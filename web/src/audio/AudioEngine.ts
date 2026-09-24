import {ClockBridge} from './ClockBridge';
import type {Settings,Color} from '../../../contracts/public-types';
export class AudioEngine {
 context:AudioContext|null=null;buffer:AudioBuffer|null=null;source:AudioBufferSourceNode|null=null;clock:ClockBridge|null=null;a0=0;s0=0;ended=false;generation=0;liveSources=0;starts=0;stops=0;
 private gains:Record<string,GainNode>={};private suspended?:()=>void;
 constructor(public settings:Settings){}
 async unlock(){if(!this.context){this.context=new AudioContext({latencyHint:'interactive'});for(const name of ['bgm','hit','effect','ui']){const g=this.context.createGain();g.connect(this.context.destination);this.gains[name]=g;}this.context.onstatechange=()=>{if(this.context?.state!=='running'&&this.source)this.suspended?.();};}await this.context.resume();this.volume();}
 onSuspend(cb:()=>void){this.suspended=cb;}
 volume(){for(const name of ['bgm','hit','effect','ui'] as const){const value=name==='hit'&&this.settings.inputMode==='midi'?this.settings.midiHit:this.settings[name];this.gains[name]?.gain.setValueAtTime(value,this.context?.currentTime??0);}}
 async load(blob:Blob){await this.unlock();this.stop();this.buffer=null;this.buffer=await this.context!.decodeAudioData(await blob.arrayBuffer());return this.buffer;}
 start(offset=0){this.stop();const c=this.context;if(!c||!this.buffer)throw Error('音源が読み込まれていません');this.clock=new ClockBridge(c);this.s0=offset;this.a0=c.currentTime+2;this.ended=false;const gen=this.generation;const s=c.createBufferSource();s.buffer=this.buffer;s.connect(this.gains.bgm);this.source=s;this.liveSources++;this.starts++;s.onended=()=>{if(gen!==this.generation)return;this.ended=true;this.release(s);};s.start(this.a0,Math.max(0,offset/1000));}
 private release(s:AudioBufferSourceNode){if(this.source===s){this.source=null;this.liveSources=Math.max(0,this.liveSources-1);}s.onended=null;s.disconnect();}
 stop(){this.generation++;if(this.source){const s=this.source;s.onended=null;try{s.stop();}catch{/* already ended */}this.release(s);this.stops++;}}
 time(p=performance.now()){return this.clock?.songAt(p,this.a0,this.s0,this.settings.audioDelayMs)??-2000;}
 hit(color:Color){if(!this.context||this.context.state!=='running')return;const c=this.context;const t=c.currentTime;const o=c.createOscillator(),g=c.createGain();o.type=color==='don'?'sine':'triangle';o.frequency.setValueAtTime(color==='don'?165:1380,t);o.frequency.exponentialRampToValueAtTime(color==='don'?48:700,t+.12);g.gain.setValueAtTime(color==='don'?.65:.32,t);g.gain.exponentialRampToValueAtTime(.001,t+.14);o.connect(g);g.connect(this.gains.hit);o.start(t);o.stop(t+.15);o.onended=()=>{o.disconnect();g.disconnect();};}
 chime(level=1){if(!this.context)return;const c=this.context;[523,659,784].slice(0,level).forEach((f,i)=>{const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+i*.1;o.frequency.value=f;o.type='sine';g.gain.setValueAtTime(.16,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g);g.connect(this.gains.effect);o.start(t);o.stop(t+.31);o.onended=()=>{o.disconnect();g.disconnect();};});}
 dispose(){this.stop();this.buffer=null;this.suspended=undefined;if(this.context){this.context.onstatechange=null;void this.context.close();this.context=null;this.gains={};}}
}
