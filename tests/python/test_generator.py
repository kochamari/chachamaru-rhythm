"""Onset-aware chart drafts: beat latency, tempo, swing and limits."""
import numpy as np
import pytest
import librosa
from chacha_studio import generator

SR = 22050


def click_track(times_s, seconds, freq=180.0, bright=False):
    y = np.zeros(int(SR * seconds), dtype=np.float32)
    n = int(SR * .08)
    t = np.arange(n) / SR
    body = np.sin(2 * np.pi * freq * t) * np.exp(-t / .03)
    if bright:
        body = body * .3 + np.random.default_rng(1).standard_normal(n) * np.exp(-t / .01) * .7
    for s in times_s:
        i = int(round(s * SR))
        if i + n < len(y):
            y[i:i + n] += body.astype(np.float32)
    return y


def tracked(y):
    env = librosa.onset.onset_strength(y=y, sr=SR, hop_length=256)
    tempo, frames = librosa.beat.beat_track(onset_envelope=env, sr=SR, hop_length=256)
    beats = [round(float(t) * 1000) for t in librosa.frames_to_time(frames, sr=SR, hop_length=256)]
    return float(np.asarray(tempo).ravel()[0]), beats


def nearest_error(beats, truth):
    truth = np.asarray(truth)
    return np.median([b - truth[np.argmin(np.abs(truth - b))] for b in beats])


def test_refine_beats_removes_tracker_latency():
    truth = [1000 + i * 500 for i in range(56)]
    y = click_track([t / 1000 for t in truth], 30)
    bpm, beats = tracked(y)
    refined, bpm2, shift = generator.refine_beats(y, SR, beats, bpm)
    assert abs(nearest_error(refined, truth)) < 8
    assert shift < 0


def test_half_tempo_is_doubled_for_fast_songs():
    beat = 60000 / 172
    truth = [800 + i * beat for i in range(150)]
    y = click_track([t / 1000 for t in truth], 46)
    bpm, beats = tracked(y)
    refined, bpm2, _ = generator.refine_beats(y, SR, beats, bpm)
    assert 160 < bpm2 < 185
    assert abs(nearest_error(refined, truth)) < 8


def features_for(y):
    return generator.onset_features(y, SR)


def test_swing_is_detected_and_used():
    beat = 600
    times = []
    for i in range(60):
        times += [1000 + i * beat, 1000 + i * beat + beat * 2 / 3]
    y = click_track([t / 1000 for t in times], 40)
    f = features_for(y)
    beats = [1000 + i * beat for i in range(60)]
    full = np.asarray(f['full'], dtype=float) / 255
    assert generator.detect_swing(beats, full, f['rate'])
    chart = generator.generate(beats, 40000, 'normal', 'ab' * 32, [], f, list(range(0, 60, 4)))
    taps = [n['timeMs'] for n in chart['notes'] if n['kind'] == 'tap']
    offbeats = [t for t in taps if (t - 1000) % beat not in (0,)]
    assert offbeats, 'swung off-beats are charted'
    assert all(abs(((t - 1000) % beat) - beat * 2 / 3) < 3 for t in offbeats)


@pytest.mark.parametrize('difficulty,spacing,max_ka', [('easy', 180, .2), ('normal', 105, .3), ('hard', 75, .4)])
def test_feature_drafts_follow_attacks_and_limits(difficulty, spacing, max_ka):
    beat = 500
    rng = np.random.default_rng(3)
    lows, highs = [], []
    for i in range(110):
        t = 1000 + i * beat
        lows.append(t)
        if i % 2 == 1:
            highs.append(t)
        if rng.uniform() < .5:
            lows.append(t + beat / 2)
    y = click_track([t / 1000 for t in lows], 58) + click_track([t / 1000 for t in highs], 58, bright=True)
    f = features_for(y)
    beats = [1000 + i * beat for i in range(112)]
    a = generator.generate(beats, 58000, difficulty, 'cd' * 32, [{'kind': 'chorus', 'startMs': 30000, 'endMs': 46000, 'confirmed': False}], f, list(range(0, 112, 4)))
    b = generator.generate(beats, 58000, difficulty, 'cd' * 32, [{'kind': 'chorus', 'startMs': 30000, 'endMs': 46000, 'confirmed': False}], f, list(range(0, 112, 4)))
    assert a == b
    taps = [n for n in a['notes'] if n['kind'] == 'tap']
    assert len(taps) > 20
    onsets = np.array(sorted(set(lows) | set(highs)))
    assert np.mean([np.min(np.abs(onsets - n['timeMs'])) <= 30 for n in taps]) > .9
    assert all(y2['timeMs'] - x['timeMs'] >= spacing for x, y2 in zip(taps, taps[1:]))
    assert sum(n['color'] == 'ka' for n in taps) / len(taps) <= max_ka
    assert sum(n['size'] == 'large' for n in taps) <= len(taps) * .1
    rolls = [n for n in a['notes'] if n['kind'] == 'roll']
    for r in rolls:
        assert not any(r['timeMs'] - 90 <= n['timeMs'] <= r['endMs'] + 90 for n in taps)


def test_chorus_candidates_are_distinct_loud_parts():
    from chacha_studio import core
    sr = SR
    y = np.random.default_rng(5).standard_normal(sr * 100).astype(np.float32) * .02
    for a, b in [(20, 36), (60, 76)]:
        y[a * sr:b * sr] *= 12
    beats = list(range(0, 100000, 500))
    found = core.chorus_candidates(y, sr, 100000, beats)
    assert 1 <= len(found) <= 3
    starts = sorted(s for s, e in found)
    assert all(b - a >= 16000 + 8000 for a, b in zip(starts, starts[1:]))
    assert any(abs(s - 20000) <= 2000 for s in starts) and any(abs(s - 60000) <= 2000 for s in starts)
    assert all(s in beats for s in starts)
