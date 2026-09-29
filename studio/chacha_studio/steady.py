"""Steady beat grids.

Most recorded songs keep one tempo from start to end (they are played to a
click). The beat tracker follows the song's attacks beat by beat, and in a
busy song it wanders: a beat late here, half a beat off for a few bars there.
The bars of the draft then no longer line up with the music, and what is on
the beat in the song lands off the beat in the chart. When one constant grid
sits on the song's attacks better than the tracked beats, and stays on them
all through the song, the drafts use that grid.
"""
import numpy as np


def _peaks(envelope):
    e = np.asarray(envelope, dtype=float)
    if len(e) < 3:
        return e
    return np.maximum(np.maximum(e, np.r_[e[:1], e[:-1]]), np.r_[e[1:], e[-1:]])


def _comb(e, rate, start, count, period, phases):
    """Mean envelope on `count` beats `period` apart, for each start + phase."""
    times = start + phases[:, None] + np.arange(count)[None, :] * period
    idx = np.clip(np.round(times / 1000 * rate).astype(int), 0, len(e) - 1)
    return e[idx].mean(axis=1)


def _on_peaks(env, rate, P, phi, start, end):
    """The grid refined on the attacks themselves: the strongest point of
    the envelope near each grid beat (between frames, from the peak's shape)
    and the straight line through them. The comb above only tells the grid
    to a frame (10 ms), which over a whole song is a slightly wrong tempo."""
    loud = float(np.percentile(env, 90)) if len(env) else 0.0
    if loud <= 0:
        return P, phi
    reach = max(1, int(round(.03 * rate)))
    index, when = [], []
    for k in range(int(np.ceil((start - phi) / P)), int((end - phi) / P) + 1):
        f = int(round((phi + k * P) / 1000 * rate))
        a, b = max(f - reach, 1), min(f + reach + 1, len(env) - 1)
        if b - a < 3:
            continue
        j = a + int(np.argmax(env[a:b]))
        if env[j] < .5 * loud:
            continue
        curve = env[j - 1] - 2 * env[j] + env[j + 1]
        index.append(k)
        when.append((j + (.5 * (env[j - 1] - env[j + 1]) / curve if curve < 0 else 0.0)) / rate * 1000)
    if len(index) < 16:
        return P, phi
    index, when = np.asarray(index, dtype=float), np.asarray(when)
    keep = np.ones(len(index), bool)
    for limit in (25, 15):
        A = np.vstack([index[keep], np.ones(keep.sum())]).T
        (slope, at0), *_ = np.linalg.lstsq(A, when[keep], rcond=None)
        keep = np.abs(when - (at0 + slope * index)) < limit
        if keep.sum() < 16:
            return P, phi
    if abs(slope - P) > .002 * P:
        return P, phi
    return float(slope), float(at0)


def steady_grid(beats, envelope, rate, duration, window=32, check=16, agree=.85):
    """A constant-tempo grid for the song, or None when its tempo moves.

    beats: the tracked beats (ms); envelope: an onset envelope (0..1) at
    `rate` frames per second. The period is the median of the best periods of
    windows of `window` tracked beats (a slip of the tracker spoils only its
    own windows), then refined over the whole song together with the phase.
    The grid is used when, in windows of `check` beats, the best local phase
    stays on it (within 20 ms, or half a beat away, where the off-beats are
    louder) in at least `agree` of the windows, and when it sits on the
    attacks at least as well as the tracked beats. Windows at the start or
    the end that do not agree (a free intro, a slowing ending) keep the
    tracked beats. Returns {'grid' (the constant part), 'before' and 'after'
    (tracked beats kept outside it), 'bpm', 'agree'}."""
    b = np.asarray(beats, dtype=float)
    if len(b) < 2 * window:
        return None
    e = _peaks(envelope)
    if not len(e) or e.max() <= 0:
        return None
    P0 = float(np.median(np.diff(b)))
    periods = []
    for k in range(0, len(b) - window, window // 2):
        t0, t1 = b[k], b[k + window]
        best = (-1.0, P0)
        for P in np.arange(P0 * .92, P0 * 1.08, .25):
            s = float(_comb(e, rate, t0, int((t1 - t0) / P), P, np.arange(0, P, 4.0)).max())
            if s > best[0]:
                best = (s, float(P))
        periods.append(best[1])
    P1 = float(np.median(periods))
    t0, t1 = b[0] - P1, b[-1]
    best = (-1.0, P1, t0)
    for P in np.linspace(P1 * .996, P1 * 1.004, 161):
        phases = np.arange(0, P, 2.0)
        sc = _comb(e, rate, t0, int((t1 - t0) / P), P, phases)
        i = int(np.argmax(sc))
        if sc[i] > best[0]:
            best = (float(sc[i]), float(P), float(t0 + phases[i]))
    _, P, phi = best
    for P2 in np.linspace(P * .9998, P * 1.0002, 41):
        phases = np.arange(phi - t0 - 3, phi - t0 + 3, .25)
        sc = _comb(e, rate, t0, int((t1 - t0) / P2), P2, phases)
        i = int(np.argmax(sc))
        if sc[i] > best[0]:
            best = (float(sc[i]), float(P2), float(t0 + phases[i]))
    score, P, phi = best
    P, phi = _on_peaks(np.asarray(envelope, dtype=float), rate, P, phi, b[0], b[-1])
    tracked = float(e[np.clip(np.round(b / 1000 * rate).astype(int), 0, len(e) - 1)].mean())
    shifts = np.arange(-P / 2, P / 2, 2.0)
    k0, k1 = int(np.ceil((b[0] - phi) / P)), int((b[-1] - phi) / P)
    starts = list(range(k0, k1 - check + 1, check))
    if not starts:
        return None
    ok = []
    for k in starts:
        sc = _comb(e, rate, phi + k * P, check, P, shifts)
        x = float(shifts[int(np.argmax(sc))])
        ok.append(abs(x) <= 20 or abs(abs(x) - P / 2) <= 20)
    share = float(np.mean(ok))
    if share < agree or score < tracked:
        return None
    first = ok.index(True)
    last = len(ok) - 1 - ok[::-1].index(True)
    lo = phi + starts[first] * P if first else b[0] - P / 2
    hi = phi + (starts[last] + check) * P if last < len(ok) - 1 else b[-1] + P / 2
    grid = phi + np.arange(np.ceil((max(lo, 0.0) - phi) / P), np.floor((min(hi, duration) - phi) / P) + 1) * P
    grid = grid[(grid >= 0) & (grid < duration)]
    if len(grid) < 2 * check:
        return None
    return {'grid': [float(x) for x in grid], 'before': [int(x) for x in b if x < grid[0] - .6 * P],
            'after': [int(x) for x in b if x > grid[-1] + .6 * P], 'bpm': 60000 / P, 'agree': share}


def join(fit, grid):
    """The song's beats: the tracked ones kept before and after the grid, and
    the grid (as given, e.g. moved onto the attacks)."""
    return sorted({*fit['before'], *(int(round(x)) for x in grid), *fit['after']})
