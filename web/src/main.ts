import './styles.css';
import type {RunResult} from '../../contracts/public-types';
import {state,defaults,validSettings} from './app/store';
import {fail,toast} from './app/ui';
import {app,input,midi,uiAudio,preview,nav,memory,armAudioUnlock} from './app/context';
import {db,listSongs,getSong,saveSong,saveSettings,backup,restore} from './storage/Database';
import {importZip,exportPack} from './packs/zip';
import {Session} from './game/Session';
import {localAvailable,api} from './studio/ApiClient';
import {homeScreen} from './screens/Home';
import {libraryScreen} from './screens/Library';
import {importScreen} from './screens/Import';
import {resultScreen} from './screens/Result';
import {studioScreen} from './screens/Studio';
import {settingsScreen,diagnosticsScreen} from './screens/Settings';
import {showcaseScreen} from './testing/showcase';
import {flowerSvg} from './render/Character';
import {markRenderer} from './app/gpu';

declare const __TEST__:boolean;
document.documentElement.style.setProperty('--festival',`url("${import.meta.env.BASE_URL}original-assets/festival.webp")`);
let cleanup=()=>{},session:Session|null=null,navGeneration=0,bundledReady=false;
midi.onDisconnect=()=>session?.pause('電子ドラムの接続が切れました。ポートを選び直してください。');
window.addEventListener('error',e=>{console.error('アプリエラー',e.message);});
window.addEventListener('unhandledrejection',e=>{console.error(e.reason);toast(e.reason instanceof Error?e.reason.message:'処理に失敗しました。もう一度お試しください');});
armAudioUnlock();

async function route(){
 const generation=++navGeneration;
 cleanup();cleanup=()=>{};
 session?.dispose();session=null;
 nav.reset();
 input.onHit=i=>nav.input(i);input.onPause=()=>{};
 const [path,query]=(location.hash.slice(1)||'/').split('?'),parts=path.split('/').filter(Boolean),params=new URLSearchParams(query);
 const current=()=>generation===navGeneration;
 window.scrollTo(0,0);
 if(parts[0]!=='songs'&&parts[0]!=='play')preview.stop();
 try{
  if(parts.length===0)cleanup=homeScreen(app);
  else if(parts[0]==='songs')cleanup=await libraryScreen(app,current);
  else if(parts[0]==='import')cleanup=importScreen(app);
  else if(parts[0]==='settings')cleanup=await settingsScreen(app,midi,uiAudio,()=>void route());
  else if(parts[0]==='diagnostics')cleanup=await diagnosticsScreen(app,input,midi,uiAudio);
  else if(parts[0]==='studio')cleanup=await studioScreen(app);
  else if(parts[0]==='play'){
   const pack=await getSong(parts[1]);
   if(!current())return;
   const chart=pack?.charts.find(c=>c.chartId===parts[2]);
   if(!pack||!chart)throw Error('データがありません。曲を選び直してください');
   session=new Session(app,pack,chart,input,{autoplay:params.get('auto')==='1',practice:params.get('practice')==='1',startMs:Number(params.get('start')??0),decoded:preview.take(pack.manifest.packId)});
   session.onResult=r=>{memory.lastResult=r;location.hash=`/result/${r.runId}`;};
   await session.init();
  }else if(parts[0]==='result'){
   const r=memory.lastResult?.runId===parts[1]?memory.lastResult:await(await db()).get('runs',parts[1]) as RunResult|undefined;
   if(!r)throw Error('データがありません。曲を選び直してください');
   if(!current())return;
   cleanup=await resultScreen(app,r);
  }else if(parts[0]==='showcase'&&import.meta.env.DEV)cleanup=await showcaseScreen(app,params.get('scene')??'normal');
  else throw Error('このページはありません。曲一覧から始めてください');
  if(!current())cleanup();
 }catch(e){if(current())fail(app,e);}
}
window.addEventListener('hashchange',()=>void route());

/**
 * Bundled original songs from the public catalog. The first song is installed
 * before the first screen; the others follow in the background so the first
 * visit starts quickly. Installed copies update when the catalog revision rises.
 */
async function bundledCatalog(){
 const base=import.meta.env.BASE_URL+'original-demo/';
 try{const r=await fetch(base+'catalog.json',{cache:'no-cache'});if(r.ok){const c=await r.json() as {packId:string;file:string;revision:number}[];if(Array.isArray(c)&&c.length)return c;}}catch{/* offline: keep what is installed */}
 return [{packId:'himawari-demo',file:'himawari.zip',revision:1}];
}
/**
 * Background work (bundled songs, local Studio sync) is cancelled as soon as
 * the page starts to leave. WebKit reports every load that a navigation cuts
 * off or that starts while the page unloads ("…due to access control checks"),
 * so the loads are aborted first, from beforeunload (pagehide where that
 * event does not exist, as on iOS).
 */
let leaving=new AbortController();
addEventListener('beforeunload',()=>leaving.abort());
addEventListener('pagehide',()=>leaving.abort());
addEventListener('pageshow',e=>{if(e.persisted)leaving=new AbortController();});

async function installBundled(entries:{packId:string;file:string;revision:number}[],signal:AbortSignal){
 const d=await db();
 const base=import.meta.env.BASE_URL+'original-demo/';
 const songs=new Map((await listSongs()).map(m=>[m.packId,m]));
 let changed=false;
 for(const entry of entries){
  const installed=songs.get(entry.packId);
  const mark=await d.get('settings','bundled-'+entry.packId);
  if(installed&&(installed.revision>=entry.revision||mark===entry.revision))continue;
  if(signal.aborted)return changed;
  try{
   const response=await fetch(base+entry.file,{signal});
   if(!response.ok)throw Error('曲を読み込めませんでした');
   const pack=await importZip(await response.arrayBuffer(),signal);pack.source='demo';
   if(signal.aborted)return changed;
   await saveSong(pack,installed?'replace':'check');
   await d.put('settings',entry.revision,'bundled-'+entry.packId);
   changed=true;
  }catch(e){if(!installed)console.warn('bundled song',entry.packId,e);}
 }
 await d.put('settings',true,'demo-installed');
 return changed;
}
/** Songs saved in the local Mac Studio appear automatically when it runs. */
async function syncLocalStudio(signal:AbortSignal){
 if(!await localAvailable()||signal.aborted)return;
 const projects=await(await api('projects')).json() as {projectId:string;title:string;revision:number}[];
 for(const p of projects){
  const mark='local-import-'+p.projectId;
  if(await(await db()).get('settings',mark)===p.revision)continue;
  if(signal.aborted)return;
  const er=await(await api(`projects/${p.projectId}/export`,{method:'POST',body:'{}',headers:{'Content-Type':'application/json'},signal})).json();
  if(signal.aborted)return;
  const pack=await importZip(await(await api(`exports/${er.exportId}`,{signal})).arrayBuffer(),signal);pack.source='studio';
  if(signal.aborted)return;
  await saveSong(pack,'replace');
  await(await db()).put('settings',p.revision,mark);
 }
}

async function boot(){
 markRenderer();
 app.innerHTML=`<section class="boot-screen">${flowerSvg()}<strong>お祭りの準備中…</strong><small>音源と保存データを読み込んでいます</small></section>`;
 let rest:{packId:string;file:string;revision:number}[]=[];
 try{
  const settings=await(await db()).get('settings','main');
  if(validSettings(settings))Object.assign(state.settings,settings);
  else{if(navigator.maxTouchPoints>0)state.settings.inputMode='touch';await saveSettings(state.settings);}
  const catalog=await bundledCatalog();
  await installBundled(catalog.slice(0,1),leaving.signal);
  rest=catalog.slice(1);
 }catch(e){fail(app,e);return;}
 await route();
 // The remaining bundled songs arrive in the background; refresh the list if it is open.
 void installBundled(rest,leaving.signal).then(changed=>{if(changed&&location.hash.startsWith('#/songs')&&!session)void route();}).catch(()=>{}).finally(()=>{bundledReady=true;document.documentElement.dataset.bundled='ready';});
 // Optional: never block or break start-up if the local Studio is absent or refuses.
 try{await syncLocalStudio(leaving.signal);}catch(e){if(!leaving.signal.aborted)console.warn('local studio sync skipped',e);}
 if('serviceWorker'in navigator&&import.meta.env.PROD){
  void navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{scope:import.meta.env.BASE_URL}).then(watchUpdates).catch(()=>toast('オフライン起動は利用できません。起動時はネット接続が必要です'));
 }
}
/**
 * A new version downloaded by the service worker waits until the player
 * chooses to update. Never during a song: the offer appears on menus only.
 */
function watchUpdates(reg:ServiceWorkerRegistration){
 let reloading=false;
 const offer=(worker:ServiceWorker)=>{
  const show=()=>{
   if(session){window.setTimeout(show,3000);return;}
   if(document.querySelector('.update-banner'))return;
   const bar=document.createElement('div');bar.className='update-banner';bar.setAttribute('role','status');
   bar.innerHTML='<span>新しいバージョンがあります</span><button class="primary">更新する</button><button class="later" aria-label="あとで">×</button>';
   bar.querySelector('.primary')!.addEventListener('click',()=>{reloading=true;worker.postMessage('skipWaiting');});
   bar.querySelector('.later')!.addEventListener('click',()=>bar.remove());
   document.body.append(bar);
  };
  show();
 };
 if(reg.waiting&&navigator.serviceWorker.controller)offer(reg.waiting);
 reg.addEventListener('updatefound',()=>{const w=reg.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)offer(w);});});
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)location.reload();});
}
if(__TEST__){Object.assign(window,{__chacha:{get session(){return session;},input,midi,db,backup,restore,defaults,settings:state.settings,saveSong,getSong,listSongs,exportPack,readChart:(id:string)=>getSong(id).then(p=>p?.charts),get status(){return session?.status;},get bundledReady(){return bundledReady;}}});}
void boot();
