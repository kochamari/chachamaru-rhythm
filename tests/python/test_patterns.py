"""The v6 rules on the synthetic songs: steady grids for songs that keep one
tempo (steady.py), and bar rhythms that stay readable (patterns.py): no
sixteenths on hard in a fast song, sixteenths only as a group from an
eighth, hardly any off-beat on its own, and bars that repeat a nearby bar."""
import json
import os
import subprocess
import sys

import numpy as np
import pytest
import soundfile as sf

from chacha_studio import core, drums, generator, steady

sys.path.insert(0, os.path.dirname(__file__))
import test_drums  # noqa: E402
import test_song_draft  # noqa: E402

SR = 22050


def taps(chart):
    return [n for n in chart['notes'] if n['kind'] == 'tap']


def positions(chart, beats):
    """(beat index, sixteenth 0-3) of each tap."""
    beats = np.asarray(beats, dtype=float)
    out = []
    for n in taps(chart):
        i = int(np.searchsorted(beats, n['timeMs'] + 1, side='right')) - 1
        q = int(round((n['timeMs'] - beats[i]) / (beats[i + 1] - beats[i]) * 4))
        out.append((i + 1, 0) if q == 4 else (i, q))
    return out


@pytest.fixture(scope='module')
def fast():
    y, beats, onsets, duration = test_song_draft.render(bpm=190)
    features = {**generator.onset_features(y, SR), 'drums': drums.drum_features(y, SR)}
    downbeats = list(range(0, len(beats), 4))
    charts = {d: core.generate(beats, duration, d, 'gh' * 32, [], features, downbeats) for d in ('easy', 'normal', 'hard')}
    return {'beats': beats, 'charts': charts}


def test_a_fast_song_has_no_sixteenths_and_hardly_a_lone_off_beat(fast):
    beats = fast['beats']
    hard = positions(fast['charts']['hard'], beats)
    assert hard and all(q in (0, 2) for _, q in hard)
    gaps = np.diff([n['timeMs'] for n in taps(fast['charts']['hard'])])
    assert gaps.min() >= (beats[1] - beats[0]) / 2 - 2
    # An off-beat on its own: no note on its beat, the beat before or the beat after.
    for d in ('normal', 'hard'):
        at = set(positions(fast['charts'][d], beats))
        off = [(i, q) for i, q in at if q == 2]
        lone = [(i, q) for i, q in off if not any((i + k, 0) in at for k in (-1, 0, 1))]
        assert len(lone) <= .02 * len(at), (d, lone)


def test_sixteenths_start_on_an_eighth():
    y, beats, onsets, duration = test_song_draft.render()
    features = {**generator.onset_features(y, SR), 'drums': drums.drum_features(y, SR)}
    hard = core.generate(beats, duration, 'hard', 'cd' * 32, [], features, list(range(0, len(beats), 4)))
    at = set(positions(hard, beats))
    sixteenths = [(i, q) for i, q in at if q in (1, 3)]
    assert sixteenths
    assert all((i, q - 1) in at for i, q in sixteenths)


def test_bars_repeat_a_bar_nearby(fast):
    """In the fast song's verse and chorus (a new sung line in every bar),
    at least a third of normal's bars play the rhythm of the bar before or
    two before."""
    beats = fast['beats']
    by_bar = {}
    for i, q in positions(fast['charts']['normal'], beats):
        by_bar.setdefault(i // 4, []).append((i % 4, q))
    bars = [b for b in range(3, 34) if b in by_bar]
    again = [b for b in bars if by_bar.get(b) in (by_bar.get(b - 1), by_bar.get(b - 2))]
    assert len(again) >= len(bars) / 3


def tracked_badly(truth, rng, slip=(40, 56)):
    """Beats as a tracker gives them in a busy song: a little early or late,
    and half a beat off for a stretch."""
    period = float(np.median(np.diff(truth)))
    out = np.asarray(truth, dtype=float) + rng.normal(0, 12, len(truth))
    out[slip[0]:slip[1]] += period / 2
    return [int(round(x)) for x in out]


def test_a_steady_grid_replaces_wandering_beats():
    parts = test_drums.SONG * 3
    y, truth, _, _, duration = test_drums.render(120, len(parts), parts, seed=7)
    kit = drums.drum_features(y, SR)
    beats = tracked_badly(truth, np.random.default_rng(1))
    fit = steady.steady_grid(beats, np.asarray(kit['full'], dtype=float) / 255, kit['rate'], duration)
    assert fit and abs(fit['bpm'] - 120) < .05
    grid, _ = generator.on_attacks(y, SR, fit['grid'])
    t = np.asarray(truth, dtype=float)
    # The grid covers the song from where the drums start (the intro without
    # drums keeps its tracked beats), and sits on the true beats.
    assert grid[0] <= t[4 * 4 + 1] and grid[-1] >= t[-2]
    assert max(np.min(np.abs(t - b)) for b in grid) <= 8
    got = steady.join(fit, grid)
    assert np.median([np.min(np.abs(t - b)) for b in got]) <= 6
    # The whole analysis step: the steady grid is taken.
    moved, bpm, _, fixes = core.track_beats(y, SR, duration, kit, beats, 118.0)
    assert 'steady' in fixes and abs(bpm - 120) < .05
    assert np.median([np.min(np.abs(t - b)) for b in moved]) <= 6


def test_a_song_that_changes_tempo_keeps_its_beats():
    parts = ['verse'] * 16 + ['chorus'] * 16
    a, first, _, _, _ = test_drums.render(110, len(parts), parts, tail=0.0, seed=4)
    b, second, _, _, _ = test_drums.render(140, len(parts), parts, lead_in=0.0, seed=5)
    y = np.concatenate([a, b])
    offset = len(a) / SR * 1000
    truth = [*first, *(t + offset for t in second)]
    kit = drums.drum_features(y, SR)
    fit = steady.steady_grid(truth, np.asarray(kit['full'], dtype=float) / 255, kit['rate'], round(len(y) / SR * 1000))
    assert fit is None


def test_regenerating_a_v5_project_puts_it_on_a_steady_grid(tmp_path):
    parts = test_drums.SONG * 2
    y, truth, _, _, _ = test_drums.render(120, len(parts), parts, seed=9)
    wav = tmp_path / 'song.wav'
    sf.write(wav, y, SR)
    d = tmp_path / 'project'
    p = core.analyze(wav, d, '試験曲', '試験')
    assert 'steady' in p['analysis']['beatFixes']
    # As drafted by v5 on beats that wander (the drum features are kept).
    beats = [b for b in tracked_badly(p['manifest']['beatTimesMs'], np.random.default_rng(2), (30, 44)) if 0 <= b < p['manifest']['durationMs']]
    p['manifest']['beatTimesMs'] = sorted(set(beats))
    p['manifest']['downbeatIndices'] = list(range(0, len(p['manifest']['beatTimesMs']), 4))
    p['manifest']['generator'] = 'chacha-generator-v5'
    core.validate(p)
    core.write_json(d / 'project.json', p)
    work = d / 'jobs' / 'job'
    work.mkdir(parents=True)
    core.write_json(work / 'input.json', p)
    env = {**os.environ, 'PYTHONPATH': str(core.ROOT / 'studio')}
    subprocess.run([sys.executable, '-m', 'chacha_studio.regenerate_worker', str(work), 'hard'], check=True, env=env, timeout=180)
    got = json.loads((work / 'candidate.json').read_text())
    core.validate(got)
    assert got['manifest']['generator'] == 'chacha-generator-v6'
    assert 'steady' in got['analysis']['beatFixes']
    t = np.asarray(truth, dtype=float)
    assert np.median([np.min(np.abs(t - b)) for b in got['manifest']['beatTimesMs']]) <= 6
