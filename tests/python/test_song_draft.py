"""The default draft (v6, patterns.py) on a synthetic song whose parts are
known: intro, verse, chorus, the second verse and chorus (the same music
again) and an outro. The verse's drums keep to the beats, so its off-beat
eighths come only from the sung line; the chorus is busier."""
import sys

import numpy as np
import pytest
from scipy.signal import resample_poly

from chacha_studio import core, drums, generator

sys.path.insert(0, str(core.ROOT))
from scripts.compose import instruments as I  # noqa: E402
from scripts.compose.dsp import SR as SR_HI  # noqa: E402

SR = 22050
N = I.note
PARTS = ['intro'] * 2 + ['verse'] * 8 + ['chorus'] * 8 + ['verse'] * 8 + ['chorus'] * 8 + ['outro'] * 2
# The sung line: note starts (in beats) per bar of each part.
VERSE = [[0, 1, 1.5, 2.5], [0, .5, 1, 2, 3], [0, 1.5, 2, 2.5, 3.5], [0, 2], [0, 1, 1.5, 2.5], [0, .5, 1, 2, 3.5], [.5, 1, 2, 3], [0, 2.5]]
CHORUS = [[0, .5, 1, 2, 2.5, 3], [0, 1, 2, 3], [0, .5, 1.5, 2, 3], [0, 2, 3, 3.5], [0, .5, 1, 2, 2.5, 3], [0, 1, 2, 3], [.5, 1, 1.5, 2, 3], [0, 2]]
CHORDS = [('A2', ['A3', 'C4', 'E4']), ('F2', ['F3', 'A3', 'C4']), ('C3', ['C4', 'E4', 'G4']), ('G2', ['G3', 'B3', 'D4'])]


def render(bpm=120, lead_in=1.0, tail=2.0, seed=11, parts=False):
    """The song (mono 22.05 kHz), its beats, the melody's and drums' onsets
    (ms) and its length; with parts=True also each part alone, as a
    separation would give them (the sung line as 'vocals')."""
    rng = np.random.default_rng(seed)
    beat = 60 / bpm
    total = lead_in + len(PARTS) * 4 * beat + tail
    mix = np.zeros(int(total * SR_HI) + SR_HI)
    alone = {name: np.zeros_like(mix) for name in ('vocals', 'drums', 'bass', 'other')}
    onsets = {'melody': [], 'drums': []}

    def add(sound, at, gain=1.0, part='other'):
        i = int(round(at * SR_HI))
        k = min(len(sound), len(mix) - i)
        if k > 0:
            mix[i:i + k] += sound[:k] * gain
            alone[part][i:i + k] += sound[:k] * gain

    def t(bar, b):
        return lead_in + (bar * 4 + b) * beat

    index = {'verse': 0, 'chorus': 0}
    for bar, kind in enumerate(PARTS):
        root, voicing = CHORDS[bar % 4]
        add(I.pad(rng, [N(x) for x in voicing], 4 * beat, .6), t(bar, 0), .12)
        if kind in ('intro', 'outro'):
            for b in range(4):
                add(I.hat(rng, .5), t(bar, b), .15, 'drums')
            continue
        line = (VERSE if kind == 'verse' else CHORUS)[index[kind] % 8]
        index[kind] += 1
        tones = [N(v) + 12 for v in voicing]
        for k, b in enumerate(line):
            add(I.pluck_lead(rng, tones[(k + bar) % 3], .4 * beat, .9), t(bar, b), .5, 'vocals')
            onsets['melody'].append(t(bar, b) * 1000)
        if kind == 'verse':
            kicks, snares, hats = [0, 2], [1, 3], [0, 1, 2, 3]
            bass = [0, 2]
        else:
            kicks, snares, hats = [0, 1, 2, 3], [1, 3], [.5, 1.5, 2.5, 3.5]
            bass = [0, .5, 1, 1.5, 2, 2.5, 3, 3.5]
        for b in bass:
            add(I.bass(rng, N(root), .4 * beat, .8), t(bar, b), .3, 'bass')
        for b in hats:
            add(I.hat(rng, .5, open_=kind == 'chorus'), t(bar, b), .15, 'drums')
        for b in kicks:
            add(I.kick(rng, .9), t(bar, b), .8, 'drums')
            onsets['drums'].append(t(bar, b) * 1000)
        for b in snares:
            add(I.snare(rng, .85), t(bar, b), .6, 'drums')
            onsets['drums'].append(t(bar, b) * 1000)
    y = resample_poly(mix, 1, 2).astype(np.float32)
    scale = .8 / (np.max(np.abs(y)) + 1e-9)
    beats = [round(t(0, b) * 1000) for b in range(len(PARTS) * 4)]
    if parts:
        return y * scale, beats, onsets, round(total * 1000), {name: (resample_poly(a, 1, 2) * scale).astype(np.float32) for name, a in alone.items()}
    return y * scale, beats, onsets, round(total * 1000)


@pytest.fixture(scope='module')
def song():
    y, beats, onsets, duration = render()
    features = {**generator.onset_features(y, SR), 'drums': drums.drum_features(y, SR)}
    downbeats = list(range(0, len(beats), 4))
    charts = {d: core.generate(beats, duration, d, 'cd' * 32, [], features, downbeats) for d in ['easy', 'normal', 'hard']}
    return {'beats': beats, 'onsets': onsets, 'duration': duration, 'features': features, 'charts': charts, 'downbeats': downbeats}


def taps(chart):
    return [n for n in chart['notes'] if n['kind'] == 'tap']


def bars(chart, beats):
    """Each bar's rhythm: (sixteenth position, colour) of its notes."""
    out = {}
    for n in taps(chart):
        bar = (int(np.searchsorted(beats, n['timeMs'] + 1, side='right')) - 1) // 4
        out.setdefault(bar, []).append((round((n['timeMs'] - beats[bar * 4]) / 125), n['color']))
    return out


def near(times, targets, ms=30):
    targets = np.asarray(targets)
    return np.array([np.min(np.abs(targets - t)) <= ms for t in times])


@pytest.mark.parametrize('difficulty', ['normal', 'hard'])
def test_the_second_verse_and_chorus_play_like_the_first(song, difficulty):
    b = bars(song['charts'][difficulty], song['beats'])
    verse1, chorus1, verse2, chorus2 = range(2, 10), range(10, 18), range(18, 26), range(26, 34)
    assert sum(b.get(x) == b.get(x + 16) for x in verse1) >= 7
    assert sum(b.get(x) == b.get(x + 16) for x in chorus1) >= 7
    assert all(b.get(x) for x in [*verse1, *chorus1, *verse2, *chorus2])


def test_a_verse_is_not_one_bar_over_and_over(song):
    b = bars(song['charts']['normal'], song['beats'])
    assert len({tuple(b.get(x, [])) for x in range(2, 10)}) >= 3


def test_notes_are_where_the_song_sounds_and_follow_the_singing(song):
    normal = [n['timeMs'] for n in taps(song['charts']['normal'])]
    everything = np.concatenate([song['onsets']['melody'], song['onsets']['drums']])
    assert near(normal, everything).mean() >= .9
    # In the verses the drums keep to the beats: off-beat notes are the singing.
    beats = np.asarray(song['beats'])
    verse = [t for t in normal if (int(np.searchsorted(beats, t + 1, side='right')) - 1) // 4 in (*range(2, 10), *range(18, 26))]
    offbeats = [t for t in verse if not near([t], beats, 20)[0]]
    assert len(offbeats) >= 6
    assert near(offbeats, song['onsets']['melody']).mean() >= .9


def test_difficulties_step_up(song):
    counts = {d: len(taps(c)) for d, c in song['charts'].items()}
    assert counts['easy'] < counts['normal'] < counts['hard']
    assert near([n['timeMs'] for n in taps(song['charts']['easy'])], song['beats'], 3).all()
    # Hard: sixteenths only in short runs (at most 3 notes in a row).
    t = [n['timeMs'] for n in taps(song['charts']['hard'])]
    run = best = 1
    for a, b in zip(t, t[1:]):
        run = run + 1 if b - a <= 125 * 1.25 else 1
        best = max(best, run)
    assert best <= 3


@pytest.mark.parametrize('difficulty,gap', [('easy', 180), ('normal', 105), ('hard', 75)])
def test_limits_and_determinism(song, difficulty, gap):
    chart = song['charts'][difficulty]
    again = core.generate(song['beats'], song['duration'], difficulty, 'cd' * 32, [], song['features'], song['downbeats'])
    assert chart == again
    t = [n['timeMs'] for n in taps(chart)]
    assert all(b - a >= gap for a, b in zip(t, t[1:]))
    assert all(800 <= x <= song['duration'] - 300 for x in t)
    assert sum(n['size'] == 'large' for n in taps(chart)) <= max(1, len(t) * .1)
    for r in [n for n in chart['notes'] if n['kind'] == 'roll']:
        assert not any(r['timeMs'] - 90 <= x <= r['endMs'] + 90 for x in t)


def test_one_ladder_easy_within_normal_within_hard_with_the_same_colours(song):
    easy, normal, hard = (taps(song['charts'][d]) for d in ('easy', 'normal', 'hard'))

    def within(small, big):
        colours = {n['timeMs']: n['color'] for n in big}
        return all(colours.get(n['timeMs']) == n['color'] for n in small)
    assert within(easy, normal) and within(normal, hard)


def test_hard_has_no_lone_sixteenth(song):
    t = [n['timeMs'] for n in taps(song['charts']['hard'])]
    beats = np.asarray(song['beats'])
    for i, x in enumerate(t):
        k = int(np.searchsorted(beats, x + 1, side='right')) - 1
        frac = (x - beats[k]) / 500
        if min(abs(frac - .25), abs(frac - .75)) < .05:
            assert (i and x - t[i - 1] <= 160) or (i + 1 < len(t) and t[i + 1] - x <= 160), x


def test_rolls_at_the_drum_fill_and_a_large_last_note():
    import test_drums
    y, beats, _, _, duration = test_drums.render(120, len(test_drums.SONG), test_drums.SONG)
    features = {**generator.onset_features(y, SR), 'drums': drums.drum_features(y, SR)}
    fill = test_drums.SONG.index('fill')
    start, end = beats[fill * 4 + 1], beats[fill * 4 + 3] + 500
    for d in ('easy', 'normal', 'hard'):
        chart = core.generate(beats, duration, d, 'ef' * 32, [], features, list(range(0, len(beats), 4)))
        rolls = [n for n in chart['notes'] if n['kind'] == 'roll']
        assert any(r['timeMs'] < end and r['endMs'] > start for r in rolls), (d, rolls)
        assert taps(chart)[-1]['size'] == 'large'
