"""夕焼けしっぽ — bright Japanese pop with festival colour, 140 BPM, 39 bars (~69 s).

Original composition in A major. Kick and snare play the normal chart (don =
kick, ka = snare), koto arpeggios and a bell-like synth carry the tune, the
chorus uses the IV–V–iii–vi progression. Taiko accents join in the chorus.
"""
from .. import instruments as I
from ..song import Song

N = I.note

EASY = [
 '0000', '0000', '1010', '1012',                                   # intro
 '1010', '1002', '1010', '1022', '1010', '1002', '1010', '1022',   # verse
 '1010', '1010', '1010', '1012',                                   # pre-chorus
 '3201', '1210', '1201', '1010', '1201', '1012', '1202', '3000',   # chorus
 '1000', '2000', '1010', '5008',                                   # bridge + roll
 '3201', '1210', '1201', '1010', '1201', '1012', '1202', '3000',   # chorus
 '1010', '1010', '3000',                                           # outro
]
NORMAL = [
 '00000000', '00000000', '10101020', '10101122',
 '10201120', '10201020', '10201120', '10202022', '10201120', '10201020', '11201120', '10202222',
 '11201120', '11201120', '11201120', '10011122',
 '31210210', '11201100', '11210210', '10011200', '11210210', '11201020', '10210120', '30000000',
 '10001000', '20002000', '10101010', '50000008',
 '31210210', '11201100', '11210210', '10011200', '11210210', '11201020', '10210120', '30000000',
 '10101020', '11101110', '30000000',
]
HARD = [
 '0000000000000000', '0000000000000000', '1000100010102000', '1000101010102022',
 '1000200010112000', '1000200010002011', '1000200010112000', '1000200020202222',
 '1000200010112000', '1000200010002011', '1010200010112000', '1011200020202222',
 '1010200010102000', '1010200010102011', '1010200010102000', '1000001010102222',
 '3010201010201011', '1010200010100011', '1010201010201011', '1000001010200011',
 '1010201010201011', '1010200010102011', '1000201110201011', '3000000000000000',
 '1000100010001000', '2000200020002000', '1010101010101010', '5000000000000008',
 '3010201010201011', '1010200010100011', '1010201010201011', '1000001010200011',
 '1010201010201011', '1010200010102011', '1000201110201011', '3000000000000000',
 '1000100010102000', '1110111011101110', '3000000000000000',
]


def build():
    s = Song('yuuyake-shippo', '夕焼けしっぽ', 'ちゃちゃまる音楽隊', bpm=140, bars=39, lead_in=0.3, tail=1.6, seed=1407)
    rng = s.rng
    s.reverb_seconds = 1.5
    kick = s.track('kick', -5.5, 0.0, .0, hp=35)
    snare = s.track('snare', -9.0, .05, .18)
    clap = s.track('clap', -14.0, -.05, .2)
    hats = s.track('hats', -19.0, .3, .05, hp=4000)
    crash = s.track('crash', -16.0, -.2, .15, hp=2000)
    taiko = s.track('taiko', -9.0, -.1, .15, hp=50)
    bass = s.track('bass', -8.5, 0.0, .0, lp=1200)
    keys = s.track('keys', -15.0, -.18, .25, hp=150)
    lead = s.track('lead', -10.0, .12, .28, hp=250)
    bells = s.track('bells', -17.0, .35, .3)
    koto = s.track('koto', -14.0, -.35, .25, hp=200)
    flute = s.track('flute', -12.0, .2, .32, hp=300)

    s.section('intro', 0, 4)
    s.section('verse', 4, 16)
    s.section('chorus', 16, 24)
    s.section('bridge', 24, 28)
    s.section('chorus', 28, 36)

    def at(bar, beat, track, sound, gain=1.0):
        track.add(sound, s.t(bar, beat), gain)

    # Drum kit plays the normal chart: don = kick, ka = snare (+ clap in the chorus).
    for bar, pattern in enumerate(NORMAL):
        chorus = 16 <= bar < 24 or 28 <= bar < 36
        for i, c in enumerate(pattern):
            beat = 4 * i / len(pattern)
            if c in '13':
                at(bar, beat, kick, I.kick(rng, 1.0 if beat % 1 == 0 else .85))
            if c == '3':
                at(bar, beat, crash, I.crash(rng, 1.0))
                at(bar, beat, taiko, I.odaiko(rng, 1.0))
            if c == '2':
                at(bar, beat, snare, I.snare(rng, .95 if beat % 1 == 0 else .8))
                if chorus:
                    at(bar, beat, clap, I.clap(rng, .8))
    for i in range(24):
        at(27, i * (3.5 / 24), snare, I.snare(rng, .35 + .6 * i / 24))
    at(27, 3.5, crash, I.crash(rng, .8))

    # Hi-hats: eighths in the verse, sixteenths in the chorus.
    for bar in range(2, 38):
        if 24 <= bar < 26:
            continue
        chorus = 16 <= bar < 24 or 28 <= bar < 36
        steps = 16 if chorus else 8
        for i in range(steps):
            at(bar, 4 * i / steps, hats, I.hat(rng, .8 if i % (steps // 4) == 0 else .5, open_=(chorus and i % 8 == 6)))
    # Festival taiko accents in the chorus: beats 1 and 3.
    for bar in list(range(16, 24)) + list(range(28, 36)):
        for beat in [0, 2]:
            at(bar, beat, taiko, I.chudaiko(rng, .8), .8)

    chords = {'A': ['A3', 'C#4', 'E4'], 'F#m': ['F#3', 'A3', 'C#4'], 'D': ['D4', 'F#4', 'A4'], 'E': ['E3', 'G#3', 'B3'],
              'Bm': ['B3', 'D4', 'F#4'], 'C#m': ['C#4', 'E4', 'G#4']}
    roots = {'A': 'A2', 'F#m': 'F#2', 'D': 'D2', 'E': 'E2', 'Bm': 'B2', 'C#m': 'C#2'}
    plan = {}
    for b in range(0, 4):
        plan[b] = ['A', 'F#m', 'D', 'E'][b]
    for b in range(4, 12):
        plan[b] = ['A', 'F#m', 'D', 'E'][(b - 4) % 4]
    for b in range(12, 16):
        plan[b] = ['Bm', 'C#m', 'D', 'E'][b - 12]
    for base in (16, 28):
        for k, c in enumerate(['D', 'E', 'C#m', 'F#m', 'D', 'E', 'A', 'A']):
            plan[base + k] = c
    for b, c in zip(range(24, 28), ['F#m', 'D', 'E', 'E']):
        plan[b] = c
    for b, c in zip(range(36, 39), ['D', 'E', 'A']):
        plan[b] = c

    for bar, c in plan.items():
        root = N(roots[c])
        chorus = 16 <= bar < 24 or 28 <= bar < 36
        # Bass: syncopated eighths.
        if bar >= 2 and bar != 38:
            for beat, off in ([(0, 0), (1.5, 0), (2, 0), (3, 12), (3.5, 7)] if chorus else [(0, 0), (1.5, 0), (2.5, 7), (3, 0)]):
                bass.add(I.bass(rng, root + off, .45 * s.beat, .9), s.t(bar, beat))
        if bar == 38:
            bass.add(I.bass(rng, root, s.beat * 3, 1.0), s.t(bar, 0))
        # Keys: stabs on the off-beats in the chorus, whole-bar chords elsewhere.
        voicing = [N(x) + 12 for x in chords[c]]
        if chorus:
            for beat in [.5, 1.5, 2.5, 3.5]:
                for m in voicing:
                    keys.add(I.epiano(rng, m, .35 * s.beat, .7), s.t(bar, beat))
        else:
            for m in voicing:
                keys.add(I.epiano(rng, m, 3.6 * s.beat, .6), s.t(bar, 0))
        # Koto arpeggios in intro/verse/bridge.
        if bar < 16 or 24 <= bar < 28:
            arp = [voicing[0], voicing[1], voicing[2], voicing[1] + 12, voicing[2] + 12, voicing[1] + 12, voicing[2], voicing[1]]
            for i, m in enumerate(arp):
                koto.add(I.koto(rng, m, .55, 1.0), s.t(bar, i * .5))

    verse = [(0, 0, .5, 'E5'), (0, .5, .5, 'E5'), (0, 1, .5, 'F#5'), (0, 1.5, 1, 'E5'), (0, 2.5, .5, 'C#5'), (0, 3, 1, 'B4'),
             (1, 0, 1, 'C#5'), (1, 1, 1, 'A4'), (1, 3.5, .5, 'B4'),
             (2, 0, .5, 'C#5'), (2, .5, .5, 'E5'), (2, 1, 1, 'F#5'), (2, 2, .5, 'E5'), (2, 2.5, .5, 'C#5'), (2, 3, 1, 'B4'),
             (3, 0, 2, 'B4'), (3, 3.5, .5, 'E5'),
             (4, 0, .5, 'E5'), (4, .5, .5, 'E5'), (4, 1, .5, 'F#5'), (4, 1.5, 1, 'A5'), (4, 2.5, .5, 'F#5'), (4, 3, 1, 'E5'),
             (5, 0, 1, 'C#5'), (5, 1, 1, 'E5'), (5, 2, 1, 'F#5'), (5, 3, .5, 'E5'), (5, 3.5, .5, 'C#5'),
             (6, 0, 1, 'B4'), (6, 1, .5, 'C#5'), (6, 1.5, 1, 'E5'), (6, 2.5, .5, 'F#5'), (6, 3, 1, 'E5'),
             (7, 0, 3, 'E5')]
    pre = [(0, 0, .5, 'B4'), (0, .5, .5, 'C#5'), (0, 1, 1, 'D5'), (0, 2, .5, 'C#5'), (0, 2.5, .5, 'B4'), (0, 3, 1, 'A4'),
           (1, 0, .5, 'C#5'), (1, .5, .5, 'E5'), (1, 1, 1, 'F#5'), (1, 2, .5, 'E5'), (1, 2.5, .5, 'C#5'), (1, 3, 1, 'E5'),
           (2, 0, .5, 'F#5'), (2, .5, .5, 'A5'), (2, 1, 1, 'B5'), (2, 2, .5, 'A5'), (2, 2.5, .5, 'F#5'), (2, 3, 1, 'A5'),
           (3, 0, 1.5, 'B5'), (3, 1.5, .5, 'A5'), (3, 2, .5, 'B5'), (3, 2.5, .5, 'C#6'), (3, 3, 1, 'E6')]
    hook = [(0, 0, .5, 'C#6'), (0, .5, .5, 'B5'), (0, 1, .5, 'A5'), (0, 1.5, 1, 'B5'), (0, 2.5, .5, 'C#6'), (0, 3, 1, 'E6'),
            (1, 0, .5, 'E6'), (1, .5, .5, 'F#6'), (1, 1, 1, 'E6'), (1, 2, .5, 'C#6'), (1, 2.5, 1.5, 'B5'),
            (2, 0, .5, 'C#6'), (2, .5, .5, 'B5'), (2, 1, .5, 'A5'), (2, 1.5, 1, 'B5'), (2, 2.5, .5, 'C#6'), (2, 3, 1, 'A5'),
            (3, 0, 1.5, 'F#5'), (3, 1.5, .5, 'E5'), (3, 2, .5, 'F#5'), (3, 2.5, 1.5, 'A5'),
            (4, 0, .5, 'C#6'), (4, .5, .5, 'B5'), (4, 1, .5, 'A5'), (4, 1.5, 1, 'B5'), (4, 2.5, .5, 'C#6'), (4, 3, 1, 'E6'),
            (5, 0, .5, 'F#6'), (5, .5, .5, 'E6'), (5, 1, 1, 'F#6'), (5, 2, 1, 'A6'), (5, 3, 1, 'E6'),
            (6, 0, 1, 'C#6'), (6, 1, .5, 'B5'), (6, 1.5, 1, 'A5'), (6, 2.5, .5, 'B5'), (6, 3, 1, 'C#6'),
            (7, 0, 3, 'A5')]
    intro = [(0, 0, .5, 'E5'), (0, .5, .5, 'A5'), (0, 1, .5, 'B5'), (0, 1.5, .5, 'C#6'), (0, 2, 1, 'E6'), (0, 3, 1, 'C#6'),
             (1, 0, 2, 'B5'), (1, 2, 2, 'A5'),
             (2, 0, .5, 'E5'), (2, .5, .5, 'A5'), (2, 1, .5, 'B5'), (2, 1.5, .5, 'C#6'), (2, 2, 1, 'E6'), (2, 3, 1, 'F#6'),
             (3, 0, 3, 'E6')]

    def phrase(track, bar0, notes, vel=1.0, shift=0, fn=I.pluck_lead):
        for bar, beat, beats, name in notes:
            track.add(fn(rng, N(name) + shift, beats * s.beat * .9, vel), s.t(bar0 + bar, beat))

    phrase(lead, 0, intro, .8)
    phrase(lead, 4, verse, .75)
    phrase(lead, 8, verse, .8)
    phrase(lead, 12, pre, .85)
    phrase(lead, 16, hook)
    phrase(lead, 28, hook)
    for bar0 in (16, 28):
        for bar, beat, beats, name in hook:
            if beat % 1 == 0:
                bells.add(I.bell(rng, N(name) + 12, .5, 1.0), s.t(bar0 + bar, beat))
    # Final chorus: festival flute an octave below the hook.
    notes = [(s.t(28 + bar, beat), beats * s.beat * .95, N(name) - 12, .7) for bar, beat, beats, name in hook]
    notes += [(s.t(36, 0), 2 * s.beat, N('A5'), .8), (s.t(37, 0), 2 * s.beat, N('B5'), .8), (s.t(38, 0), 3 * s.beat, N('C#6'), .9)]
    flute.add(I.shinobue_phrase(rng, notes, s.duration), 0.0)
    at(38, 0, crash, I.crash(rng, 1.0))

    s.chart('easy', EASY)
    s.chart('normal', NORMAL)
    s.chart('hard', HARD)
    # Hard-only strokes get a quiet fill voice so every hard note has a sound.
    s.fill_layer('fills', lambda: I.shime(rng, .7), lambda: I.hat(rng, .9), -14.0)
    return s
