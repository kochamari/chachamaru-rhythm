import copy
import hashlib
import json
import subprocess
import time
import uuid
import zipfile
from pathlib import Path
import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient
from chacha_studio import core,server

@pytest.fixture(scope='module')
def analyzed(tmp_path_factory):
    directory=tmp_path_factory.mktemp('analyzed')/str(uuid.uuid4())
    source=core.ROOT/'fixtures/diagnostic.wav'
    before=core.sha(source)
    project=core.analyze(source,directory,'試験曲','ちゃちゃまる音楽隊')
    assert core.sha(source)==before
    return project,directory

def test_pipeline_and_roundtrip(analyzed,tmp_path):
    p,d=analyzed
    assert len(p['charts'])==3
    assert p['manifest']['audio']['sha256']==core.sha(d/'song.m4a')
    assert p['analysis']['audioSha256']==core.sha(d/'song.m4a')
    assert p['analysis']['sampleRate']==22050
    assert p['analysis']['hopLength']==256
    target=tmp_path/'pack.zip'
    core.export_project(p,d,target)
    with zipfile.ZipFile(target) as z:
        m=json.loads(z.read('manifest.json'))
        for ref in [m['audio'],*m['charts']]:assert hashlib.sha256(z.read(ref['path'])).hexdigest()==ref['sha256']

@pytest.mark.parametrize('difficulty,spacing,max_ka',[('easy',180,.2),('normal',105,.3),('hard',75,.4)])
def test_generator_determinism_limits(difficulty,spacing,max_ka):
    beats=list(range(0,64000,500));h='abcdef01'*8
    a=core.generate(beats,64000,difficulty,h);b=core.generate(beats,64000,difficulty,h)
    assert a==b
    taps=[n for n in a['notes'] if n['kind']=='tap']
    assert all(y['timeMs']-x['timeMs']>=spacing for x,y in zip(taps,taps[1:]))
    assert sum(n['size']=='large' for n in taps)<=len(taps)*.1
    assert all(800<=n['timeMs']<=63700 for n in taps)
    assert sum(n['color']=='ka' for n in taps)/len(taps)<=max_ka

def test_silence_has_manual_fallback(tmp_path):
    source=tmp_path/'silent.wav';sf.write(source,np.zeros(44100*4),44100)
    p=core.analyze(source,tmp_path/'silent','無音','試験')
    assert p['confidence']=='low'
    assert p['warnings']
    assert p['manifest']['beatTimesMs']
    assert all(len(c['notes']) for c in p['charts'])

def test_unconfirmed_sections(analyzed):
    p,_=analyzed
    assert all(not s['confirmed'] for s in p['manifest']['sections'])
    altered=copy.deepcopy(p)
    altered['manifest']['sections']=[{'kind':'chorus','startMs':1000,'endMs':3000,'confirmed':True}]
    core.validate(altered)

@pytest.mark.parametrize('bad',['notes-order','ids','offset','empty','overlap','path','future','audio-duration','beats','downbeats'])
def test_semantics_reject_invalid(analyzed,bad):
    p=copy.deepcopy(analyzed[0]);c=p['charts'][1]
    if bad=='notes-order':c['notes'].reverse()
    if bad=='ids':c['notes'][1]['id']=c['notes'][0]['id']
    if bad=='offset':c['offsetMs']=-10000
    if bad=='empty':c['notes']=[]
    if bad=='overlap':c['notes'].insert(1,{'kind':'roll','id':'roll','timeMs':c['notes'][0]['timeMs']+1,'endMs':c['notes'][1]['timeMs']+100})
    if bad=='path':p['manifest']['charts'][0]['path']='../../x'
    if bad=='future':p['manifest']['schemaVersion']=2
    if bad=='audio-duration':p['manifest']['durationMs']=900000
    if bad=='beats':p['manifest']['beatTimesMs']=[3,2]
    if bad=='downbeats':p['manifest']['downbeatIndices']=[900]
    with pytest.raises(Exception):core.validate(p)

@pytest.fixture()
def client(tmp_path,monkeypatch,analyzed):
    monkeypatch.setattr(server,'DATA',tmp_path)
    pid=str(uuid.uuid4());directory=tmp_path/'projects'/pid;directory.mkdir(parents=True)
    p=copy.deepcopy(analyzed[0]);p['projectId']=pid
    core.write_json(directory/'project.json',p)
    (directory/'song.m4a').write_bytes((analyzed[1]/'song.m4a').read_bytes())
    server.JOBS.clear();server.EXPORTS.clear()
    with TestClient(server.app,base_url='http://127.0.0.1:8787') as c:
        token=c.get('/api/session').json()['csrfToken']
        yield c,{'X-Chacha-Token':token},pid
        for j in server.JOBS.values():
            if j['process'].poll() is None:server.cancel(next(k for k,v in server.JOBS.items() if v is j))

def test_health_and_api_security(client):
    c,h,pid=client
    assert c.get('/api/health').json()['analysisAvailable']
    assert c.get('/api/projects').status_code==403
    assert c.get('/api/projects',headers={**h,'Origin':'https://evil.example'}).status_code==403
    assert c.get('/api/session',headers={'Host':'evil.example'}).status_code==400
    assert c.get('/api/session',headers={'Sec-Fetch-Site':'cross-site'}).status_code==403
    assert c.get('/api/projects/not-a-path/audio',headers=h).status_code==400
    assert c.get(f'/api/projects/{pid}/audio',headers=h).status_code==200
    assert c.get(f'/api/projects/{pid}/audio').status_code==403
    assert c.get('/api/projects',headers=h).status_code==200

def test_autosave_revision_conflict_and_export(client):
    c,h,pid=client
    p=c.get(f'/api/projects/{pid}',headers=h).json();old=copy.deepcopy(p)
    p['charts'][0]['notes'][0]['color']='ka'
    response=c.put(f'/api/projects/{pid}',json=p,headers=h)
    assert response.status_code==200
    assert response.json()['revision']==p['revision']+1
    assert c.put(f'/api/projects/{pid}',json=old,headers=h).status_code==409
    response=c.post(f'/api/projects/{pid}/export',headers=h,json={})
    assert response.status_code==200
    data=c.get('/api/exports/'+response.json()['exportId'],headers=h)
    assert data.status_code==200 and data.content[:2]==b'PK'
    assert c.get('/api/exports/'+response.json()['exportId']).status_code==403

def test_audio_mutation_rejected(client):
    c,h,pid=client;p=c.get(f'/api/projects/{pid}',headers=h).json();p['manifest']['audio']['sha256']='0'*64
    assert c.put(f'/api/projects/{pid}',json=p,headers=h).status_code==400

def test_generation_retains_history(client):
    c,h,pid=client;p=c.get(f'/api/projects/{pid}',headers=h).json()
    r=c.post(f'/api/projects/{pid}/generate',headers=h,json={'difficulty':'normal','revision':p['revision']})
    assert r.status_code==202
    jid=r.json()['jobId'];deadline=time.time()+30
    while time.time()<deadline:
        data=c.get('/api/jobs/'+jid,headers=h).json()
        if data['status'] in ['REVIEW_READY','ERROR']:break
        time.sleep(.05)
    assert data['status']=='REVIEW_READY',data
    assert data['projectId']==pid
    assert (server.DATA/'projects'/pid/'history'/'1.json').exists()
    assert c.post(f'/api/projects/{pid}/generate',headers=h,json={'difficulty':'normal','revision':p['revision']}).status_code==409

def test_generation_does_not_overwrite_intervening_edit(client):
    c,h,pid=client;p=c.get(f'/api/projects/{pid}',headers=h).json()
    response=c.post(f'/api/projects/{pid}/generate',headers=h,json={'difficulty':'normal','revision':p['revision']})
    jid=response.json()['jobId']
    p['charts'][0]['offsetMs']=2
    assert c.put(f'/api/projects/{pid}',headers=h,json=p).status_code==200
    server.JOBS[jid]['process'].wait(timeout=30)
    assert c.get('/api/jobs/'+jid,headers=h).json()['status']=='ERROR'
    assert c.get(f'/api/projects/{pid}',headers=h).json()['charts'][0]['offsetMs']==2

def test_cancel_generation_preserves_saved_project(client):
    c,h,pid=client;p=c.get(f'/api/projects/{pid}',headers=h).json()
    response=c.post(f'/api/projects/{pid}/generate',headers=h,json={'difficulty':'normal','revision':p['revision']})
    jid=response.json()['jobId']
    assert c.delete('/api/jobs/'+jid,headers=h).status_code==200
    assert c.get('/api/jobs/'+jid,headers=h).json()['status']=='CANCELLED'
    assert c.get(f'/api/projects/{pid}',headers=h).json()==p

def test_real_upload_job_export_flow(client):
    c,h,_=client;source=core.ROOT/'fixtures/diagnostic.wav';before=core.sha(source)
    r=c.post('/api/jobs',headers=h,files={'audio':('diagnostic.wav',source.read_bytes(),'audio/wav')},data={'title':'API試験曲','artist':'音楽隊'})
    assert r.status_code==202
    jid=r.json()['jobId'];deadline=time.time()+60
    while time.time()<deadline:
        data=c.get('/api/jobs/'+jid,headers=h).json()
        if data['status'] in ['REVIEW_READY','ERROR']:break
        time.sleep(.1)
    assert data['status']=='REVIEW_READY',data
    assert core.sha(source)==before
    assert c.post(f'/api/projects/{jid}/export',headers=h,json={}).status_code==200

def test_cancel_stops_process_and_cleans_temp(client):
    c,h,_=client;source=core.ROOT/'fixtures/diagnostic.wav'
    r=c.post('/api/jobs',headers=h,files={'audio':('diagnostic.wav',source.read_bytes(),'audio/wav')})
    jid=r.json()['jobId'];assert c.delete('/api/jobs/'+jid,headers=h).status_code==200
    assert c.get('/api/jobs/'+jid,headers=h).json()['status']=='CANCELLED'
    assert not (server.DATA/'projects'/jid/'original.upload').exists()
    assert server.JOBS[jid]['process'].poll() is not None

def test_invalid_audio_job_recovers(client):
    c,h,_=client
    r=c.post('/api/jobs',headers=h,files={'audio':('bad.wav',b'not audio','audio/wav')})
    jid=r.json()['jobId'];deadline=time.time()+30
    while time.time()<deadline:
        d=c.get('/api/jobs/'+jid,headers=h).json()
        if d['status']=='ERROR':break
        time.sleep(.1)
    assert d['status']=='ERROR'
    assert c.post('/api/jobs',headers={**h,'Content-Length':str(90*1024*1024)},content=b'x').status_code==413

def test_transcode_failure_preserves_source(tmp_path,monkeypatch):
    source=core.ROOT/'fixtures/diagnostic.wav';before=core.sha(source)
    monkeypatch.setattr(core,'ffmpeg',lambda:'/not-an-executable')
    with pytest.raises((OSError,subprocess.CalledProcessError)):core.analyze(source,tmp_path/'failed','fail','test')
    assert core.sha(source)==before


def test_old_projects_get_features_for_regeneration(analyzed):
    p, d = analyzed
    saved = d / 'features.json'
    assert saved.exists()
    original = json.loads(saved.read_text())
    saved.unlink()
    assert core.load_features(d) is None
    again = core.load_features(d, compute=True)
    assert saved.exists() and again['rate'] == original['rate'] and len(again['full']) == len(original['full'])
    chart = core.generate(p['manifest']['beatTimesMs'], p['manifest']['durationMs'], 'normal', p['manifest']['audio']['sha256'], p['manifest']['sections'], again, p['manifest']['downbeatIndices'])
    assert any(n['kind'] == 'tap' for n in chart['notes'])
