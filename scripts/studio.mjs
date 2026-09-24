import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:net';
import {existsSync} from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');process.chdir(root);
const route=process.argv.includes('--game')?'songs':'studio';
if(process.argv.includes('--reuse')){
 try{const r=await fetch('http://127.0.0.1:8787/api/health',{signal:AbortSignal.timeout(1500)});const data=await r.json();if(data.app==='chachamaru-studio'&&data.ok){if(!process.argv.includes('--no-open'))spawnSync('open',[`http://127.0.0.1:8787/#/${route}`],{stdio:'ignore'});console.log(`http://127.0.0.1:8787/#/${route}`);process.exit(0);}}catch{/* Start a new local instance below. */}
}
if(!existsSync('.venv/bin/python')){console.error('初回セットアップ: python3 -m venv .venv && .venv/bin/python -m pip install -r studio/requirements.lock');process.exit(1);}
if(!process.argv.includes('--no-build')){const build=spawnSync('npm',['run','build'],{stdio:'inherit'});if(build.status)process.exit(build.status);}
async function free(port){return new Promise(resolve=>{const s=createServer();s.once('error',()=>resolve(false));s.listen(port,'127.0.0.1',()=>s.close(()=>resolve(true)));});}
let port=Number(process.env.PORT||8787);while(!await free(port))port++;
const url=`http://127.0.0.1:${port}/#/${route}`;
const proc=spawn(path.join(root,'.venv/bin/python'),['-m','uvicorn','chacha_studio.server:app','--host','127.0.0.1','--port',String(port)],{cwd:root,stdio:'inherit',env:{...process.env,PYTHONPATH:path.join(root,'studio'),NUMBA_CACHE_DIR:path.join(root,'_private/numba-cache')}});
console.log(`ちゃちゃまる 譜面工房: ${url}\n終了: Control+C`);
if(process.platform==='darwin'&&!process.argv.includes('--no-open')){const ready=setInterval(async()=>{try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok){clearInterval(ready);spawn('open',[url],{stdio:'ignore'});}}catch{}},500);proc.on('exit',()=>clearInterval(ready));}
process.on('SIGINT',()=>proc.kill('SIGINT'));process.on('SIGTERM',()=>proc.kill('SIGTERM'));proc.on('exit',code=>process.exit(code??0));
