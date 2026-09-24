"""Original synthesised instruments for the festival songs.

Every sound is generated from oscillators, filtered noise and plucked-string
models. Nothing is sampled from recordings or other games.
"""
import numpy as np
from .dsp import (SR, length, secs, filt, noise, decay, attack, modal, swept_sine, ks_pluck, fm, saw, fade_out)


def _norm(x, peak=1.0):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


# ------------------------------------------------------------- percussion --

def odaiko(rng, vel=1.0, size=1.0):
    """Big festival drum: deep swept membrane, woody thump, stick contact."""
    n = length(1.3)
    f0 = 58 / size
    body = modal(n, [f0, f0 * 1.52, f0 * 2.03, f0 * 2.64], [1, .45, .26, .12], [.62, .32, .18, .09], glide=.62, glide_tau=.035)
    thump = filt(noise(n, rng), 'lowpass', 700) * decay(n, .05) * 1.6
    click = filt(noise(n, rng), 'bandpass', 1900, 1.1) * decay(n, .004) * (.5 + .5 * vel)
    x = (body + thump + click) * attack(n, 1.2)
    x = np.tanh(x * 1.5)
    return _norm(fade_out(x, 60), vel)


def chudaiko(rng, vel=1.0):
    """Mid drum used for the main rhythm."""
    n = length(.7)
    f0 = 118
    body = modal(n, [f0, f0 * 1.55, f0 * 2.1], [1, .4, .22], [.3, .14, .07], glide=.55, glide_tau=.025)
    shell = filt(noise(n, rng), 'bandpass', 420, 1.3) * decay(n, .03) * 2.0
    click = filt(noise(n, rng), 'bandpass', 2600, .9) * decay(n, .003) * .7
    x = np.tanh((body + shell + click) * 1.6 * attack(n, .8))
    return _norm(fade_out(x, 40), vel)


def fuchi(rng, vel=1.0):
    """Drum rim stroke (the 'ka' sound of the ensemble)."""
    n = length(.22)
    x = modal(n, [930, 1870, 2890, 4100], [.8, .45, .28, .12], [.05, .032, .02, .012], glide=.01, glide_tau=.01)
    x += filt(noise(n, rng), 'bandpass', 3000, 1.0) * decay(n, .008) * 2.2
    x += filt(noise(n, rng), 'bandpass', 700, 2.0) * decay(n, .016) * 1.0
    return _norm(fade_out(np.tanh(x * 1.3), 20), vel)


def shime(rng, vel=1.0):
    """Small high-tension drum: crisp 'ten' / 'tsu'."""
    n = length(.26)
    f0 = 480 + 60 * vel
    x = modal(n, [f0, f0 * 1.62, f0 * 2.31], [1, .38, .18], [.085, .045, .025], glide=.18, glide_tau=.008)
    x += filt(noise(n, rng), 'bandpass', 3200, .8) * decay(n, .005) * 1.4
    return _norm(fade_out(np.tanh(x * 1.4), 20), vel)


def kane(rng, vel=1.0, damped=False):
    """Hand gong (atarigane): bright inharmonic ring, 'chan' or damped 'chiki'."""
    n = length(.12 if damped else .6)
    base = 1520
    ratios = [1, 1.47, 2.09, 2.56, 3.11, 4.23, 5.4]
    taus = [.05, .04, .032, .025, .02, .015, .012] if damped else [.34, .22, .16, .12, .09, .06, .045]
    x = modal(n, [base * r for r in ratios], [1, .7, .55, .45, .32, .2, .12], taus)
    x += filt(noise(n, rng), 'highpass', 5000) * decay(n, .01) * .8
    return _norm(fade_out(x, 15), vel)


def hyoshigi(rng, vel=1.0):
    """Wooden clappers: a single very sharp 'kan!'."""
    n = length(.35)
    x = modal(n, [2380, 3920, 6100], [1, .5, .22], [.07, .04, .02])
    x += filt(noise(n, rng), 'bandpass', 3000, 1.5) * decay(n, .003) * 2
    return _norm(fade_out(x, 30), vel)


def kick(rng, vel=1.0):
    n = length(.45)
    x = swept_sine(n, 160, 46, .03) * decay(n, .22)
    x += filt(noise(n, rng), 'bandpass', 3500, 1) * decay(n, .002) * .5
    return _norm(fade_out(np.tanh(x * 1.8), 30), vel)


def snare(rng, vel=1.0):
    n = length(.35)
    tone = modal(n, [188, 330], [1, .5], [.07, .04])
    rattle = filt(filt(noise(n, rng), 'highpass', 1500), 'lowpass', 9000) * decay(n, .13)
    x = tone * .7 + rattle * 1.1
    return _norm(fade_out(np.tanh(x * 1.4), 30), vel)


def clap(rng, vel=1.0):
    n = length(.4)
    x = np.zeros(n)
    for i, delay in enumerate([0, .009, .017, .026]):
        k = int(delay * SR)
        burst = filt(noise(n - k, rng), 'bandpass', 1300, 1.2) * decay(n - k, .006 if i < 3 else .12)
        x[k:] += burst
    return _norm(fade_out(x, 30), vel)


def hat(rng, vel=1.0, open_=False):
    n = length(.4 if open_ else .09)
    x = filt(noise(n, rng), 'highpass', 7200) * decay(n, .16 if open_ else .022)
    x += modal(n, [7350, 9830], [.2, .15], [.04, .03])
    return _norm(fade_out(x, 10), vel)


def crash(rng, vel=1.0):
    n = length(2.2)
    x = filt(noise(n, rng), 'highpass', 3800) * decay(n, .7)
    x += modal(n, [3100, 4450, 5890, 7210], [.3, .25, .2, .15], [.9, .7, .5, .4]) * .5
    return _norm(fade_out(x, 200), vel)


def shaker(rng, vel=1.0):
    n = length(.12)
    x = filt(noise(n, rng), 'bandpass', 6500, 1.5) * (attack(n, 12) * decay(n, .03))
    return _norm(x, vel)


# ------------------------------------------------------------- pitched ---

def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


NOTE_NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def note(name):
    """'D5', 'F#4', 'Bb3' -> midi number."""
    base = NOTE_NAMES[name[0]]
    i = 1
    while i < len(name) and name[i] in '#b':
        base += 1 if name[i] == '#' else -1
        i += 1
    return base + 12 * (int(name[i:]) + 1)


def shinobue_phrase(rng, notes, total, vib_depth=.012):
    """Bamboo-flute line with glides, vibrato and breath.

    notes: list of (start_s, dur_s, midi, vel). Legato notes closer than 30 ms
    are joined with a short pitch glide like a flute player's finger change.
    """
    n = length(total)
    freq = np.zeros(n)
    amp = np.zeros(n)
    t = secs(n)
    for i, (start, dur, m, vel) in enumerate(notes):
        a, b = int(start * SR), min(n, int((start + dur) * SR))
        if b <= a:
            continue
        f = midi_hz(m)
        seg = np.full(b - a, f)
        prev = notes[i - 1] if i else None
        if prev and abs(prev[0] + prev[1] - start) < .03:
            g = min(b - a, int(.045 * SR))
            seg[:g] = np.linspace(midi_hz(prev[2]), f, g)
        # Ornament: small upward flip into long notes.
        if dur > .45 and not (prev and abs(prev[0] + prev[1] - start) < .03):
            g = min(b - a, int(.06 * SR))
            seg[:g] = f * 2 ** (np.linspace(-1.2, 0, g) / 12)
        freq[a:b] = seg
        k = b - a
        env = np.ones(k)
        at = min(k, int(.035 * SR))
        env[:at] = np.linspace(0, 1, at) ** .7
        rl = min(k, int(.06 * SR))
        env[-rl:] *= np.linspace(1, 0, rl)
        # Gentle swell on long notes.
        env *= 0.85 + 0.15 * np.clip(secs(k) / max(dur, .2), 0, 1)
        vib = 1 + vib_depth * np.sin(2 * np.pi * 5.6 * secs(k)) * np.clip((secs(k) - .18) / .25, 0, 1)
        freq[a:b] *= vib
        amp[a:b] = np.maximum(amp[a:b], env * vel)
    freq[freq == 0] = 440
    phase = 2 * np.pi * np.cumsum(freq) / SR
    tone = np.sin(phase) + .22 * np.sin(2 * phase + .3) + .07 * np.sin(3 * phase) + .03 * np.sin(4 * phase)
    breath = filt(noise(n, rng), 'bandpass', 2600, .7) * .09 + filt(noise(n, rng), 'highpass', 6000) * .03
    x = (tone + breath) * amp
    # Chiff: breath burst at each note onset.
    for start, dur, m, vel in notes:
        a = int(start * SR)
        k = min(n - a, int(.03 * SR))
        if k > 0:
            x[a:a + k] += filt(noise(k, rng), 'bandpass', midi_hz(m) * 2.2, 1.2) * np.linspace(.35, 0, k) * vel
    del t
    return x


def shamisen(rng, m, vel=1.0, dur=.9):
    """Plucked lute with a bright plectrum attack and 'sawari' buzz."""
    f = midi_hz(m)
    x = ks_pluck(f, dur, rng, brightness=.95, feedback=.992, pick=.12)
    n = len(x)
    buzz = filt(noise(n, rng), 'bandpass', min(9000, f * 6), 3) * np.abs(x) * .35
    bachi = filt(noise(n, rng), 'highpass', 2500) * decay(n, .004) * .6
    y = np.tanh((x + buzz + bachi) * 1.4) * decay(n, dur * .5)
    return _norm(fade_out(y, 25), vel)


def koto(rng, m, vel=1.0, dur=1.6):
    f = midi_hz(m)
    x = ks_pluck(f, dur, rng, brightness=.55, feedback=.9975, pick=.3)
    n = len(x)
    x = filt(x, 'peak', f * 3, 1.0, 4)
    x += filt(noise(n, rng), 'bandpass', 3500, 1.4) * decay(n, .003) * .4
    return _norm(fade_out(x * decay(n, dur * .6), 60), vel)


def bass(rng, m, dur, vel=1.0, style='round'):
    n = length(dur + .08)
    f = midi_hz(m)
    t = secs(n)
    if style == 'pluck':
        x = ks_pluck(f, dur + .08, rng, brightness=.35, feedback=.998, pick=.4)
        x = filt(x, 'lowpass', 1400)
    else:
        x = np.sin(2 * np.pi * f * t) + .35 * np.sin(4 * np.pi * f * t) + .12 * filt(saw(n, f, rng), 'lowpass', 900)
    env = attack(n, 6) * np.clip((dur + .08 - t) / .08, 0, 1)
    env *= .75 + .25 * np.exp(-t / .15)
    return _norm(x * env, vel)


def pad(rng, midis, dur, vel=1.0, bright=1800):
    n = length(dur + .5)
    t = secs(n)
    x = np.zeros(n)
    for m in midis:
        f = midi_hz(m)
        for cents in (-7, 0, 7):
            x += saw(n, f, rng, cents)
    x = filt(filt(x, 'lowpass', bright), 'highpass', 120)
    env = np.clip(t / .18, 0, 1) * np.clip((dur + .5 - t) / .45, 0, 1)
    return _norm(x * env, vel)


def organ(rng, midis, dur, vel=1.0):
    """Reedy accordion-like chord for the ondo song."""
    n = length(dur + .15)
    t = secs(n)
    x = np.zeros(n)
    for m in midis:
        f = midi_hz(m)
        ph = 2 * np.pi * f * t
        x += np.sin(ph) + .5 * np.sin(2 * ph) + .33 * np.sin(3 * ph) + .2 * np.sin(4 * ph) + .1 * np.sin(6 * ph)
    trem = 1 + .06 * np.sin(2 * np.pi * 5.2 * t)
    env = np.clip(t / .03, 0, 1) * np.clip((dur + .15 - t) / .12, 0, 1)
    return _norm(filt(x, 'lowpass', 3200) * env * trem, vel)


def epiano(rng, m, dur, vel=1.0):
    n = length(dur + .6)
    f = midi_hz(m)
    x = fm(n, f, 1.0, 1.8 * vel + .4, .35, 1.1) + .25 * fm(n, f, 14.0, .6, .02, .08)
    t = secs(n)
    x *= np.clip((dur + .6 - t) / .35, 0, 1)
    return _norm(x, vel)


def bell(rng, m, vel=1.0, dur=1.2):
    n = length(dur)
    f = midi_hz(m)
    x = fm(n, f, 3.5, 2.4, .1, dur * .32) + .35 * fm(n, f * 2, 1.0, .5, .05, dur * .2)
    return _norm(fade_out(x, 30), vel)


def pluck_lead(rng, m, dur, vel=1.0):
    """Bright synth pluck for the pop songs' hooks."""
    n = length(dur + .25)
    f = midi_hz(m)
    t = secs(n)
    x = saw(n, f, rng, -6) + saw(n, f, rng, 6) + .5 * np.sign(np.sin(2 * np.pi * f * t))
    cutoff_env = 900 + 5200 * np.exp(-t / .09)
    # Time-varying filter approximated by blending two static filters.
    lo = filt(x, 'lowpass', 1100, 1.2)
    hi = filt(x, 'lowpass', 5200, 1.0)
    mix = np.clip((cutoff_env - 900) / 5200, 0, 1)
    y = lo * (1 - mix) + hi * mix
    env = attack(n, 3) * np.exp(-t / .5) * np.clip((dur + .25 - t) / .2, 0, 1)
    return _norm(y * env, vel)
