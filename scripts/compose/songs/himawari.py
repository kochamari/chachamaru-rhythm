"""ひまわり囃子 — festival music (matsuri-bayashi style), 120 BPM, 32 bars, 64 s.

Original composition. D major pentatonic (D E F# A B). The shinobue flute
leads; shime-daiko and the hand gong keep time; the big drum marks the pulse.

Charts are written first. The ensemble's mid drum (don) and rim (ka) play the
normal chart, so every normal/easy note is an audible drum stroke; the hard
chart adds strokes that fall on the shime-daiko sixteenths or the flute hook.
Sections: intro 0-8 s, verse 8-24 s, chorus 24-40 s, bridge 40-48 s,
final chorus 48-64 s.
"""
from .. import instruments as I
from ..song import Song

N = I.note

# ------------------------------------------------------------------ charts --
# One string per bar. 0 rest, 1 don, 2 ka, 3 big don, 5/8 roll start/end.
EASY = [
 '0000', '3000', '1010', '1010',                                  # intro
 '1010', '1010', '1010', '1022', '1010', '1010', '2020', '1010',  # verse
 '3010', '1010', '1010', '1002', '1010', '1012', '1111', '3020',  # chorus
 '1010', '2020', '1022', '5008',                                  # bridge + roll
 '3010', '1010', '1010', '1002', '1010', '1012', '1111', '3000',  # final chorus
]
NORMAL = [
 '00000000', '30001011', '10101120', '11101122',
 '10101120', '10111020', '10101120', '11102022', '10101120', '10111020', '20102011', '11101110',
 '30121012', '10121020', '10121012', '10011022', '10121012', '10121020', '11121112', '30002000',
 '10101020', '20202010', '10102020', '50000008',
 '30121012', '10121020', '10121012', '10011022', '10121012', '10121022', '11121112', '30000000',
]
HARD = [
 '0000000000000000', '3000000010001010', '1000101010102000', '1010100010102020',
 '1000101110102000', '1000101110002011', '1000101110102000', '1010100020002022',
 '1000101110102000', '1000101110002011', '2000101020001011', '1110111010101010',
 '3001102010101020', '1000102010002020', '1001102010101020', '1000001010102020',
 '1001102010101020', '1000102011102020', '1110111011102020', '3000000020000000',
 '1000100010002010', '2000200020001010', '1000101020202020', '5000000000000008',
 '3001102010101020', '1000102010002020', '1001102010101020', '1000001011102020',
 '1001102010101020', '1000102011102022', '1120112011201120', '3000000000000000',
]


def build():
    s = Song('himawari-demo', 'ひまわり囃子', 'ちゃちゃまる音楽隊', bpm=120, bars=32, seed=260924, duration=64.0)
    rng = s.rng
    s.reverb_seconds = 1.9
    odaiko = s.track('odaiko', -3.5, 0.0, .18, hp=45)
    chu = s.track('chudaiko', -6.5, -.12, .16)
    fuchi = s.track('fuchi', -11.0, .14, .12)
    shime = s.track('shime', -11.5, .3, .1)
    kane = s.track('kane', -13.5, -.35, .14, hp=900)
    flute = s.track('flute', -5.5, .06, .3, hp=300)
    flute2 = s.track('flute2', -13.0, -.3, .35, hp=300)
    sham = s.track('shamisen', -13.0, -.24, .16, hp=140)
    bass = s.track('bass', -9.5, 0.0, .0, lp=900)
    pad = s.track('pad', -20.0, 0.0, .45)
    clap = s.track('clap', -16.0, .1, .2)
    bells = s.track('bells', -18.0, .3, .3)
    hy = s.track('hyoshigi', -8.0, 0.0, .3)

    s.section('intro', 0, 4)
    s.section('verse', 4, 12)
    s.section('chorus', 12, 20)
    s.section('bridge', 20, 24)
    s.section('chorus', 24, 32)

    def at(bar, beat, track, sound):
        track.add(sound, s.t(bar, beat))

    # --- the ensemble drums play the normal chart ------------------------------
    for bar, pattern in enumerate(NORMAL):
        chars = [c for c in pattern if c != ' ']
        for i, c in enumerate(chars):
            beat = 4 * i / len(chars)
            accent = .95 if beat % 1 == 0 else .72
            if c == '1':
                at(bar, beat, chu, I.chudaiko(rng, accent))
            elif c == '2':
                at(bar, beat, fuchi, I.fuchi(rng, accent))
            elif c == '3':
                at(bar, beat, odaiko, I.odaiko(rng, 1.0, size=1.08))
                at(bar, beat, chu, I.chudaiko(rng, 1.0))
    # Bar 23: the 連打 as a building drum roll.
    for i in range(26):
        at(23, i * (3.5 / 26), chu, I.chudaiko(rng, .4 + .55 * i / 26))
    at(23, 3.5, odaiko, I.odaiko(rng, 1.0))

    # --- intro -----------------------------------------------------------------
    at(0, 0, hy, I.hyoshigi(rng, 1.0))
    at(0, 1.5, hy, I.hyoshigi(rng, .75))
    at(0, 3, hy, I.hyoshigi(rng, .9))
    for b in [2, 3, 3.5]:
        at(1, b, odaiko, I.odaiko(rng, .85))

    # --- melodies (bar offset, beat, length in beats, note) -----------------------
    intro_flute = [(1, 0, 1.5, 'A5'), (1, 1.5, .5, 'B5'), (1, 2, 1, 'D6'), (1, 3, 1, 'B5'),
                   (2, 0, 1, 'A5'), (2, 1, .5, 'F#5'), (2, 1.5, .5, 'A5'), (2, 2, 2, 'E5'),
                   (3, 0, .5, 'D5'), (3, .5, .5, 'E5'), (3, 1, .5, 'F#5'), (3, 1.5, .5, 'A5'), (3, 2, 1, 'B5'), (3, 3, 1, 'A5')]
    verse_a = [(0, 0, 1, 'A5'), (0, 1, .5, 'F#5'), (0, 1.5, .5, 'A5'), (0, 2, 1, 'B5'), (0, 3, 1, 'A5'),
               (1, 0, .5, 'F#5'), (1, .5, .5, 'E5'), (1, 1, 1, 'D5'), (1, 2, 2, 'E5'),
               (2, 0, 1, 'F#5'), (2, 1, .5, 'A5'), (2, 1.5, .5, 'B5'), (2, 2, 1, 'D6'), (2, 3, 1, 'B5'),
               (3, 0, 1, 'A5'), (3, 1, 1, 'F#5'), (3, 2, 2, 'A5')]
    verse_b = [(0, 0, 1, 'B5'), (0, 1, .5, 'A5'), (0, 1.5, .5, 'B5'), (0, 2, 1, 'D6'), (0, 3, 1, 'E6'),
               (1, 0, .5, 'D6'), (1, .5, .5, 'B5'), (1, 1, 1, 'A5'), (1, 2, 2, 'F#5'),
               (2, 0, 1, 'E5'), (2, 1, .5, 'F#5'), (2, 1.5, .5, 'A5'), (2, 2, 1, 'F#5'), (2, 3, 1, 'E5'),
               (3, 0, 2, 'D5'), (3, 2, .5, 'E5'), (3, 2.5, .5, 'F#5'), (3, 3, 1, 'A5')]
    hook_a = [(0, 0, .75, 'D6'), (0, .75, .25, 'D6'), (0, 1, .5, 'B5'), (0, 1.5, .5, 'A5'), (0, 2, 1, 'B5'), (0, 3, .5, 'A5'), (0, 3.5, .5, 'F#5'),
              (1, 0, 1, 'A5'), (1, 1, .5, 'F#5'), (1, 1.5, .5, 'E5'), (1, 2, 2, 'D5'),
              (2, 0, .75, 'E5'), (2, .75, .25, 'F#5'), (2, 1, .5, 'A5'), (2, 1.5, .5, 'B5'), (2, 2, 1, 'D6'), (2, 3, 1, 'E6'),
              (3, 0, 1.5, 'D6'), (3, 1.5, .5, 'B5'), (3, 2, 2, 'A5')]
    hook_b = [(0, 0, .75, 'D6'), (0, .75, .25, 'D6'), (0, 1, .5, 'B5'), (0, 1.5, .5, 'A5'), (0, 2, 1, 'B5'), (0, 3, .5, 'D6'), (0, 3.5, .5, 'E6'),
              (1, 0, 1, 'F#6'), (1, 1, .5, 'E6'), (1, 1.5, .5, 'D6'), (1, 2, 2, 'B5'),
              (2, 0, .5, 'A5'), (2, .5, .5, 'B5'), (2, 1, .5, 'D6'), (2, 1.5, .5, 'B5'), (2, 2, .5, 'A5'), (2, 2.5, .5, 'F#5'), (2, 3, 1, 'E5'),
              (3, 0, 2, 'D5'), (3, 2, 1, 'A5'), (3, 3, 1, 'D6')]
    bridge_sham = [(0, 0, 'D4'), (0, .5, 'D4'), (0, 1, 'A4'), (0, 2, 'D5'), (0, 2.5, 'B4'), (0, 3, 'A4'),
                   (1, 0, 'F#4'), (1, .5, 'A4'), (1, 1, 'B4'), (1, 2, 'A4'), (1, 3, 'F#4'), (1, 3.5, 'E4'),
                   (2, 0, 'D4'), (2, .5, 'D4'), (2, 1, 'A4'), (2, 2, 'D5'), (2, 2.5, 'E5'), (2, 3, 'F#5'),
                   (3, 0, 'E5'), (3, 1, 'D5'), (3, 2, 'B4')]

    flute_notes, flute2_notes = [], []

    def melody(bar0, phrase, vel=1.0, target=flute_notes, shift=0):
        for bar, beat, beats, name in phrase:
            target.append((s.t(bar0 + bar, beat), beats * s.beat * .96, N(name) + shift, vel))

    melody(0, intro_flute, .85)
    melody(4, verse_a, .9)
    melody(8, verse_b, .9)
    melody(12, hook_a)
    melody(16, hook_b)
    melody(24, hook_a)
    melody(28, hook_b)
    melody(24, hook_a, .5, flute2_notes, -12)
    melody(28, hook_b, .5, flute2_notes, -12)
    flute_notes.append((s.t(31, 0), 1.8, N('D6'), 1.0))
    flute.add(I.shinobue_phrase(rng, flute_notes, s.duration), 0.0)
    flute2.add(I.shinobue_phrase(rng, flute2_notes, s.duration), 0.0)
    for bar0, phrase in [(12, hook_a), (16, hook_b), (24, hook_a), (28, hook_b)]:
        for bar, beat, beats, name in phrase:
            if beat % 1 == 0:
                bells.add(I.bell(rng, N(name) + 12, .55, .9), s.t(bar0 + bar, beat))

    # --- rhythm section -------------------------------------------------------------
    chords = {'D': ['D3', 'A3', 'D4', 'F#4'], 'G': ['G3', 'B3', 'D4', 'G4'], 'A': ['A3', 'C#4', 'E4', 'A4'], 'Bm': ['B2', 'F#3', 'B3', 'D4']}
    progression = ['D', 'D', 'G', 'A', 'Bm', 'G', 'A', 'D']
    bass_root = {'D': 'D2', 'G': 'G2', 'A': 'A2', 'Bm': 'B2'}

    def groove(bar, level):
        c = progression[bar % 8]
        root = N(bass_root[c])
        for beat in ([0, 2] if level == 1 else [0, 1, 2, 3]):
            at(bar, beat, odaiko, I.odaiko(rng, .95 if beat == 0 else .7))
        straight = level > 1 or bar == 11
        for t, ch in s.grid(bar, 'xxxx xxxx xxxx xxxx' if straight else 'x.xx x.xx x.xx x.xx'):
            pos = round((t - s.t(bar)) / s.beat * 4)
            shime.add(I.shime(rng, .8 if pos % 4 == 0 else .5), t)
        for t, ch in s.grid(bar, 'C.cc C.cc C.cc C.c.'):
            kane.add(I.kane(rng, .9 if ch == 'C' else .5, damped=ch == 'c'), t)
        for beat in [0, 1.5, 2, 3]:
            bass.add(I.bass(rng, root + (7 if beat == 3 else 0), .8 * s.beat, .85, 'pluck'), s.t(bar, beat))
        for beat in [.5, 1.5, 2.5, 3.5]:
            sham.add(I.shamisen(rng, N(chords[c][2 if beat in (.5, 2.5) else 3]), .65, .35), s.t(bar, beat))
        if level > 1:
            pad.add(I.pad(rng, [N(x) for x in chords[c][1:]], s.beat * 4, .8), s.t(bar, 0))
            for beat in [1, 3]:
                at(bar, beat, clap, I.clap(rng, .85))

    for bar in range(4, 12):
        groove(bar, 1)
    for bar in range(12, 20):
        groove(bar, 2)
    for bar in range(24, 31):
        groove(bar, 3)

    # --- bridge: shamisen solo over the drum call; roll into the final chorus ------
    for bar in range(20, 24):
        for t, ch in s.grid(bar, 'x.x. x.x. x.x. x.xx'):
            shime.add(I.shime(rng, .55), t)
        at(bar, 0, odaiko, I.odaiko(rng, .85))
        c = ['Bm', 'G', 'A', 'A'][bar - 20]
        bass.add(I.bass(rng, N(bass_root[c]), s.beat * 3.6, .8), s.t(bar, 0))
        pad.add(I.pad(rng, [N(x) for x in chords[c][1:]], s.beat * 4, .7), s.t(bar, 0))
    for bar, beat, name in bridge_sham:
        sham.add(I.shamisen(rng, N(name), .95, .8), s.t(20 + bar, beat))

    # --- ending -------------------------------------------------------------------
    kane.add(I.kane(rng, 1.0), s.t(31, 0))
    at(31, 2, hy, I.hyoshigi(rng, .9))
    pad.add(I.pad(rng, [N(x) for x in chords['D'][1:]], s.beat * 3.2, .9), s.t(31, 0))
    bass.add(I.bass(rng, N('D2'), s.beat * 3, 1.0), s.t(31, 0))

    s.chart('easy', EASY)
    s.chart('normal', NORMAL)
    s.chart('hard', HARD)
    # Hard-only strokes get a quiet fill voice so every hard note has a sound.
    s.fill_layer('fills', lambda: I.shime(rng, .8), lambda: I.fuchi(rng, .7), -13.0)
    return s
