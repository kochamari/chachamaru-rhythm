"""The drafts with the song's parts heard apart (stems.py, v7), on the
synthetic song whose parts are known: its sung line as the separated
vocals, its drums, bass and chords. Separation itself (Demucs) runs only on
a Mac where the separation environment is set up."""
import os
import sys

import numpy as np
import pytest

from chacha_studio import core, drums, generator, patterns, stems

sys.path.insert(0, os.path.dirname(__file__))
import test_song_draft as song_draft  # noqa: E402

SR = 22050


@pytest.fixture(scope='module')
def song():
    y, beats, onsets, duration, parts = song_draft.render(parts=True)
    mix = {**generator.onset_features(y, SR), 'drums': drums.drum_features(y, SR)}
    with_parts = {**mix, 'stems': stems.features(parts)}
    downbeats = list(range(0, len(beats), 4))
    charts = {d: core.generate(beats, duration, d, 'ij' * 32, [], with_parts, downbeats) for d in ('easy', 'normal', 'hard')}
    return {'beats': beats, 'onsets': onsets, 'duration': duration, 'mix': mix, 'parts': with_parts, 'charts': charts, 'downbeats': downbeats}


def taps(chart):
    return [n for n in chart['notes'] if n['kind'] == 'tap']


def near(times, targets, ms=30):
    targets = np.asarray(targets)
    return np.array([np.min(np.abs(targets - t)) <= ms for t in times])


def test_part_features_line_up_with_the_whole_song(song):
    f = song['parts']['stems']
    assert stems.usable(f)
    assert f['rate'] == song['mix']['drums']['rate']
    assert len({len(f[k]) for k in stems.KEYS}) == 1
    # The sung line is heard where it is sung, and only there.
    voice = np.asarray(f['voice']) / 255
    at = lambda ms: voice[int(ms / 1000 * f['rate'])]  # noqa: E731
    assert np.mean([at(x + 40) > .15 for x in song['onsets']['melody']]) >= .9
    assert at(1500) < .15  # the intro: no singing


def test_with_the_parts_the_chart_follows_the_singing(song):
    melody = song['onsets']['melody']
    everything = np.concatenate([melody, song['onsets']['drums']])
    for d in ('easy', 'normal'):
        t = [n['timeMs'] for n in taps(song['charts'][d])]
        assert near(t, everything).mean() >= .95, d
    normal = [n['timeMs'] for n in taps(song['charts']['normal'])]
    mix_normal = [n['timeMs'] for n in taps(core.generate(song['beats'], song['duration'], 'normal', 'ij' * 32, [], song['mix'], song['downbeats']))]
    assert near(normal, melody).mean() >= near(mix_normal, melody).mean() - .02
    assert near(normal, melody).mean() >= .75


def test_the_ladder_and_its_rules_hold_with_the_parts(song):
    easy, normal, hard = (taps(song['charts'][d]) for d in ('easy', 'normal', 'hard'))
    assert len(easy) < len(normal) < len(hard)

    def within(small, big):
        colours = {n['timeMs']: n['color'] for n in big}
        return all(colours.get(n['timeMs']) == n['color'] for n in small)
    assert within(easy, normal) and within(normal, hard)
    for d, gap in (('easy', 180), ('normal', 105), ('hard', 75)):
        t = [n['timeMs'] for n in taps(song['charts'][d])]
        assert all(b - a >= gap for a, b in zip(t, t[1:])), d
    again = core.generate(song['beats'], song['duration'], 'hard', 'ij' * 32, [], song['parts'], song['downbeats'])
    assert again == song['charts']['hard']
    # With the drums heard apart, up to 45% ka (as in hand-made charts);
    # hard's added notes lean to don, so hard has no more ka than normal.
    ka = lambda notes: sum(n['color'] == 'ka' for n in notes) / len(notes)  # noqa: E731
    assert .18 <= ka(normal) <= .45 and ka(hard) <= ka(normal) + .01 and ka(easy) <= .3


def test_a_rhythm_keeps_its_colours_in_the_next_bar():
    """On the drum song (the same groove bar after bar), bars with the rhythm
    of the bar before (or two before: a phrase may alternate two rhythms)
    keep its colours."""
    import test_drums
    y, beats, _, _, duration = test_drums.render(120, len(test_drums.SONG), test_drums.SONG)
    features = {**generator.onset_features(y, SR), 'drums': drums.drum_features(y, SR)}
    chart = core.generate(beats, duration, 'normal', 'kl' * 32, [], features, list(range(0, len(beats), 4)))
    by_bar = {}
    for n in taps(chart):
        bar = (int(np.searchsorted(beats, n['timeMs'] + 1, side='right')) - 1) // 4
        by_bar.setdefault(bar, []).append((round((n['timeMs'] - beats[bar * 4]) / 125), n['color']))
    same = kept = 0
    for b in sorted(by_bar):
        rhythm = [s for s, _ in by_bar[b]]
        before = next((by_bar[b - d] for d in (1, 2) if b - d in by_bar and [s for s, _ in by_bar[b - d]] == rhythm), None)
        if before:
            same += 1
            kept += before == by_bar[b]
    assert same >= 8 and kept / same >= .9


def test_every_bar_with_music_gets_a_few_notes(song):
    """Where a bar is busy, normal has at least two notes (the intro and
    outro, with pads and a quiet hat only, may rest)."""
    beats = song['beats']
    counts = np.histogram([n['timeMs'] for n in taps(song['charts']['normal'])], bins=beats[::4])[0]
    busy = [i for i, kind in enumerate(song_draft.PARTS) if kind in ('verse', 'chorus') and i < len(counts)]
    assert all(counts[i] >= 2 for i in busy)


@pytest.mark.skipif(stems.python() is None, reason='the separation environment is not set up on this Mac')
def test_separation_gives_the_parts(tmp_path):
    y, beats, onsets, duration, parts = song_draft.render(parts=True)
    wav = tmp_path / 'song.wav'
    import soundfile as sf
    sf.write(wav, y[:SR * 12], SR)
    got = stems.separate(wav, tmp_path / 'work')
    assert got and set(got) == {'vocals', 'drums', 'bass', 'other'}
    assert all(abs(len(a) - 12 * SR) <= SR // 10 and np.isfinite(a).all() for a in got.values())
    assert not list((tmp_path / 'work').iterdir())  # no audio left behind
    f = stems.features(got)
    assert stems.usable(f)
    # The separated drums carry the bass drum, the vocals the sung line.
    kit = np.asarray(f['kick'], float) / 255
    kicks = [x for x in onsets['drums'] if x < 11500]
    assert np.mean([kit[int(x / 1000 * f['rate']):int(x / 1000 * f['rate']) + 4].max() > .2 for x in kicks]) >= .7


def test_parts_weights_are_sane():
    assert patterns.PARTS['singing'] > patterns.PARTS['drums']
    assert patterns.FOLLOW['slow_bpm'] < patterns.FOLLOW['fast_bpm']
