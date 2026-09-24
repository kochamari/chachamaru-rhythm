"""Render the original songs, encode them and write the public song packs.

Run: .venv/bin/python -m scripts.compose.build [song ...]
Outputs web/public/original-demo/<file>.zip and catalog.json, and records the
SHA-256 of each pack in assets/manifest.json. Intermediate WAVs stay in
_private/songs-build/ (never published).
"""
import hashlib
import importlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'studio'))
from chacha_studio.core import ffmpeg, validate, export_project, write_json  # noqa: E402

from .dsp import SR  # noqa: E402

# (module, zip file name, revision). Revision bumps replace the bundled copy.
SONGS = [
    ('himawari', 'himawari.zip', 2),
    ('ondo', 'ondo.zip', 1),
    ('yuuyake', 'yuuyake.zip', 1),
    ('hanabi', 'hanabi.zip', 1),
]
GENERATOR = 'original-composition-v2'
PUBLIC = ROOT / 'web/public/original-demo'
WORK = ROOT / '_private/songs-build'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def decoded_ms(path):
    r = subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True)
    return len(r.stdout) / 4 / SR * 1000


def build(module_name, file_name, revision):
    mod = importlib.import_module(f'.songs.{module_name}', __package__)
    song = mod.build()
    audio = song.render()
    work = WORK / song.pack_id
    work.mkdir(parents=True, exist_ok=True)
    wav = work / 'original.wav'
    sf.write(wav, audio, SR, subtype='PCM_16')
    m4a = work / 'song.m4a'
    subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-i', str(wav), '-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', '160k', '-ar', str(SR), '-ac', '2', str(m4a)], check=True)
    h = sha(m4a)
    base = song.manifest_base()
    dur = decoded_ms(m4a)
    if abs(dur - base['durationMs']) > 100:
        raise SystemExit(f'{song.pack_id}: decoded {dur:.0f} ms vs manifest {base["durationMs"]} ms')
    charts = [song.charts[d] for d in ['easy', 'normal', 'hard']]
    manifest = {'schemaVersion': 1, 'packId': song.pack_id, 'revision': revision, 'title': song.title, 'artist': song.artist,
                'durationMs': base['durationMs'], 'audio': {'path': 'audio/song.m4a', 'sha256': h},
                'charts': [{'chartId': c['chartId'], 'difficulty': c['difficulty'], 'path': f"charts/{c['difficulty']}.json", 'sha256': '0' * 64} for c in charts],
                'beatTimesMs': base['beatTimesMs'], 'downbeatIndices': base['downbeatIndices'], 'sections': base['sections'], 'generator': GENERATOR}
    mono = audio.mean(axis=1)
    project = {'projectId': 'original-' + song.pack_id, 'revision': revision, 'manifest': manifest, 'charts': charts,
               'waveform': [round(float(np.max(np.abs(a))), 4) for a in np.array_split(mono, 1000)],
               'bpm': float(song.bpm), 'confidence': 'high', 'warnings': [],
               'analysis': {'sampleRate': 22050, 'hopLength': 256, 'audioSha256': h}, 'originalHash': sha(wav)}
    validate(project)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    target = PUBLIC / file_name
    export_project(project, work, target)
    stats = {d: {'taps': sum(1 for n in song.charts[d]['notes'] if n['kind'] == 'tap'), 'rolls': sum(1 for n in song.charts[d]['notes'] if n['kind'] == 'roll')} for d in ['easy', 'normal', 'hard']}
    print(json.dumps({'packId': song.pack_id, 'title': song.title, 'seconds': base['durationMs'] / 1000, 'bytes': target.stat().st_size, 'charts': stats}, ensure_ascii=False))
    return project, target


def main(names):
    catalog = []
    projects = {}
    for module_name, file_name, revision in SONGS:
        if names and module_name not in names:
            existing = PUBLIC / file_name
            if existing.exists():
                catalog.append({'packId': None, 'file': file_name, 'revision': revision, 'module': module_name})
            continue
        project, target = build(module_name, file_name, revision)
        projects[module_name] = project
        catalog.append({'packId': project['manifest']['packId'], 'file': file_name, 'revision': revision, 'module': module_name})
    # Fill packIds for songs not rebuilt this time from their zip manifest.
    import zipfile
    for entry in catalog:
        if entry['packId'] is None:
            with zipfile.ZipFile(PUBLIC / entry['file']) as z:
                entry['packId'] = json.loads(z.read('manifest.json'))['packId']
    write_json(PUBLIC / 'catalog.json', [{k: e[k] for k in ('packId', 'file', 'revision')} for e in catalog])
    if 'himawari' in projects:
        write_json(ROOT / 'fixtures/demo-project.json', projects['himawari'])
    # Public asset provenance with fresh hashes.
    manifest_path = ROOT / 'assets/manifest.json'
    assets = json.loads(manifest_path.read_text())
    keep = [a for a in assets['assets'] if not a['path'].startswith('web/public/original-demo/')]
    for entry in catalog:
        path = f"web/public/original-demo/{entry['file']}"
        keep.append({'path': path, 'sha256': sha(ROOT / path), 'provenance': f"Original composition and hand-authored charts rendered locally by scripts/compose ({entry['module']}.py); synthesised instruments, no samples", 'permission': 'Created for this project; included in public build; no user-provided private media'})
    keep.append({'path': 'web/public/original-demo/catalog.json', 'sha256': sha(PUBLIC / 'catalog.json'), 'provenance': 'Generated list of bundled original songs', 'permission': 'Created for this project; included in public build'})
    assets['assets'] = keep
    manifest_path.write_text(json.dumps(assets, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main(sys.argv[1:])
