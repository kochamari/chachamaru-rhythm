"""The drum kit analysis (drums.py) on synthetic songs whose drum parts are
known: an intro without drums, a rock verse, a fill, a four-on-the-floor
chorus with a clap on the backbeat, a break and the chorus again, over bass,
chords and a sung line. It fixes the beats (tempo, half-beat, bar start) for
every draft, and drives the drums-only draft style (v3), which players found
too plain as a whole chart and which is kept for comparison."""
import json
import os
import subprocess
import sys

import numpy as np
import pytest
import soundfile as sf
from scipy.signal import resample_poly

from chacha_studio import core, drums, generator

sys.path.insert(0, str(core.ROOT))
from scripts.compose import instruments as I  # noqa: E402
from scripts.compose.dsp import SR as SR_HI  # noqa: E402

SR = 22050
N = I.note


def render(bpm, bars, parts, lead_in=1.0, tail=2.0, seed=3):
    """parts: bar -> kind ('intro', 'verse', 'fill', 'chorus', 'break').
    Returns (mono 22.05 kHz audio, beats ms, kick ms, snare ms, duration ms)."""
    rng = np.random.default_rng(seed)
    beat = 60 / bpm
    total = lead_in + bars * 4 * beat + tail
    mix = np.zeros(int(total * SR_HI) + SR_HI)
    kicks, snares = [], []

    def add(sound, at, gain=1.0):
        i = int(round(at * SR_HI))
        k = min(len(sound), len(mix) - i)
        if k > 0:
            mix[i:i + k] += sound[:k] * gain

    def t(bar, b):
        return lead_in + (bar * 4 + b) * beat

    chords = [('A2', ['A3', 'C4', 'E4']), ('F2', ['F3', 'A3', 'C4']), ('C3', ['C4', 'E4', 'G4']), ('G2', ['G3', 'B3', 'D4'])]
    melody = []
    for bar in range(bars):
        kind = parts[bar]
        root, voicing = chords[bar % 4]
        add(I.pad(rng, [N(x) for x in voicing], 4 * beat, .6), t(bar, 0), .18)
        if kind != 'break':
            for k, b in enumerate([0, 1.5, 2.5]):
                melody.append((t(bar, b), beat * (1.4 if k == 0 else .9), N(voicing[k]) + 12, .7))
        if kind in ('intro', 'break'):
            continue
        for e in range(8):
            add(I.bass(rng, N(root), .4 * beat, .8), t(bar, e / 2), .35)
        if kind == 'verse':
            hits = {'k': [0, 2, 2.5], 's': [1, 3]}
            for e in range(8):
                add(I.hat(rng, .6 if e % 2 == 0 else .4), t(bar, e / 2), .22)
        elif kind == 'fill':
            hits = {'k': [0], 's': [1, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75]}
        else:
            hits = {'k': [0, 1, 2, 3], 's': [1, 3]}
            for e in range(4):
                add(I.hat(rng, .5, open_=True), t(bar, e + .5), .2)
        for b in hits['k']:
            add(I.kick(rng, .95), t(bar, b), .9)
            kicks.append(t(bar, b) * 1000)
        for b in hits['s']:
            add(I.snare(rng, .9 if b in (1, 3) else .6), t(bar, b), .7)
            snares.append(t(bar, b) * 1000)
    add(I.shinobue_phrase(rng, [(s - lead_in, d, m, v) for s, d, m, v in melody], total - lead_in), lead_in, .25)
    y = resample_poly(mix, 1, 2).astype(np.float32)
    y /= np.max(np.abs(y)) + 1e-9
    beats = [round(t(0, b) * 1000) for b in range(bars * 4)]
    return y * .8, beats, np.array(kicks), np.array(snares), round(total * 1000)


SONG = ['intro'] * 4 + ['verse'] * 8 + ['fill'] + ['chorus'] * 8 + ['break'] + ['chorus'] * 4


@pytest.fixture(scope='module')
def song():
    y, beats, kicks, snares, duration = render(120, len(SONG), SONG)
    kit = drums.drum_features(y, SR)
    features = {**generator.onset_features(y, SR), 'drums': kit}
    charts = {d: core.generate(beats, duration, d, 'ab' * 32, [], features, list(range(0, len(beats), 4)), 'drums') for d in ['easy', 'normal', 'hard']}
    return {'beats': beats, 'kicks': kicks, 'snares': snares, 'duration': duration, 'features': features, 'charts': charts, 'y': y}


def taps(chart, color=None):
    return [n for n in chart['notes'] if n['kind'] == 'tap' and (color is None or n['color'] == color)]


def near(times, targets, ms=30):
    targets = np.asarray(targets)
    return np.array([np.min(np.abs(targets - t)) <= ms for t in times]) if len(targets) else np.zeros(len(times), bool)


def bar_of(t, beats):
    return (int(np.searchsorted(beats, t + 1, side='right')) - 1) // 4


def test_don_is_the_bass_drum_and_ka_the_snare(song):
    normal = song['charts']['normal']
    drum_bars = {i for i, kind in enumerate(SONG) if kind in ('verse', 'chorus')}
    dons = [n['timeMs'] for n in taps(normal, 'don') if bar_of(n['timeMs'], song['beats']) in drum_bars]
    kas = [n['timeMs'] for n in taps(normal, 'ka') if bar_of(n['timeMs'], song['beats']) in drum_bars]
    assert len(dons) > 40 and len(kas) > 25
    assert near(dons, song['kicks']).mean() >= .9
    assert near(kas, song['snares']).mean() >= .9
    # Every backbeat of the grooves is a ka.
    backbeats = [s for s in song['snares'] if bar_of(s, song['beats']) in drum_bars]
    assert near(backbeats, kas).mean() >= .9


def test_bars_that_sound_alike_play_alike(song):
    beats = song['beats']
    for difficulty in ('normal', 'hard'):
        by_bar = {}
        for n in taps(song['charts'][difficulty]):
            bar = bar_of(n['timeMs'], beats)
            by_bar.setdefault(bar, []).append((round((n['timeMs'] - beats[bar * 4]) / 125), n['color']))
        for section in [range(5, 12), range(14, 21)]:
            same = [by_bar.get(b) == by_bar.get(b - 1) for b in section]
            assert np.mean(same) >= .8, (difficulty, section, [by_bar.get(b) for b in section])


def test_difficulties_step_up_and_easy_stays_on_the_beat(song):
    counts = {d: len(taps(c)) for d, c in song['charts'].items()}
    assert counts['easy'] < counts['normal'] < counts['hard']
    beats = np.asarray(song['beats'])
    assert near([n['timeMs'] for n in taps(song['charts']['easy'])], beats, 3).all()
    # Normal keeps to beats and eighths.
    eighths = np.sort(np.concatenate([beats, beats[:-1] + np.diff(beats) / 2]))
    assert near([n['timeMs'] for n in taps(song['charts']['normal'])], eighths, 3).all()


@pytest.mark.parametrize('difficulty,gap', [('easy', 180), ('normal', 105), ('hard', 75)])
def test_limits_and_determinism(song, difficulty, gap):
    chart = song['charts'][difficulty]
    again = core.generate(song['beats'], song['duration'], difficulty, 'ab' * 32, [], song['features'], list(range(0, len(song['beats']), 4)), 'drums')
    assert chart == again
    t = [n['timeMs'] for n in taps(chart)]
    assert all(b - a >= gap for a, b in zip(t, t[1:]))
    assert all(800 <= x <= song['duration'] - 300 for x in t)
    assert sum(n['size'] == 'large' for n in taps(chart)) <= max(1, len(t) * .1)
    for r in [n for n in chart['notes'] if n['kind'] == 'roll']:
        assert not any(r['timeMs'] - 90 <= x <= r['endMs'] + 90 for x in t)


def test_bar_start_follows_the_backbeat(song):
    scores = drums.bar_phase_scores(song['beats'], song['features']['drums'])
    assert int(np.argmax(scores)) % 2 == 0
    # Beats tracked half a beat late are moved back onto the drums.
    beats = song['beats']
    late = [b + 250 for b in beats[:-1]]
    moved, changed = drums.align_beats(late, song['features']['drums'])
    assert changed
    assert np.median(np.abs(np.asarray(moved) - np.asarray(beats[1:len(moved) + 1]))) <= 5


def test_a_fast_song_tracked_at_two_thirds_is_tracked_again():
    parts = ['verse'] * 6 + ['chorus'] * 6
    y, beats, _, _, duration = render(186, len(parts), parts, seed=5)
    kit = drums.drum_features(y, SR)
    wrong = list(range(beats[0], duration - 500, round(60000 / 124)))
    assert drums.tempo_alias(wrong, 124, kit)
    got, bpm, _, fixes = core.track_beats(y, SR, duration, kit, wrong, 124)
    assert 'tempo' in fixes and abs(bpm - 186) < 4
    truth = np.asarray(beats)
    assert np.median([np.min(np.abs(truth - b)) for b in got]) <= 12
    # A song at its own tempo is left alone.
    assert not drums.tempo_alias(beats, 186, kit)


def test_regenerating_an_older_project_fixes_its_beats(tmp_path):
    y, _, _, _, _ = render(120, len(SONG), SONG)
    wav = tmp_path / 'song.wav'
    sf.write(wav, y, SR)
    d = tmp_path / 'project'
    p = core.analyze(wav, d, '試験曲', '試験')
    assert p['manifest']['generator'] == 'chacha-generator-v8'
    truth = np.asarray(p['manifest']['beatTimesMs'])
    # As analysed before the drum features: none saved, and the beats half a beat late.
    features = json.loads((d / 'features.json').read_text())
    del features['drums']
    core.write_json(d / 'features.json', features)
    half = round(float(np.median(np.diff(truth))) / 2)
    late = [int(b) + half for b in truth if b + half < p['manifest']['durationMs']]
    p['manifest']['beatTimesMs'] = late
    p['manifest']['downbeatIndices'] = list(range(0, len(late), 4))
    core.validate(p)
    core.write_json(d / 'project.json', p)
    # The regeneration worker, as the Studio API starts it.
    work = d / 'jobs' / 'job'
    work.mkdir(parents=True)
    core.write_json(work / 'input.json', p)
    env = {**os.environ, 'PYTHONPATH': str(core.ROOT / 'studio')}
    subprocess.run([sys.executable, '-m', 'chacha_studio.regenerate_worker', str(work), 'normal'], check=True, env=env, timeout=180)
    assert json.loads((work / 'status.json').read_text())['status'] == 'REVIEW_READY'
    assert drums.usable(json.loads((d / 'features.json').read_text())['drums'])
    got = json.loads((work / 'candidate.json').read_text())
    core.validate(got)
    moved = np.asarray(got['manifest']['beatTimesMs'])
    assert np.median([np.min(np.abs(truth - b)) for b in moved]) <= 5
    normal = next(c for c in got['charts'] if c['difficulty'] == 'normal')
    assert len(taps(normal)) > 60
