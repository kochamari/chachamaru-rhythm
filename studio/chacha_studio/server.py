import asyncio
import hashlib
import json
import os
import re
import secrets
import shutil
import signal
import subprocess
import sys
import threading
import unicodedata
import uuid
from pathlib import Path
from urllib.parse import urlparse
from fastapi import FastAPI,Request,HTTPException,UploadFile,File,Form
from fastapi.responses import JSONResponse,FileResponse
from fastapi.staticfiles import StaticFiles
from .core import ROOT,DATA,write_json,validate,export_project,ffmpeg,ffprobe

app=FastAPI(docs_url=None,redoc_url=None,openapi_url=None)
TOKEN=secrets.token_urlsafe(32)
JOBS={}
EXPORTS={}
LOCK=threading.RLock()
STAGING=False

def stop_group(pid,sig):
    """Signal a worker's process group. The worker may finish between the
    poll() and this call: Linux then reports ESRCH, macOS EPERM for a group of
    exited processes. Either way there is nothing left to stop."""
    try:os.killpg(pid,sig)
    except (ProcessLookupError,PermissionError):pass

def project_dir(pid):
    if not re.fullmatch(r'[a-f0-9-]{36}',pid):raise HTTPException(400,'プロジェクトIDが不正です')
    d=DATA/'projects'/pid
    if not d.is_dir():raise HTTPException(404,'プロジェクトがありません')
    return d

@app.middleware('http')
async def guard(request:Request,call_next):
    host=request.headers.get('host','')
    if urlparse('http://'+host).hostname not in ['127.0.0.1','localhost','testserver'] or ('testserver' in host and not os.environ.get('CHACHA_TEST')):
        return JSONResponse({'detail':'不正なHostです'},400)
    origin=request.headers.get('origin')
    if origin and origin != f'{request.url.scheme}://{host}':return JSONResponse({'detail':'外部Originは許可されていません'},403)
    if request.headers.get('sec-fetch-site')=='cross-site':return JSONResponse({'detail':'外部アクセスを拒否しました'},403)
    if request.url.path.startswith('/api/'):
        if request.url.path not in ['/api/health','/api/session'] and not secrets.compare_digest(request.headers.get('x-chacha-token',''),TOKEN):return JSONResponse({'detail':'セッションを読み直してください'},403)
        size=request.headers.get('content-length')
        if size and (not size.isdigit() or int(size)>82*1024*1024):return JSONResponse({'detail':'アップロードは80MiBまでです'},413)
        if request.method in ['POST','PUT'] and size is None:return JSONResponse({'detail':'Content-Lengthが必要です'},411)
    response=await call_next(request)
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Referrer-Policy']='no-referrer'
    response.headers['Cache-Control']='no-store' if request.url.path.startswith('/api/') else 'no-cache'
    return response

# Identifies the folder this Studio runs from (the launcher reuses only its own).
INSTANCE=hashlib.sha256(unicodedata.normalize('NFC',str(ROOT)).encode()).hexdigest()[:16]

@app.get('/api/health')
def health():return {'ok':True,'app':'chachamaru-studio','apiVersion':1,'studio':INSTANCE,'features':['quickPack'],'ffmpeg':Path(ffmpeg()).exists(),'analysisAvailable':Path(ffprobe()).exists()}

@app.get('/api/session')
def session():return {'csrfToken':TOKEN}

@app.get('/api/projects')
def projects():
    DATA.mkdir(parents=True,exist_ok=True)
    result=[]
    for f in sorted((DATA/'projects').glob('*/project.json'),key=lambda f:f.stat().st_mtime,reverse=True):
        try:
            p=json.loads(f.read_text());result.append({'projectId':p['projectId'],'title':p['manifest']['title'],'artist':p['manifest']['artist'],'revision':p['revision']})
        except (ValueError,KeyError):continue
    return result

@app.post('/api/jobs',status_code=202)
async def create_job(audio:UploadFile=File(...),title:str=Form(''),artist:str=Form(''),filename:str=Form('')):
    global STAGING
    with LOCK:
        if STAGING or any(j['process'].poll() is None for j in JOBS.values()):raise HTTPException(409,'別の解析が進行中です')
        STAGING=True
        jobid=str(uuid.uuid4());d=DATA/'projects'/jobid;d.mkdir(parents=True)
        source=d/'original.upload'
        count=0
        try:
            with source.open('wb') as f:
                while chunk:=await audio.read(1024*1024):
                    count+=len(chunk)
                    if count>80*1024*1024:raise HTTPException(413,'音源は80MiBまでです')
                    f.write(chunk)
            if count==0:raise HTTPException(400,'空の音源です')
            write_json(d/'status.json',{'status':'STAGED','progress':1,'message':'音源を確認しています'})
            log=(d/'worker.log').open('w')
            env={**os.environ,'PYTHONPATH':str(ROOT/'studio'),'NUMBA_CACHE_DIR':str(ROOT/'_private'/'numba-cache')}
            # Blank title/artist: the worker reads the file's tags, then its name.
            name=Path(filename.replace('\\','/')).stem[:200] if filename else ''
            process=subprocess.Popen([sys.executable,'-m','chacha_studio.worker',str(source),str(d),title[:200],artist[:200],'--name='+name],stdout=log,stderr=log,start_new_session=True,env=env)
            log.close();JOBS[jobid]={'process':process,'directory':d}
        except BaseException:
            shutil.rmtree(d,ignore_errors=True);raise
        finally:STAGING=False
    return {'jobId':jobid}

@app.get('/api/jobs/{jid}')
def job(jid:str):
    j=JOBS.get(jid)
    if not j:raise HTTPException(404,'解析がありません')
    data=json.loads((j['directory']/'status.json').read_text())
    if j['process'].poll() not in [None,0] and data['status'] not in ['ERROR','CANCELLED']:data.update(status='ERROR',message='解析処理が終了しました。再試行してください。')
    if data['status']=='REVIEW_READY' and j.get('kind')=='generate':
        with LOCK:
            if not j.get('committed'):
                d=project_dir(j['projectId']);old=json.loads((d/'project.json').read_text())
                if old['revision']!=j['revision']:
                    data.update(status='ERROR',message='生成中に別の編集が保存されました。保存版を読み直してください。')
                    write_json(j['directory']/'status.json',data)
                    return data
                candidate=json.loads((j['directory']/'candidate.json').read_text());validate(candidate)
                write_json(d/'history'/f"{old['revision']}.json",old)
                write_json(d/'project.json',candidate);j['committed']=True
    if data['status']=='REVIEW_READY':data['projectId']=j.get('projectId',jid)
    return data

@app.delete('/api/jobs/{jid}')
def cancel(jid:str):
    j=JOBS.get(jid)
    if not j:raise HTTPException(404,'解析がありません')
    if j.get('committed'):return {'ok':True,'alreadyComplete':True}
    p=j['process']
    if p.poll() is None:
        stop_group(p.pid,signal.SIGTERM)
        try:p.wait(timeout=5)
        except subprocess.TimeoutExpired:stop_group(p.pid,signal.SIGKILL);p.wait()
    d=j['directory']
    if not (d/'project.json').exists():
        for f in d.iterdir():
            if f.is_file():f.unlink(missing_ok=True)
    write_json(d/'status.json',{'status':'CANCELLED','progress':0,'message':'解析を取り消しました'})
    return {'ok':True}

@app.get('/api/projects/{pid}')
def get_project(pid:str):return json.loads((project_dir(pid)/'project.json').read_text())

@app.put('/api/projects/{pid}')
async def put_project(pid:str,request:Request):
    if int(request.headers.get('content-length','0'))>24*1024*1024:raise HTTPException(413,'プロジェクトが大きすぎます')
    p=await request.json();d=project_dir(pid)
    with LOCK:
        old=json.loads((d/'project.json').read_text())
        if p.get('revision')!=old['revision']:raise HTTPException(409,'別の画面で更新されました。再読込してから編集してください')
        if p.get('projectId')!=pid or p['manifest']['audio']!=old['manifest']['audio'] or p.get('originalHash')!=old['originalHash']:raise HTTPException(400,'音源情報は変更できません')
        try:validate(p)
        except Exception as e:raise HTTPException(422,str(e)) from e
        p['revision']+=1;p['manifest']['revision']+=1
        write_json(d/'history'/f"{old['revision']}.json",old)
        write_json(d/'project.json',p)
    return p

@app.post('/api/projects/{pid}/generate',status_code=202)
async def regenerate(pid:str,request:Request):
    d=project_dir(pid);body=await request.json();difficulty=body.get('difficulty')
    if difficulty not in ['easy','normal','hard']:raise HTTPException(422,'難易度が不正です')
    with LOCK:
        if STAGING or any(j['process'].poll() is None for j in JOBS.values()):raise HTTPException(409,'別の解析が進行中です')
        p=json.loads((d/'project.json').read_text())
        if body.get('revision')!=p['revision']:raise HTTPException(409,'保存版が変わりました。読み直してください')
        jid=str(uuid.uuid4());work=d/'jobs'/jid;work.mkdir(parents=True)
        write_json(work/'input.json',p)
        write_json(work/'status.json',{'status':'GENERATING','progress':10,'message':'譜面の下書きを作っています'})
        log=(work/'worker.log').open('w')
        env={**os.environ,'PYTHONPATH':str(ROOT/'studio')}
        process=subprocess.Popen([sys.executable,'-m','chacha_studio.regenerate_worker',str(work),difficulty],stdout=log,stderr=log,start_new_session=True,env=env)
        log.close();JOBS[jid]={'process':process,'directory':work,'kind':'generate','projectId':pid,'revision':p['revision']}
    return {'jobId':jid}

@app.get('/api/projects/{pid}/audio')
def audio(pid:str):return FileResponse(project_dir(pid)/'song.m4a',media_type='audio/mp4')

@app.post('/api/projects/{pid}/export')
def export(pid:str):
    with LOCK:
        d=project_dir(pid);p=json.loads((d/'project.json').read_text());eid=str(uuid.uuid4());target=DATA/'exports'/f'{eid}.zip';target.parent.mkdir(parents=True,exist_ok=True)
        try:export_project(p,d,target)
        except Exception as e:raise HTTPException(422,str(e)) from e
        EXPORTS[eid]=target
    return {'exportId':eid}

@app.get('/api/exports/{eid}')
def download(eid:str):
    if eid not in EXPORTS:raise HTTPException(404,'書き出しがありません')
    return FileResponse(EXPORTS[eid],media_type='application/zip',filename='chachamaru-song.zip')

if (ROOT/'dist').exists():app.mount('/',StaticFiles(directory=ROOT/'dist',html=True),name='web')
