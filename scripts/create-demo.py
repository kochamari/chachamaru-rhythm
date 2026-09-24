"""Compose an original 64-second pentatonic festival tune. No third-party samples."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'studio'))
from chacha_studio.core import ffmpeg,generate,sha,write_json,export_project,ROOT
import numpy as np
import soundfile as sf
import subprocess
import json
SR=44100
LENGTH=64
rng=np.random.default_rng(260924)
track=np.zeros(SR*LENGTH,dtype=np.float32)
def mix(at,data,gain=1):
    pos=round(at*SR);n=min(len(data),len(track)-pos)
    if n>0:track[pos:pos+n]+=data[:n]*gain
def tone(freq,length,kind='plucked'):
    t=np.arange(round(length*SR))/SR
    wave=np.sin(2*np.pi*freq*t)+.28*np.sin(2*np.pi*2*freq*t)+.1*np.sin(2*np.pi*3*freq*t)
    env=(1-np.exp(-t*180))*np.exp(-t*(5 if kind=='plucked' else 2))
    env*=np.minimum(1,(length-t)*35)
    return (wave*env).astype(np.float32)
scale=[293.6648,329.6276,391.9954,440.,493.8833,587.3295,659.2551,783.9909]
motifs=[[0,2,3,2,0,1,2,4],[2,3,4,5,4,3,2,0],[5,4,3,2,3,4,2,1],[0,1,2,4,3,2,1,0]]
for beat in range(128):
    at=beat*.5;chorus=24<=at<40 or at>=48
    t=np.arange(int(SR*.23))/SR
    if beat%2==0:mix(at,np.sin(2*np.pi*(60*t+10*(1-np.exp(-t*20))))*np.exp(-t*24),.30)
    else:mix(at,rng.normal(0,1,len(t))*np.exp(-t*45),.035)
    if beat%4==2 or chorus:mix(at+.25,rng.normal(0,1,int(SR*.05))*np.exp(-np.arange(int(SR*.05))/SR*100),.025)
    chord=[146.8324,130.8128,164.8138,195.9977][beat//8%4]
    if beat%2==0:mix(at,tone(chord/2,.9,'bass'),.18)
    if beat%4==0:
        for f in [chord,chord*1.5,chord*2]:mix(at,tone(f,1.7),.05)
    if at>=4:
        motif=motifs[beat//8%4];note=motif[beat%8];mix(at,tone(scale[note],.42),.11 if chorus else .075)
        if chorus and beat%4 in [1,3]:mix(at+.25,tone(scale[(note+2)%8],.22),.065)
track[:int(SR*.015)]*=np.linspace(0,1,int(SR*.015))
track[-SR:]*=np.linspace(1,0,SR)
track=np.tanh(track*1.2)*.82
tmp=ROOT/'_private'/'demo-source';tmp.mkdir(parents=True,exist_ok=True)
sf.write(tmp/'original.wav',np.column_stack([track,track]),SR,subtype='PCM_16')
subprocess.run([ffmpeg(),'-nostdin','-v','error','-y','-i',str(tmp/'original.wav'),'-c:a','aac','-b:a','192k','-ar','44100',str(tmp/'song.m4a')],check=True)
h=sha(tmp/'song.m4a');beats=list(range(0,64000,500));charts=[generate(beats,64000,d,h) for d in ['easy','normal','hard']]
sections=[{'kind':k,'startMs':a,'endMs':b,'confirmed':True} for k,a,b in [('intro',0,8000),('verse',8000,24000),('chorus',24000,40000),('bridge',40000,48000),('chorus',48000,64000)]]
m={'schemaVersion':1,'packId':'himawari-demo','revision':1,'title':'ひまわり囃子','artist':'ちゃちゃまる音楽隊','durationMs':64000,'audio':{'path':'audio/song.m4a','sha256':h},'charts':[{'chartId':c['chartId'],'difficulty':c['difficulty'],'path':f"charts/{c['difficulty']}.json",'sha256':'0'*64} for c in charts],'beatTimesMs':beats,'downbeatIndices':list(range(0,128,4)),'sections':sections,'generator':'original-composition-v1'}
p={'projectId':'original-demo','revision':1,'manifest':m,'charts':charts,'waveform':[round(float(np.max(np.abs(a))),4) for a in np.array_split(track,1000)],'bpm':120.,'confidence':'high','warnings':[],'analysis':{'sampleRate':22050,'hopLength':256,'audioSha256':h},'originalHash':sha(tmp/'original.wav')}
export_project(p,tmp,ROOT/'web/public/original-demo/himawari.zip')
write_json(ROOT/'fixtures/demo-project.json',p)
# Short original diagnostic audio, including non-zero time positions.
sf.write(ROOT/'fixtures/diagnostic.wav',track[:SR*4],SR,subtype='PCM_16')
print(json.dumps({'demoSeconds':64,'charts':{c['difficulty']:len(c['notes']) for c in charts},'audioSha256':h}))
