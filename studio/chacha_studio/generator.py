"""Onset-aware chart drafts.

The analysis stores band onset envelopes (low / high / full). Notes are placed
on the song's own beat grid where the music actually attacks, coloured by
whether the attack is low (drums, bass: don) or bright (snare, claps: ka),
then shaped into repeating phrases and checked against the difficulty limits.
It is a draft for editing, not a transcription of the original drums.
"""
import numpy as np

VERSION = 'chacha-generator-v2'

RULES = {
    # subdivisions per beat, target notes/s, min gap ms, fast-run limit, ka share
    'easy': {'div': 2, 'density': 1.25, 'gap': 180, 'run': 3, 'ka': .16, 'floor': .2},
    'normal': {'div': 2, 'density': 2.35, 'gap': 105, 'run': 5, 'ka': .24, 'floor': .15},
    'hard': {'div': 4, 'density': 3.7, 'gap': 75, 'run': 8, 'ka': .32, 'floor': .11},
}
POSITION_WEIGHT = {0: 1.0, 1: .72, 2: .55}


def _sample(env, rate, t_ms, window_ms=28):
    if env is None or len(env) == 0:
        return 0.0
    i = t_ms / 1000 * rate
    a, b = int(max(0, i - window_ms / 1000 * rate)), int(min(len(env), i + window_ms / 1000 * rate + 1))
    return float(np.max(env[a:b])) if b > a else 0.0


def candidates(beats, downbeat_phase, div, swing=False):
    """(time_ms, level, beat_index, fraction) for each grid position between beats.

    Straight feel: 1/2 (and 1/4) of the beat. Swing feel: the 'and' falls at
    2/3 of the beat, so the grid uses thirds instead.
    """
    if swing:
        fractions = [(0, 0), (2 / 3, 1)] if div == 2 else [(0, 0), (1 / 3, 2), (2 / 3, 1)]
    else:
        fractions = [(0, 0), (.5, 1)] if div == 2 else [(0, 0), (.25, 2), (.5, 1), (.75, 2)]
    out = []
    for i in range(len(beats) - 1):
        a, b = beats[i], beats[i + 1]
        for f, level in fractions:
            out.append((round(a + (b - a) * f), level, i, f))
    return out


def detect_swing(beats, full, rate):
    """True when attacks sit at 2/3 of the beat rather than 1/2 (shuffle)."""
    if full is None or len(beats) < 16:
        return False
    half, third = [], []
    for a, b in zip(beats, beats[1:]):
        half.append(_sample(full, rate, a + (b - a) / 2, 18))
        third.append(_sample(full, rate, a + (b - a) * 2 / 3, 18))
    h, t = float(np.median(half)), float(np.median(third))
    return t > .12 and t > 1.3 * h


def downbeat_phase(beats, low_env=None, rate=None):
    """Which beat (0-3) starts the bar: the one with the strongest low attacks."""
    if low_env is None or len(beats) < 8:
        return 0
    scores = [0.0] * 4
    for i, t in enumerate(beats):
        scores[i % 4] += _sample(low_env, rate, t)
    return int(np.argmax(scores))


def _enforce(notes, gap, run_limit, half_beat):
    """Minimum spacing and a cap on unbroken fast runs (drop weakest)."""
    notes = sorted(notes, key=lambda n: n['t'])
    kept = []
    for n in notes:
        if kept and n['t'] - kept[-1]['t'] < gap:
            if n['score'] > kept[-1]['score']:
                kept[-1] = n
            continue
        kept.append(n)
    # Break long runs of quick notes.
    changed = True
    while changed:
        changed = False
        run = [kept[0]] if kept else []
        for prev, cur in zip(kept, kept[1:]):
            if cur['t'] - prev['t'] <= half_beat(cur['t']) + 1:
                run.append(cur)
            else:
                run = [cur]
            if len(run) > run_limit:
                weakest = min(run[1:-1] or run, key=lambda n: n['score'])
                kept.remove(weakest)
                changed = True
                break
    return kept


def generate(beats, duration, difficulty, audio_hash, sections=None, features=None, downbeats=None):
    rules = RULES[difficulty]
    if len(beats) < 2:
        beats = list(range(0, duration, 500))
    rate = features.get('rate', 50) if features else None
    low = np.asarray(features['low'], dtype=float) / 255 if features else None
    high = np.asarray(features['high'], dtype=float) / 255 if features else None
    full = np.asarray(features['full'], dtype=float) / 255 if features else None
    phase = downbeats[0] % 4 if downbeats else downbeat_phase(beats, low, rate)
    beat_len = np.diff(beats)
    median_beat = float(np.median(beat_len)) if len(beat_len) else 500.0

    def local_beat(t):
        i = int(np.searchsorted(beats, t, side='right')) - 1
        i = min(max(i, 0), len(beat_len) - 1)
        return float(beat_len[i]) if len(beat_len) else median_beat

    def half_beat(t):
        return local_beat(t) / 2

    swing = detect_swing(beats, full, rate)
    cands = candidates(beats, phase, rules['div'], swing)
    notes = []
    if features:
        for t, level, bi, frac in cands:
            if t < 800 or t > duration - 300:
                continue
            f, lo, hi = _sample(full, rate, t), _sample(low, rate, t), _sample(high, rate, t)
            bar_pos = (bi - phase) % 4
            weight = POSITION_WEIGHT[level] * (1.12 if bar_pos == 0 and level == 0 else 1.0)
            score = f * weight
            if f < rules['floor'] * (1.0 if level == 0 else 1.25):
                continue
            notes.append({'t': t, 'level': level, 'beat': bi, 'sub': frac, 'score': score, 'low': lo, 'high': hi})
    else:
        # No audio features (manual grid): a musical fallback on the beat grid.
        motif = {'easy': [[1, 0], [0, 0], [1, 0], [1, 0]], 'normal': [[1, 0], [1, 1], [1, 0], [1, 0]], 'hard': [[1, 0, 1, 0], [1, 0, 1, 1], [1, 0, 1, 0], [1, 1, 1, 0]]}[difficulty]
        per_beat = 2 if rules['div'] == 2 else 4
        for idx, (t, level, bi, frac) in enumerate(cands):
            k = idx % per_beat
            if t < 800 or t > duration - 300:
                continue
            bar_pos = (bi - phase) % 4
            if motif[bar_pos][k]:
                accent = 1.0 if k == 0 else .6
                ka = (bar_pos == 3 and k == 0) or (difficulty != 'easy' and bar_pos == 1 and k == 0 and (bi // 4) % 2 == 1)
                notes.append({'t': t, 'level': level, 'beat': bi, 'sub': frac, 'score': accent, 'low': 0.0 if ka else 1.0, 'high': 1.0 if ka else 0.0})

    # Density: keep the strongest candidates up to the target for the time the
    # music is actually playing (quiet intros and breaks don't count).
    if notes and features:
        from scipy.ndimage import maximum_filter1d
        busy = maximum_filter1d(full, size=max(1, int(rate * 2))) > .08
        active = float(np.count_nonzero(busy)) / rate
        target = max(8, int(rules['density'] * max(active, 1)))
        notes.sort(key=lambda n: -n['score'])
        notes = notes[:target]
    notes = _enforce(notes, rules['gap'], rules['run'], half_beat)

    # Phrase consistency: a bar that sounds like one 2, 4 or 8 bars earlier
    # reuses that bar's rhythm, so repeated music plays the same way.
    if features and notes:
        by_bar = {}
        for n in notes:
            by_bar.setdefault((n['beat'] - phase) // 4, []).append(n)
        # Compare bars on every grid position, not only the beats.
        bar_profile = {}
        for t, level, bi, frac in cands:
            bar_profile.setdefault((bi - phase) // 4, []).append(_sample(full, rate, t))
        for bar in sorted(bar_profile):
            for back in (2, 4, 8):
                ref = bar - back
                if ref not in bar_profile or len(bar_profile[ref]) != len(bar_profile[bar]):
                    continue
                u, v = np.array(bar_profile[ref]), np.array(bar_profile[bar])
                sim = float(u @ v / (np.linalg.norm(u) * np.linalg.norm(v) + 1e-9))
                if sim > .97 and ref in by_bar:
                    shift = back * 4
                    copied = []
                    for n in by_bar[ref]:
                        bi = n['beat'] + shift
                        if bi >= len(beats) - 1:
                            continue
                        a, b = beats[bi], beats[bi + 1]
                        t = round(a + (b - a) * n['sub'])
                        # Keep a copied stroke only where this bar also attacks.
                        if 800 <= t <= duration - 300 and _sample(full, rate, t) >= rules['floor'] * .5:
                            copied.append({**n, 'beat': bi, 't': t})
                    if copied:
                        by_bar[bar] = copied
                    break
        notes = _enforce([n for ns in by_bar.values() for n in ns], rules['gap'], rules['run'], half_beat)

    if not notes:
        t = int(min(max(800, beats[min(2, len(beats) - 1)]), duration - 300))
        notes = [{'t': t, 'level': 0, 'beat': 0, 'sub': 0, 'score': 1, 'low': 1, 'high': 0}]

    # Colour: the brightest attacks become ka, up to the difficulty's share.
    brightness = np.array([n['high'] / (n['high'] + n['low'] + 1e-6) for n in notes])
    share = rules['ka']
    k = int(round(len(notes) * share))
    order = np.argsort(-brightness, kind='stable')
    ka_idx = set(int(i) for i in order[:k] if brightness[i] > .3) if features else set(i for i, n in enumerate(notes) if n['high'] > n['low'])
    # Downbeats of a bar stay don; ka lands on accents and phrase ends.
    for i, n in enumerate(notes):
        n['color'] = 'ka' if i in ka_idx and not ((n['beat'] - phase) % 4 == 0 and n['sub'] == 0) else 'don'
    # Cap the share (spread evenly, so ka does not vanish from the song's end).
    ka_list = [i for i, n in enumerate(notes) if n['color'] == 'ka']
    limit = int(len(notes) * {'easy': .2, 'normal': .3, 'hard': .4}[difficulty])
    if len(ka_list) > limit:
        keep = set(ka_list[int(j * len(ka_list) / limit)] for j in range(limit)) if limit else set()
        for i in ka_list:
            if i not in keep:
                notes[i]['color'] = 'don'

    # Large notes: a few strong, isolated downbeats.
    taps = sorted(notes, key=lambda n: n['t'])
    big = []
    for i, n in enumerate(taps):
        if (n['beat'] - phase) % 4 != 0 or n['sub'] != 0:
            continue
        prev_gap = n['t'] - taps[i - 1]['t'] if i else 1e9
        next_gap = taps[i + 1]['t'] - n['t'] if i + 1 < len(taps) else 1e9
        if prev_gap >= local_beat(n['t']) * .9 and next_gap >= local_beat(n['t']) * .9:
            big.append(n)
    big.sort(key=lambda n: -n['score'])
    for n in big[:max(0, int(len(taps) * .05))]:
        n['size'] = 'large'

    out = [{'kind': 'tap', 'timeMs': int(n['t']), 'color': n['color'], 'size': n.get('size', 'normal')} for n in taps]

    # A roll leading into a chorus: one per started minute (at least one in
    # songs over 12 s).
    rolls = []
    chorus_starts = [s['startMs'] for s in (sections or []) if s.get('kind') == 'chorus']
    if not chorus_starts and duration > 12000 and len(beats) > 24:
        chorus_starts = [beats[max(8, len(beats) // 2)] + int(local_beat(beats[len(beats) // 2]) * 4)]
    allowed = max(1, int(round(duration / 60000)))
    for start in chorus_starts[:allowed]:
        bi = int(np.searchsorted(beats, start)) - 4
        if bi < 2 or bi + 3 >= len(beats):
            continue
        a = beats[bi + 2]
        b = beats[bi + 3] + int(local_beat(beats[bi + 3]) * .5)
        if b - a < 300 or a < 800 or b > duration - 600:
            continue
        rolls.append({'kind': 'roll', 'timeMs': int(a), 'endMs': int(b)})
    for r in rolls:
        out = [n for n in out if not (r['timeMs'] - 90 <= n['timeMs'] <= r['endMs'] + 90)]
    notes_all = sorted(out + rolls, key=lambda n: n['timeMs'])
    # Rolls must not overlap each other.
    cleaned = []
    for n in notes_all:
        if n['kind'] == 'roll' and cleaned and any(c['kind'] == 'roll' and c['endMs'] >= n['timeMs'] for c in cleaned):
            continue
        cleaned.append(n)
    if not any(n['kind'] == 'tap' for n in cleaned):
        cleaned = [n for n in cleaned if n['kind'] == 'tap'] or [{'kind': 'tap', 'timeMs': int(min(max(800, beats[0]), duration - 300)), 'color': 'don', 'size': 'normal'}]
    final = []
    for i, n in enumerate(cleaned):
        final.append({'id': (f'r{i}' if n['kind'] == 'roll' else f'n{i}'), **n})
    return {'schemaVersion': 1, 'chartId': difficulty, 'difficulty': difficulty, 'offsetMs': 0, 'notes': final}


def onset_features(y, sr, rate=50):
    """Band onset envelopes (0..255) at `rate` frames per second."""
    import librosa
    hop = int(sr / rate)
    spec = np.abs(librosa.stft(y, n_fft=1024, hop_length=hop)) ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=1024)

    def flux(mask):
        band = np.log1p(spec[mask].sum(axis=0) * 50)
        d = np.maximum(0, np.diff(band, prepend=band[:1]))
        # Local normalisation: compare each attack with its neighbourhood.
        k = max(1, int(rate * 1.5))
        from scipy.ndimage import maximum_filter1d
        peak = maximum_filter1d(d, size=2 * k + 1)
        norm = d / (np.percentile(d, 98) + 1e-9) * .7 + d / (peak + 1e-9) * .3
        return np.clip(norm, 0, 1)

    low = flux((freqs >= 30) & (freqs < 220))
    high = flux((freqs >= 1800) & (freqs < 9000))
    full = flux((freqs >= 30) & (freqs < 11000))
    q = lambda a: [int(v) for v in np.round(a * 255)]  # noqa: E731
    return {'rate': rate, 'low': q(low), 'high': q(high), 'full': q(full)}


def refine_beats(y, sr, beats_ms, bpm):
    """Correct beat-tracker latency and half-tempo estimates.

    The tracker's beats sit a few tens of ms after the attacks; a fine onset
    envelope (1.5 ms steps) gives the median offset, applied to all beats.
    Fast songs are often tracked at half tempo: when the midpoints attack as
    strongly as the beats, the midpoints are inserted.
    """
    import librosa
    beats = np.asarray(beats_ms, dtype=float)
    if len(beats) < 8:
        return [int(round(b)) for b in beats], bpm, 0.0
    hop = 32
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop, n_fft=256)
    times = librosa.frames_to_time(np.arange(len(env)), sr=sr, hop_length=hop) * 1000

    def strength(t, lo=-15, hi=15):
        w = (times >= t + lo) & (times <= t + hi)
        return float(env[w].max()) if w.any() else 0.0

    devs = []
    for b in beats:
        w = (times >= b - 70) & (times <= b + 40)
        if w.any():
            devs.append(times[w][int(np.argmax(env[w]))] - b)
    shift = float(np.clip(np.median(devs) - 2.5, -60, 60)) if len(devs) >= 8 else 0.0
    beats = beats + shift
    if bpm < 100:
        mids = (beats[:-1] + beats[1:]) / 2
        on = np.median([strength(b) for b in beats])
        mid = np.median([strength(m) for m in mids])
        if on > 0 and mid > .75 * on:
            beats = np.sort(np.concatenate([beats, mids]))
            bpm *= 2
    return [int(round(b)) for b in beats if b >= 0], bpm, shift


def downbeat_phase_chroma(y, sr, beats_ms, low_env=None, rate=None):
    """Bar start from where the bass and chords change, supported by low attacks."""
    import librosa
    if len(beats_ms) < 16:
        return downbeat_phase(beats_ms, low_env, rate)
    hop = 512
    frames = librosa.time_to_frames(np.asarray(beats_ms) / 1000, sr=sr, hop_length=hop)

    def change_by_phase(chroma):
        f = np.clip(frames, 0, chroma.shape[1] - 1)
        sync = np.stack([chroma[:, a:max(a + 1, b)].mean(axis=1) for a, b in zip(f[:-1], f[1:])], axis=1)
        sync = sync / (np.linalg.norm(sync, axis=0, keepdims=True) + 1e-9)
        change = 1 - np.sum(sync[:, 1:] * sync[:, :-1], axis=0)
        out = np.zeros(4)
        for i, c in enumerate(change):
            out[(i + 1) % 4] += c
        return out

    bass = change_by_phase(librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop, fmin=librosa.note_to_hz('C1'), n_octaves=3))
    chords = change_by_phase(librosa.feature.chroma_stft(y=y, sr=sr, hop_length=hop))
    attacks = np.zeros(4)
    if low_env is not None:
        for i, t in enumerate(beats_ms):
            attacks[i % 4] += _sample(low_env, rate, t)

    def z(v):
        return (v - v.mean()) / (v.std() + 1e-9)
    return int(np.argmax(z(bass) + .5 * z(chords) + .6 * z(attacks)))
