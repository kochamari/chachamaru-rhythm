// Festival rewards around a run: the cheering crowd (おうえん), FEVER and
// ほねっこ (dog-bone treats, spent on the result-screen draw). Pure: no DOM,
// no Pixi. Only for show and for the draw: score, gauge and judgement never
// depend on anything here.
import type {EffectEvent,GameSnapshot} from '../../../contracts/public-types';

/** Shibas in a full crowd; every layout has this many places. */
export const CROWD_MAX=20;
/** FEVER while the combo is at least this. */
export const FEVER_COMBO=30;
/** Bones for a full crowd (満員御礼). */
export const FULL_HOUSE_BONES=30;
/** Bones every 50 combo. */
export const COMBO_BONES=10;

/**
 * 良 hits per new crowd member: a run with about nine 良 in ten fills the
 * crowd near the end of the song, whatever its length.
 */
export function crowdStep(taps:number){return Math.max(4,Math.min(14,Math.round(taps*.87/CROWD_MAX)));}
export function crowdSize(great:number,step:number){return Math.min(CROWD_MAX,Math.floor(great/Math.max(1,step)));}
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
 * Bones of one run, followed live: judgement events in order, FEVER from the
 * combo before each event, and the full crowd once.
 */
export class BoneCounter {
 bones=0;fullHouse=false;
 private combo=0;
 constructor(readonly step:number){}
 add(events:readonly EffectEvent[],great:number){
  for(const e of events){
   this.bones+=boneGain(e,inFever(this.combo));
   if(e.kind==='great'||e.kind==='ok')this.combo++;
   else if(e.kind==='miss')this.combo=0;
  }
  if(!this.fullHouse&&crowdSize(great,this.step)>=CROWD_MAX){this.fullHouse=true;this.bones+=FULL_HOUSE_BONES;}
 }
}
