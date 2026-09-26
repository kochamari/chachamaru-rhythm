import {db} from './Database';

// ほねっこ (dog-bone treats) and the shibas collected with them, kept in the
// settings store under its own key. One award per finished run (by runId), so
// a result screen shown twice never pays twice.

export interface Award {runId:string;date:string;play:number;items:{label:string;bones:number}[];total:number}
export interface FestivalData {
 schemaVersion:1;
 /** Bones to spend. */
 bones:number;
 /** All bones ever earned. */
 earned:number;
 /** Collected items and how many times each was drawn. */
 owned:Record<string,number>;
 pulls:number;
 /** The latest awards, newest first. */
 awards:Award[];
}
const KEY='festival';
export const emptyFestival=():FestivalData=>({schemaVersion:1,bones:0,earned:0,owned:{},pulls:0,awards:[]});

const count=(v:unknown,max=1e9)=>Number.isSafeInteger(v)&&(v as number)>=0&&(v as number)<=max;
export function validFestival(v:unknown):v is FestivalData{
 if(!v||typeof v!=='object')return false;
 const f=v as FestivalData;
 if(f.schemaVersion!==1||!count(f.bones)||!count(f.earned)||!count(f.pulls)||!f.owned||typeof f.owned!=='object'||Array.isArray(f.owned)||!Array.isArray(f.awards)||f.awards.length>50)return false;
 const ids=Object.entries(f.owned);
 if(ids.length>500||!ids.every(([k,n])=>/^[a-z0-9-]{1,40}$/.test(k)&&count(n,1e6)))return false;
 return f.awards.every(a=>a&&typeof a.runId==='string'&&a.runId.length<=200&&typeof a.date==='string'&&count(a.play)&&count(a.total)&&Array.isArray(a.items)&&a.items.length<=12&&a.items.every(i=>i&&typeof i.label==='string'&&i.label.length<=40&&count(i.bones)));
}

export async function loadFestival():Promise<FestivalData>{
 const v=await (await db()).get('settings',KEY);
 return validFestival(v)?v:emptyFestival();
}
export async function saveFestival(f:FestivalData){
 if(!validFestival(f))throw Error('ごほうびのデータが不正です');
 await (await db()).put('settings',f,KEY);
}

/** Adds a finished run's bones once; returns the award (the earlier one if it was already paid). */
export async function awardBones(runId:string,play:number,items:{label:string;bones:number}[]):Promise<Award>{
 const d=await db(),tx=d.transaction('settings','readwrite'),store=tx.objectStore('settings');
 const raw=await store.get(KEY),f=validFestival(raw)?raw:emptyFestival();
 const paid=f.awards.find(a=>a.runId===runId);
 if(paid){await tx.done;return paid;}
 const total=play+items.reduce((a,i)=>a+i.bones,0);
 const award:Award={runId,date:new Date().toISOString(),play,items,total};
 f.bones+=total;f.earned+=total;f.awards=[award,...f.awards].slice(0,20);
 await store.put(f,KEY);await tx.done;
 return award;
}

/**
 * Spends bones on `count` draws (one transaction): checks the balance, draws,
 * adds the outfits and pays back duplicates. Returns the draws and the new data.
 */
export async function spendOnDraws<P extends {id:string;refund:number}>(count:number,draw:(owned:Record<string,number>)=>P[],cost:number):Promise<{pulls:P[];festival:FestivalData}>{
 const d=await db(),tx=d.transaction('settings','readwrite'),store=tx.objectStore('settings');
 const raw=await store.get(KEY),f=validFestival(raw)?raw:emptyFestival();
 if(f.bones<cost){await tx.done;throw Error('ほねっこが足りません');}
 const pulls=draw(f.owned);
 f.bones-=cost;
 for(const p of pulls){f.owned[p.id]=(f.owned[p.id]??0)+1;f.bones+=p.refund;}
 f.pulls+=count;
 if(!validFestival(f)){await tx.done;throw Error('ごほうびのデータが不正です');}
 await store.put(f,KEY);await tx.done;
 return {pulls,festival:f};
}
