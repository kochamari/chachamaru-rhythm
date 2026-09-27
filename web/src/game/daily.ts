// Reasons to come back every day, and long goals. Pure: no DOM, no storage.
//  - ログインボーナス: a 7-day stamp card (any days, not only consecutive),
//    a streak of consecutive days with milestone bonuses, and a welcome back.
//  - きょうのミッション: three small goals a day, the same all day.
//  - きょうのおすすめ曲: one song a day pays double ほねっこ from play.
//  - やりこみ: lifetime goals in three tiers (銅・銀・金), each with a 称号.
// Everything pays bones or titles: nothing changes play, judgement or scores.
import type {RunResult} from '../../../contracts/public-types';
import {COSTUMES} from '../render/costumes';
import {levelFor} from './festival';

export interface Item {label:string;bones:number}

/** Whole calendar days from day key a to day key b ("2026-09-27"). */
export function daysBetween(a:string,b:string){
 const [ya,ma,da]=a.split('-').map(Number),[yb,mb,db]=b.split('-').map(Number);
 return Math.round((Date.UTC(yb,mb-1,db)-Date.UTC(ya,ma-1,da))/86400000);
}
/** A small string hash (FNV-1a) and a seeded random source, for per-day choices. */
function seedOf(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function seeded(seed:number){let x=seed%2147483646+1;return ()=>{x=(x*16807)%2147483647;return (x-1)/2147483646;};}

// ------------------------------------------------------------ login bonus --

/** Bones for day 1…7 of a stamp card; the 7th day is the big one. */
export const LOGIN_REWARDS=[50,50,80,80,100,120,300] as const;
/** Streak milestones (consecutive days) and their bonus. */
export const STREAK_BONUS:Readonly<Record<number,number>>={3:50,7:150,14:300,30:600,60:1000,100:2000};
/** Back after this many days away: a welcome-back bonus. */
export const WELCOME_BACK_DAYS=3,WELCOME_BACK_BONES=100;

export interface LoginState {day:string;count:number;card:number;streak:number;best:number}
/**
 * The first visit of a new day: the next stamp on the card (a new card after
 * the 7th), the streak (it restarts at 1 after a missed day; nothing else is
 * lost), and what they pay. Null when today was already claimed or the clock
 * went back.
 */
export function nextLogin(prev:LoginState|undefined,today:string):{state:LoginState;items:Item[]}|null{
 const gap=prev?daysBetween(prev.day,today):null;
 if(gap!==null&&gap<=0)return null;
 const streak=gap===1?prev!.streak+1:1;
 const card=prev&&prev.card<LOGIN_REWARDS.length?prev.card+1:1;
 const state:LoginState={day:today,count:(prev?.count??0)+1,card,streak,best:Math.max(prev?.best??0,streak)};
 const items:Item[]=[{label:`ログインボーナス ${card}日目`,bones:LOGIN_REWARDS[card-1]}];
 const milestone=STREAK_BONUS[streak];
 if(milestone)items.push({label:`${streak}日連続ログイン`,bones:milestone});
 if(gap!==null&&gap>=WELCOME_BACK_DAYS)items.push({label:'おかえりボーナス',bones:WELCOME_BACK_BONES});
 return {state,items};
}
/** The next streak milestone after `streak`: its day, how many days to go and its bonus. */
export function nextStreakGoal(streak:number){
 const day=Object.keys(STREAK_BONUS).map(Number).sort((a,b)=>a-b).find(d=>d>streak);
 return day?{day,left:day-streak,bones:STREAK_BONUS[day]}:null;
}

// ---------------------------------------------------------------- missions --

/** What one finished normal run did (for missions and やりこみ). */
export interface RunFacts {cleared:boolean;great:number;maxCombo:number;rollHits:number;fevers:number;friendsAll:boolean;anySet:boolean;jackpot:boolean;hard:boolean;fullCombo:boolean;allGreat:boolean;featured:boolean}
export type MissionTier='easy'|'mid'|'fun';
export interface Mission {id:string;name:string;target:number;bones:number;tier:MissionTier;gain:(r:RunFacts)=>number}
export const MISSIONS:Mission[]=[
 {id:'play2',name:'2曲あそぶ',target:2,bones:40,tier:'easy',gain:()=>1},
 {id:'play3',name:'3曲あそぶ',target:3,bones:60,tier:'easy',gain:()=>1},
 {id:'clear1',name:'1曲クリアする',target:1,bones:40,tier:'easy',gain:r=>r.cleared?1:0},
 {id:'great150',name:'良を150回出す',target:150,bones:50,tier:'mid',gain:r=>r.great},
 {id:'great300',name:'良を300回出す',target:300,bones:80,tier:'mid',gain:r=>r.great},
 {id:'combo50',name:'50コンボを出す',target:1,bones:50,tier:'mid',gain:r=>r.maxCombo>=50?1:0},
 {id:'combo100',name:'100コンボを出す',target:1,bones:80,tier:'mid',gain:r=>r.maxCombo>=100?1:0},
 {id:'roll50',name:'連打を50回',target:50,bones:40,tier:'mid',gain:r=>r.rollHits},
 {id:'fever3',name:'フィーバーに3回入る',target:3,bones:50,tier:'mid',gain:r=>r.fevers},
 {id:'friends4',name:'仲間を4匹そろえる',target:1,bones:60,tier:'fun',gain:r=>r.friendsAll?1:0},
 {id:'pair',name:'仲間の毛色をそろえる',target:1,bones:50,tier:'fun',gain:r=>r.anySet?1:0},
 {id:'hard1',name:'むずかしいで1曲あそぶ',target:1,bones:60,tier:'fun',gain:r=>r.hard?1:0},
 {id:'osusume',name:'おすすめ曲をあそぶ',target:1,bones:50,tier:'fun',gain:r=>r.featured?1:0},
 {id:'fc1',name:'フルコンボを出す',target:1,bones:100,tier:'fun',gain:r=>r.fullCombo?1:0},
 {id:'clear2',name:'2曲クリアする',target:2,bones:60,tier:'fun',gain:r=>r.cleared?1:0},
 {id:'gacha1',name:'しばガチャをひく',target:1,bones:30,tier:'fun',gain:()=>0},
];
export const MISSION_BY_ID=new Map(MISSIONS.map(m=>[m.id,m]));
/** Bones for finishing all three of the day. */
export const ALL_MISSIONS_BONES=150;

/** The day's three missions: one easy, one middle, one fun (the same all day). */
export function missionsFor(day:string){
 const random=seeded(seedOf('missions:'+day));
 return (['easy','mid','fun'] as const).map(tier=>{const pool=MISSIONS.filter(m=>m.tier===tier);return pool[Math.floor(random()*pool.length)].id;});
}
export interface DailyState {day:string;ids:string[];progress:Record<string,number>;paid:string[];allPaid:boolean}
/** Today's missions: the saved ones if they are today's, otherwise a new set. */
export function todayDaily(state:DailyState|undefined,day:string):DailyState{
 return state&&state.day===day?state:{day,ids:missionsFor(day),progress:{},paid:[],allPaid:false};
}
export interface MissionMove {id:string;before:number;after:number}
/** Adds progress; pays each mission once when reached, and a bonus once all three are. */
export function advanceMissions(state:DailyState|undefined,day:string,gain:(m:Mission)=>number){
 const s=todayDaily(state,day);
 const next:DailyState={...s,ids:[...s.ids],progress:{...s.progress},paid:[...s.paid]};
 const items:Item[]=[],moves:MissionMove[]=[];
 for(const id of next.ids){
  const m=MISSION_BY_ID.get(id);if(!m)continue;
  const before=next.progress[id]??0,after=Math.min(m.target,before+Math.max(0,Math.floor(gain(m))));
  next.progress[id]=after;moves.push({id,before,after});
  if(after>=m.target&&!next.paid.includes(id)){next.paid.push(id);items.push({label:`ミッション「${m.name}」`,bones:m.bones});}
 }
 if(!next.allPaid&&next.ids.every(id=>next.paid.includes(id))){next.allPaid=true;items.push({label:'ミッション全部クリア',bones:ALL_MISSIONS_BONES});}
 return {state:next,items,moves};
}

// ----------------------------------------------------------- featured song --

/** Bones from play are doubled on the day's featured song. */
export const FEATURED_MULT=2;
/** The day's featured song among the installed ones (the same all day). */
export function featuredSong(day:string,packIds:readonly string[]){
 if(!packIds.length)return null;
 const ids=[...packIds].sort();
 return ids[seedOf('song:'+day)%ids.length];
}

// ------------------------------------------------------------------ やりこみ --

export interface LifeStats {plays?:number;great?:number;maxCombo?:number;fc?:number;ag?:number;hardClears?:number;rolls?:number;jackpots?:number;collected?:number;loginDays?:number;streakBest?:number;level?:number}
export interface Achievement {id:string;name:string;unit:string;stat:keyof LifeStats;tiers:readonly number[];titles:readonly string[]}
export const TIER_NAMES=['銅','銀','金'] as const;
export const TIER_BONES=[100,300,800] as const;
export const ACHIEVEMENTS:Achievement[]=[
 {id:'plays',name:'演奏した曲',unit:'曲',stat:'plays',tiers:[10,50,200],titles:['お祭りデビュー','お祭りの常連','お祭りの主']},
 {id:'great',name:'出した良',unit:'回',stat:'great',tiers:[1000,10000,50000],titles:['良の見習い','良の職人','良の達人']},
 {id:'combo',name:'最大コンボ',unit:'コンボ',stat:'maxCombo',tiers:[100,300,600],titles:['コンボ好き','コンボ名人','コンボの鬼']},
 {id:'fc',name:'フルコンボ',unit:'回',stat:'fc',tiers:[1,10,50],titles:['ノーミスデビュー','ノーミス職人','ノーミス名人']},
 {id:'ag',name:'全良',unit:'回',stat:'ag',tiers:[1,5,20],titles:['全良のひと','全良マスター','伝説の全良']},
 {id:'hard',name:'むずかしいをクリア',unit:'回',stat:'hardClears',tiers:[1,10,50],titles:['むずかしい挑戦者','むずかしい常連','太鼓の達人']},
 {id:'rolls',name:'連打',unit:'回',stat:'rolls',tiers:[500,3000,10000],titles:['連打っ子','連打職人','連打の嵐']},
 {id:'jackpot',name:'仲間の4匹そろい',unit:'回',stat:'jackpots',tiers:[1,5,20],titles:['しば運','しば運の持ち主','大当たり柴使い']},
 {id:'zukan',name:'しばずかん',unit:'種類',stat:'collected',tiers:[20,40,COSTUMES.length],titles:['しばコレクター','しば博士','しばずかん名人']},
 {id:'login',name:'ログインした日',unit:'日',stat:'loginDays',tiers:[7,30,100],titles:['毎日たいこ','たいこ一筋','たいこと共に']},
 {id:'streak',name:'連続ログイン',unit:'日',stat:'streakBest',tiers:[3,7,30],titles:['三日坊主こえ','一週間皆勤','ひと月皆勤']},
 {id:'level',name:'太鼓レベル',unit:'',stat:'level',tiers:[10,25,50],titles:['太鼓の若手','太鼓の師範','太鼓の名人']},
];
export const ACHIEVEMENT_BY_ID=new Map(ACHIEVEMENTS.map(a=>[a.id,a]));
export const DEFAULT_TITLE='はじめての太鼓';

export function tierFor(a:Achievement,value:number){return a.tiers.filter(t=>value>=t).length;}
export interface Unlock {id:string;tier:number;name:string;title:string;bones:number}
/** Tiers reached but not yet paid, in order. Achievements whose stat is unknown here are skipped. */
export function newTiers(stats:LifeStats,achieved:Readonly<Record<string,number>>):Unlock[]{
 const out:Unlock[]=[];
 for(const a of ACHIEVEMENTS){
  const value=stats[a.stat];if(value===undefined)continue;
  for(let t=(achieved[a.id]??0)+1;t<=tierFor(a,value);t++)out.push({id:a.id,tier:t,name:a.name,title:a.titles[t-1],bones:TIER_BONES[t-1]});
 }
 return out;
}
/** Titles unlocked so far, as "id:tier" keys with their names. */
export function unlockedTitles(achieved:Readonly<Record<string,number>>){
 return ACHIEVEMENTS.flatMap(a=>a.titles.slice(0,achieved[a.id]??0).map((name,i)=>({key:`${a.id}:${i+1}`,name,tier:i+1})));
}
export function titleName(key:string|undefined,achieved:Readonly<Record<string,number>>){
 const [id,tier]=(key??'').split(':'),a=ACHIEVEMENT_BY_ID.get(id),t=Number(tier);
 return a&&t>=1&&t<=(achieved[id]??0)?a.titles[t-1]:DEFAULT_TITLE;
}

/** Lifetime play stats from saved runs (normal play only: no AUTO, no practice). */
export function runStats(runs:readonly RunResult[]):LifeStats{
 let plays=0,great=0,maxCombo=0,fc=0,ag=0,hardClears=0,rolls=0;
 for(const r of runs){
  if(r.autoplay||r.practice)continue;
  const s=r.stats;plays++;great+=s.great;maxCombo=Math.max(maxCombo,s.maxCombo);rolls+=s.rollHits;
  if(s.fullCombo)fc++;
  if(s.allGreat)ag++;
  if(r.difficulty==='hard'&&s.gauge>=70)hardClears++;
 }
 return {plays,great,maxCombo,fc,ag,hardClears,rolls};
}
/** Stats kept with the rewards (not in the runs). */
export function festivalStats(f:{owned:Readonly<Record<string,number>>;xp?:number;jackpots?:number;login?:{count:number;best:number}}):LifeStats{
 return {jackpots:f.jackpots??0,collected:COSTUMES.filter(c=>f.owned[c.id]).length,loginDays:f.login?.count??0,streakBest:f.login?.best??0,level:levelFor(f.xp??0).level};
}
