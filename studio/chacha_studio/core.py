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
VERSION = 'chacha-generator-v1'

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
    return {'durationMs': round(duration * 1000), 'channels': int(a['channels']), 'sampleRate': int(a['sample_rate'])}

def generate(beats, duration, difficulty, audio_hash, sections=None):
    limit = {'easy': 180, 'normal': 105, 'hard': 75}[difficulty]
    notes = []
    fast = 0
    phase = int(audio_hash[:8], 16) % 4
    for i, beat in enumerate(beats[:-1]):
        gap = beats[i+1] - beat
        if gap <= 0:
            raise ValueError('拍の時刻順が不正です')
        if difficulty == 'easy':
            fractions = [0] if i % 2 == 0 else []
        elif difficulty == 'normal':
            fractions = [0, .5] if i % 8 in [2, 6, 7] else [0]
        else:
            fractions = [0, .5] if i % 8 < 6 else [0, .25, .5, .75]
            if gap < 450 and i % 8 in [0, 4]:
                fractions = [0]
        for j, fraction in enumerate(fractions):
            t = round(beat + gap * fraction)
            if t < 800 or t > duration - 300:
                continue
            if notes and t - notes[-1]['timeMs'] < limit:
                continue
            max_fast = {'easy': 3, 'normal': 5, 'hard': 8}[difficulty]
            if notes and t-notes[-1]['timeMs'] < gap*.5:
                fast += 1
            else:
                fast = 0
            if fast >= max_fast:
                continue
            ka = ((i // 2 + phase) % 8 == 3) if difficulty == 'easy' else ((i + phase) % 4 == 3 and j == 0) if difficulty == 'normal' else ((i + phase) % 4 in [2, 3] and j == 0)
            notes.append({'id': f'n{len(notes)}', 'kind': 'tap', 'timeMs': t, 'color': 'ka' if ka else 'don', 'size': 'large' if i % 32 == 0 and j == 0 else 'normal'})
    if not notes:
        notes = [{'id': 'n0', 'kind': 'tap', 'timeMs': max(0, min(1000, duration-300)), 'color': 'don', 'size': 'normal'}]
    if duration > 12000 and len(beats) > 24:
        a = int(beats[max(8, len(beats)//2)])
        b = min(duration-600, a+int((beats[1]-beats[0])*4))
        if b > a:
            notes = [n for n in notes if not a-90 <= n['timeMs'] <= b+90]
            notes.append({'id': 'roll0', 'kind': 'roll', 'timeMs': a, 'endMs': b})
    notes.sort(key=lambda n: n['timeMs'])
    taps = [n for n in notes if n['kind']=='tap']
    large = [n for n in taps if n['size']=='large']
    for n in large[int(len(taps)*.1):]:
        n['size']='normal'
    return {'schemaVersion': 1, 'chartId': difficulty, 'difficulty': difficulty, 'offsetMs': 0, 'notes': notes}

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

def analyze(source, directory, title, artist, progress=lambda *args:None):
    import numpy as np
    import librosa
    import soundfile as sf
    directory=Path(directory)
    directory.mkdir(parents=True,exist_ok=True)
    info=probe(source)
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
    beats=sorted(set(t for t in beats if 0<=t<duration))
    warnings=[]
    confidence='high'
    if len(beats)<8 or not np.isfinite(bpm) or bpm<=0:
        bpm=120.;beats=list(range(0,duration,500));confidence='low';warnings.append('拍候補が少ないため仮の120 BPMです。先頭拍・BPMを手動調整してください。')
    elif np.std(np.diff(beats))/np.mean(np.diff(beats))>.15:
        confidence='medium';warnings.append('拍間隔が変化しています。先頭・中盤・末尾を試聴してください。')
    rms=np.sqrt(np.mean(np.square(y.reshape(-1,1))))
    if rms<.005:
        confidence='low';warnings.append('静かな音源です。自動下書きを確認してください。')
    peaks=[round(float(np.max(np.abs(a))),4) for a in np.array_split(y,min(1400,len(y)))]
    energies=[]
    for start in range(8000,max(8001,duration-8000),16000):
        end=min(start+16000,duration)
        segment=y[int(start/1000*sr):int(end/1000*sr)]
        if len(segment):energies.append((float(np.mean(segment**2)),start,end))
    sections=[{'kind':'chorus','startMs':a,'endMs':b,'confirmed':False} for _,a,b in sorted(energies,reverse=True)[:3]]
    sections.sort(key=lambda s:s['startMs'])
    h=sha(audio)
    progress('GENERATING',80,'3つの難易度の譜面を作っています')
    charts=[generate(beats,duration,d,h,sections) for d in ['easy','normal','hard']]
    m={'schemaVersion':1,'packId':'song-'+h[:16],'revision':1,'title':title[:200] or '新しい曲','artist':artist[:200] or 'アーティスト未設定','durationMs':duration,'audio':{'path':'audio/song.m4a','sha256':h},'charts':[{'chartId':c['chartId'],'difficulty':c['difficulty'],'path':f"charts/{c['difficulty']}.json",'sha256':hashlib.sha256(json.dumps(c,separators=(',', ':')).encode()).hexdigest()} for c in charts],'beatTimesMs':beats,'downbeatIndices':list(range(0,len(beats),4)),'sections':sections,'generator':VERSION}
    p={'projectId':directory.name,'revision':1,'manifest':m,'charts':charts,'waveform':peaks,'bpm':round(bpm,2),'confidence':confidence,'warnings':warnings+['自動下書き・要試聴。盛り上がりは音量からの候補で、歌詞のサビ判定ではありません。'],'analysis':{'sampleRate':sr,'hopLength':256,'audioSha256':h},'originalHash':sha(source),'decodedDurationMs':duration,'containerDurationMs':final_info['durationMs']}
    validate(p)
    write_json(directory/'project.json',p)
    pcm.unlink(missing_ok=True)
    progress('REVIEW_READY',100,'譜面ができました。試聴して調整してください')
    return p
