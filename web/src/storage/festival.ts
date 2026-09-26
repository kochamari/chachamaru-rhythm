import {db} from './Database';
import {slotPayout,levelFor,dayKey,SLOT_SYMBOLS,LEVEL_UP_BONES,DAILY_BONES,type SlotSymbol} from '../game/festival';

// ほねっこ (dog-bone treats) and the shibas collected with them, kept in the
// settings store under its own key. One award per finished run (by runId), so
// a result screen shown twice never pays twice.

export interface Award {runId:string;date:string;play:number;items:{label:string;bones:number}[];total:number;
 /** The result-screen bonus slot (symbols and what it paid), since the slot was added. */
 slot?:{symbols:SlotSymbol[];mult:number;bones:number};
 /** 太鼓レベル experience from this run and the total before it. */
 xp?:{gain:number;before:number};
 /** The first finished run of the day. */
 daily?:boolean}
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
 /** 太鼓レベル experience (optional in older saves). */
 xp?:number;
 /** Local day of the latest finished run, for the first-run-of-the-day bonus. */
 lastDay?:string;
 /** Series whose completion bonus was paid, and whether the whole book was. */
 sets?:string[];complete?:boolean;
 /** Draws since the last ウルトラレア (for the 天井). */
 sinceSSR?:number;
}
const KEY='festival';
export const emptyFestival=():FestivalData=>({schemaVersion:1,bones:0,earned:0,owned:{},pulls:0,awards:[]});

const count=(v:unknown,max=1e9)=>Number.isSafeInteger(v)&&(v as number)>=0&&(v as number)<=max;
const validAwardExtras=(a:Award)=>(a.slot===undefined||(!!a.slot&&Array.isArray(a.slot.symbols)&&a.slot.symbols.length===3&&a.slot.symbols.every(s=>(SLOT_SYMBOLS as readonly string[]).includes(s))&&[1,1.5,2,3].includes(a.slot.mult)&&count(a.slot.bones)))
 &&(a.xp===undefined||(!!a.xp&&count(a.xp.gain,1000)&&count(a.xp.before)))&&(a.daily===undefined||typeof a.daily==='boolean');
export function validFestival(v:unknown):v is FestivalData{
 if(!v||typeof v!=='object')return false;
 const f=v as FestivalData;
 if(f.schemaVersion!==1||!count(f.bones)||!count(f.earned)||!count(f.pulls)||!f.owned||typeof f.owned!=='object'||Array.isArray(f.owned)||!Array.isArray(f.awards)||f.awards.length>50)return false;
 if((f.xp!==undefined&&!count(f.xp))||(f.lastDay!==undefined&&!(typeof f.lastDay==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(f.lastDay))))return false;
 if((f.sets!==undefined&&!(Array.isArray(f.sets)&&f.sets.length<=50&&f.sets.every(x=>typeof x==='string'&&/^[a-z0-9-]{1,40}$/.test(x))))||(f.complete!==undefined&&typeof f.complete!=='boolean')||(f.sinceSSR!==undefined&&!count(f.sinceSSR,1e6)))return false;
 const ids=Object.entries(f.owned);
 if(ids.length>500||!ids.every(([k,n])=>/^[a-z0-9-]{1,40}$/.test(k)&&count(n,1e6)))return false;
 return f.awards.every(a=>a&&typeof a.runId==='string'&&a.runId.length<=200&&typeof a.date==='string'&&count(a.play)&&count(a.total)&&Array.isArray(a.items)&&a.items.length<=12&&a.items.every(i=>i&&typeof i.label==='string'&&i.label.length<=40&&count(i.bones))&&validAwardExtras(a));
}

export async function loadFestival():Promise<FestivalData>{
 const v=await (await db()).get('settings',KEY);
 return validFestival(v)?v:emptyFestival();
}
export async function saveFestival(f:FestivalData){
 if(!validFestival(f))throw Error('ごほうびのデータが不正です');
 await (await db()).put('settings',f,KEY);
}

/**
 * Adds a finished run's bones once; returns the award (the earlier one if it
 * was already paid). With `extras`: the bonus slot multiplies the bones from
 * play, the first finished run of the day adds a bonus, and 太鼓レベル
 * experience is added (each level gained pays too).
 */
export async function awardBones(runId:string,play:number,items:{label:string;bones:number}[],extras?:{slot:SlotSymbol[];xp:number;now?:Date}):Promise<Award>{
 const d=await db(),tx=d.transaction('settings','readwrite'),store=tx.objectStore('settings');
 const raw=await store.get(KEY),f=validFestival(raw)?raw:emptyFestival();
 const paid=f.awards.find(a=>a.runId===runId);
 if(paid){await tx.done;return paid;}
 const all=[...items];
 const award:Award={runId,date:(extras?.now??new Date()).toISOString(),play,items:all,total:0};
 if(extras){
  const {mult,label}=slotPayout(extras.slot),slotBones=Math.round(play*(mult-1));
  award.slot={symbols:[...extras.slot],mult,bones:slotBones};
  if(slotBones)all.push({label:`スロット ${label}`,bones:slotBones});
  const today=dayKey(extras.now);
  if(f.lastDay!==today){award.daily=true;all.push({label:'きょうの初プレイ',bones:DAILY_BONES});}
  f.lastDay=today;
  const before=f.xp??0,gained=levelFor(before+extras.xp).level-levelFor(before).level;
  award.xp={gain:extras.xp,before};f.xp=before+extras.xp;
  if(gained)all.push({label:'レベルアップ',bones:LEVEL_UP_BONES*gained});
 }
 award.total=play+all.reduce((a,i)=>a+i.bones,0);
 f.bones+=award.total;f.earned+=award.total;f.awards=[award,...f.awards].slice(0,20);
 await store.put(f,KEY);await tx.done;
 return award;
}

export interface Settled {bonuses:{label:string;bones:number}[];paid:string[];complete:boolean}
/**
 * Spends bones on `count` draws (one transaction): checks the balance, draws
 * (with the 天井 counter), adds the outfits, pays back duplicates and, with
 * `settle`, pays series / book completion bonuses once. Returns the draws,
 * the bonuses paid and the new data.
 */
export async function spendOnDraws<P extends {id:string;refund:number}>(count:number,draw:(owned:Record<string,number>,pity:{since:number})=>P[],cost:number,settle?:(owned:Record<string,number>,paid:string[],complete:boolean)=>Settled):Promise<{pulls:P[];festival:FestivalData;bonuses:{label:string;bones:number}[]}>{
 const d=await db(),tx=d.transaction('settings','readwrite'),store=tx.objectStore('settings');
 const raw=await store.get(KEY),f=validFestival(raw)?raw:emptyFestival();
 if(f.bones<cost){await tx.done;throw Error('ほねっこが足りません');}
 const pity={since:f.sinceSSR??0};
 const pulls=draw(f.owned,pity);
 f.sinceSSR=pity.since;
 f.bones-=cost;
 for(const p of pulls){f.owned[p.id]=(f.owned[p.id]??0)+1;f.bones+=p.refund;}
 f.pulls+=count;
 let bonuses:{label:string;bones:number}[]=[];
 if(settle){const r=settle(f.owned,f.sets??[],f.complete??false);bonuses=r.bonuses;f.sets=r.paid;f.complete=r.complete;for(const b of bonuses){f.bones+=b.bones;f.earned+=b.bones;}}
 if(!validFestival(f)){await tx.done;throw Error('ごほうびのデータが不正です');}
 await store.put(f,KEY);await tx.done;
 return {pulls,festival:f,bonuses};
}
