// Festival rewards around a run: FEVER, all four friends together (全員集合)
// and ほねっこ (dog-bone treats, spent on しばガチャ). Pure: no DOM, no Pixi.
// Only for show and for the draw: score, gauge and judgement never depend on
// anything here.
import type {EffectEvent,GameSnapshot} from '../../../contracts/public-types';

/** The fourth (last) friend comes at a full gauge. */
export const ALL_FRIENDS_GAUGE=100;
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
 * Bones of one run, followed live: judgement events in order, FEVER from the
 * combo before each event, and all four friends once.
 */
export class BoneCounter {
 bones=0;allFriends=false;
 private combo=0;
 add(events:readonly EffectEvent[],gauge:number){
  for(const e of events){
   this.bones+=boneGain(e,inFever(this.combo));
   if(e.kind==='great'||e.kind==='ok')this.combo++;
   else if(e.kind==='miss')this.combo=0;
  }
  if(!this.allFriends&&gauge>=ALL_FRIENDS_GAUGE){this.allFriends=true;this.bones+=ALL_FRIENDS_BONES;}
 }
}
