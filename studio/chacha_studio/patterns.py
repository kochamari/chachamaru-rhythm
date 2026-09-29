"""Chart drafts built bar by bar (generator v6 and v7, the default).

The notes are still the song's strongest attacks on its beat grid, as in the
drafts players liked (v2 and v5): the singing and the melody as much as the
drums, with more notes where the song is busy. v5 picked them one by one; in
a busy, fast song that gave rhythms nobody could read (an off-beat on its
own here, a pair of sixteenths 77 ms apart there, every bar different). v6
chooses each bar's rhythm as a whole, the way a person writes a chart:

- A rhythm is worth the strength of its notes, less a cost for each note
  (one cost for the whole song, which sets the density) and a cost for what
  makes it hard to read: an off-beat on its own (no note on its beat, on the
  beat before or on the beat after), and on hard a sixteenth. Both cost more
  the faster the song.
- Sixteenths only on hard, only as a group that starts on an eighth (ドコ,
  ドコドン, three at most), and only when they are at least 90 ms apart (up to
  166 BPM). Runs of eighths are shorter in fast songs.
- Playing the rhythm of the bar before, or of the bar two before (a sung
  phrase and its answer), is worth a little: a bar changes when the song
  does, not at every small difference (the last bar of a phrase more freely).
- Every bar with music gets a few notes; notes go only where the bar (and
  most of its repeats) has an attack.
- One ladder: normal first (beats and eighths), hard adds notes to each bar
  of normal, easy keeps some of normal's beats (leaning to beats 1 and 3);
  each note keeps its colour.
- A passage that comes back plays the same (the second verse as the first).
- Colours bar by bar: a rhythm keeps its colours from one bar to the next
  unless the sound clearly changes (see COLOUR). Large notes and rolls as in
  v5 (ladder.py).

v7: when the song's parts are separated (stems.py), the attacks are heard
part by part: the singing leads (its soft, quick syllables measured against
the strongest nearby; how closely depends on the tempo, see FOLLOW), and the
other instruments and the drums carry the bars where no one sings; colours
and fills use the drum part alone.

It is a draft for editing, not a transcription.
"""
from functools import lru_cache

import numpy as np
from scipy.ndimage import maximum_filter1d

from .generator import POSITION_WEIGHT, _bar_chroma, _repeat_groups, _sample, candidates, detect_swing, downbeat_phase
from .ladder import KA_EASY, KA_HARD, KA_NORMAL, LARGE_SHARE, _fill_rolls

DENSITY = {'easy': 1.15, 'normal': 2.25, 'hard': 3.3}  # notes per second of music
GAP = {'easy': 180, 'normal': 105, 'hard': 75}  # least ms between notes
FLOOR = {'easy': .15, 'normal': .15, 'hard': .11}  # least attack strength for a note (off-beats 1.25x)
SIXTEENTH_MS = 90  # hard's sixteenths only when at least this far apart
QUICK = 3  # most notes in a row at sixteenth spacing
# Costs, in units of the song's cost per note, at 160 BPM (scaled with the tempo).
LONE = {'normal': .5, 'hard': .3}  # an off-beat on its own
SIXTEENTH = .3  # a sixteenth (hard)
REPEAT = (.1, .3)  # worth of playing the rhythm of the bar before / two before
PHRASE_END = .5  # ...at the last bar of a four-bar phrase: half (a fill may break the pattern)
CHOICES = 10  # rhythms a bar considers (its best ones, and its neighbours')
# With the song's parts separated (stems.py): how much each part's attacks
# count. The singing leads; where no one sings the other instruments carry
# the tune (a riff, a solo); the drums (with their hi-hat) support. The
# singing's attacks are measured half against the strongest one within 2 s
# (quick, even singing has soft attacks).
PARTS = {'singing': 1.2, 'drums': .6, 'hat': .6, 'other': .7, 'lead': 1.0, 'nearby': .5, 'window_s': 2.0}
# How closely the rhythm follows the singing: in songs up to 140 BPM the drums
# count less while someone sings and an off-beat (an 'and') more; from 200
# BPM, where off-beats are hard to read, the beat leads (in between, a mix).
FOLLOW = {'slow_bpm': 140, 'fast_bpm': 200, 'drums_sung': (.4, .6), 'and': (.85, .72)}
EASY_STRONG = 1.15  # easy leans to beats 1 and 3 (a steady half-note pulse)
EASY_KA = 1.15  # and a little to normal's ka, so it has both colours
FOLD = .8  # a sixteenth's attack at the eighth next to it (for rhythms without sixteenths)
# Every bar with music gets at least this many notes where it can (an
# interlude of drums alone is no rest), each missing one costing this many
# notes' worth.
LEAST = {'easy': 1, 'normal': 2, 'hard': 3, 'short': 1.5}
# Colour: a note's leaning to ka (the snare over the bass drum, a brighter
# sound, and where it falls: the backbeat and the 'and' lean to ka, beat 3
# to don, beat 1 is always don). Decided bar by bar: a repeat plays its first
# time's colours, and a bar with the rhythm of the bar before keeps its
# colours unless a note's leaning moves past the threshold by 'change'. One
# threshold for the whole song ('ka_at', moved to keep the share of ka within
# 'least' and the KA_ caps).
COLOUR = {'bright': .3, 'backbeat': .15, 'and': .1, 'three': -.1, 'ka_at': .1, 'change': .25, 'least': {'normal': .18, 'hard': .18}}
LAST = {}  # the latest draft's repeat groups (for inspection)


def _layout(per_beat):
    """Level of each slot of a bar (0 beat, 1 eighth or swung 'and', 2
    sixteenth or triplet) and the slot of its beat."""
    level = [0, 2, 1, 2] if per_beat == 4 else [0, 2, 1]
    width = 4 * per_beat
    return np.array([level[k % per_beat] for k in range(width)]), np.array([k - k % per_beat for k in range(width)])


def _runs(positions, spacing):
    """(longest, first, last) run of notes at most `spacing` slots apart."""
    if not len(positions):
        return 0, 0, 0
    best = run = 1
    lead = None
    for a, b in zip(positions, positions[1:]):
        if b - a <= spacing:
            run += 1
        else:
            lead = run if lead is None else lead
            run = 1
        best = max(best, run)
    return best, run if lead is None else lead, run


@lru_cache(maxsize=16)
def _table(per_beat, allowed, run8, run16):
    """Every rhythm of a bar over the `allowed` slots (a bitmask) that keeps
    to the rules inside the bar, with what the costs and the joins between
    bars need."""
    level, beat_slot = _layout(per_beat)
    width = len(level)
    slots = [k for k in range(width) if allowed >> k & 1]
    bits = np.zeros(1 << len(slots), dtype=np.int64)
    for i, k in enumerate(slots):
        bits |= ((np.arange(1 << len(slots)) >> i) & 1).astype(np.int64) << k
    mask = ((bits[:, None] >> np.arange(width)[None, :]) & 1).astype(bool)
    ok = np.ones(len(bits), bool)
    for k in range(width):
        if level[k] == 2:  # a sixteenth needs the note before it (a group from an eighth)
            ok &= ~mask[:, k] | mask[:, k - 1]
    lone = np.zeros(len(bits), int)
    for k in range(width):
        if level[k] == 1:
            b = beat_slot[k]
            near = mask[:, b].copy()
            if b >= per_beat:
                near |= mask[:, b - per_beat]
            if b + per_beat < width:
                near |= mask[:, b + per_beat]
            lone += (mask[:, k] & ~near).astype(int)
    six = mask[:, level == 2].sum(axis=1)
    eighth = 2
    pos = [np.nonzero(r)[0] for r in mask]
    r8 = np.array([_runs(p, eighth) for p in pos]).reshape(-1, 3)
    r16 = np.array([_runs(p, 1) for p in pos]).reshape(-1, 3)
    ok &= r8[:, 0] <= run8
    ok &= (six == 0) | (r16[:, 0] <= run16)
    first = np.array([p[0] if len(p) else -1 for p in pos])
    last = np.array([p[-1] if len(p) else -1 for p in pos])
    keep = np.nonzero(ok)[0]
    return {'bits': bits[keep], 'mask': mask[keep], 'n': mask[keep].sum(axis=1), 'lone': lone[keep], 'six': six[keep],
            'r8': r8[keep], 'r16': r16[keep], 'first': first[keep], 'last': last[keep], 'width': width, 'run8': run8, 'run16': run16}


def _joins(T):
    """Whether rhythm a (a bar) may be followed by rhythm b (the next bar):
    runs across the bar line keep to the limits."""
    width = T['width']

    def ok(a, b):
        la, fb = T['last'][a][:, None], T['first'][b][None, :]
        gap = np.where((la >= 0) & (fb >= 0), width - la + fb, 99)
        run8 = T['r8'][a][:, 2][:, None] + T['r8'][b][:, 1][None, :]
        run16 = T['r16'][a][:, 2][:, None] + T['r16'][b][:, 1][None, :]
        return ~((gap <= 2) & (run8 > T['run8'])) & ~((gap == 1) & (run16 > T['run16']))
    return ok


def _choose(cands, values, bits, count, again1, again2, joins):
    """The rhythm of each bar (indices into the table) that is worth most in
    all: its value, plus again1 for the rhythm of the bar before and again2
    for that of the bar two before (non-empty rhythms; per bar), over allowed
    joins."""
    nb = len(cands)
    again1, again2 = np.broadcast_to(again1, nb), np.broadcast_to(again2, nb)
    if nb == 1:
        return [cands[0][int(np.argmax(values[0]))]]

    def same(a, b):
        return ((bits[a][:, None] == bits[b][None, :]) & (count[b] > 0)[None, :]).astype(float)
    D = [None] * nb
    back = [None] * nb
    D[1] = values[0][:, None] + values[1][None, :] + again1[1] * same(cands[0], cands[1])
    D[1] = np.where(joins(cands[0], cands[1]), D[1], -np.inf)
    for b in range(2, nb):
        ca, cb, cc = cands[b - 2], cands[b - 1], cands[b]
        s = D[b - 1][:, :, None] + again2[b] * same(ca, cc)[:, None, :]
        h = np.argmax(s, axis=0)
        D[b] = np.take_along_axis(s, h[None], axis=0)[0] + values[b][None, :] + again1[b] * same(cb, cc)
        D[b] = np.where(joins(cb, cc), D[b], -np.inf)
        back[b] = h
    i, j = np.unravel_index(int(np.argmax(D[nb - 1])), D[nb - 1].shape)
    path = [0] * nb
    path[nb - 1], path[nb - 2] = cands[nb - 1][j], cands[nb - 2][i]
    for b in range(nb - 1, 1, -1):
        h = back[b][i, j]
        path[b - 2] = cands[b - 2][h]
        i, j = h, i
    return path


def song_patterns(beats, duration, sections, features, downbeats):
    """Tap lists per difficulty ({'t', 'color', 'size'}), and the rolls as
    (start ms, end ms) pairs, or None when the song has no drum fill."""
    from .drums import usable, _sampler
    rate = features.get('rate', 50)
    low, high, full = (np.asarray(features[k], dtype=float) / 255 for k in ('low', 'high', 'full'))
    kit = features.get('drums') if usable(features.get('drums')) else None
    phase = downbeats[0] % 4 if downbeats else downbeat_phase(beats, low, rate)
    beat_len = np.diff(beats)
    median_beat = float(np.median(beat_len))
    swing = detect_swing(beats, full, rate)
    slow = float(np.clip((60000 / median_beat - FOLLOW['slow_bpm']) / (FOLLOW['fast_bpm'] - FOLLOW['slow_bpm']), 0, 1))
    follow = lambda k: FOLLOW[k][0] + (FOLLOW[k][1] - FOLLOW[k][0]) * slow  # noqa: E731
    per_beat = 3 if swing else 4
    level_of, _ = _layout(per_beat)
    width = len(level_of)
    fine = candidates(beats, phase, 4, swing)
    t = np.array([c[0] for c in fine], dtype=float)
    rel = np.array([c[2] for c in fine]) - phase
    bar = rel // 4
    first_bar = int(bar.min())
    bar = bar - first_bar
    slot = (rel % 4) * per_beat + np.round(np.array([c[3] for c in fine]) * per_beat).astype(int)
    nb = int(bar.max()) + 1
    valid = (t >= 800) & (t <= duration - 300)
    where = {(int(b), int(s)): i for i, (b, s) in enumerate(zip(bar, slot))}

    def grid(values):
        m = np.zeros((nb, width))
        m[bar, slot] = np.where(valid, values, 0)
        return m
    sample = lambda env: np.array([_sample(env, rate, x) for x in t])  # noqa: E731
    F, L, H = grid(sample(full)), grid(sample(low)), grid(sample(high))
    if kit:
        at = lambda k: _sampler(kit[k], kit['rate'], 25)(t)  # noqa: E731
        M, K, S = grid(at('melody')), grid(at('kick')), grid(at('snare'))
    else:
        M = K = S = np.zeros((nb, width))

    # Passages that come back: groups of bars that play as one.
    rhythm = np.concatenate([2 * M, F], axis=1) if kit else F
    harmony = _bar_chroma(kit, beats, phase, nb) if kit and 'chroma' in kit else None
    group = _repeat_groups(rhythm, harmony)
    # Phrases of four bars start where the music changes most often; the last
    # bar of a phrase may leave the rhythm it repeated (a fill, the end of a
    # sung line) if its sound asks for it.
    look = rhythm if harmony is None else np.concatenate([rhythm / (np.linalg.norm(rhythm, axis=1, keepdims=True) + 1e-9), harmony / (np.linalg.norm(harmony, axis=1, keepdims=True) + 1e-9)], axis=1)
    look = look - look.mean(axis=0, keepdims=True)
    look = look / (np.linalg.norm(look, axis=1, keepdims=True) + 1e-9)
    change = np.r_[0.0, 1 - np.sum(look[1:] * look[:-1], axis=1)]
    start = int(np.argmax([change[o::4].mean() if len(change[o::4]) else 0 for o in range(4)]))
    keep = np.where((np.arange(nb) - start) % 4 == 3, PHRASE_END, 1.0)
    LAST.update(group=group, first_bar=first_bar, phrase=start)
    same = (group[:, None] == group[None, :]).astype(float)
    share = lambda m: (same @ m) / same.sum(axis=1, keepdims=True)  # noqa: E731
    from .stems import usable as parts_usable
    parts = features.get('stems') if kit and parts_usable(features.get('stems')) else None
    if parts:
        # The parts heard apart (see PARTS).
        part = lambda k: grid(_sampler(parts[k], parts['rate'], 25)(t))  # noqa: E731
        raw = np.asarray(parts['vocal'], dtype=float) / 255
        singing = np.asarray(parts['voice'], dtype=float) / 255 > .15
        nearby = raw / np.maximum(maximum_filter1d(raw, size=max(1, int(parts['rate'] * PARTS['window_s']))), .15)
        nearby = np.minimum(nearby, 1.0) * singing
        V = (1 - PARTS['nearby']) * part('vocal') + PARTS['nearby'] * grid(_sampler(np.round(nearby * 255), parts['rate'], 25)(t))
        D = np.maximum(part('drums'), PARTS['hat'] * part('hat'))
        sung = grid(_sampler(np.round(singing * 255.0), parts['rate'], 60)(t)) > .5
        other = np.where(sung, PARTS['other'], PARTS['lead']) * part('other')
        heard = np.maximum(np.maximum(np.where(sung, follow('drums_sung'), PARTS['drums']) * D, PARTS['singing'] * V), other)
        K, S = part('kick'), part('snare')  # the drum part alone: clearer for colours and fills
    else:
        heard = np.maximum(F, .85 * M) if kit else F  # each bar's own attacks
    Ls, Hs, Ks, Ss = share(L), share(H), share(K), share(S)
    salient = share(heard)
    weight = np.array([follow('and') if parts and x == 1 else POSITION_WEIGHT[int(x)] for x in level_of]) * np.where(np.arange(width) == 0, 1.12, 1.0)
    value = salient * weight[None, :]
    # Without sixteenths a quick syllable counts at the eighth or beat next to
    # it, as a person simplifying the rhythm would write it.
    folded = value.copy()
    for k in range(width):
        if level_of[k] <= 1:
            near = [j for j in (k - 1, k + 1) if 0 <= j < width and level_of[j] == 2]
            if near:
                folded[:, k] = np.maximum(value[:, k], FOLD * salient[:, near].max(axis=1) * weight[k])
    busy = maximum_filter1d(full, size=max(1, int(rate * 2))) > .08
    active = max(float(np.count_nonzero(busy)) / rate, 1.0)
    tempo = float(np.clip((60000 / median_beat - 80) / 80, .25, 1.5))
    eighth_ms = median_beat / 2
    sixteenth_ms = median_beat / per_beat

    def slots_open(floor):
        """Per bar, the slots (bitmask) where a note may go: inside the song and
        on an attack of the bar and its repeats together, heard in most of
        them (a rhythm shared with its repeats never puts a note where the
        bar has nothing, and the repeats keep playing alike)."""
        need = floor * np.where(level_of == 0, 1.0, 1.25)
        heard_in = share((heard >= .5 * need[None, :]).astype(float))
        out = np.zeros(nb, dtype=np.int64)
        for i in np.nonzero(valid)[0]:
            b, k = bar[i], slot[i]
            if salient[b, k] >= need[k] and heard_in[b, k] > .5:
                out[b] |= np.int64(1) << int(k)
        return out

    def as_group(chosen, cost, open_bits):
        """Every bar of a group plays the members' rhythm that is worth most
        to all of them."""
        out = chosen.copy()
        for g in np.unique(group):
            members = np.nonzero(group == g)[0]
            options = np.unique(chosen[members])
            if len(members) < 2 or len(options) < 2:
                continue

            def worth(x):
                m = ((int(x) >> np.arange(width)) & 1).astype(float)
                return float((value[members] - cost).sum(axis=0) @ m)
            best = max(options, key=lambda x: (worth(x), -int(x)))
            out[members] = best & open_bits[members]
        return out

    def solve(T, target, fits, lone, sixteenth, floor, lean=None, least=0, values=None):
        """Each bar's rhythm (bitmask), the cost per note set for `target`
        notes; fits(bits) -> (bars, rhythms) bool."""
        open_bits = slots_open(floor)
        allowed = ((T['bits'][None, :] & ~open_bits[:, None]) == 0) & fits(T['bits'])
        own = value if values is None else values
        base = (own if lean is None else own * (lean if lean.ndim == 2 else lean[None, :])) @ T['mask'].T.astype(float)
        joins = _joins(T)

        reach = np.where(allowed, T['n'][None, :], 0).max(axis=1)
        short = np.maximum(0, np.minimum(least, reach)[:, None] - T['n'][None, :])

        def run(cost):
            V = base - cost * (T['n'] + lone * T['lone'] + sixteenth * T['six'])[None, :] - LEAST['short'] * cost * short
            V = np.where(allowed, V, -np.inf)
            own = np.argmax(V, axis=1)
            cands = []
            for b in range(nb):
                k = min(CHOICES, int(np.isfinite(V[b]).sum()))
                top = np.argpartition(-V[b], k - 1)[:k] if k else np.zeros(0, int)
                near = [own[x] for x in range(max(0, b - 2), min(nb, b + 3)) if np.isfinite(V[b, own[x]])]
                cands.append(np.unique(np.concatenate([top, np.array(near, dtype=int)])))
            path = _choose(cands, [V[b, cands[b]] for b in range(nb)], T['bits'], T['n'], REPEAT[0] * cost * keep, REPEAT[1] * cost * keep, joins)
            return T['bits'][path]
        lo, hi, best = 0.0, float(value.max()) + 1, None
        for _ in range(16):
            cost = (lo + hi) / 2
            got = run(cost)
            n = sum(bin(int(x)).count('1') for x in got)
            if best is None or abs(n - target) < abs(best[1] - target):
                best = (got, n, cost)
            lo, hi = (cost, hi) if n > target else (lo, cost)
        return as_group(best[0], best[2], open_bits)

    def bits_of(b):
        return np.array([(int(x) >> np.arange(width)) & 1 for x in b], dtype=bool) if len(b) else np.zeros((0, width), bool)

    everything = int(sum(1 << k for k in range(width)))
    straight = int(sum(1 << k for k in range(width) if level_of[k] <= 1))
    on_beats = int(sum(1 << k for k in range(width) if level_of[k] == 0))
    run8_normal = 5 if eighth_ms >= 180 else (4 if eighth_ms >= 150 else 3)
    T = _table(per_beat, straight, run8_normal, QUICK)
    normal_bits = solve(T, max(8, int(DENSITY['normal'] * active)), lambda x: np.ones((nb, len(x)), bool), LONE['normal'] * tempo, 0.0, FLOOR['normal'], least=LEAST['normal'], values=folded)
    quick_ok = sixteenth_ms >= SIXTEENTH_MS
    T = _table(per_beat, everything if quick_ok else straight, 8 if eighth_ms < 180 else 16, QUICK)
    hard_bits = solve(T, max(int(DENSITY['hard'] * active), 1), lambda x: (x[None, :] & normal_bits[:, None]) == normal_bits[:, None], LONE['hard'] * tempo, SIXTEENTH * tempo, FLOOR['hard'], least=LEAST['hard'], values=None if quick_ok else folded) | normal_bits

    def notes(chosen):
        m = bits_of(chosen)
        return {where[(b, k)] for b, k in zip(*np.nonzero(m)) if (b, k) in where and valid[where[(b, k)]]}
    normal, hard = notes(normal_bits), notes(hard_bits)
    # The joins of repeated passages (as_group) can make a run too long: drop
    # its last note (normal's drops leave easy too).
    normal = _limit(normal, t, GAP['normal'], eighth_ms * 1.1, run8_normal)
    hard = _limit(hard | normal, t, GAP['hard'], eighth_ms * 1.1, 8 if eighth_ms < 180 else 16, keep=normal)

    # Colour: decided on normal (easy keeps it, with no more than its share
    # of ka: its weakest ka beats go); hard colours its extra notes the same
    # way. A group of sixteenths (ドコ, ドコドン) takes its first note's colour.
    beat_of = np.arange(width) // per_beat

    def leaning(i):
        return lean_at(bar[i], slot[i])

    def lean_at(b, k):
        drum = float(np.clip(Ss[b, k] - Ks[b, k], -1, 1))
        bright = Hs[b, k] / (Hs[b, k] + Ls[b, k] + 1e-6) - .5
        place = 0.0
        if level_of[k] == 0 and beat_of[k] in (1, 3):
            place = COLOUR['backbeat']
        elif level_of[k] == 0 and beat_of[k] == 2:
            place = COLOUR['three']
        elif level_of[k] == 1:
            place = COLOUR['and']
        return drum + COLOUR['bright'] * bright + place

    def paint(chosen, fixed, least, most):
        """Colours of `chosen` (notes in `fixed` keep theirs), bar by bar: a
        repeat plays the colours of its first time; a bar with the rhythm of
        the bar before (or two before) keeps its colours unless the sound
        clearly changes (a snare coming in); otherwise each note leans to ka
        or don by its sound. One threshold for the whole song keeps the share
        of ka between `least` and `most`."""
        rhythm, members = {}, {}
        for i in chosen:
            b = int(bar[i])
            rhythm.setdefault(b, set()).add(int(slot[i]))
            members.setdefault(b, []).append(i)
        rhythm = {b: frozenset(v) for b, v in rhythm.items()}
        first_of = {}
        for b in sorted(rhythm):
            first_of.setdefault(int(group[b]), b)

        def colours(at):
            out = dict(fixed)
            by_bar = {}
            for b in sorted(rhythm):
                mine = {}
                source = first_of[int(group[b])]
                earlier = next((b - d for d in (1, 2) if rhythm.get(b - d) == rhythm[b] and b - d in by_bar), None)
                held = {int(slot[i]): fixed[i] for i in members[b] if i in fixed}
                for k in rhythm[b]:
                    lean = lean_at(b, k)
                    if k in held:
                        mine[k] = held[k]  # normal's colour, kept on hard
                    elif source != b and rhythm.get(source) == rhythm[b]:
                        mine[k] = by_bar[source][k]  # a repeat: as the first time
                    elif k == 0:
                        mine[k] = 'don'
                    elif earlier is not None:
                        before = by_bar[earlier][k]
                        change = lean > at + COLOUR['change'] if before == 'don' else lean < at - COLOUR['change']
                        mine[k] = ('ka' if before == 'don' else 'don') if change else before
                    else:
                        mine[k] = 'ka' if lean > at else 'don'
                by_bar[b] = mine
                for i in members[b]:
                    if i not in fixed:
                        out[i] = mine[int(slot[i])]
            # A group of sixteenths takes its first note's colour.
            order = sorted(chosen, key=lambda i: t[i])
            for a, b in zip(order, order[1:]):
                if b not in fixed and t[b] - t[a] <= sixteenth_ms * 1.25 and (level_of[slot[b]] == 2 or level_of[slot[a]] == 2):
                    out[b] = out[a]
            return out

        def share_ka(out):
            return sum(out[i] == 'ka' for i in chosen) / max(1, len(chosen))
        at = COLOUR['ka_at']
        out = colours(at)
        lo, hi = -1.0, 1.5
        if share_ka(out) > most:
            lo = at
        elif share_ka(out) < least:
            hi = at
        else:
            return out
        for _ in range(20):  # the threshold that brings the share of ka within bounds
            at = (lo + hi) / 2
            out = colours(at)
            if share_ka(out) > most:
                lo = at
            elif share_ka(out) < least:
                hi = at
            else:
                break
        if share_ka(out) > most:
            out = colours(hi)
        if fixed:
            # An added note takes the colour its place has in a neighbouring
            # bar of the same rhythm where normal plays it (same rhythm, same
            # colours on hard too).
            at_slot = {(int(bar[i]), int(slot[i])): i for i in chosen}
            for i in sorted(chosen, key=lambda i: t[i]):
                if i in fixed:
                    continue
                b, k = int(bar[i]), int(slot[i])
                for d in (-1, 1, -2, 2):
                    j = at_slot.get((b + d, k))
                    if j is not None and j in fixed and rhythm.get(b + d) == rhythm[b]:
                        out[i] = fixed[j]
                        break
        return out
    colour = paint(normal, {}, COLOUR['least']['normal'], KA_NORMAL * .95)  # (rolls may take a few notes later)
    # Easy: some of normal's beats, leaning to beats 1 and 3 and a little to
    # normal's ka, so easy has both colours.
    T = _table(per_beat, on_beats, 16, QUICK)
    lean = np.tile(np.where(np.arange(width) % (2 * per_beat) == 0, EASY_STRONG, 1.0), (nb, 1))
    for i in normal:
        if colour[i] == 'ka':
            lean[bar[i], slot[i]] *= EASY_KA
    easy_target = max(4, int(DENSITY['easy'] * active))
    easy_room = normal_bits.copy()  # normal's beats easy may take

    def easy_notes():
        chosen = solve(T, easy_target, lambda x: (x[None, :] & ~easy_room[:, None]) == 0, 0.0, 0.0, FLOOR['easy'], lean, least=LEAST['easy'])
        return notes(chosen) & normal
    easy = easy_notes()
    def easy_cap(easy):
        """Easy's weakest ka beats go (with their repeats) until it has no more
        than its share of ka; returns the notes and the places that went."""
        easy_ka = sorted((i for i in easy if colour[i] == 'ka'), key=lambda i: (value[bar[i], slot[i]], t[i]))
        gone = set()
        while easy_ka and len(easy_ka) > len(easy) * KA_EASY:
            i = easy_ka.pop(0)
            drop = {j for j in easy_ka + [i] if group[bar[j]] == group[bar[i]] and slot[j] == slot[i]}
            easy = easy - drop
            gone |= drop
            easy_ka = [j for j in easy_ka if j not in drop]
        return easy, gone
    easy, gone = easy_cap(easy)
    if gone and len(easy) < .95 * easy_target:
        # Choose again without those ka beats, so don beats take their place.
        for i in gone:
            easy_room[bar[i]] &= ~(np.int64(1) << int(slot[i]))
        easy, _ = easy_cap(easy_notes())
    colour = paint(hard, {i: colour[i] for i in normal}, COLOUR['least']['hard'], KA_HARD)

    # Large notes where the song starts something, the same in every difficulty.
    score = value[bar, slot]
    normal_order = sorted(normal, key=lambda i: t[i])
    chorus = [s['startMs'] for s in (sections or []) if s.get('kind') == 'chorus']
    starts = []
    for n, i in enumerate(normal_order):
        prev_gap = t[i] - t[normal_order[n - 1]] if n else 1e9
        if slot[i] == 0 and (prev_gap >= 2 * median_beat or any(abs(t[i] - c) <= median_beat / 2 for c in chorus)):
            starts.append(i)
    room = max(1, int(len(normal_order) * LARGE_SHARE))
    large = set()
    for i in sorted(starts, key=lambda i: (-score[i], t[i])):
        members = [where.get((int(j), int(slot[i]))) for j in np.nonzero(group == group[bar[i]])[0]]
        members = [m for m in members if m is not None and m in normal]
        if len(large) + len(members) <= room:
            large.update(members)
    rolls = _fill_rolls(K, S, valid, t, bar, slot, where, beats, phase, per_beat, first_bar, duration, median_beat) if kit and not swing else None

    def taps(chosen):
        order = sorted(chosen, key=lambda i: t[i])
        end = order[-1] if order else None  # every difficulty ends on a large note
        return [{'t': int(round(t[i])), 'color': colour[i], 'size': 'large' if i in large or i == end else 'normal'} for i in order]
    return {'easy': taps(easy), 'normal': taps(normal), 'hard': taps(hard), 'rolls': rolls}


def _limit(chosen, t, gap, quick_ms, run_limit, keep=frozenset()):
    """Notes that keep the least gap and the longest run at eighth spacing or
    faster; a note that breaks them goes (never one of `keep`)."""
    out = []
    run = 0
    for i in sorted(chosen, key=lambda i: t[i]):
        if out and (t[i] - t[out[-1]] < gap or (t[i] - t[out[-1]] <= quick_ms and run >= run_limit)) and i not in keep:
            continue
        run = run + 1 if out and t[i] - t[out[-1]] <= quick_ms else 1
        out.append(i)
    return set(out)
