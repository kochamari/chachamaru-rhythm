import type {Project} from '../../../contracts/public-types';
let token='';
/** A request gives up after `ms`, or earlier when the caller's signal aborts. */
function deadline(ms:number,signal?:AbortSignal|null){
 const timeout=AbortSignal.timeout(ms);if(!signal)return timeout;
 const both=new AbortController(),stop=()=>both.abort();
 if(signal.aborted)stop();else{signal.addEventListener('abort',stop,{once:true});timeout.addEventListener('abort',stop,{once:true});}
 return both.signal;
}
export async function api(path:string,init:RequestInit={}){if(!token){const s=await fetch('api/session',{signal:deadline(10000,init.signal)});if(!s.ok)throw Error('Mac版の譜面工房を起動してください');token=(await s.json()).csrfToken;}const r=await fetch('api/'+path,{...init,signal:deadline(30000,init.signal),headers:{...init.headers,'X-Chacha-Token':token}});if(!r.ok){const e=await r.json().catch(()=>({detail:`接続エラー (${r.status})`}));throw Error(e.detail??'ローカルAPIのエラー');}return r;}
export async function getProject(id:string):Promise<Project>{return (await api(`projects/${id}`)).json();}
export async function localAvailable(){try{const r=await fetch('api/health',{signal:AbortSignal.timeout(3000)});const j=await r.json();return r.ok&&j.apiVersion===1&&j.ok;}catch{return false;}}
