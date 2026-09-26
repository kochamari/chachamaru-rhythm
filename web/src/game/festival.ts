// Festival rewards around a run: FEVER, the four friends (a slot machine:
// who comes is drawn, the same coat twice or more pays, a rare coat pays)
// and ほねっこ (dog-bone treats, spent on しばガチャ). Pure: no DOM, no Pixi.
// Only for show and for the draw: score, gauge and judgement never depend on
// anything here.
import type {EffectEvent,GameSnapshot} from '../../../contracts/public-types';

/** Friends come at these festival-gauge steps; the fourth (last) at a full gauge. */
export const FRIEND_STEPS=[30,50,70,100] as const;
export const ALL_FRIENDS_GAUGE=100;
export function friendsForGauge(gauge:number){return FRIEND_STEPS.filter(step=>gauge>=step).length;}

/** Coats a friend can come in: four common ones and three rare ones. */
export const COMMON_COATS=['kuro','shiro','goma','aka'] as const;
export const RARE_COATS=['kin','sakura','gin'] as const;
/**
 * Chance of each rare coat for the 1st…4th friend: the later the friend, the
 * likelier a rare one. A rare coat found in しばガチャ comes twice as often.
 */
export const RARE_CHANCE=[.015,.025,.045,.08] as const;
/** リーチ: when the first three hold two (or three) the same, the fourth completes it this much more often. */
export const REACH_BOOST={pair:.15,three:.3} as const;
export const isRare=(coat:string)=>(RARE_COATS as readonly string[]).includes(coat);

function most(coats:readonly string[]){
 let best='',count=0;
 for(const c of coats){const n=coats.filter(x=>x===c).length;if(n>count){best=c;count=n;}}
 return {coat:best,count};
}
/** Whether the fourth friend could complete a set: two or three the same among the first three. */
export const isReach=(first:readonly string[])=>first.length===3&&most(first).count>=2;

/** The four friends of a run, drawn at the start and revealed one by one (in order). */
export function drawFriends(random:()=>number,owned:Readonly<Record<string,number>>={}):string[]{
 const out:string[]=[];
 for(let i=0;i<FRIEND_STEPS.length;i++){
  if(i===FRIEND_STEPS.length-1){
   const {coat,count}=most(out);
   const boost=count>=3?REACH_BOOST.three:count>=2?REACH_BOOST.pair:0;
   if(boost&&random()<boost){out.push(coat);continue;}
  }
  const u=random();let acc=0,picked='';
  for(const id of RARE_COATS){acc+=RARE_CHANCE[i]*(owned[id]?2:1);if(u<acc){picked=id;break;}}
  out.push(picked||COMMON_COATS[Math.min(COMMON_COATS.length-1,Math.floor(random()*COMMON_COATS.length))]);
 }
 return out;
}

export interface Bonus {label:string;bones:number}
/** One line per kind of bonus (for the result): the same label adds up, in first-seen order. */
export function mergeBonuses(items:readonly Bonus[]):Bonus[]{
 const out:Bonus[]=[];
 for(const b of items){const same=out.find(o=>o.label===b.label);if(same)same.bones+=b.bones;else out.push({...b});}
 return out;
}
export type FriendSet='pair'|'twoPair'|'three'|'four';
/** What a friend's coat completes with those already here, and the bones for it. */
export function joinBonuses(before:readonly string[],coat:string):{items:Bonus[];set:FriendSet|null;rare:boolean}{
 const same=before.filter(c=>c===coat).length+1,items:Bonus[]=[];
 let set:FriendSet|null=null;
 if(same===4){set='four';items.push({label:'4匹そろい',bones:200});}
 else if(same===3){set='three';items.push({label:'3匹そろい',bones:50});}
 else if(same===2){
  const otherPair=before.some(c=>c!==coat&&before.filter(x=>x===c).length===2);
  set=otherPair?'twoPair':'pair';items.push(otherPair?{label:'ダブルペア',bones:30}:{label:'ペア',bones:10});
 }
 const rare=isRare(coat);
 if(rare)items.push({label:'レア柴',bones:20});
 return {items,set,rare};
}
/** FEVER while the combo is at least this. */
export const FEVER_COMBO=30;
/** Bones when all four friends are here (全員集合). */
export const ALL_FRIENDS_BONES=30;
/** Bones every 50 combo. */
export const COMBO_BONES=10;

export const inFever=(combo:number)=>combo>=FEVER_COMBO;

/** Bones for one judgement event: 良 1 (big note 2), doubled in FEVER; +10 every 50 combo. */
export function boneGain(e:Pick<EffectEvent,'kind'|'size'|'value'>,fever:boolean){
 if(e.kind==='great')return (e.size==='large'?2:1)*(fever?2:1);
 if(e.kind==='combo'&&e.value&&e.value%50===0)return COMBO_BONES;
 return 0;
}

/** Bones added when the song ends. */
export function finishBones(s:Pick<GameSnapshot,'gauge'|'fullCombo'|'allGreat'>){
 const items:{label:string;bones:number}[]=[];
 if(s.gauge>=70)items.push({label:'クリア',bones:20});
 if(s.allGreat)items.push({label:'全良',bones:100});
 else if(s.fullCombo)items.push({label:'フルコンボ',bones:50});
 return items;
}

/**
 * Bones of one run, followed live: `play` from judgement events in order
 * (FEVER from the combo before each event), `bonuses` once per friend as they
 * first come (sets, rare coats) and once for all four.
 */
export class BoneCounter {
 play=0;bonuses:Bonus[]=[];
 private combo=0;private joined=0;private coats:string[]=[];
 get bones(){return this.play+this.bonuses.reduce((a,b)=>a+b.bones,0);}
 /** The run's drawn friends (known shortly after the start). */
 setFriends(coats:readonly string[]){this.coats=[...coats];}
 add(events:readonly EffectEvent[],gauge:number){
  for(const e of events){
   this.play+=boneGain(e,inFever(this.combo));
   if(e.kind==='great'||e.kind==='ok')this.combo++;
   else if(e.kind==='miss')this.combo=0;
  }
  const n=friendsForGauge(gauge);
  while(this.joined<n&&this.joined<this.coats.length){
   this.bonuses.push(...joinBonuses(this.coats.slice(0,this.joined),this.coats[this.joined]).items);
   this.joined++;
   if(this.joined===FRIEND_STEPS.length)this.bonuses.push({label:'全員集合',bones:ALL_FRIENDS_BONES});
  }
 }
}

// ------------------------------------------------------------ result screen --

/** Result-screen bonus slot: three reels of festival symbols multiply the bones from play. */
export const SLOT_SYMBOLS=['bone','flower','drum','chacha'] as const;
export type SlotSymbol=typeof SLOT_SYMBOLS[number];
const SLOT_WEIGHTS:Record<SlotSymbol,number>={bone:.34,flower:.3,drum:.24,chacha:.12};
/** When the first two reels match, the third matches this much more often (リーチ). */
export const SLOT_REACH_BOOST=.25;
function slotSymbol(u:number):SlotSymbol{
 let acc=0;
 for(const s of SLOT_SYMBOLS){acc+=SLOT_WEIGHTS[s];if(u<acc)return s;}
 return 'chacha';
}
export function drawSlot(random:()=>number):SlotSymbol[]{
 const a=slotSymbol(random()),b=slotSymbol(random());
 const c=a===b&&random()<SLOT_REACH_BOOST?a:slotSymbol(random());
 return [a,b,c];
}
/** ちゃちゃまる three times ×3, any three the same ×2, two the same ×1.5. */
export function slotPayout(symbols:readonly SlotSymbol[]):{mult:number;label:string}{
 const [a,b,c]=symbols;
 if(a===b&&b===c)return a==='chacha'?{mult:3,label:'ちゃちゃまる3つ！'}:{mult:2,label:'3つそろい！'};
 if(a===b||b===c||a===c)return {mult:1.5,label:'2つそろい'};
 return {mult:1,label:''};
}

/** 太鼓レベル: experience from each finished run. */
export function xpForRun(s:Pick<GameSnapshot,'score'|'gauge'|'fullCombo'|'allGreat'>){
 return Math.min(100,Math.round(s.score/10000))+(s.gauge>=70?20:0)+(s.allGreat?50:s.fullCombo?30:0);
}
/** Level for total experience: the next level needs 100 + 20 per level so far. */
export function levelFor(xp:number){
 let level=1,rest=Math.max(0,Math.floor(xp));
 while(rest>=100+20*(level-1)){rest-=100+20*(level-1);level++;}
 return {level,into:rest,need:100+20*(level-1)};
}
export const LEVEL_UP_BONES=50;
export const DAILY_BONES=50;
/** The local calendar day, for the first-run-of-the-day bonus. */
export function dayKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}

/** One line that makes "one more time" tempting, or null. */
export function nearMiss(s:Pick<GameSnapshot,'score'|'gauge'|'fullCombo'|'allGreat'|'miss'|'ok'>,best:number|null){
 if(!s.fullCombo&&s.miss>0&&s.miss<=2)return `フルコンボまで あと${s.miss}ミス！`;
 if(s.fullCombo&&!s.allGreat&&s.ok>0&&s.ok<=3)return `全良まで あと 可${s.ok}つ！`;
 if(s.gauge<70&&s.gauge>=60)return `クリアまで あと${Math.ceil(70-s.gauge)}%！`;
 if(best!==null&&s.score<best&&best-s.score<=30000)return `自己ベストまで あと${(best-s.score).toLocaleString()}点！`;
 return null;
}
