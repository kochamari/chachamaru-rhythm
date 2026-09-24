// Maps performance.now() milliseconds to AudioContext seconds.
//
// Mode A ('output') uses getOutputTimestamp() pairs; mode B ('render') uses
// currentTime. The mode is fixed for a run. Each valid sample updates a
// smoothed offset (audio seconds − performance seconds): small jitter is
// averaged so notes glide smoothly, real jumps (> snap) are followed at once.
// Invalid or non-monotonic samples are never accepted; the last good offset
// is kept until the clock has been stale for longer than staleLimitMs.
export interface ClockSource {currentTime:number;getOutputTimestamp?:()=>{contextTime?:number;performanceTime?:number}}

export function normalizeTimestamp(stamp:number,receipt:number,origin:number){
 let p=stamp;if(p>1e12)p-=origin;
 const valid=Number.isFinite(p)&&p>0&&p<=receipt+5&&receipt-p<10000;
 return {time:valid?p:receipt,degraded:!valid,mode:valid?(stamp>1e12?'epoch':'performance'):'receipt'};
}

export class ClockBridge {
 readonly mode:'output'|'render';
 staleLimitMs=1500;
 private previousOutput=-Infinity;
 private offset:number|null=null;
 private lastValidAt=-Infinity;
 rejected=0;
 private readonly snap:number;
 private readonly smoothing:number;
 constructor(private source:ClockSource,private now:()=>number=()=>performance.now()){
  this.mode=this.validOutput(source.getOutputTimestamp?.())?'output':'render';
  this.snap=this.mode==='output'?.03:.08;
  this.smoothing=this.mode==='output'?.12:.08;
 }
 private validOutput(p:{contextTime?:number;performanceTime?:number}|undefined):p is {contextTime:number;performanceTime:number}{
  return !!p&&Number.isFinite(p.contextTime)&&Number.isFinite(p.performanceTime)&&p.contextTime!>0&&Math.abs(this.source.currentTime-p.contextTime!)<2&&p.contextTime!>=this.previousOutput&&Math.abs(this.now()-p.performanceTime!)<1000;
 }
 private sample(){
  const now=this.now();
  let value:number;
  if(this.mode==='output'){
   const pair=this.source.getOutputTimestamp?.();
   if(!this.validOutput(pair)){this.rejected++;return;}
   this.previousOutput=pair.contextTime;
   value=pair.contextTime-pair.performanceTime/1000;
  }else{
   if(!Number.isFinite(this.source.currentTime)){this.rejected++;return;}
   value=this.source.currentTime-now/1000;
  }
  if(this.offset===null||Math.abs(value-this.offset)>this.snap)this.offset=value;
  else this.offset+=(value-this.offset)*this.smoothing;
  this.lastValidAt=now;
 }
 /** AudioContext time (s) at which audio scheduled now is heard, for performance time p (ms). */
 audioAt(p:number){
  this.sample();
  if(this.offset===null||this.now()-this.lastValidAt>this.staleLimitMs)throw Error('音声時計が停止しました。再開してください');
  return this.offset+p/1000;
 }
 songAt(p:number,a0:number,s0:number,audioDelayMs:number){return s0+1000*(this.audioAt(p)-a0)-audioDelayMs;}
}
