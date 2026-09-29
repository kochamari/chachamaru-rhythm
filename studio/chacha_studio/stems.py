"""The song's parts heard apart: the singing, the drums and the rest.

In the whole mix the singing, the guitars and the drums overlap, so the
drafts cannot tell which attacks are the singing, and a chart is most fun
when it follows the singing. When this Mac has the separation environment
(scripts/setup-stems.sh: Demucs in _private/stems-venv, apart from the
Studio's own Python), the analysis separates the song (separate.py, about
20 s on an M4) and keeps features of its parts: the singing's attacks and
level, the other instruments' attacks, and the drum kit of the drum part
alone. Without it everything works as before, on the whole mix.

Only these features are kept; the separated audio is deleted.
"""
import os
import shutil
import subprocess
from pathlib import Path

import numpy as np

VERSION = 2
KEYS = ('vocal', 'voice', 'other', 'kick', 'snare', 'hat', 'drums')


def _root():
    return Path(__file__).resolve().parents[2]


def python():
    """The separation environment's Python, or None when it is not set up."""
    exe = Path(os.environ.get('CHACHA_STEMS_PYTHON') or _root() / '_private' / 'stems-venv' / 'bin' / 'python')
    return exe if exe.exists() else None


def usable(stems):
    return isinstance(stems, dict) and stems.get('version') == VERSION and all(k in stems for k in KEYS)


def separate(audio, work, timeout=900):
    """The parts of `audio` as mono 22.05 kHz arrays {'vocals', 'drums',
    'bass', 'other'}, or None when separation is not set up or fails."""
    from .core import ffmpeg
    exe = python()
    if exe is None:
        return None
    work = Path(work)
    work.mkdir(parents=True, exist_ok=True)
    wav, out = work / 'parts-input.wav', work / 'parts'
    env = {**os.environ, 'PYTHONPATH': str(_root() / 'studio'), 'TORCH_HOME': str(_root() / '_private' / 'models')}
    try:
        subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-i', str(audio), '-vn', '-ar', '44100', '-ac', '2', '-c:a', 'pcm_s16le', str(wav)], check=True, timeout=180)
        subprocess.run([str(exe), '-m', 'chacha_studio.separate', str(wav), str(out)], check=True, timeout=timeout, env=env, capture_output=True)
        return {name: np.load(out / f'{name}.npy') for name in ('vocals', 'drums', 'bass', 'other')}
    except (subprocess.SubprocessError, OSError, ValueError):
        return None
    finally:
        wav.unlink(missing_ok=True)
        shutil.rmtree(out, ignore_errors=True)


def _bands(y, sr, hop, lo=150, hi=5000):
    import librosa
    power = np.abs(librosa.stft(np.asarray(y, dtype=np.float32), n_fft=1024, hop_length=hop)) ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=1024)
    return power[(freqs >= lo) & (freqs < hi)]


def _rise(band, loud):
    from scipy.ndimage import maximum_filter1d
    comp = np.log1p(band / loud * 20)
    widened = maximum_filter1d(comp, size=3, axis=0)  # a sung note's slight glide is no new note
    before = np.concatenate([widened[:, :2], widened[:, :-2]], axis=1)
    return np.maximum(0.0, comp - before).sum(axis=0)


def features(parts, sr=22050):
    """Features of the separated parts (0..255, about 100 per second): the
    singing's attacks (vocal) and level (voice), the other instruments'
    attacks, and the drum kit of the drum part (kick, snare, hat, drums).
    The singing and the other instruments are measured on the scale of the
    whole song, so a quiet part's small wavering (a pad, a held chord) does
    not look like attacks."""
    from .drums import drum_features
    kit = drum_features(parts['drums'], sr)
    hop = int(round(sr / 100))
    whole = _bands(sum(parts.values()), sr, hop)
    loud = float(np.percentile(whole, 95)) + 1e-12
    top = float(np.percentile(_rise(whole, loud), 99.5)) + 1e-9
    level = float(np.percentile(np.sqrt(whole.mean(axis=0)), 99)) + 1e-9
    q = lambda a: [int(v) for v in np.round(np.clip(a, 0, 1) * 255)]  # noqa: E731
    vocals, other = _bands(parts['vocals'], sr, hop), _bands(parts['other'], sr, hop)
    return {'version': VERSION, 'rate': sr / hop, 'model': 'htdemucs', 'vocal': q(_rise(vocals, loud) / top),
            'voice': q(np.sqrt(vocals.mean(axis=0)) / level), 'other': q(_rise(other, loud) / top),
            'kick': kit['kick'], 'snare': kit['snare'], 'hat': kit['hat'], 'drums': kit['full']}


def analyse(audio, work):
    """Features of the song's parts, or None without separation."""
    parts = separate(audio, work)
    return features(parts) if parts else None
