"""Drum-following chart drafts (chart generator v3).

The analysis keeps onset envelopes for the parts of a drum kit
(`drum_features`): bass drum, snare, hi-hat and the whole band. The draft
puts notes where the song's drums play, on the song's own beat grid: the
bass drum becomes don and the snare (or a clap) ka.

Single bars are noisy (guitars, synths and singing leak into every band), so
each bar is judged by its typical pattern: the bar averaged with its
neighbours and with the bars anywhere in the song that sound like it. A
groove is therefore played the same way every time it comes back, while a
fill, which sounds like no other bar, keeps its own shape, and a break rests.
Easy keeps the beats, normal the beats and eighths, hard also sixteenths;
where the drums rest the draft follows the band, more sparsely.

It is a draft for editing, not a transcription of the drums.
"""
import numpy as np

VERSION = 'chacha-generator-v3'
FEATURES = 4

RULES = {
    # levels: 1 = beats only, 2 = + eighths (swing: the swung 'and'), 3 = + sixteenths (swing: triplets)
    # density: notes per second of music (fewest, most); gap: least ms between notes;
    # run: most notes in a row at the difficulty's quickest spacing; per_bar: notes added to a
    # bar with music when the chart is too sparse
    'easy': {'levels': 1, 'density': (.6, 2.0), 'gap': 180, 'run': 0, 'per_bar': 1},
    'normal': {'levels': 2, 'density': (1.1, 3.4), 'gap': 105, 'run': 7, 'per_bar': 2},
    'hard': {'levels': 3, 'density': (1.8, 4.8), 'gap': 75, 'run': 5, 'per_bar': 3},
}


def drum_features(y, sr):
    """Onset envelopes (0..255, about 100 per second) of the drum kit, from the
    percussive part of the sound (so singing and chords count far less):
    kick (35-120 Hz), snare (the drum's body at 150-300 Hz together with its
    crack at 1.2-5 kHz, minus the bass drum), hat (5-9 kHz), and full (the
    whole band, for the parts without drums) and melody (note changes in the
    harmonic part at 200-4000 Hz: mostly the singing and the lead). Also the
    harmony (chroma, 12 pitch classes about 10 times a second), which tells
    where a passage of the song comes back (a second verse, the next chorus)."""
    import librosa
    hop = int(round(sr / 100))
    power = np.abs(librosa.stft(np.asarray(y, dtype=np.float32), n_fft=1024, hop_length=hop)) ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=1024)
    harm, perc = librosa.decompose.hpss(power, kernel_size=31, margin=(1.0, 2.0))

    def flux(spec, lo, hi):
        band = spec[(freqs >= lo) & (freqs < hi)].sum(axis=0)
        comp = np.log1p(band / (np.percentile(band, 60) + 1e-12))
        before = np.concatenate([comp[:2], comp[:-2]])
        rise = np.maximum(0.0, comp - before)
        return np.clip(rise / (np.percentile(rise, 99.5) + 1e-9), 0, 1)

    kick = flux(perc, 35, 120)
    snare = np.sqrt(flux(perc, 150, 300) * flux(perc, 1200, 5000)) - .4 * kick
    snare = np.clip(snare / (np.percentile(snare, 99.5) + 1e-9), 0, 1)
    q = lambda a: [int(v) for v in np.round(np.clip(a, 0, 1) * 255)]  # noqa: E731
    chroma = librosa.feature.chroma_stft(S=harm, sr=sr, n_fft=1024)
    step = 10
    frames = chroma.shape[1] // step
    slow = chroma[:, :frames * step].reshape(12, frames, step).mean(axis=2).T if frames else np.zeros((0, 12))
    slow = slow / (slow.max(axis=1, keepdims=True) + 1e-9)
    return {'version': FEATURES, 'rate': sr / hop, 'kick': q(kick), 'snare': q(snare), 'hat': q(flux(perc, 5000, 9000)),
            'full': q(flux(power, 30, 11000)), 'melody': q(flux(harm, 200, 4000)),
            'chroma': {'rate': sr / hop / step, 'frames': q(slow.ravel())}}


def usable(drums):
    """Drum features this version can use (older analyses are computed again)."""
    return bool(drums) and drums.get('version') == FEATURES and all(k in drums for k in ('kick', 'snare', 'hat', 'full', 'melody', 'chroma'))


def _sampler(env, rate, width_ms):
    """The strongest value of an envelope within ±width of given times."""
    from scipy.ndimage import maximum_filter1d
    env = np.asarray(env, dtype=float) / 255
    w = max(1, int(round(width_ms / 1000 * rate)))
    peak = maximum_filter1d(env, size=2 * w + 1) if len(env) else env

    def at(times_ms):
        if not len(peak):
            return np.zeros(len(times_ms))
        i = np.clip(np.round(np.asarray(times_ms, dtype=float) / 1000 * rate).astype(int), 0, len(peak) - 1)
        return peak[i]
    return at


def kit(drums, times, width_ms=25):
    """Bass drum, snare, hi-hat and full-band strength (0..1) at each time."""
    return tuple(_sampler(drums[k], drums['rate'], width_ms)(times) for k in ('kick', 'snare', 'hat', 'full'))


def align_beats(beats, drums):
    """Beats moved by half a beat when the bass drum and snare hit between the
    tracked beats rather than on them (the tracker locked onto the off-beats).
    Returns (beats, moved)."""
    beats = [int(b) for b in beats]
    if not usable(drums) or len(beats) < 16:
        return beats, False
    b = np.asarray(beats, dtype=float)
    mids = (b[:-1] + b[1:]) / 2
    k_on, s_on, _, _ = kit(drums, b[:-1])
    k_off, s_off, _, _ = kit(drums, mids)
    on, off = np.maximum(k_on, s_on), np.maximum(k_off, s_off)
    if np.median(np.maximum(on, off)) < .12:
        return beats, False
    if np.mean(off) > 1.35 * np.mean(on) and np.median(off) > 1.2 * np.median(on):
        return [int(round(m)) for m in mids], True
    return beats, False


def tempo_alias(beats, bpm, drums):
    """True when a song tracked at two thirds of its tempo (it then looks
    swung: attacks at 2/3 of every beat) repeats more strongly at 1.5 times
    the tracked tempo, so the beats should be tracked again there."""
    from .generator import detect_swing
    if not usable(drums) or len(beats) < 16 or bpm * 1.5 > 240:
        return False
    rate = drums['rate']
    full = np.asarray(drums['full'], dtype=float) / 255
    if not detect_swing(beats, full, rate):
        return False
    env = (np.asarray(drums['kick'], dtype=float) + np.asarray(drums['snare'], dtype=float) + np.asarray(drums['hat'], dtype=float)) / 765
    env = env - env.mean()
    ac = np.correlate(env, env, mode='full')[len(env) - 1:]
    ac = ac / (ac[0] + 1e-9)

    def at(tempo):
        lag = 60 / tempo * rate
        i = int(lag)
        return float(ac[i] + (ac[i + 1] - ac[i]) * (lag - i)) if i + 1 < len(ac) else 0.0
    return at(bpm * 1.5) > max(.08, 1.1 * at(bpm))


def bar_phase_scores(beats, drums):
    """For each of the 4 phases: how well it puts the bass drum on beats 1 and
    3 and the snare on beats 2 and 4 (the backbeat). Zeros without drums."""
    if not usable(drums) or len(beats) < 16:
        return np.zeros(4)
    kick, snare, _, _ = kit(drums, np.asarray(beats, dtype=float))
    if np.median(np.maximum(kick, snare)) < .12:
        return np.zeros(4)
    idx = np.arange(len(beats))
    scores = np.zeros(4)
    for p in range(4):
        pos = (idx - p) % 4
        scores[p] = kick[pos == 0].mean() + .5 * kick[pos == 2].mean() - .5 * kick[pos % 2 == 1].mean() \
            + snare[pos % 2 == 1].mean() - snare[pos % 2 == 0].mean()
    return scores


def _normalise(m, valid):
    """Each bar compared with the bars around it (a quiet verse and a loud
    chorus both count), never lifting a quiet bar far above the song's level.
    Returns the normalised matrix and each bar's peak against the song."""
    m = np.where(valid, m, 0.0)
    peak = m.max(axis=1)
    live = peak[peak > 0]
    whole = float(np.percentile(live, 75)) if len(live) else 1.0
    ref = np.array([max(float(np.percentile(peak[max(0, j - 8):j + 9], 75)), .35 * whole, 1e-3) for j in range(len(peak))])
    return np.clip(m / ref[:, None], 0, 1.5), peak / max(whole, 1e-3)


def _typical(bands, valid, window=4, far=.85):
    """Likeness between bars (weights), and each bar's typical pattern for the
    given bands: the bar averaged with its neighbours (within `window` bars)
    and with look-alike bars anywhere in the song, weighted by how alike their
    whole sound is (single hits in a recording are too noisy to compare)."""
    vec = np.concatenate(bands, axis=1) * np.tile(valid, (1, len(bands)))
    nb = len(vec)
    norm = np.linalg.norm(vec, axis=1) + 1e-9
    sim = np.clip((vec @ vec.T) / norm[:, None] / norm[None, :], 0, 1)
    idx = np.arange(nb)
    near = np.abs(idx[:, None] - idx[None, :]) <= window
    weight = np.where(near, sim ** 4, 0.0) + np.where(~near & (sim >= far), .5 * sim ** 4, 0.0)
    np.fill_diagonal(weight, 1.0)
    return weight, (weight @ vec) / weight.sum(axis=1, keepdims=True)


def _hits(own, typical, valid, level=None):
    """Slots the typical pattern plays (clearly above the bar's usual level),
    where this bar also sounds (a break rests). Off-beats need a clearer hit
    than beats, so a groove is not cluttered by what only sometimes sounds."""
    lo = np.percentile(np.where(valid, typical, 0), 40, axis=1, keepdims=True)
    hi = typical.max(axis=1, keepdims=True)
    share = .55 if level is None else np.select([level == 0, level == 1], [.55, .65], .75)
    return (typical >= lo + share * (hi - lo)) & (hi >= .45) & (own >= .25) & valid


def groove(beats, duration, drums, downbeats=None):
    """The song's drum part on its grid: per bar and slot, 1 bass drum (don),
    2 snare (ka), plus the grid's times and levels and each hit's strength."""
    from .generator import detect_swing
    beats = [int(b) for b in beats]
    phase = downbeats[0] % 4 if downbeats else 0
    beat_len = np.diff(beats).astype(float)
    median_beat = float(np.median(beat_len))
    swing = detect_swing(beats, np.asarray(drums['full'], dtype=float) / 255, drums['rate'])
    frac = sorted([(0, 0), (2 / 3, 1), (1 / 3, 2)] if swing else [(0, 0), (.5, 1), (.25, 2), (.75, 2)])
    per_beat = len(frac)
    per_bar = 4 * per_beat
    slot_ms = median_beat / per_beat

    # The grid: slots between consecutive beats, grouped in bars of 4 beats.
    nbeats = len(beats) - 1
    beat_bar = (np.arange(nbeats) - phase) // 4
    beat_bar -= beat_bar.min()
    nb = int(beat_bar.max()) + 1
    times = np.full((nb, per_bar), np.nan)
    level = np.full((nb, per_bar), 9)
    for i in range(nbeats):
        a, b = beats[i], beats[i + 1]
        for k, (f, lv) in enumerate(frac):
            s = ((i - phase) % 4) * per_beat + k
            times[beat_bar[i], s] = a + (b - a) * f
            level[beat_bar[i], s] = lv
    valid = ~np.isnan(times) & (np.nan_to_num(times) >= 800) & (np.nan_to_num(times) <= duration - 300)
    bar_ms = np.zeros(nb)
    for i in range(nbeats):
        if 800 <= beats[i] and beats[i + 1] <= duration - 300:
            bar_ms[beat_bar[i]] += beat_len[i]
    flat = np.nan_to_num(times).ravel()
    kick, snare, hat, full = (x.reshape(nb, per_bar) for x in kit(drums, flat, min(30.0, .35 * slot_ms)))
    kn, kick_level = _normalise(kick, valid)
    sn, snare_level = _normalise(snare, valid)
    hn, _ = _normalise(hat, valid)
    fn, full_level = _normalise(full, valid)

    weight, typical = _typical([kn, sn], valid)
    kick_typ = typical[:, :per_bar]
    kick_hit = _hits(kn, kick_typ, valid, level)
    snare_hit = _hits(sn, typical[:, per_bar:], valid, level)
    drums_on = (kick_level + snare_level) / 2 >= .3
    music_on = full_level >= .15
    kick_hit &= drums_on[:, None]
    snare_hit &= drums_on[:, None]
    # Where the drums rest, the band's typical pattern on beats and eighths.
    _, ftypical = _typical([fn], valid)
    other_hit = _hits(fn, ftypical, valid, level) & (level <= 1) & ~drums_on[:, None] & music_on[:, None]
    _, htypical = _typical([hn], valid)
    # Off-beat eighths where the band keeps playing (for hard, see taps).
    offbeat_busy = (np.maximum(htypical, ftypical) >= .2) & (np.maximum(hn, fn) >= .15) & (level == 1) & valid & drums_on[:, None]

    # 1 don, 2 ka. Where bass drum and snare sound together: ka on the
    # backbeat (beats 2 and 4), else don. Off the backbeat a snare is ka only
    # where the bass drum is clearly silent (a crash on beat 1 is not a ka).
    slot = np.arange(per_bar)
    backbeat = (slot % per_beat == 0) & ((slot // per_beat) % 2 == 1)
    kick_lo = np.percentile(np.where(valid, kick_typ, 0), 40, axis=1, keepdims=True)
    kick_near = kick_typ >= kick_lo + .3 * (kick_typ.max(axis=1, keepdims=True) - kick_lo)
    code = np.zeros((nb, per_bar), dtype=int)
    code[kick_hit] = 1
    code[snare_hit & (backbeat[None, :] | ~kick_near)] = 2
    code[snare_hit & ~backbeat[None, :] & kick_near & (code == 0)] = 1
    code[other_hit & (code == 0)] = 1
    code[other_hit & (level == 1)] = 2
    strength = np.maximum(np.maximum(kn * kick_hit, sn * snare_hit), fn * other_hit * .8)
    return {'times': times, 'level': level, 'valid': valid, 'bar_ms': bar_ms, 'code': code * valid, 'strength': strength,
            'weight': weight, 'music_on': music_on, 'drums_on': drums_on, 'offbeat_busy': offbeat_busy, 'fn': fn, 'ftypical': ftypical,
            'per_beat': per_beat, 'slot_ms': slot_ms, 'median_beat': median_beat}


def _levels(g, difficulty):
    """How fine a grid the difficulty plays, slower for fast songs: hard's
    sixteenths only where they are at least 90 ms apart (about 166 BPM)."""
    levels = RULES[difficulty]['levels']
    if levels == 3 and g['median_beat'] / 4 < 90 and g['per_beat'] == 4:
        levels = 2
    return levels


def _run(g, difficulty):
    """Most notes in a row at the quickest spacing: fewer when that spacing is
    fast (normal's eighths under 170 ms, above about 176 BPM, come in pairs)."""
    run = RULES[difficulty]['run']
    if difficulty == 'normal' and g['slot_ms'] * 2 < 170:
        run = 2
    return run


def _part(g, difficulty):
    """The difficulty's part of the groove, kept within its density."""
    rules = RULES[difficulty]
    level, per_beat, bar_ms = g['level'], g['per_beat'], g['bar_ms']
    code = g['code'].copy()
    code[level >= _levels(g, difficulty)] = 0
    active_s = max(1.0, float(bar_ms[g['music_on']].sum()) / 1000)
    lo, hi = rules['density']
    beat_in_bar = np.arange(code.shape[1]) // per_beat
    if difficulty == 'easy':
        # Each step keeps a part of the one before: don-ka-don, don-ka, don.
        steps = [lambda c: c * np.isin(beat_in_bar, [0, 1, 2])[None, :], lambda c: c * np.isin(beat_in_bar, [0, 1])[None, :],
                 lambda c: c * (beat_in_bar == 0)[None, :]]
    elif difficulty == 'normal':
        steps = [lambda c: np.where((level == 1) & (c == 1), 0, c), lambda c: np.where(level == 1, 0, c)]
    else:
        steps = [lambda c: np.where((level == 2) & (c == 1), 0, c), lambda c: np.where(level == 2, 0, c),
                 lambda c: np.where((level == 1) & (c == 1), 0, c)]
    # Busy bars first (a crowded chorus), then the whole song, one rule at a
    # time, so bars that play alike stay alike.
    for step in steps:
        per_s = np.count_nonzero(code, axis=1) / np.maximum(bar_ms, 1) * 1000
        busy = per_s > hi * 1.3
        if busy.any():
            code[busy] = step(code)[busy]
    for step in steps:
        if np.count_nonzero(code) / active_s <= hi:
            break
        code = step(code)
    # Too sparse (a quiet song, or drums that play little): add the band's
    # strongest beats (above easy also eighths) to bars with few notes.
    if np.count_nonzero(code) / active_s < lo:
        room = g['valid'] & (code == 0) & (level < min(_levels(g, difficulty), 2)) & g['music_on'][:, None]
        rank = np.where(room, (g['fn'] + g['ftypical']) / 2 - .05 * level, -1.0)
        for j in range(len(code)):
            need = rules['per_bar'] - np.count_nonzero(code[j])
            for s in np.argsort(-rank[j], kind='stable')[:max(0, need)]:
                if rank[j, s] >= .35:
                    code[j, s] = 2 if level[j, s] == 1 else 1
    return code, active_s


def _ladder(g):
    """The three difficulties' parts, each clearly more than the one below."""
    per_beat = g['per_beat']
    easy, _ = _part(g, 'easy')
    normal, active_s = _part(g, 'normal')
    hard, _ = _part(g, 'hard')
    count = np.count_nonzero
    # Hard plays clearly more than normal: where it would not (a simple beat),
    # the off-beat eighths the band keeps playing join as dons, the classic
    # don-don-ka-don; in a fast song only those after beats 2 and 4 (don,
    # ka-don), when that stays within hard's density.
    eighth = g['median_beat'] / 2
    if count(hard) < 1.25 * count(normal) and eighth >= 140:
        extra = g['offbeat_busy'] & (hard == 0)
        if eighth < 190:
            extra &= ((np.arange(hard.shape[1]) // per_beat) % 2 == 1)[None, :]
        if extra.any() and count(hard) + count(extra) <= RULES['hard']['density'][1] * active_s:
            hard = np.where(extra, 1, hard)
    # Still no step up (a fast song with a plain beat): normal rests on beat 4,
    # and easy stays below normal.
    beat_in_bar = np.arange(hard.shape[1]) // per_beat
    if count(hard) < 1.15 * count(normal):
        normal = normal * np.isin(beat_in_bar, [0, 1, 2])[None, :]
    for keep in ([0, 1, 2], [0, 1]):
        if count(easy) > .8 * count(normal):
            easy = easy * np.isin(beat_in_bar, keep)[None, :]
    return {'easy': easy, 'normal': normal, 'hard': hard}


def taps(beats, duration, difficulty, sections=None, drums=None, downbeats=None):
    """Tap notes ({t, color, size}) following the drums for one difficulty."""
    rules = RULES[difficulty]
    g = groove(beats, duration, drums, downbeats)
    code = _ladder(g)[difficulty]
    level, valid, per_beat = g['level'], g['valid'], g['per_beat']

    # Bars that sound alike play alike: each slot takes what most of the bar's
    # look-alikes play there (none, don or ka), when that changes a slot or
    # two. Fills, which sound like no other bar, keep their own shape.
    weight = g['weight']
    snapped = code.copy()
    onehot = np.stack([code == v for v in (0, 1, 2)], axis=-1).astype(float)
    for j in range(len(code)):
        mates = np.nonzero(weight[j] >= .4)[0]
        if len(mates) < 3:
            continue
        votes = np.tensordot(weight[j, mates], onehot[mates], axes=1)
        usual = np.argmax(votes, axis=-1) * valid[j]
        diff = int(np.count_nonzero(usual != code[j]))
        if 0 < diff <= max(2, code.shape[1] // 8):
            snapped[j] = usual
    code = snapped * valid

    times, strength = g['times'], g['strength']
    notes = [{'t': float(times[j, s]), 'color': 'ka' if code[j, s] == 2 else 'don', 'level': int(level[j, s]), 'pos': int(s),
              'score': float(strength[j, s]) + (.3 if s % per_beat == 0 else 0)} for j, s in zip(*np.nonzero(code))]
    notes.sort(key=lambda n: n['t'])
    quick = g['slot_ms'] * (1 if _levels(g, difficulty) == 3 else 2) * 1.25
    notes = _space(notes, rules['gap'], _run(g, difficulty), quick)

    # Large notes: a bass drum that starts a chorus or comes back after a rest.
    median_beat = g['median_beat']
    chorus = [s['startMs'] for s in (sections or []) if s.get('kind') == 'chorus']
    big = []
    for i, n in enumerate(notes):
        if n['color'] != 'don' or n['pos'] != 0:
            continue
        prev_gap = n['t'] - notes[i - 1]['t'] if i else 1e9
        next_gap = notes[i + 1]['t'] - n['t'] if i + 1 < len(notes) else 1e9
        starts = any(abs(n['t'] - c) <= median_beat / 2 for c in chorus) or prev_gap >= 2 * median_beat
        if starts and prev_gap >= median_beat / 2 and next_gap >= median_beat / 2:
            big.append(n)
    big.sort(key=lambda n: -n['score'])
    for n in big[:max(1, int(len(notes) * .04))]:
        n['size'] = 'large'
    return [{'t': int(round(n['t'])), 'color': n['color'], 'size': n.get('size', 'normal')} for n in notes]


def _space(notes, gap, run_limit, quick_ms):
    """The least spacing (of two close notes the weaker goes) and no more than
    `run_limit` notes in a row at the quickest spacing."""
    kept = []
    for n in notes:
        if kept and n['t'] - kept[-1]['t'] < gap:
            if n['score'] > kept[-1]['score']:
                kept[-1] = n
            continue
        kept.append(n)
    if run_limit <= 0:
        return kept
    changed = True
    while changed:
        changed = False
        run = kept[:1]
        for prev, cur in zip(kept, kept[1:]):
            run = run + [cur] if cur['t'] - prev['t'] <= quick_ms else [cur]
            if len(run) > run_limit:
                weakest = min(run[1:-1] or run, key=lambda n: (-n['level'], n['score']))
                kept.remove(weakest)
                changed = True
                break
    return kept
