import hashlib
import json
import os
import subprocess
import sys
import uuid
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = Path(os.environ.get('CHACHA_DATA', str(ROOT / '_private' / 'studio')))
VERSION = 'chacha-generator-v2'

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')))
    tmp.replace(path)

def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()

def ffprobe():
    import shutil
    if shutil.which('ffprobe'):
        return shutil.which('ffprobe')
    platform = 'darwin' if sys.platform == 'darwin' else 'linux'
    return str(ROOT / 'node_modules' / 'ffprobe-static' / 'bin' / platform / 'x64' / 'ffprobe')

def probe(path):
    r = subprocess.run([ffprobe(), '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)], capture_output=True, check=True, timeout=30)
    data = json.loads(r.stdout)
    audio = [s for s in data['streams'] if s['codec_type'] == 'audio']
    if not audio:
        raise ValueError('音声トラックがありません')
    a = audio[0]
    duration = float(data['format']['duration'])
    if duration <= 0 or duration > 480 or int(a['channels']) > 2:
        raise ValueError('音源は480秒・2チャンネルまでです')
    # Title and artist tags (ID3 in MP3, iTunes atoms in M4A, INFO in WAV).
    tags = {}
    for source in [a.get('tags') or {}, data['format'].get('tags') or {}]:
        for k, v in source.items():
            tags[k.lower()] = str(v).strip()
    return {'durationMs': round(duration * 1000), 'channels': int(a['channels']), 'sampleRate': int(a['sample_rate']),
            'title': tags.get('title', ''), 'artist': tags.get('artist') or tags.get('album_artist') or ''}

def song_labels(title, artist, info, name=''):
    """Title and artist for a new song: what the user typed, else the file's
    tags, else the file name (title only)."""
    title = (title or '').strip() or info.get('title', '') or (name or '').strip() or '新しい曲'
    artist = (artist or '').strip() or info.get('artist', '') or 'アーティスト未設定'
    return title[:200], artist[:200]

def generate(beats, duration, difficulty, audio_hash, sections=None, features=None, downbeats=None):
    """Draft chart for one difficulty. Deterministic for the same inputs."""
    from .generator import generate as draft
    return draft(beats, duration, difficulty, audio_hash, sections, features, downbeats)


def load_features(directory, compute=False):
    """Onset features saved by the analysis. Projects made before v2 have
    none: with compute=True they are derived from the project's final audio."""
    f = Path(directory) / 'features.json'
    if f.exists():
        try:
            return json.loads(f.read_text())
        except ValueError:
            pass
    audio = Path(directory) / 'song.m4a'
    if not compute or not audio.exists():
        return None
    import soundfile as sf
    from .generator import onset_features
    pcm = Path(directory) / 'features.wav'
    try:
        subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-i', str(audio), '-vn', '-ar', '22050', '-ac', '1', '-c:a', 'pcm_s16le', str(pcm)], check=True, timeout=120)
        y, sr = sf.read(pcm, dtype='float32')
        features = onset_features(y, sr)
        write_json(f, features)
        return features
    finally:
        pcm.unlink(missing_ok=True)


def validate(project):
    import jsonschema
    m = project['manifest']
    jsonschema.validate(m, json.loads((ROOT/'schemas/manifest.schema.json').read_text()))
    duration=m['durationMs']
    beats=m['beatTimesMs']
    if any(t<0 or t>=duration for t in beats) or any(a>=b for a,b in zip(beats,beats[1:])):
        raise ValueError('拍は曲内の昇順にしてください')
    downs=m['downbeatIndices']
    if any(i<0 or i>=len(beats) for i in downs) or any(a>=b for a,b in zip(downs,downs[1:])):
        raise ValueError('小節線が不正です')
    sections=sorted(m['sections'],key=lambda s:s['startMs'])
    if any(s['endMs']<=s['startMs'] or s['endMs']>duration for s in sections) or any(a['endMs']>b['startMs'] for a,b in zip(sections,sections[1:])):
        raise ValueError('区間の長さ・重なりが不正です')
    refs=m['charts']
    if len(project['charts'])!=len(refs) or any(len(set(r[k] for r in refs))!=len(refs) for k in ['chartId','path','difficulty']):
        raise ValueError('譜面の識別子が不正です')
    for c in project['charts']:
        jsonschema.validate(c,json.loads((ROOT/'schemas/chart.schema.json').read_text()))
        ref=next((r for r in refs if r['chartId']==c['chartId']),None)
        if not ref or ref['difficulty']!=c['difficulty'] or ref['path']!=f"charts/{c['difficulty']}.json":
            raise ValueError('譜面情報が一致しません')
        notes=c['notes']
        if len({n['id'] for n in notes})!=len(notes) or any(a['timeMs']>=b['timeMs'] for a,b in zip(notes,notes[1:])):
            raise ValueError('音符のID・時刻が重複しています')
        taps=[n for n in notes if n['kind']=='tap']
        rolls=[n for n in notes if n['kind']=='roll']
        if not taps:
            raise ValueError('通常音符が必要です')
        for n in notes:
            if n['timeMs']+c['offsetMs']<0 or n.get('endMs',n['timeMs'])+c['offsetMs']>duration:
                raise ValueError('音符が曲末を超えています')
        for i,r in enumerate(rolls):
            if r['endMs']<=r['timeMs'] or (i and rolls[i-1]['endMs']>=r['timeMs']) or any(r['timeMs']-90<=n['timeMs']<=r['endMs']+90 for n in taps):
                raise ValueError('連打の範囲が不正です')

def export_project(project, directory, target):
    validate(project)
    m=json.loads(json.dumps(project['manifest']))
    audio=Path(directory)/'song.m4a'
    if sha(audio)!=m['audio']['sha256']:
        raise ValueError('音源が変更されています。再解析してください')
    files={m['audio']['path']:audio.read_bytes()}
    for c in project['charts']:
        b=json.dumps(c,separators=(',', ':')).encode()
        ref=next(r for r in m['charts'] if r['chartId']==c['chartId'])
        ref['sha256']=hashlib.sha256(b).hexdigest()
        files[ref['path']]=b
    files['manifest.json']=json.dumps(m,ensure_ascii=False,separators=(',', ':')).encode()
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=1) as z:
        for name,b in files.items():z.writestr(name,b)
    return m

def chorus_candidates(y, sr, duration, beats, window_ms=16000, count=3):
    """Loudest 16 s stretches (at most three), separated so they are distinct
    parts of the song, snapped to beats. Energy candidates only: they are
    marked unconfirmed for the user to check."""
    import numpy as np
    if duration < window_ms + 8000:
        return []
    step = 1000
    frames = np.array([float(np.mean(y[int(t / 1000 * sr):int((t + step) / 1000 * sr)] ** 2)) for t in range(0, duration - step, step)])
    k = window_ms // step
    scores = np.convolve(frames, np.ones(k) / k, mode='valid')
    order = np.argsort(-scores)
    chosen = []
    for i in order:
        start = int(i) * step
        if start < 4000 or start + window_ms > duration - 2000:
            continue
        if any(abs(start - c) < window_ms + 8000 for c in chosen):
            continue
        chosen.append(start)
        if len(chosen) == count:
            break
    out = []
    for start in sorted(chosen):
        if beats:
            start = min(beats, key=lambda b: abs(b - start))
        out.append((int(start), int(min(duration, start + window_ms))))
    return out


def analyze(source, directory, title, artist, progress=lambda *args:None, name=''):
    import numpy as np
    import librosa
    import soundfile as sf
    directory=Path(directory)
    directory.mkdir(parents=True,exist_ok=True)
    info=probe(source)
    title,artist=song_labels(title,artist,info,name)
    progress('TRANSCODING',15,'iPhone用の音源を作成しています')
    audio=directory/'song.m4a'
    subprocess.run([ffmpeg(),'-nostdin','-v','error','-y','-i',str(source),'-map','0:a:0','-vn','-c:a','aac','-profile:a','aac_low','-b:a','192k','-ar','44100','-ac',str(info['channels']),str(audio)],check=True,timeout=180)
    final_info=probe(audio)
    pcm=directory/'analysis.wav'
    subprocess.run([ffmpeg(),'-nostdin','-v','error','-y','-i',str(audio),'-vn','-ar','22050','-ac','1','-c:a','pcm_s16le',str(pcm)],check=True,timeout=120)
    progress('ANALYZING',40,'曲の拍と盛り上がりを調べています')
    y,sr=sf.read(pcm,dtype='float32')
    duration=round(len(y)/sr*1000)
    onset=librosa.onset.onset_strength(y=y,sr=sr,hop_length=256)
    tempo,frames=librosa.beat.beat_track(onset_envelope=onset,sr=sr,hop_length=256)
    bpm=float(np.asarray(tempo).ravel()[0]) if np.asarray(tempo).size else 120
    beats=[round(float(t)*1000) for t in librosa.frames_to_time(frames,sr=sr,hop_length=256)]
    from .generator import onset_features,downbeat_phase_chroma,refine_beats
    beats,bpm,beat_shift=refine_beats(y,sr,beats,bpm)
    beats=sorted(set(t for t in beats if 0<=t<duration))
    warnings=[]
    confidence='high'
    if len(beats)<8 or not np.isfinite(bpm) or bpm<=0:
        bpm=120.;beats=list(range(0,duration,500));confidence='low';warnings.append('拍候補が少ないため仮の120 BPMです。先頭拍・BPMを手動調整してください。')
    elif np.std(np.diff(beats))/np.mean(np.diff(beats))>.15:
        confidence='medium';warnings.append('拍間隔が変化しています。先頭・中盤・末尾を試聴してください。')
    features=onset_features(y,sr)
    write_json(directory/'features.json',features)
    phase=downbeat_phase_chroma(y,sr,beats,np.asarray(features['low'],dtype=float)/255,features['rate']) if confidence!='low' else 0
    rms=np.sqrt(np.mean(np.square(y.reshape(-1,1))))
    if rms<.005:
        confidence='low';warnings.append('静かな音源です。自動下書きを確認してください。')
    peaks=[round(float(np.max(np.abs(a))),4) for a in np.array_split(y,min(1400,len(y)))]
    sections=[{'kind':'chorus','startMs':a,'endMs':b,'confirmed':False} for a,b in chorus_candidates(y,sr,duration,beats)]
    h=sha(audio)
    progress('GENERATING',80,'3つの難易度の譜面を作っています')
    downbeats=list(range(phase,len(beats),4))
    charts=[generate(beats,duration,d,h,sections,features if confidence!='low' else None,downbeats) for d in ['easy','normal','hard']]
    m={'schemaVersion':1,'packId':'song-'+h[:16],'revision':1,'title':title,'artist':artist,'durationMs':duration,'audio':{'path':'audio/song.m4a','sha256':h},'charts':[{'chartId':c['chartId'],'difficulty':c['difficulty'],'path':f"charts/{c['difficulty']}.json",'sha256':hashlib.sha256(json.dumps(c,separators=(',', ':')).encode()).hexdigest()} for c in charts],'beatTimesMs':beats,'downbeatIndices':downbeats,'sections':sections,'generator':VERSION}
    p={'projectId':directory.name,'revision':1,'manifest':m,'charts':charts,'waveform':peaks,'bpm':round(bpm,2),'confidence':confidence,'warnings':warnings+['自動下書き・要試聴。盛り上がりは音量からの候補で、歌詞のサビ判定ではありません。'],'analysis':{'sampleRate':sr,'hopLength':256,'audioSha256':h,'beatShiftMs':round(beat_shift,1)},'originalHash':sha(source),'decodedDurationMs':duration,'containerDurationMs':final_info['durationMs']}
    validate(p)
    write_json(directory/'project.json',p)
    pcm.unlink(missing_ok=True)
    progress('REVIEW_READY',100,'譜面ができました。試聴して調整してください')
    return p
