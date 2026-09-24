"""花火ラッシュ — fast festival rush, 172 BPM, 44 bars (~63 s).

Original composition in E minor pentatonic (E G A B D). An electronic kick
and off-beat bass drive the taiko ensemble; fireworks (rolls) light up the
break. The taiko ensemble plays the normal chart; hard adds sixteenth runs on
the hi-hat grid. Easy stays on quarter notes (eighths are too close at 172 BPM).
"""
from .. import instruments as I
from ..song import Song

N = I.note

EASY = [
 '0000', '0000', '1010', '1012',                                   # intro
 '1010', '1002', '1010', '1022', '1010', '1002', '1010', '2020',   # A
 '1010', '1010', '1111', '1022',                                   # pre
 '3010', '1010', '2010', '1012', '3010', '1010', '2010', '1022',   # chorus
 '5008', '3000', '5008', '3030',                                   # break (fireworks)
 '1010', '1002', '1010', '2020',                                   # A'
 '3010', '1010', '2010', '1012', '3010', '1010', '2010', '1022',   # chorus
 '1010', '5000', '0008', '3000',                                   # outro
]
NORMAL = [
 '00000000', '00000000', '10101010', '10101122',
 '10201020', '10201120', '10201020', '11202020', '10201020', '10201120', '10201020', '20202022',
 '10101010', '10101010', '11101110', '10111122',
 '30121020', '11101020', '20121020', '10111022', '30121020', '11101020', '20121020', '11112222',
 '50000008', '30000000', '50000008', '30003000',
 '10201020', '10201120', '10201020', '20202022',
 '30121020', '11101020', '20121020', '10111022', '30121020', '11101020', '20121020', '11112222',
 '10101010', '50000000', '00000008', '30000000',
]
HARD = [
 '0000000000000000', '0000000000000000', '1000100010001011', '1000101110102022',
 '1000200010102000', '1000200011102011', '1000200010102000', '1110200020102022',
 '1000200010102000', '1000200011102011', '1000200010102000', '2020202020202022',
 '1000101010001010', '1000101010001011', '1110111011101110', '1000111011102222',
 '3000112010102000', '1110111010102011', '2000112010102000', '1000111011102022',
 '3000112010102000', '1110111010102011', '2000112010102000', '1110111022202220',
 '5000000000000080', '3000000000000000', '5000000000000080', '3000000030000000',
 '1000200010102000', '1000200011102011', '1000200010102000', '2020202020202022',
 '3000112010102000', '1110111010102011', '2000112010102000', '1000111011102022',
 '3000112010102000', '1110111010102011', '2000112010102000', '1110111022202220',
 '1000101010101010', '5000000000000000', '0000000000000080', '3000000000000000',
]


def build():
    s = Song('hanabi-rush', '花火ラッシュ', 'ちゃちゃまる音楽隊', bpm=172, bars=44, lead_in=0.3, tail=1.8, seed=172)
    rng = s.rng
    s.reverb_seconds = 1.4
    kick = s.track('kick', -6.0, 0.0, .0, hp=35)
    snare = s.track('snare', -11.0, .05, .15)
    hats = s.track('hats', -19.0, .3, .04, hp=5000)
    crash = s.track('crash', -15.0, -.25, .15, hp=2500)
    odaiko = s.track('odaiko', -5.0, 0.0, .15, hp=45)
    chu = s.track('chudaiko', -7.5, -.12, .12)
    fuchi = s.track('fuchi', -11.5, .15, .1)
    bass = s.track('bass', -8.0, 0.0, .0, lp=1300)
    lead = s.track('lead', -9.5, .1, .25, hp=250)
    sham = s.track('shamisen', -12.0, -.3, .15, hp=150)
    pad = s.track('pad', -19.0, 0.0, .4)
    fire = s.track('fireworks', -14.0, 0.0, .5)

    s.section('intro', 0, 4)
    s.section('verse', 4, 16)
    s.section('chorus', 16, 24)
    s.section('bridge', 24, 28)
    s.section('verse', 28, 32)
    s.section('chorus', 32, 40)

    def at(bar, beat, track, sound, gain=1.0):
        track.add(sound, s.t(bar, beat), gain)

    # Taiko ensemble plays the normal chart.
    roll_bars = set()
    for bar, pattern in enumerate(NORMAL):
        for i, c in enumerate(pattern):
            beat = 4 * i / len(pattern)
            v = .95 if beat % 1 == 0 else .75
            if c == '1':
                at(bar, beat, chu, I.chudaiko(rng, v))
            elif c == '2':
                at(bar, beat, fuchi, I.fuchi(rng, v))
            elif c == '3':
                at(bar, beat, odaiko, I.odaiko(rng, 1.0, size=1.1))
                at(bar, beat, chu, I.chudaiko(rng, 1.0))
                at(bar, beat, crash, I.crash(rng, .9))
            elif c in '58':
                roll_bars.add(bar)
    # Rolls: drums build like rising fireworks, then a burst.
    for start_bar, start_beat, end_bar, end_beat in [(24, 0, 24, 3.5), (26, 0, 26, 3.5), (41, 0, 42, 3.5)]:
        t0, t1 = s.t(start_bar, start_beat), s.t(end_bar, end_beat)
        steps = int((t1 - t0) / (s.beat / 4))
        for k in range(steps):
            chu.add(I.chudaiko(rng, .4 + .55 * k / max(1, steps)), t0 + k * (t1 - t0) / steps)
        # Whistle up, then crackle.
        whistle = I.shinobue_phrase(rng, [(0, (t1 - t0), N('E6'), .6)], t1 - t0 + .2)
        fire.add(whistle, t0, .5)
        crackle = I.crash(rng, 1.0)
        fire.add(crackle, t1)

    # Electronic backbone: four-on-the-floor kick, clap on 2 and 4, 16th hats.
    for bar in range(2, 43):
        if bar in roll_bars and bar not in (25, 27):
            continue
        for beat in range(4):
            at(bar, beat, kick, I.kick(rng, .9))
        for beat in [1, 3]:
            at(bar, beat, snare, I.snare(rng, .85))
        chorus = 16 <= bar < 24 or 32 <= bar < 40
        for i in range(16 if chorus else 8):
            steps = 16 if chorus else 8
            at(bar, 4 * i / steps, hats, I.hat(rng, .75 if i % (steps // 4) == 0 else .45, open_=(i % (steps // 2) == steps // 4)))

    prog = {'Em': ('E2', ['E4', 'G4', 'B4']), 'C': ('C2', ['C4', 'E4', 'G4']), 'D': ('D2', ['D4', 'F#4', 'A4']), 'Bm': ('B1', ['B3', 'D4', 'F#4']), 'Am': ('A1', ['A3', 'C4', 'E4'])}
    plan = {}
    for b in range(0, 16):
        plan[b] = ['Em', 'C', 'D', 'Bm'][b % 4] if b >= 4 else ['Em', 'Em', 'C', 'D'][b]
    for base in (16, 32):
        for k, c in enumerate(['C', 'D', 'Bm', 'Em', 'C', 'D', 'Am', 'Bm']):
            plan[base + k] = c
    for b in range(24, 28):
        plan[b] = ['C', 'D', 'C', 'D'][b - 24]
    for b in range(28, 32):
        plan[b] = ['Em', 'C', 'D', 'Bm'][b - 28]
    for b in range(40, 44):
        plan[b] = ['C', 'D', 'D', 'Em'][b - 40]

    for bar, c in plan.items():
        root, voicing = prog[c]
        r = N(root) + 12
        if 2 <= bar < 43 and bar not in (24, 26, 41, 42):
            # Off-beat 'oom-pa' bass.
            for beat in [0, .5, 1.5, 2, 2.5, 3.5]:
                bass.add(I.bass(rng, r + (12 if beat % 1 else 0), .4 * s.beat, .85 if beat % 1 == 0 else .7), s.t(bar, beat))
            for beat in [.5, 1.5, 2.5, 3.5]:
                sham.add(I.shamisen(rng, N(voicing[1]) + 12, .6, .25), s.t(bar, beat))
        pad.add(I.pad(rng, [N(x) for x in voicing], s.beat * 4, .7, bright=2400), s.t(bar, 0))

    riff = [(0, 0, .5, 'E5'), (0, .5, .5, 'G5'), (0, 1, .5, 'A5'), (0, 1.5, .5, 'B5'), (0, 2, 1, 'D6'), (0, 3, .5, 'B5'), (0, 3.5, .5, 'A5'),
            (1, 0, 1, 'G5'), (1, 1, 1, 'E5'), (1, 2, .5, 'D5'), (1, 2.5, 1.5, 'E5'),
            (2, 0, .5, 'E5'), (2, .5, .5, 'G5'), (2, 1, .5, 'A5'), (2, 1.5, .5, 'B5'), (2, 2, 1, 'D6'), (2, 3, .5, 'B5'), (2, 3.5, .5, 'A5'),
            (3, 0, .5, 'G5'), (3, .5, .5, 'A5'), (3, 1, 1, 'B5'), (3, 2, .5, 'D6'), (3, 2.5, 1.5, 'E6')]
    riff2 = riff[:17] + [(3, 0, 1, 'D6'), (3, 1, 1, 'B5'), (3, 2, 1, 'A5'), (3, 3, 1, 'G5')]
    pre = [(0, 0, .5, 'B4'), (0, .5, .5, 'D5'), (0, 1, .5, 'E5'), (0, 1.5, .5, 'G5'), (0, 2, 2, 'A5'),
           (1, 0, .5, 'D5'), (1, .5, .5, 'E5'), (1, 1, .5, 'G5'), (1, 1.5, .5, 'A5'), (1, 2, 2, 'B5'),
           (2, 0, .5, 'E5'), (2, .5, .5, 'G5'), (2, 1, .5, 'A5'), (2, 1.5, .5, 'B5'), (2, 2, .5, 'D6'), (2, 2.5, .5, 'B5'), (2, 3, 1, 'D6'),
           (3, 0, 1, 'E6'), (3, 1, 1, 'D6'), (3, 2, 1, 'E6'), (3, 3, 1, 'G6')]
    hook = [(0, 0, 1, 'E6'), (0, 1, .5, 'D6'), (0, 1.5, .5, 'B5'), (0, 2, 1, 'D6'), (0, 3, 1, 'E6'),
            (1, 0, .5, 'G6'), (1, .5, .5, 'E6'), (1, 1, 1, 'D6'), (1, 2, 2, 'B5'),
            (2, 0, 1, 'A5'), (2, 1, .5, 'B5'), (2, 1.5, .5, 'D6'), (2, 2, 1, 'E6'), (2, 3, 1, 'D6'),
            (3, 0, 3, 'B5'), (3, 3, 1, 'D6'),
            (4, 0, 1, 'E6'), (4, 1, .5, 'D6'), (4, 1.5, .5, 'B5'), (4, 2, 1, 'D6'), (4, 3, 1, 'E6'),
            (5, 0, .5, 'G6'), (5, .5, .5, 'A6'), (5, 1, 1, 'G6'), (5, 2, 2, 'E6'),
            (6, 0, .5, 'D6'), (6, .5, .5, 'E6'), (6, 1, .5, 'D6'), (6, 1.5, .5, 'B5'), (6, 2, 1, 'A5'), (6, 3, 1, 'B5'),
            (7, 0, 4, 'E6')]

    def phrase(bar0, notes, vel=1.0, shift=0):
        for bar, beat, beats, name in notes:
            lead.add(I.pluck_lead(rng, N(name) + shift, beats * s.beat * .9, vel), s.t(bar0 + bar, beat))

    phrase(4, riff, .8)
    phrase(8, riff2, .8)
    phrase(12, pre, .85)
    phrase(16, hook)
    phrase(28, riff, .8)
    phrase(32, hook)
    phrase(40, [(0, 0, 1, 'E6'), (0, 1, 1, 'D6'), (0, 2, 1, 'B5'), (0, 3, 1, 'D6')], .9)
    phrase(43, [(0, 0, 3, 'E6')], 1.0)
    # Shamisen doubles the riff an octave down in the A sections.
    for bar0, notes in [(4, riff), (8, riff2), (28, riff)]:
        for bar, beat, beats, name in notes:
            sham.add(I.shamisen(rng, N(name) - 12, .7, .4), s.t(bar0 + bar, beat))
    # Intro: rising drums.
    for bar in range(0, 2):
        for i in range(8):
            at(bar, i * .5, chu, I.chudaiko(rng, .3 + .35 * (bar * 8 + i) / 16))
    at(43, 0, crash, I.crash(rng, 1.0))
    at(43, 0, odaiko, I.odaiko(rng, 1.0, size=1.15))
    at(43, 0, kick, I.kick(rng, 1.0))

    s.chart('easy', EASY)
    s.chart('normal', NORMAL)
    s.chart('hard', HARD)
    # Hard-only strokes get a quiet fill voice so every hard note has a sound.
    s.fill_layer('fills', lambda: I.shime(rng, .8), lambda: I.fuchi(rng, .7), -13.0)
    return s
