import type {Project} from '../../../contracts/public-types';
let token='';
export async function api(path:string,init:RequestInit={}){if(!token){const s=await fetch('api/session',{signal:AbortSignal.timeout(10000)});if(!s.ok)throw Error('Mac版の譜面工房を起動してください');token=(await s.json()).csrfToken;}const r=await fetch('api/'+path,{signal:AbortSignal.timeout(30000),...init,headers:{...init.headers,'X-Chacha-Token':token}});if(!r.ok){const e=await r.json().catch(()=>({detail:`接続エラー (${r.status})`}));throw Error(e.detail??'ローカルAPIのエラー');}return r;}
export async function getProject(id:string):Promise<Project>{return (await api(`projects/${id}`)).json();}
export async function localAvailable(){try{const r=await fetch('api/health',{signal:AbortSignal.timeout(3000)});const j=await r.json();return r.ok&&j.apiVersion===1&&j.ok;}catch{return false;}}
