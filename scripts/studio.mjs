import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,openSync,readFileSync} from 'node:fs';
import path from 'node:path';
// Starts the Mac Studio (local analysis API + the built game) on port 8787.
//   --reuse   open the Studio already running from this folder (Start Studio.command)
//   --app     for the Mac app / chachamaru-studio:// links: open it, or start it in
//             the background (no terminal) and open it once it answers
//   --stop    stop a Studio from this folder that runs in the background
//   --game    open the song list instead of the Studio
const root=path.resolve(import.meta.dirname,'..');process.chdir(root);
const has=flag=>process.argv.includes(flag);
const route=has('--game')?'songs':'studio';
const HOME=8787;
const self=createHash('sha256').update(root.normalize('NFC')).digest('hex').slice(0,16);
const OTHER='ポート8787で、別のフォルダ（以前の版など）の譜面工房が動いています。\nそちらのターミナルで Control+C を押して終了してから、もう一度開いてください。\n（同じ8787で開くと、ゲームの保存データもそのまま使えます）';
const open=url=>{if(process.platform==='darwin'&&!has('--no-open'))spawnSync('open',[url],{stdio:'ignore'});console.log(url);};

async function health(port=HOME){
 try{const r=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(1500)});const data=await r.json();return data?.app==='chachamaru-studio'&&data.ok?data:null;}
 catch{return null;}
}
async function free(port){return new Promise(resolve=>{const s=createServer();s.once('error',()=>resolve(false));s.listen(port,'127.0.0.1',()=>s.close(()=>resolve(true)));});}
const serverArgs=port=>['-m','uvicorn','chacha_studio.server:app','--host','127.0.0.1','--port',String(port)];
const serverEnv={...process.env,PYTHONPATH:path.join(root,'studio'),NUMBA_CACHE_DIR:path.join(root,'_private/numba-cache')};

if(has('--stop')){
 const data=await health();
 if(!data){console.log('譜面工房は動いていません');process.exit(0);}
 if(data.studio!==self){console.error('ポート8787の譜面工房は別のフォルダのものです。そちらで終了してください。');process.exit(3);}
 const pids=spawnSync('lsof',['-t','-iTCP:8787','-sTCP:LISTEN'],{encoding:'utf8'}).stdout.split(/\s+/).filter(Boolean).map(Number);
 for(const pid of pids)process.kill(pid,'SIGTERM');
 console.log('譜面工房を終了しました');process.exit(0);
}

if(has('--reuse')||has('--app')){
 // Reuse only a Studio started from this folder. Another copy (an older
 // version elsewhere) on the same port would silently open the old Studio.
 const data=await health();
 if(data){
  if(data.studio!==self){console.error(OTHER);process.exit(3);}
  open(`http://127.0.0.1:${HOME}/#/${route}`);process.exit(0);
 }
}
if(!existsSync('.venv/bin/python')){console.error('初回セットアップが必要です: python3 -m venv .venv && .venv/bin/python -m pip install -r studio/requirements.lock');process.exit(1);}
if(!has('--no-build')){const build=spawnSync('npm',['run','build'],{stdio:has('--app')?'ignore':'inherit'});if(build.status){console.error('ゲームのビルドに失敗しました（npm run build）');process.exit(build.status);}}

if(has('--app')){
 // Same origin as always (the browser keeps songs and records per address).
 if(!await free(HOME)){console.error('ポート8787を別のアプリが使っているため、譜面工房を開けません。');process.exit(4);}
 mkdirSync('_private',{recursive:true});
 const logFile=path.join(root,'_private/studio-app.log');const log=openSync(logFile,'a');
 const server=spawn(path.join(root,'.venv/bin/python'),serverArgs(HOME),{cwd:root,detached:true,stdio:['ignore',log,log],env:serverEnv});
 let exited=false;server.on('exit',()=>{exited=true;});
 server.unref();
 const deadline=Date.now()+60000;
 while(Date.now()<deadline&&!exited){
  if(await health()){open(`http://127.0.0.1:${HOME}/#/${route}`);process.exit(0);}
  await new Promise(r=>setTimeout(r,300));
 }
 const tail=readFileSync(logFile,'utf8').trim().split('\n').slice(-5).join('\n');
 console.error(`譜面工房を起動できませんでした。\n${tail}`);process.exit(5);
}

let port=Number(process.env.PORT||HOME);while(!await free(port))port++;
const url=`http://127.0.0.1:${port}/#/${route}`;
const proc=spawn(path.join(root,'.venv/bin/python'),serverArgs(port),{cwd:root,stdio:'inherit',env:serverEnv});
console.log(`ちゃちゃまる 譜面工房: ${url}\n終了: Control+C`);
if(process.platform==='darwin'&&!has('--no-open')){const ready=setInterval(async()=>{if(await health(port)){clearInterval(ready);spawn('open',[url],{stdio:'ignore'});}},500);proc.on('exit',()=>clearInterval(ready));}
process.on('SIGINT',()=>proc.kill('SIGINT'));process.on('SIGTERM',()=>proc.kill('SIGTERM'));proc.on('exit',code=>process.exit(code??0));
