import type {Chart,Tap,Roll,HitEvent,Outcome,GameSnapshot,EffectEvent} from '../../../contracts/public-types';

// Pure judgement engine: timed inputs in, results out. No DOM, audio or
// storage. See docs/02_ENGINE.md for the rules; the numbers below are the
// fixed ruleset chacha-v1.
export const RULESET='chacha-v1';
export const GREAT_MS=45,OK_MS=90,DELIVERY_GRACE_MS=80;

export class Engine {
 readonly taps:Tap[];
 readonly rolls:Roll[];
 readonly outcomes=new Map<string,Outcome>();
 readonly seen=new Set<string>();
 readonly deltas:number[]=[];
 private commit=0;
 private greatWeight=0;private okWeight=0;private readonly totalWeight:number;
 private great=0;private ok=0;private miss=0;
 private combo=0;private maxCombo=0;private gauge=0;private rollHits=0;
 timingUnstable=false;
 active=false;
 events:EffectEvent[]=[];

 constructor(readonly chart:Chart,readonly runId:string){
  this.taps=chart.notes.filter((n):n is Tap=>n.kind==='tap');
  this.rolls=chart.notes.filter((n):n is Roll=>n.kind==='roll');
  this.totalWeight=this.taps.reduce((v,n)=>v+(n.size==='large'?2:1),0);
  if(!this.totalWeight)throw Error('空譜面は演奏できません');
 }

 /** Mark taps whose window plus delivery grace has passed as missed. */
 advance(now:number){
  if(!this.active||!Number.isFinite(now))return;
  for(let i=this.commit;i<this.taps.length;i++){
   const n=this.taps[i];
   if(now<=n.timeMs+this.chart.offsetMs+OK_MS+DELIVERY_GRACE_MS)break;
   if(!this.outcomes.has(n.id)){this.outcomes.set(n.id,'miss');this.events.push({kind:'miss',timeMs:now,color:n.color,size:n.size,noteId:n.id});}
  }
  this.drain(now);
 }

 hit(h:HitEvent):Outcome|'roll'|null{
  if(!this.active||h.runId!==this.runId||this.seen.has(h.id)||!Number.isFinite(h.inputSongMs)||!Number.isFinite(h.receiptSongMs))return null;
  this.seen.add(h.id);
  if((h.deliveryDelayMs??(h.receiptSongMs-h.inputSongMs))>DELIVERY_GRACE_MS)this.timingUnstable=true;
  this.advance(h.receiptSongMs);
  // The earliest unresolved tap of the same colour inside the window wins.
  for(let i=this.commit;i<this.taps.length;i++){
   const n=this.taps[i];
   const delta=h.inputSongMs-(n.timeMs+this.chart.offsetMs);
   if(delta< -OK_MS)break;
   if(this.outcomes.has(n.id)||n.color!==h.color||Math.abs(delta)>OK_MS)continue;
   const outcome:Outcome=Math.abs(delta)<=GREAT_MS?'great':'ok';
   this.outcomes.set(n.id,outcome);
   this.deltas.push(delta);
   this.events.push({kind:outcome,color:h.color,delta,timeMs:h.receiptSongMs,size:n.size,noteId:n.id});
   this.drain(h.receiptSongMs);
   return outcome;
  }
  if(this.rolls.some(n=>h.inputSongMs>=n.timeMs+this.chart.offsetMs&&h.inputSongMs<n.endMs+this.chart.offsetMs)){
   this.rollHits++;
   this.events.push({kind:'roll',color:h.color,timeMs:h.receiptSongMs});
   return 'roll';
  }
  return null;
 }

 /** Commit resolved taps strictly in chart order. */
 private drain(now:number){
  let milestone=0;
  while(this.commit<this.taps.length){
   const n=this.taps[this.commit];
   const result=this.outcomes.get(n.id);
   if(!result)break;
   const w=n.size==='large'?2:1;
   if(result==='miss'){this.miss++;this.combo=0;this.gauge-=240*w/this.totalWeight;}
   else{
    this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);
    if(result==='great'){this.great++;this.greatWeight+=w;this.gauge+=120*w/this.totalWeight;}
    else{this.ok++;this.okWeight+=w;this.gauge+=60*w/this.totalWeight;}
    if(this.combo===10||this.combo===50||this.combo%100===0)milestone=Math.max(milestone,this.combo);
   }
   this.gauge=Math.max(0,Math.min(100,this.gauge));
   this.commit++;
  }
  if(milestone)this.events.push({kind:'combo',value:milestone,timeMs:now});
 }

 snapshot():GameSnapshot{
  const baseScore=Math.floor(1_000_000*(2*this.greatWeight+this.okWeight)/(2*this.totalWeight));
  const finished=this.commit===this.taps.length;
  return {baseScore,rollBonus:this.rollHits*100,score:baseScore+this.rollHits*100,rollHits:this.rollHits,great:this.great,ok:this.ok,miss:this.miss,combo:this.combo,maxCombo:this.maxCombo,gauge:this.gauge,accuracy:(this.great+this.ok*.5)/this.taps.length,fullCombo:finished&&this.miss===0,allGreat:finished&&this.miss===0&&this.ok===0,resolved:this.commit,total:this.taps.length,timingUnstable:this.timingUnstable,finished,outcomes:this.outcomes,deltas:this.deltas};
 }

 takeEvents(){const v=this.events;this.events=[];return v;}
}
