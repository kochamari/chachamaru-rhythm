"""Chart drafts for all three difficulties at once (generator v5, the default).

The notes are the song's strongest attacks on its own beat grid, as in the
drafts players liked (v2): what you hear, the singing and the melody as much
as the drums, with more notes where the song is busy. On top of that the
draft is shaped the way hand-made charts are:

- One ladder: normal takes the strongest attacks on beats and eighths; hard
  is normal plus the next strongest (sixteenths only as pairs or triples,
  never a lone one); easy is normal's strongest beats. Each note keeps the
  same colour in every difficulty, so what is learnt on easy still holds on
  hard.
- A passage that comes back plays the same way (the second verse as the
  first, every chorus alike), so it can be learnt by repeating it
  (generator._repeat_groups); within a passage the rhythm follows the song.
- Colour: brighter attacks and the snare are ka, a bar's first beat is don,
  and a quick run of four or more sixteenths keeps one colour.
- Large notes where the song starts something: a chorus, the return after a
  rest, the last note. Rolls where the drums play a fill (a run of sixteenths
  over two beats or more); songs without such fills get one leading into a
  chorus, as before.

It is a draft for editing, not a transcription.
"""
import bisect

import numpy as np

from .generator import POSITION_WEIGHT, _bar_chroma, _enforce, _repeat_groups, _sample, candidates, detect_swing, downbeat_phase

RULES = {
    # density: notes per second of music; gap: least ms between notes;
    # run: most notes in a row at half-beat spacing; floor: least attack
    # strength (off-beats need 1.25x); quick: most notes in a row at
    # sixteenth spacing
    'easy': {'density': 1.15, 'gap': 180},
    'normal': {'density': 2.25, 'gap': 105, 'run': 5, 'floor': .15},
    'hard': {'density': 3.3, 'gap': 75, 'floor': .11, 'quick': 3},
}
KA_EASY, KA_NORMAL, KA_HARD = .2, .3, .32  # the most ka (share of notes) per difficulty
LARGE_SHARE = .04
LAST = {}  # the latest ladder's repeat groups (for inspection)


def song_ladder(beats, duration, sections, features, downbeats):
    """Tap lists per difficulty ({'t', 'color', 'size'}), and the rolls as
    (start ms, end ms) pairs, or None when the song has no drum fill."""
    from .drums import usable, _sampler
    rate = features.get('rate', 50)
    low, high, full = (np.asarray(features[k], dtype=float) / 255 for k in ('low', 'high', 'full'))
    kit = features.get('drums') if usable(features.get('drums')) else None
    phase = downbeats[0] % 4 if downbeats else downbeat_phase(beats, low, rate)
    beat_len = np.diff(beats)
    median_beat = float(np.median(beat_len))
    sixteenth = median_beat / 4

    swing = detect_swing(beats, full, rate)
    per_beat = 3 if swing else 4
    fine = candidates(beats, phase, 4, swing)
    t = np.array([c[0] for c in fine], dtype=float)
    level = np.array([c[1] for c in fine])
    rel = np.array([c[2] for c in fine]) - phase
    bar = rel // 4
    first_bar = int(bar.min())
    bar = bar - first_bar
    slot = (rel % 4) * per_beat + np.round(np.array([c[3] for c in fine]) * per_beat).astype(int)
    nb, width = int(bar.max()) + 1, 4 * per_beat
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
    LAST.update(group=group, first_bar=first_bar)
    same = (group[:, None] == group[None, :]).astype(float)
    share = lambda m: (same @ m) / same.sum(axis=1, keepdims=True)  # noqa: E731
    Fs, Ls, Hs, Ks, Ss = share(F), share(L), share(H), share(K), share(S)
    # What stands out: the whole band, or the singing and the melody.
    salient = share(np.maximum(F, .85 * M)) if kit else Fs
    score = salient[bar, slot] * np.array([POSITION_WEIGHT[int(x)] for x in level]) * np.where(slot == 0, 1.12, 1.0)
    strength = Fs[bar, slot]
    from scipy.ndimage import maximum_filter1d
    busy = maximum_filter1d(full, size=max(1, int(rate * 2))) > .08
    active = max(float(np.count_nonzero(busy)) / rate, 1.0)

    def half_beat(x):
        i = min(max(int(np.searchsorted(beats, x, side='right')) - 1, 0), len(beat_len) - 1)
        return float(beat_len[i]) / 2

    def as_notes(idx):
        return [{'t': float(t[i]), 'level': int(level[i]), 'bar': int(bar[i]), 'slot': int(slot[i]), 'down': bool(slot[i] == 0),
                 'score': float(score[i]), 'i': int(i)} for i in sorted(idx, key=lambda i: t[i])]

    def by_group(idx, allowed):
        """Every bar of a group plays what its bars mostly play (in `allowed` slots)."""
        chosen = np.zeros((nb, width), dtype=bool)
        for i in idx:
            chosen[bar[i], slot[i]] = True
        out = set()
        for g in np.unique(group):
            members = np.nonzero(group == g)[0]
            usual = chosen[members].mean(axis=0) >= .5 if len(members) > 1 else chosen[members[0]]
            for j in members:
                for s in np.nonzero(usual)[0]:
                    i = where.get((int(j), int(s)))
                    if i is not None and allowed[i]:
                        out.add(i)
        return out

    def spaced(idx, gap):
        kept = []
        for i in sorted(idx, key=lambda i: t[i]):
            if kept and t[i] - t[kept[-1]] < gap:
                continue
            kept.append(i)
        return set(kept)

    # Normal: the strongest attacks on beats and eighths, up to its density.
    r = RULES['normal']
    ok_normal = valid & (level <= 1) & (strength >= r['floor'] * np.where(level == 0, 1.0, 1.25))
    pick = sorted(np.nonzero(ok_normal)[0], key=lambda i: (-score[i], t[i]))[:max(8, int(r['density'] * active))]
    normal = {n['i'] for n in _enforce(as_notes(pick), r['gap'], r['run'], half_beat)}
    normal = spaced(by_group(normal, ok_normal), r['gap'])

    # Hard: normal plus the next strongest, a sixteenth only next to another note.
    r = RULES['hard']
    ok_hard = valid & (strength >= r['floor'] * np.where(level == 0, 1.0, 1.25))
    quick = sixteenth * 1.25

    def fits(i, chosen, times):
        k = bisect.bisect_left(times, t[i])
        prev = times[k - 1] if k else None
        nxt = times[k] if k < len(times) else None
        if (prev is not None and t[i] - prev < r['gap']) or (nxt is not None and nxt - t[i] < r['gap']):
            return False
        if level[i] == 2 and not ((prev is not None and t[i] - prev <= quick) or (nxt is not None and nxt - t[i] <= quick)):
            return False
        run = 1
        j = k - 1
        while j >= 0 and (times[j + 1] if j + 1 < k else t[i]) - times[j] <= quick:
            run += 1
            j -= 1
        j = k
        last = t[i]
        while j < len(times) and times[j] - last <= quick:
            run += 1
            last = times[j]
            j += 1
        return run <= r['quick']

    def grow(base, pool, target):
        chosen = set(base)
        times = sorted(t[i] for i in chosen)
        for i in pool:
            if len(chosen) >= target:
                break
            if i in chosen or not fits(i, chosen, times):
                continue
            chosen.add(i)
            bisect.insort(times, t[i])
        return chosen
    pool = sorted(np.nonzero(ok_hard)[0], key=lambda i: (-score[i], t[i]))
    target = max(len(normal), int(r['density'] * active))
    hard = grow(normal, pool, target)
    # Repeats play alike (the extra notes by the group's majority), then the
    # extras are checked again against the spacing rules.
    extras = by_group(hard - normal, ok_hard) - normal
    hard = grow(normal, sorted(extras, key=lambda i: (-score[i], t[i])), len(normal) + len(extras))

    # Colour, decided on normal: easy keeps it, and hard keeps it for normal's
    # notes and colours only its extra notes (mostly quick dons, as in
    # hand-made charts, where hard has a little less ka than normal).
    key = {i: Hs[bar[i], slot[i]] / (Hs[bar[i], slot[i]] + Ls[bar[i], slot[i]] + 1e-6)
           + .35 * float(np.clip(Ss[bar[i], slot[i]] - Ks[bar[i], slot[i]], 0, 1)) for i in hard}

    def paint(notes, budget):
        together = {}
        for i in sorted(notes, key=lambda i: t[i]):
            together.setdefault((int(group[bar[i]]), int(slot[i])), []).append(i)
        ka = set()
        for k in sorted(together, key=lambda k: (-key[together[k][0]], k)):
            members = together[k]
            if key[members[0]] <= .3:
                break
            if k[1] == 0 or len(ka) + len(members) > budget:
                continue
            ka.update(members)
        return ka
    ka = paint(normal, int(len(normal) * KA_NORMAL * .95))  # (rolls may take a few notes later)
    # Easy: normal's strongest beats, its ka a little favoured so easy has
    # both colours (a song's loudest beats are usually the bass drum's), but
    # no more than easy's share of ka (colours stay as on normal).
    r = RULES['easy']
    beats_in_normal = [i for i in normal if level[i] == 0]
    want = max(4, int(r['density'] * active))
    pick, kas = [], 0
    for i in sorted(beats_in_normal, key=lambda i: (-score[i] * (1.15 if i in ka else 1.0), t[i])):
        if len(pick) >= want:
            break
        if i in ka:
            if kas >= int(want * KA_EASY * .9):
                continue
            kas += 1
        pick.append(i)
    easy = spaced(by_group(set(pick), np.isin(np.arange(len(t)), beats_in_normal)), r['gap'])
    ka |= paint(hard - normal, max(0, int(len(hard) * KA_HARD) - len(ka)))
    colour = {i: 'ka' if i in ka else 'don' for i in hard}
    # A quick run of four or more sixteenths: its extra notes take the run's
    # more common colour (normal's notes keep theirs).
    order = sorted(hard, key=lambda i: t[i])
    k = 0
    while k < len(order):
        j = k
        while j + 1 < len(order) and t[order[j + 1]] - t[order[j]] <= quick:
            j += 1
        run = order[k:j + 1]
        if len(run) >= 4:
            kas = sum(colour[i] == 'ka' for i in run)
            for i in run:
                if i not in normal:
                    colour[i] = 'ka' if kas > len(run) - kas else 'don'
        k = j + 1

    # Large notes where the song starts something, the same in every difficulty.
    normal_order = sorted(normal, key=lambda i: t[i])
    chorus = [s['startMs'] for s in (sections or []) if s.get('kind') == 'chorus']
    starts = []
    for n, i in enumerate(normal_order):
        prev_gap = t[i] - t[normal_order[n - 1]] if n else 1e9
        begins = slot[i] == 0 and (prev_gap >= 2 * median_beat or any(abs(t[i] - c) <= median_beat / 2 for c in chorus))
        if begins or n == len(normal_order) - 1:
            starts.append(i)
    room = max(1, int(len(normal_order) * LARGE_SHARE))
    large = set()
    for i in sorted(starts, key=lambda i: (-score[i], t[i])):
        members = [where.get((int(j), int(slot[i]))) for j in np.nonzero(group == group[bar[i]])[0]]
        members = [m for m in members if m is not None and m in normal]
        if len(large) + len(members) <= room:
            large.update(members)

    rolls = _fill_rolls(K, S, valid, t, bar, slot, where, beats, phase, per_beat, first_bar, duration, median_beat) if kit and not swing else None

    def taps(idx):
        order = sorted(idx, key=lambda i: t[i])
        # Every difficulty ends on a large note.
        end = order[-1] if order else None
        return [{'t': int(round(t[i])), 'color': colour[i], 'size': 'large' if i in large or i == end else 'normal'} for i in order]
    return {'easy': taps(easy), 'normal': taps(normal), 'hard': taps(hard), 'rolls': rolls}


def _fill_rolls(K, S, valid, t, bar, slot, where, beats, phase, per_beat, first_bar, duration, median_beat):
    """Where the drums play a fill: two beats or more with drum hits on (almost)
    every sixteenth. The strongest ones, at most one every 20 seconds."""
    drum = np.maximum(K, S)
    peak = drum.max(axis=1)
    live = peak[peak > 0]
    if not len(live):
        return None
    loud = float(np.percentile(live, 50))
    busy_beats = []
    for i in range(len(beats) - 1):
        rel = i - phase
        b = rel // 4 - first_bar
        if b < 0 or b >= len(drum) or peak[b] < .5 * loud:
            continue
        s0 = (rel % 4) * per_beat
        cells = drum[b, s0:s0 + per_beat] / (peak[b] + 1e-9)
        ok = all(valid[where[(b, s)]] for s in range(s0, s0 + per_beat) if (b, s) in where)
        if ok and np.count_nonzero(cells >= .45) >= per_beat - 1:
            busy_beats.append(i)
    regions = []
    k = 0
    while k < len(busy_beats):
        j = k
        while j + 1 < len(busy_beats) and busy_beats[j + 1] == busy_beats[j] + 1:
            j += 1
        first, last = busy_beats[k], busy_beats[j]
        if last - first + 1 >= 2:
            last = min(last, first + 7)
            end = beats[last] + (beats[last + 1] - beats[last]) * .75
            strength = float(np.mean([drum[(x - phase) // 4 - first_bar].max() for x in range(first, last + 1)]))
            regions.append((strength, int(beats[first]), int(end)))
        k = j + 1
    chosen = []
    for s, a, b in sorted(regions, reverse=True):
        if a < 800 or b > duration - 600 or b - a < 300:
            continue
        if all(abs(a - c) >= 20000 for c, _ in chosen):
            chosen.append((a, b))
    return sorted(chosen) or None
