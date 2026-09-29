"""Separate a song into its parts with Demucs (htdemucs).

Run by the separation environment's Python (_private/stems-venv, see
stems.py), not by the Studio's own: it imports only the standard library,
NumPy, PyTorch and Demucs. A 44.1 kHz WAV in; mono 22.05 kHz float32 .npy
files out, one per part (vocals, drums, bass, other). The model comes from
Meta's server (dl.fbaipublicfiles.com), checked against its hash, and is
kept in TORCH_HOME.

Usage: python -m chacha_studio.separate <song.wav> <output folder>
"""
import os
import sys
import wave
from pathlib import Path

import numpy as np

SAMPLE_RATE = 22050


def model():
    from demucs.pretrained import REMOTE_ROOT, _parse_remote_files
    from demucs.repo import AnyModelRepo, BagOnlyRepo, RemoteRepo
    repo = RemoteRepo(_parse_remote_files(REMOTE_ROOT / 'files.txt'))
    m = AnyModelRepo(repo, BagOnlyRepo(REMOTE_ROOT, repo)).get_model('htdemucs')
    m.eval()
    return m


def read(path):
    with wave.open(str(path)) as w:
        if w.getsampwidth() != 2:
            raise ValueError('16-bit PCM only')
        rate, channels = w.getframerate(), w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return x.reshape(-1, channels).T, rate


def main(source, target):
    try:
        import certifi  # this Python may not find the system's certificates
        os.environ.setdefault('SSL_CERT_FILE', certifi.where())
    except ImportError:
        pass
    import julius
    import torch
    from demucs.apply import apply_model
    m = model()
    x, rate = read(source)
    if rate != m.samplerate:
        raise ValueError(f'{m.samplerate} Hz audio expected')
    if x.shape[0] == 1:
        x = np.repeat(x, 2, axis=0)
    song = torch.from_numpy(np.ascontiguousarray(x))
    mono = song.mean(0)
    centre, scale = float(mono.mean()), float(mono.std()) + 1e-8
    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    with torch.no_grad():
        parts = apply_model(m, ((song - centre) / scale)[None], device=device, shifts=0, split=True, overlap=.25, progress=False)[0]
    parts = parts * scale + centre
    target = Path(target)
    target.mkdir(parents=True, exist_ok=True)
    for name, part in zip(m.sources, parts):
        down = julius.resample_frac(part.mean(0).cpu(), m.samplerate, SAMPLE_RATE)
        np.save(target / f'{name}.npy', down.numpy().astype(np.float32))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
