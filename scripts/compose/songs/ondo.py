"""ちゃちゃまる音頭 — bon-odori dance song, 100 BPM swing, 32 bars (~78 s).

Original composition in G major pentatonic (G A B D E). Swung eighths (2/3 +
1/3 of a beat) like a summer dance circle: the taiko's 'ドン・ドドン・カッ',
hand claps on 2 and 4, shamisen strums and a singable flute melody. Charts are
written on a 12-step grid (three steps per beat) so the swing is exact; the
mid drum and rim play the normal chart.
"""
from .. import instruments as I
from ..song import Song

N = I.note
A = '100001100200'   # ドン ・ド ドン カッ
B = '100202101100'   # ドン カカ ドド ドン
C = '100001100222'   # ドン ・ド ドン カカカ

EASY = [
 '0000', '3000',                                                   # intro
 '1012', '1210', '1012', '1012', '1012', '1210', '1012', '1010',   # verse
 '3212', '1112', '1212', '1012', '1212', '1112', '1212', '3000',   # chorus
 '1010', '2020', '1010', '5008',                                   # bridge + roll
 '3212', '1112', '1212', '1012', '1212', '1112', '1212', '3000',   # chorus
 '1010', '3000',                                                   # outro
]
NORMAL = [
 '000000000000', '300000100100',
 A, B, A, C, A, B, A, '100100100000',
 '301200101200', '100102100200', '101200101200', '100000100200', '101200101200', '100102100200', '101200102200', '300000000000',
 '100000100000', '200000200200', '100100100100', '500000000008',
 '301200101200', '100102100200', '101200101200', '100000100200', '101200101200', '100102100200', '101200102200', '300000000000',
 '100001100200', '300000000000',
]
HARD = [
 '000000000000', '300000101101',
 '101001101200', '100202101101', '101001101200', '100001100222', '101001101200', '100202101101', '101001101200', '101101101200',
 '301211101200', '101102101200', '101211101200', '100000101222', '301211101200', '101102101200', '101211102200', '300000000000',
 '100100101100', '200200202200', '101101101101', '500000000008',
 '301211101200', '101102101200', '101211101200', '100000101222', '301211101200', '101102101200', '101211102200', '300000000000',
 '101001101200', '300000000000',
]


def build():
    s = Song('chachamaru-ondo', 'ちゃちゃまる音頭', 'ちゃちゃまる音楽隊', bpm=100, bars=32, lead_in=0.4, tail=1.4, seed=410)
    rng = s.rng
    s.reverb_seconds = 1.7
    odaiko = s.track('odaiko', -4.0, 0.0, .15, hp=45)
    chu = s.track('chudaiko', -6.5, -.1, .14)
    fuchi = s.track('fuchi', -11.0, .15, .1)
    kane = s.track('kane', -15.0, -.4, .12, hp=900)
    clap = s.track('clap', -12.5, .05, .22)
    flute = s.track('flute', -6.0, .08, .32, hp=300)
    sham = s.track('shamisen', -11.5, -.28, .18, hp=140)
    koto = s.track('koto', -14.0, .35, .25, hp=200)
    organ = s.track('organ', -21.0, .0, .35, hp=180)
    bass = s.track('bass', -9.0, 0.0, .0, lp=800)

    s.section('intro', 0, 2)
    s.section('verse', 2, 10)
    s.section('chorus', 10, 18)
    s.section('bridge', 18, 22)
    s.section('chorus', 22, 30)

    def at(bar, beat, track, sound):
        track.add(sound, s.t(bar, beat))

    for bar, pattern in enumerate(NORMAL):
        for i, c in enumerate(pattern):
            beat = 4 * i / len(pattern)
            accent = .95 if i % 3 == 0 else .75
            if c == '1':
                at(bar, beat, chu, I.chudaiko(rng, accent))
            elif c == '2':
                at(bar, beat, fuchi, I.fuchi(rng, accent))
            elif c == '3':
                at(bar, beat, odaiko, I.odaiko(rng, 1.0, size=1.05))
                at(bar, beat, chu, I.chudaiko(rng, 1.0))
    for i in range(20):
        at(21, i * (3.667 / 20), chu, I.chudaiko(rng, .4 + .55 * i / 20))

    # Melodies: (bar offset, beat, beats, note); .667 is the swung 'and'.
    verse = [(0, 0, 1.5, 'D5'), (0, 1.667, .333, 'E5'), (0, 2, 1, 'D5'), (0, 3, 1, 'B4'),
             (1, 0, 1, 'A4'), (1, 1, .667, 'B4'), (1, 1.667, .333, 'D5'), (1, 2, 2, 'E5'),
             (2, 0, 1, 'D5'), (2, 1, .667, 'B4'), (2, 1.667, .333, 'A4'), (2, 2, 1, 'G4'), (2, 3, 1, 'A4'),
             (3, 0, 3, 'B4'), (3, 3, 1, 'D5'),
             (4, 0, 1, 'E5'), (4, 1, .667, 'G5'), (4, 1.667, .333, 'E5'), (4, 2, 1, 'D5'), (4, 3, 1, 'B4'),
             (5, 0, 1, 'D5'), (5, 1, .667, 'E5'), (5, 1.667, .333, 'D5'), (5, 2, 2, 'B4'),
             (6, 0, 1, 'A4'), (6, 1, .667, 'B4'), (6, 1.667, .333, 'D5'), (6, 2, 1, 'E5'), (6, 3, 1, 'A4'),
             (7, 0, 3, 'G4'), (7, 3, 1, 'D5')]
    chorus = [(0, 0, .667, 'G5'), (0, .667, .333, 'G5'), (0, 1, 1, 'E5'), (0, 2, .667, 'D5'), (0, 2.667, .333, 'E5'), (0, 3, 1, 'G5'),
              (1, 0, 1, 'A5'), (1, 1, .667, 'G5'), (1, 1.667, .333, 'E5'), (1, 2, 2, 'D5'),
              (2, 0, .667, 'E5'), (2, .667, .333, 'D5'), (2, 1, 1, 'B4'), (2, 2, .667, 'D5'), (2, 2.667, .333, 'E5'), (2, 3, 1, 'D5'),
              (3, 0, 2, 'B4'), (3, 2, 1, 'A4'), (3, 3, 1, 'B4'),
              (4, 0, .667, 'G5'), (4, .667, .333, 'G5'), (4, 1, 1, 'E5'), (4, 2, .667, 'D5'), (4, 2.667, .333, 'E5'), (4, 3, 1, 'G5'),
              (5, 0, 1, 'A5'), (5, 1, .667, 'B5'), (5, 1.667, .333, 'A5'), (5, 2, 2, 'G5'),
              (6, 0, .667, 'E5'), (6, .667, .333, 'G5'), (6, 1, 1, 'E5'), (6, 2, .667, 'D5'), (6, 2.667, .333, 'B4'), (6, 3, 1, 'A4'),
              (7, 0, 3.5, 'G4')]
    intro = [(0, 2, .667, 'D5'), (0, 2.667, .333, 'E5'), (0, 3, 1, 'G5'), (1, 0, 2, 'A5'), (1, 2, .667, 'G5'), (1, 2.667, .333, 'E5'), (1, 3, 1, 'D5')]
    outro = [(0, 0, .667, 'G5'), (0, .667, .333, 'E5'), (0, 1, 1, 'D5'), (0, 2, .667, 'B4'), (0, 2.667, .333, 'A4'), (0, 3, 1, 'B4'), (1, 0, 3, 'G4')]
    notes = []

    def melody(bar0, phrase, vel=1.0, shift=0):
        for bar, beat, beats, name in phrase:
            notes.append((s.t(bar0 + bar, beat), beats * s.beat * .95, N(name) + shift, vel))

    melody(0, intro, .85)
    melody(2, verse, .9)
    melody(10, chorus)
    melody(22, chorus)
    melody(30, outro)
    flute.add(I.shinobue_phrase(rng, notes, s.duration, vib_depth=.014), 0.0)

    chords = {'G': ['G3', 'B3', 'D4', 'G4'], 'C': ['C4', 'E4', 'G4', 'C5'], 'D': ['D4', 'F#4', 'A4', 'D5'], 'Em': ['E3', 'G3', 'B3', 'E4']}
    roots = {'G': 'G2', 'C': 'C3', 'D': 'D3', 'Em': 'E2'}
    prog = ['G', 'G', 'C', 'G', 'Em', 'C', 'D', 'G']

    def groove(bar, chord, full=True):
        root = N(roots[chord])
        for beat in [0, 2]:
            at(bar, beat, odaiko, I.odaiko(rng, .9 if beat == 0 else .75))
        for beat in [1, 3]:
            at(bar, beat, clap, I.clap(rng, .9))
        for beat in range(4):
            at(bar, beat, kane, I.kane(rng, .8, damped=False))
            at(bar, beat + .667, kane, I.kane(rng, .45, damped=True))
        for beat, off in [(0, 0), (1, 7), (2, 0), (3, 7)]:
            bass.add(I.bass(rng, root + off, .6 * s.beat, .85, 'pluck'), s.t(bar, beat))
        # Shamisen strums: the swung off-beats ('ton-TEN').
        for beat in [0, .667, 1.667, 2, 2.667, 3.667]:
            chord_notes = chords[chord]
            for k, name in enumerate(chord_notes[1:3]):
                sham.add(I.shamisen(rng, N(name) + 12, .55 if beat % 1 else .75, .3), s.t(bar, beat) + k * .008)
        if full:
            organ.add(I.organ(rng, [N(x) for x in chords[chord][1:]], s.beat * 3.8, .7), s.t(bar, 0))

    for bar in range(2, 10):
        groove(bar, prog[(bar - 2) % 8], full=False)
    for bar in range(10, 18):
        groove(bar, prog[(bar - 10) % 8])
    for bar in range(22, 30):
        groove(bar, prog[(bar - 22) % 8])
    for bar in range(30, 32):
        groove(bar, 'G' if bar == 31 else 'D', full=bar == 30)
    # Bridge: koto arpeggios over sparse drums, building to the roll.
    arps = [['G4', 'B4', 'D5', 'G5'], ['E4', 'G4', 'B4', 'E5'], ['C4', 'E4', 'G4', 'C5'], ['D4', 'F#4', 'A4', 'D5']]
    for k, bar in enumerate(range(18, 22)):
        for i in range(8):
            koto.add(I.koto(rng, N(arps[k][i % 4]) + (12 if i >= 4 else 0), .7, 1.2), s.t(bar, i * .5))
        bass.add(I.bass(rng, N(['G2', 'E2', 'C3', 'D3'][k]), s.beat * 3.5, .8), s.t(bar, 0))
        at(bar, 0, odaiko, I.odaiko(rng, .85))
        at(bar, 2, clap, I.clap(rng, .7))
    # Intro: accordion swell and flute pickup.
    organ.add(I.organ(rng, [N('G3'), N('B3'), N('D4')], s.beat * 8, .7), s.t(0, 0))
    at(1, 0, odaiko, I.odaiko(rng, 1.0))
    # Ending chord.
    organ.add(I.organ(rng, [N('G3'), N('B3'), N('D4'), N('G4')], s.beat * 4, .9), s.t(31, 0))
    at(31, 0, odaiko, I.odaiko(rng, 1.0, size=1.1))
    at(31, 0, kane, I.kane(rng, 1.0))

    s.chart('easy', EASY)
    s.chart('normal', NORMAL)
    s.chart('hard', HARD)
    # Hard-only strokes get a quiet fill voice so every hard note has a sound.
    s.fill_layer('fills', lambda: I.shime(rng, .8), lambda: I.fuchi(rng, .7), -13.0)
    return s
