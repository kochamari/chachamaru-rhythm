export interface ClockSource {currentTime:number;getOutputTimestamp?:()=>{contextTime?:number;performanceTime?:number}}
export function normalizeTimestamp(stamp:number,receipt:number,origin:number){let p=stamp;if(p>1e12)p-=origin;const valid=Number.isFinite(p)&&p>0&&p<=receipt+5&&receipt-p<10000;return {time:valid?p:receipt,degraded:!valid,mode:valid?(stamp>1e12?'epoch':'performance'):'receipt'};}
export class ClockBridge {
 readonly mode:'output'|'render';private previousOutput=-Infinity;
 constructor(private source:ClockSource,private now:()=>number=()=>performance.now()){this.mode=this.validOutput(source.getOutputTimestamp?.())?'output':'render';}
 private validOutput(p:{contextTime?:number;performanceTime?:number}|undefined):p is {contextTime:number;performanceTime:number}{return !!p&&Number.isFinite(p.contextTime)&&Number.isFinite(p.performanceTime)&&p.contextTime!>0&&Math.abs(this.source.currentTime-p.contextTime!)<2&&p.contextTime!>=this.previousOutput&&Math.abs(this.now()-p.performanceTime!)<1000;}
 audioAt(p:number){if(this.mode==='output'){const pair=this.source.getOutputTimestamp?.();if(this.validOutput(pair)){this.previousOutput=pair.contextTime;return pair.contextTime+(p-pair.performanceTime)/1000;}throw Error('音声時計が停止しました。再開してください');}return this.source.currentTime+(p-this.now())/1000;}
 songAt(p:number,a0:number,s0:number,audioDelayMs:number){return s0+1000*(this.audioAt(p)-a0)-audioDelayMs;}
}
