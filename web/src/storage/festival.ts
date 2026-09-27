import {db} from './Database';
import type {RunResult} from '../../../contracts/public-types';
import {slotPayout,levelFor,dayKey,SLOT_SYMBOLS,LEVEL_UP_BONES,DAILY_BONES,type SlotSymbol} from '../game/festival';
import {nextLogin,advanceMissions,todayDaily,newTiers,runStats,festivalStats,featuredSong,LOGIN_REWARDS,type LoginState,type DailyState,type RunFacts,type MissionMove,type Item,type Unlock} from '../game/daily';

// ほねっこ (dog-bone treats) and the shibas collected with them, kept in the
// settings store under its own key. One award per finished run (by runId), so
// a result screen shown twice never pays twice.

export interface Award {runId:string;date:string;play:number;items:{label:string;bones:number}[];total:number;
 /** The result-screen bonus slot (symbols and what it paid), since the slot was added. */
 slot?:{symbols:SlotSymbol[];mult:number;bones:number};
 /** 太鼓レベル experience from this run and the total before it. */
 xp?:{gain:number;before:number};
 /** The first finished run of the day. */
 daily?:boolean;
 /** Today's missions before and after this run, and titles unlocked by it. */
 missions?:MissionMove[];titles?:string[]}
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
 /** ログインボーナス: the stamp card, the streak and login days. */
 login?:LoginState;
 /** きょうのミッション and their progress. */
 daily?:DailyState;
 /** やりこみ: the tier reached per achievement, the chosen title ("id:tier"). */
 achieved?:Record<string,number>;title?:string;
 /** The day of the last free draw, and 4-of-a-kind friends so far. */
 freeDay?:string;jackpots?:number;
}
const KEY='festival';
export const emptyFestival=():FestivalData=>({schemaVersion:1,bones:0,earned:0,owned:{},pulls:0,awards:[]});

const count=(v:unknown,max=1e9)=>Number.isSafeInteger(v)&&(v as number)>=0&&(v as number)<=max;
const isDay=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
const isId=(v:unknown)=>typeof v==='string'&&/^[a-z0-9-]{1,40}$/.test(v);
const ids=(v:unknown,max:number)=>Array.isArray(v)&&v.length<=max&&v.every(isId);
const counts=(v:unknown,max:number,top=1e9)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length<=max&&Object.entries(v).every(([k,n])=>isId(k)&&count(n,top));
function validExtras(f:FestivalData){
 const l=f.login,d=f.daily;
 if(l!==undefined&&!(l&&isDay(l.day)&&count(l.count)&&Number.isInteger(l.card)&&l.card>=1&&l.card<=LOGIN_REWARDS.length&&count(l.streak)&&count(l.best)))return false;
 if(d!==undefined&&!(d&&isDay(d.day)&&ids(d.ids,5)&&counts(d.progress,10)&&ids(d.paid,5)&&typeof d.allPaid==='boolean'&&(d.featured===undefined||(typeof d.featured==='string'&&d.featured.length>0&&d.featured.length<=200))))return false;
 if(f.achieved!==undefined&&!counts(f.achieved,50,3))return false;
 if(f.title!==undefined&&!(typeof f.title==='string'&&/^[a-z0-9-]{1,40}:[123]$/.test(f.title)))return false;
 return (f.freeDay===undefined||isDay(f.freeDay))&&(f.jackpots===undefined||count(f.jackpots));
}
const validAwardExtras=(a:Award)=>(a.missions===undefined||(Array.isArray(a.missions)&&a.missions.length<=5&&a.missions.every(m=>m&&isId(m.id)&&count(m.before)&&count(m.after))))
 &&(a.titles===undefined||(Array.isArray(a.titles)&&a.titles.length<=40&&a.titles.every(t=>typeof t==='string'&&t.length<=40)))
 &&(a.slot===undefined||(!!a.slot&&Array.isArray(a.slot.symbols)&&a.slot.symbols.length===3&&a.slot.symbols.every(s=>(SLOT_SYMBOLS as readonly string[]).includes(s))&&[1,1.5,2,3].includes(a.slot.mult)&&count(a.slot.bones)))
 &&(a.xp===undefined||(!!a.xp&&count(a.xp.gain,1000)&&count(a.xp.before)))&&(a.daily===undefined||typeof a.daily==='boolean');
export function validFestival(v:unknown):v is FestivalData{
 if(!v||typeof v!=='object')return false;
 const f=v as FestivalData;
 if(f.schemaVersion!==1||!count(f.bones)||!count(f.earned)||!count(f.pulls)||!f.owned||typeof f.owned!=='object'||Array.isArray(f.owned)||!Array.isArray(f.awards)||f.awards.length>50)return false;
 if((f.xp!==undefined&&!count(f.xp))||(f.lastDay!==undefined&&!(typeof f.lastDay==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(f.lastDay))))return false;
 if((f.sets!==undefined&&!(Array.isArray(f.sets)&&f.sets.length<=50&&f.sets.every(x=>typeof x==='string'&&/^[a-z0-9-]{1,40}$/.test(x))))||(f.complete!==undefined&&typeof f.complete!=='boolean')||(f.sinceSSR!==undefined&&!count(f.sinceSSR,1e6)))return false;
 if(!counts(f.owned,500,1e6)||!validExtras(f))return false;
 return f.awards.every(a=>a&&typeof a.runId==='string'&&a.runId.length<=200&&typeof a.date==='string'&&count(a.play)&&count(a.total)&&Array.isArray(a.items)&&a.items.length<=60&&a.items.every(i=>i&&typeof i.label==='string'&&i.label.length<=40&&count(i.bones))&&validAwardExtras(a));
}

/**
 * Outfits replaced after they were released: whoever drew one owns its
 * replacement instead (てんしの柴 → 獅子舞の柴, 2026-09-26, at the user's request).
 */
const REPLACED:Record<string,string>={tenshi:'shishimai'};
function migrate(f:FestivalData):FestivalData{
 for(const [from,to] of Object.entries(REPLACED)){const n=f.owned[from];if(n){f.owned[to]=(f.owned[to]??0)+n;delete f.owned[from];}}
 return f;
}

export async function loadFestival():Promise<FestivalData>{
 const v=await (await db()).get('settings',KEY);
 return validFestival(v)?migrate(v):emptyFestival();
}
export async function saveFestival(f:FestivalData){
 if(!validFestival(f))throw Error('ごほうびのデータが不正です');
 await (await db()).put('settings',f,KEY);
}

/** Records newly reached やりこみ tiers on `f` and returns them. */
function unlock(f:FestivalData,stats:Parameters<typeof newTiers>[0]):Unlock[]{
 const unlocks=newTiers(stats,f.achieved??{});
 if(unlocks.length){f.achieved={...f.achieved};for(const u of unlocks)f.achieved[u.id]=Math.max(f.achieved[u.id]??0,u.tier);}
 return unlocks;
}
const titleItem=(u:Unlock):Item=>({label:`称号「${u.title}」`,bones:u.bones});

export interface LoginClaim {items:Item[];total:number;login:LoginState;titles:string[];bones:number}
/**
 * The first visit of a new day: stamps the login card, pays the day's bonus
 * (and streak / welcome-back / やりこみ bonuses) and starts today's missions.
 * Null when today was already claimed.
 */
export async function claimLogin(now=new Date()):Promise<LoginClaim|null>{
 const today=dayKey(now);
 const d=await db(),tx=d.transaction('settings','readwrite'),store=tx.objectStore('settings');
 const raw=await store.get(KEY),f=validFestival(raw)?migrate(raw):emptyFestival();
 const next=nextLogin(f.login,today);
 if(!next){await tx.done;return null;}
 f.login=next.state;f.daily=todayDaily(f.daily,today);
 const unlocks=unlock(f,festivalStats(f));
 const items=[...next.items,...unlocks.map(titleItem)],total=items.reduce((a,i)=>a+i.bones,0);
 f.bones+=total;f.earned+=total;
 await store.put(f,KEY);await tx.done;
 return {items,total,login:next.state,titles:unlocks.map(u=>u.title),bones:f.bones};
}

/**
 * Today's featured song: chosen once a day from the songs installed at that
 * moment and kept all day, so songs still being installed (the very first
 * start) or added later don't change it. Chosen again only if it was deleted.
 */
export async function featuredToday(packIds:readonly string[],now=new Date()):Promise<string|null>{
 const today=dayKey(now);
 const d=await db(),tx=d.transaction('settings','readwrite'),store=tx.objectStore('settings');
 const raw=await store.get(KEY),f=validFestival(raw)?migrate(raw):emptyFestival();
 const daily=todayDaily(f.daily,today);
 if(daily.featured&&packIds.includes(daily.featured)){await tx.done;return daily.featured;}
 const pick=featuredSong(today,packIds);
 if(pick){f.daily={...daily,featured:pick};await store.put(f,KEY);}
 await tx.done;
 return pick;
}

/** Chooses the title shown with the level (an unlocked "id:tier", or none). */
export async function setTitle(key:string|null){
 const d=await db(),tx=d.transaction('settings','readwrite'),store=tx.objectStore('settings');
 const raw=await store.get(KEY),f=validFestival(raw)?migrate(raw):emptyFestival();
 if(key===null)delete f.title;else{const [id,t]=key.split(':');if((f.achieved?.[id]??0)<Number(t)){await tx.done;throw Error('まだ手に入れていない称号です');}f.title=key;}
 await store.put(f,KEY);await tx.done;
}

/**
 * Adds a finished run's bones once; returns the award (the earlier one if it
 * was already paid). With `extras`: the bonus slot multiplies the bones from
 * play, the first finished run of the day adds a bonus, and 太鼓レベル
 * experience is added (each level gained pays too).
 */
export async function awardBones(runId:string,play:number,items:{label:string;bones:number}[],extras?:{slot:SlotSymbol[];xp:number;now?:Date;run?:RunFacts}):Promise<Award>{
 const d=await db(),tx=d.transaction(['settings','runs'],'readwrite'),store=tx.objectStore('settings');
 const raw=await store.get(KEY),f=validFestival(raw)?migrate(raw):emptyFestival();
 const paid=f.awards.find(a=>a.runId===runId);
 if(paid){await tx.done;return paid;}
 const all=[...items];
 const award:Award={runId,date:(extras?.now??new Date()).toISOString(),play,items:all,total:0};
 if(extras){
  // The day's featured song doubles the bones from play.
  if(extras.run?.featured&&play)all.push({label:'おすすめ曲 ×2',bones:play});
  const {mult,label}=slotPayout(extras.slot),slotBones=Math.round(play*(mult-1));
  award.slot={symbols:[...extras.slot],mult,bones:slotBones};
  if(slotBones)all.push({label:`スロット ${label}`,bones:slotBones});
  const today=dayKey(extras.now);
  if(f.lastDay!==today){award.daily=true;all.push({label:'きょうの初プレイ',bones:DAILY_BONES});}
  f.lastDay=today;
  const before=f.xp??0,gained=levelFor(before+extras.xp).level-levelFor(before).level;
  award.xp={gain:extras.xp,before};f.xp=before+extras.xp;
  if(gained)all.push({label:'レベルアップ',bones:LEVEL_UP_BONES*gained});
  if(extras.run){
   const run=extras.run;
   // Today's missions.
   const m=advanceMissions(f.daily,today,mission=>mission.gain(run));
   f.daily=m.state;all.push(...m.items);award.missions=m.moves;
   if(run.jackpot)f.jackpots=(f.jackpots??0)+1;
   // やりこみ: lifetime stats from the saved runs (this one included) and from the rewards.
   const runs=(await tx.objectStore('runs').getAll()) as RunResult[];
   const unlocks=unlock(f,{...runStats(runs),...festivalStats(f)});
   all.push(...unlocks.map(titleItem));
   if(unlocks.length)award.titles=unlocks.map(u=>u.title);
  }
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
export async function spendOnDraws<P extends {id:string;refund:number}>(count:number,draw:(owned:Record<string,number>,pity:{since:number})=>P[],cost:number,settle?:(owned:Record<string,number>,paid:string[],complete:boolean)=>Settled,opts:{free?:boolean;now?:Date}={}):Promise<{pulls:P[];festival:FestivalData;bonuses:{label:string;bones:number}[];extras:Item[]}>{
 const d=await db(),tx=d.transaction('settings','readwrite'),store=tx.objectStore('settings');
 const raw=await store.get(KEY),f=validFestival(raw)?migrate(raw):emptyFestival();
 const today=dayKey(opts.now);
 // One free draw a day.
 if(opts.free){if(f.freeDay===today){await tx.done;throw Error('きょうの無料ガチャは、もうひきました');}f.freeDay=today;cost=0;}
 if(f.bones<cost){await tx.done;throw Error('ほねっこが足りません');}
 const pity={since:f.sinceSSR??0};
 const pulls=draw(f.owned,pity);
 f.sinceSSR=pity.since;
 f.bones-=cost;
 for(const p of pulls){f.owned[p.id]=(f.owned[p.id]??0)+1;f.bones+=p.refund;}
 f.pulls+=count;
 let bonuses:{label:string;bones:number}[]=[];
 if(settle){const r=settle(f.owned,f.sets??[],f.complete??false);bonuses=r.bonuses;f.sets=r.paid;f.complete=r.complete;for(const b of bonuses){f.bones+=b.bones;f.earned+=b.bones;}}
 // The draw mission, and しばずかん やりこみ.
 const m=advanceMissions(f.daily,today,mission=>mission.id==='gacha1'?count:0);f.daily=m.state;
 const extras=[...m.items,...unlock(f,festivalStats(f)).map(titleItem)];
 for(const e of extras){f.bones+=e.bones;f.earned+=e.bones;}
 if(!validFestival(f)){await tx.done;throw Error('ごほうびのデータが不正です');}
 await store.put(f,KEY);await tx.done;
 return {pulls,festival:f,bonuses,extras};
}
