"""Signal helpers for the original song composer. Numpy/SciPy only; no samples."""
import numpy as np
from scipy import signal

SR = 44100


def secs(n):
    return np.arange(n) / SR


def length(dur):
    return max(1, int(round(dur * SR)))


def biquad(kind, freq, q=0.707, gain_db=0.0):
    """RBJ cookbook biquad coefficients."""
    freq = min(max(freq, 10.0), SR * 0.45)
    w = 2 * np.pi * freq / SR
    cos, sin = np.cos(w), np.sin(w)
    alpha = sin / (2 * q)
    a_gain = 10 ** (gain_db / 40)
    if kind == 'lowpass':
        b = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2]
        a = [1 + alpha, -2 * cos, 1 - alpha]
    elif kind == 'highpass':
        b = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
        a = [1 + alpha, -2 * cos, 1 - alpha]
    elif kind == 'bandpass':
        b = [alpha, 0, -alpha]
        a = [1 + alpha, -2 * cos, 1 - alpha]
    elif kind == 'peak':
        b = [1 + alpha * a_gain, -2 * cos, 1 - alpha * a_gain]
        a = [1 + alpha / a_gain, -2 * cos, 1 - alpha / a_gain]
    elif kind == 'lowshelf':
        sq = 2 * np.sqrt(a_gain) * alpha
        b = [a_gain * ((a_gain + 1) - (a_gain - 1) * cos + sq), 2 * a_gain * ((a_gain - 1) - (a_gain + 1) * cos), a_gain * ((a_gain + 1) - (a_gain - 1) * cos - sq)]
        a = [(a_gain + 1) + (a_gain - 1) * cos + sq, -2 * ((a_gain - 1) + (a_gain + 1) * cos), (a_gain + 1) + (a_gain - 1) * cos - sq]
    elif kind == 'highshelf':
        sq = 2 * np.sqrt(a_gain) * alpha
        b = [a_gain * ((a_gain + 1) + (a_gain - 1) * cos + sq), -2 * a_gain * ((a_gain - 1) + (a_gain + 1) * cos), a_gain * ((a_gain + 1) + (a_gain - 1) * cos - sq)]
        a = [(a_gain + 1) - (a_gain - 1) * cos + sq, 2 * ((a_gain - 1) - (a_gain + 1) * cos), (a_gain + 1) - (a_gain - 1) * cos - sq]
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return b, a


def filt(x, kind, freq, q=0.707, gain_db=0.0):
    b, a = biquad(kind, freq, q, gain_db)
    return signal.lfilter(b, a, x, axis=0)


def noise(n, rng):
    return rng.standard_normal(n)


def decay(n, tau):
    return np.exp(-secs(n) / tau)


def attack(n, ms):
    k = max(1, int(SR * ms / 1000))
    e = np.ones(n)
    e[:k] = np.linspace(0, 1, min(k, n))[:k] if n >= k else np.linspace(0, 1, n)
    return e


def fade_out(x, ms):
    k = min(len(x), max(1, int(SR * ms / 1000)))
    x = x.copy()
    x[-k:] *= np.linspace(1, 0, k)
    return x


def swept_sine(n, f_start, f_end, tau, phase=0.0):
    """Sine whose frequency glides exponentially from f_start to f_end."""
    t = secs(n)
    f = f_end + (f_start - f_end) * np.exp(-t / tau)
    ph = phase + 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph)


def modal(n, freqs, amps, taus, glide=0.0, glide_tau=0.02):
    """Sum of damped sinusoids (membranes, bars, bells)."""
    t = secs(n)
    out = np.zeros(n)
    bend = 1 + glide * np.exp(-t / glide_tau)
    for f, a, tau in zip(freqs, amps, taus):
        ph = 2 * np.pi * np.cumsum(f * bend) / SR
        out += a * np.sin(ph) * np.exp(-t / tau)
    return out


def ks_pluck(freq, dur, rng, brightness=0.6, feedback=0.996, pick=0.5):
    """Karplus-Strong string via an IIR comb (fast C loop through lfilter)."""
    n = length(dur)
    period = max(2, int(round(SR / freq)))
    burst = rng.uniform(-1, 1, period)
    # Pick position comb and brightness lowpass shape the excitation.
    shift = max(1, int(period * pick))
    burst = burst - np.roll(burst, shift) * 0.5
    burst = filt(burst, 'lowpass', 400 + brightness * 9000)
    x = np.zeros(n)
    x[:period] = burst
    a = np.zeros(period + 2)
    a[0] = 1
    a[period] = -0.5 * feedback
    a[period + 1] = -0.5 * feedback
    y = signal.lfilter([1.0], a, x)
    return y / (np.max(np.abs(y)) + 1e-9)


def fm(n, freq, ratio, index, index_tau, amp_tau, detune=0.0):
    t = secs(n)
    mod = index * np.exp(-t / index_tau) * np.sin(2 * np.pi * freq * ratio * t)
    return np.sin(2 * np.pi * freq * (1 + detune) * t + mod) * np.exp(-t / amp_tau)


def saw(n, freq, rng=None, detune_cents=0.0):
    f = freq * 2 ** (detune_cents / 1200)
    phase = (np.arange(n) * f / SR + (rng.uniform() if rng is not None else 0)) % 1.0
    return 2 * phase - 1


def pan_gains(pan):
    """Constant-power pan: -1 left .. +1 right."""
    angle = (pan + 1) * np.pi / 4
    return np.cos(angle), np.sin(angle)


def reverb_ir(seconds, rng, predelay=0.012, damping=5200, width=1.0):
    n = length(seconds)
    t = secs(n)
    env = np.exp(-t * 6.9 / seconds)
    left = noise(n, rng) * env
    right = noise(n, rng) * env
    right = width * right + (1 - width) * left
    left = filt(left, 'lowpass', damping)
    right = filt(right, 'lowpass', damping)
    pad = np.zeros(int(predelay * SR))
    ir = np.stack([np.concatenate([pad, left]), np.concatenate([pad, right])], axis=1)
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def convolve_stereo(x, ir):
    out = np.zeros((x.shape[0] + ir.shape[0] - 1, 2))
    for ch in range(2):
        out[:, ch] = signal.fftconvolve(x[:, ch], ir[:, ch])
    return out[:x.shape[0]]


def compress(x, threshold_db=-18.0, ratio=2.5, attack_ms=8, release_ms=160, makeup_db=0.0):
    """Stereo-linked RMS compressor."""
    mono = np.max(np.abs(x), axis=1)
    level = np.maximum(mono, 1e-6)
    a_att = np.exp(-1 / (SR * attack_ms / 1000))
    a_rel = np.exp(-1 / (SR * release_ms / 1000))
    db = 20 * np.log10(level)
    over = np.maximum(0, db - threshold_db)
    target = -over * (1 - 1 / ratio)
    # One-pole smoothing with different attack/release coefficients.
    gain = np.empty_like(target)
    g = 0.0
    for i in range(0, len(target), 64):
        chunk = target[i:i + 64].min()
        coef = a_att ** 64 if chunk < g else a_rel ** 64
        g = coef * g + (1 - coef) * chunk
        gain[i:i + 64] = g
    return x * (10 ** ((gain + makeup_db) / 20))[:, None]


def limit(x, ceiling=0.95, lookahead_ms=4, release_ms=60):
    """Look-ahead peak limiter (block-wise, smooth)."""
    from scipy.ndimage import maximum_filter1d, uniform_filter1d
    peak = np.max(np.abs(x), axis=1)
    la = max(1, int(SR * lookahead_ms / 1000))
    need = np.minimum(1.0, ceiling / np.maximum(maximum_filter1d(peak, size=2 * la + 1), 1e-9))
    need = np.minimum.accumulate(need[::-1])[::-1] if False else need
    smooth = uniform_filter1d(need, size=la)
    # Release: gain may rise slowly.
    rel = np.exp(-1 / (SR * release_ms / 1000))
    out = np.empty_like(smooth)
    g = 1.0
    for i in range(0, len(smooth), 32):
        target = smooth[i:i + 32].min()
        g = target if target < g else rel ** 32 * g + (1 - rel ** 32) * target
        out[i:i + 32] = g
    y = x * out[:, None]
    return np.clip(y, -ceiling, ceiling)


def db_to_gain(db):
    return 10 ** (db / 20)
