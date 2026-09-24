"""Song framework: timeline, tracks, mixing and TJA-like chart authoring."""
import numpy as np
from .dsp import SR, filt, pan_gains, reverb_ir, convolve_stereo, compress, limit, db_to_gain

DIFF_MIN_GAP = {'easy': 180, 'normal': 105, 'hard': 75}


class Track:
    def __init__(self, n, gain_db=0.0, pan=0.0, reverb=0.0, hp=None, lp=None):
        self.buf = np.zeros((n, 2))
        self.gain = db_to_gain(gain_db)
        self.pan = pan
        self.reverb = reverb
        self.hp, self.lp = hp, lp

    def add(self, sound, at, gain=1.0, pan=None):
        i = int(round(at * SR))
        if i >= len(self.buf) or len(sound) == 0:
            return
        if i < 0:
            sound = sound[-i:]
            i = 0
        k = min(len(sound), len(self.buf) - i)
        gl, gr = pan_gains(self.pan if pan is None else pan)
        self.buf[i:i + k, 0] += sound[:k] * gl * gain
        self.buf[i:i + k, 1] += sound[:k] * gr * gain

    def processed(self):
        x = self.buf
        if self.hp:
            x = filt(x, 'highpass', self.hp)
        if self.lp:
            x = filt(x, 'lowpass', self.lp)
        return x * self.gain


class Song:
    def __init__(self, pack_id, title, artist, bpm, bars, beats_per_bar=4, lead_in=0.0, tail=0.0, seed=1, duration=None):
        self.pack_id, self.title, self.artist = pack_id, title, artist
        self.bpm, self.bars, self.bpb = bpm, bars, beats_per_bar
        self.beat = 60.0 / bpm
        self.lead_in = lead_in
        self.duration = duration if duration is not None else lead_in + bars * beats_per_bar * self.beat + tail
        self.n = int(round(self.duration * SR))
        self.tracks = {}
        self.sections = []
        self.charts = {}
        self.rng = np.random.default_rng(seed)
        self.reverb_seconds = 1.8
        # Master EQ in dB (per song): tame sub, add presence and air for phones.
        self.eq_low, self.eq_presence, self.eq_air = -1.5, 2.5, 5.5

    # timeline ----------------------------------------------------------
    def t(self, bar, beat=0.0):
        return self.lead_in + (bar * self.bpb + beat) * self.beat

    def track(self, name, gain_db=0.0, pan=0.0, reverb=0.0, hp=None, lp=None):
        self.tracks[name] = Track(self.n + SR * 3, gain_db, pan, reverb, hp, lp)
        return self.tracks[name]

    def section(self, kind, start_bar, end_bar):
        self.sections.append({'kind': kind, 'startMs': int(round(self.t(start_bar) * 1000)), 'endMs': int(round(min(self.duration, self.t(end_bar)) * 1000)), 'confirmed': True})

    def grid(self, bar, pattern, beats=None):
        """Yield (time, char) for each non-rest character of a bar pattern."""
        chars = [c for c in pattern if c not in ' |']
        span = beats if beats is not None else self.bpb
        for i, c in enumerate(chars):
            if c not in '0.-':
                yield self.t(bar, span * i / len(chars)), c

    # charts --------------------------------------------------------------
    def chart(self, difficulty, bars, start_bar=0):
        """TJA-like authoring: one string per bar.

        0 rest, 1 don, 2 ka, 3 big don, 4 big ka, 5 roll start, 8 roll end.
        The string length sets the grid of that bar (4, 8, 12, 16, ...).
        """
        notes = []
        roll_start = None
        for offset, pattern in enumerate(bars):
            bar = start_bar + offset
            chars = [c for c in pattern if c not in ' |']
            for i, c in enumerate(chars):
                if c in '0.-':
                    continue
                ms = int(round(self.t(bar, self.bpb * i / len(chars)) * 1000))
                if c in '1234':
                    notes.append({'kind': 'tap', 'timeMs': ms, 'color': 'don' if c in '13' else 'ka', 'size': 'large' if c in '34' else 'normal'})
                elif c == '5':
                    roll_start = ms
                elif c == '8':
                    if roll_start is None:
                        raise ValueError(f'roll end without start in bar {bar}')
                    notes.append({'kind': 'roll', 'timeMs': roll_start, 'endMs': ms})
                    roll_start = None
                else:
                    raise ValueError(f'unknown chart symbol {c!r}')
        if roll_start is not None:
            raise ValueError('unterminated roll')
        notes.sort(key=lambda n: n['timeMs'])
        for i, n in enumerate(notes):
            n['id'] = f"{difficulty[0]}{i:04d}"
        self._check(difficulty, notes)
        self.charts[difficulty] = {'schemaVersion': 1, 'chartId': difficulty, 'difficulty': difficulty, 'offsetMs': 0, 'notes': [dict(id=n['id'], **{k: v for k, v in n.items() if k != 'id'}) for n in notes]}
        return notes

    def _check(self, difficulty, notes):
        dur = int(self.duration * 1000)
        taps = [n for n in notes if n['kind'] == 'tap']
        rolls = [n for n in notes if n['kind'] == 'roll']
        if not taps:
            raise ValueError('empty chart')
        last = -1
        for n in notes:
            if n['timeMs'] <= last:
                raise ValueError(f'{difficulty}: notes must be strictly increasing at {n["timeMs"]}')
            last = n['timeMs']
            end = n.get('endMs', n['timeMs'])
            if n['timeMs'] < 0 or end > dur - 300:
                raise ValueError(f'{difficulty}: note outside the song at {n["timeMs"]}')
        for a, b in zip(taps, taps[1:]):
            if b['timeMs'] - a['timeMs'] < DIFF_MIN_GAP[difficulty]:
                raise ValueError(f'{difficulty}: notes closer than {DIFF_MIN_GAP[difficulty]}ms at {b["timeMs"]}')
        for r in rolls:
            if r['endMs'] <= r['timeMs']:
                raise ValueError('roll must have positive length')
            for n in taps:
                if r['timeMs'] - 90 <= n['timeMs'] <= r['endMs'] + 90:
                    raise ValueError(f'{difficulty}: tap {n["timeMs"]} too close to roll {r["timeMs"]}-{r["endMs"]}')
        large = [n for n in taps if n['size'] == 'large']
        if len(large) > max(1, len(taps) * .1):
            raise ValueError(f'{difficulty}: too many large notes ({len(large)}/{len(taps)})')

    def extra_notes(self, harder='hard', base='normal', tolerance_ms=20):
        """Taps that exist in `harder` but not in `base` (for audible fill layers)."""
        base_times = [n['timeMs'] for n in self.charts[base]['notes'] if n['kind'] == 'tap']
        out = []
        for n in self.charts[harder]['notes']:
            if n['kind'] != 'tap':
                continue
            if not any(abs(n['timeMs'] - t) <= tolerance_ms for t in base_times):
                out.append(n)
        return out

    def fill_layer(self, name, don_sound, ka_sound, gain_db=-12.0, pan=.22, reverb=.08):
        """Quiet percussion that plays the hard-only notes so every note is audible."""
        tr = self.track(name, gain_db, pan, reverb)
        for n in self.extra_notes():
            tr.add(don_sound() if n['color'] == 'don' else ka_sound(), n['timeMs'] / 1000)
        return tr

    # markers -------------------------------------------------------------
    def beats(self):
        out, downs = [], []
        total = self.bars * self.bpb
        for i in range(total):
            ms = int(round(self.t(0, i) * 1000))
            if ms >= int(self.duration * 1000):
                break
            if i % self.bpb == 0:
                downs.append(len(out))
            out.append(ms)
        return out, downs

    # mix -------------------------------------------------------------------
    def render(self, master_gain_db=0.0, rms_target_db=-13.5):
        n = self.n + SR * 3
        dry = np.zeros((n, 2))
        send = np.zeros((n, 2))
        for tr in self.tracks.values():
            x = tr.processed()
            dry += x
            if tr.reverb:
                send += x * tr.reverb
        ir = reverb_ir(self.reverb_seconds, np.random.default_rng(7), damping=5200)
        wet = convolve_stereo(filt(send, 'highpass', 250), ir) * .5
        mix = dry + wet
        mix = filt(mix, 'highpass', 38)
        mix = filt(mix, 'lowshelf', 90, .7, self.eq_low)
        mix = filt(mix, 'peak', 3000, .8, self.eq_presence)
        mix = filt(mix, 'highshelf', 6000, .7, self.eq_air)
        mix = mix[:self.n]
        # Level to the RMS target, then compress and limit.
        rms = np.sqrt(np.mean(mix ** 2)) + 1e-9
        mix *= db_to_gain(rms_target_db + master_gain_db) / rms
        mix = compress(mix, threshold_db=-9, ratio=2.0, attack_ms=10, release_ms=180, makeup_db=0.5)
        mix = limit(mix, ceiling=db_to_gain(-1.0))
        # Short fades avoid clicks at the file edges.
        k = int(.004 * SR)
        mix[:k] *= np.linspace(0, 1, k)[:, None]
        k2 = int(.35 * SR)
        mix[-k2:] *= np.linspace(1, 0, k2)[:, None]
        return mix.astype(np.float32)

    def manifest_base(self):
        beats, downs = self.beats()
        return {'beatTimesMs': beats, 'downbeatIndices': downs, 'sections': sorted(self.sections, key=lambda s: s['startMs']), 'durationMs': int(round(self.duration * 1000))}
