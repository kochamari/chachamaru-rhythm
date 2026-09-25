import {ClockBridge} from './ClockBridge';
import type {Settings,Color} from '../../../contracts/public-types';
import {renderHit,renderEffect,type EffectName,type HitSound} from './synth';

type Bus='bgm'|'hit'|'effect'|'ui';

// One AudioContext for the whole app: unlocked by the first tap, reused by
// menus, previews and every play session (iOS allows only a few contexts).
let shared:AudioContext|null=null;
const sampleCache=new Map<string,AudioBuffer>();
export function sharedAudioContext(){return shared&&shared.state!=='closed'?shared:null;}
function obtainContext(){
 if(!shared||shared.state==='closed'){
  // iOS Safari: let the game sound even when the ringer switch is silent.
  try{const session=(navigator as Navigator&{audioSession?:{type:string}}).audioSession;if(session)session.type='playback';}catch{/* optional API */}
  shared=new AudioContext({latencyHint:'interactive'});sampleCache.clear();
 }
 return shared;
}
const EFFECTS:EffectName[]=['combo10','combo50','combo100','chorus','clear','fullCombo','allGreat','fail','select','move','back','count','balloon','tick','fever','fullHouse','gachaTurn','gachaOpen','gachaRare'];
const UI_EFFECTS=new Set<EffectName>(['select','move','back','count','tick']);

/**
 * Owns the AudioContext: the song source, the clock bridge and the short
 * synthesised hit/effect samples. Only this class creates or stops nodes.
 */
export class AudioEngine {
 context:AudioContext|null=null;buffer:AudioBuffer|null=null;source:AudioBufferSourceNode|null=null;clock:ClockBridge|null=null;
 a0=0;s0=0;ended=false;generation=0;liveSources=0;starts=0;stops=0;
 private gains:Partial<Record<Bus,GainNode>>={};
 private samples=new Map<string,AudioBuffer>();
 private preparing=0;
 private suspended?:()=>void;
 constructor(public settings:Settings){}

 async unlock(){
  if(!this.context){
   this.context=obtainContext();
   for(const name of ['bgm','hit','effect','ui'] as const){const g=this.context.createGain();g.connect(this.context.destination);this.gains[name]=g;}
   this.context.addEventListener?.('statechange',this.onState);
   if(!this.context.addEventListener)this.context.onstatechange=this.onState;
  }
  await this.context.resume();
  this.volume();
  this.prepareSamples();
 }
 /**
  * The context left 'running' while a song plays. A short stop (another app
  * or tab starting audio, a Bluetooth route change) often recovers by
  * itself: try to resume, and pause the game only if it is still silent
  * after RECOVER_MS. Notes follow the audio clock, so a brief stall stays in
  * sync. A closed context pauses at once.
  */
 private onState=()=>{
  const c=this.context;
  if(!c||c.state==='running'||!this.source)return;
  if(c.state==='closed'){this.suspended?.();return;}
  const generation=this.generation;
  void c.resume().catch(()=>{});
  setTimeout(()=>{if(this.context===c&&this.source&&this.generation===generation&&c.state!=='running')this.suspended?.();},AudioEngine.RECOVER_MS);
 };
 static RECOVER_MS=800;
 /**
  * Right after a resume the output clock (getOutputTimestamp) can still read
  * 0 for a moment. Wait briefly for it, so a run's clock (fixed at start)
  * uses the same mode as 音ズレ合わせ did; the measured delay assumes that.
  */
 async settle(){
  const c=this.context;if(!c||typeof c.getOutputTimestamp!=='function')return;
  for(let i=0;i<20&&!((c.getOutputTimestamp().contextTime??0)>0);i++)await new Promise(r=>setTimeout(r,25));
 }
 onSuspend(cb:()=>void){this.suspended=cb;}
 volume(){
  for(const name of ['bgm','hit','effect','ui'] as const){
   const value=name==='hit'&&this.settings.inputMode==='midi'?this.settings.midiHit:this.settings[name];
   this.gains[name]?.gain.setValueAtTime(value,this.context?.currentTime??0);
  }
 }
 /** Hits first (tiny), festival effects afterwards in idle slices. */
 private prepareSamples(){
  const c=this.context;
  if(!c||typeof c.createBuffer!=='function')return;
  this.samples=sampleCache;
  this.hitSample('don');this.hitSample('ka');
  const id=++this.preparing;let i=0;
  const next=()=>{if(id!==this.preparing||!this.context)return;const name=EFFECTS[i++];if(!name)return;if(!this.samples.has(name))this.samples.set(name,this.toBuffer(renderEffect(name,this.context.sampleRate)));setTimeout(next,0);};
  setTimeout(next,0);
 }
 /** Stroke sample for the chosen sound set, rendered on first use. */
 private hitSample(color:Color){
  const set:HitSound=this.settings.hitSound??'taiko',key=`${color}:${set}`;
  let b=this.samples.get(key);
  if(!b&&this.context&&typeof this.context.createBuffer==='function'){b=this.toBuffer(renderHit(color,set,this.context.sampleRate));this.samples.set(key,b);}
  return key;
 }
 private toBuffer(data:Float32Array){
  const c=this.context!;const b=c.createBuffer(1,data.length,c.sampleRate);b.copyToChannel(data as Float32Array<ArrayBuffer>,0);return b;
 }
 private playSample(name:string,bus:Bus,gain=1,detune=0){
  const c=this.context;if(!c||c.state!=='running')return;
  let buffer=this.samples.get(name);
  if(!buffer&&EFFECTS.includes(name as EffectName)&&typeof c.createBuffer==='function'){buffer=this.toBuffer(renderEffect(name as EffectName,c.sampleRate));this.samples.set(name,buffer);}
  const out=this.gains[bus];if(!buffer||!out)return;
  const s=c.createBufferSource();s.buffer=buffer;if(detune&&s.detune)s.detune.value=detune;
  let node:AudioNode=s;
  if(gain!==1){const g=c.createGain();g.gain.value=gain;s.connect(g);node=g;}
  node.connect(out);
  s.onended=()=>{s.disconnect();if(node!==s)node.disconnect();};
  s.start();
 }

 async load(blob:Blob){await this.unlock();this.stop();this.buffer=null;this.buffer=await this.context!.decodeAudioData(await blob.arrayBuffer());return this.buffer;}
 start(offset=0){
  this.stop();
  const c=this.context;if(!c||!this.buffer)throw Error('音源が読み込まれていません');
  this.clock=new ClockBridge(c);this.s0=offset;this.a0=c.currentTime+2;this.ended=false;
  const gen=this.generation;
  const s=c.createBufferSource();s.buffer=this.buffer;s.connect(this.gains.bgm!);
  this.source=s;this.liveSources++;this.starts++;
  s.onended=()=>{if(gen!==this.generation)return;this.ended=true;this.release(s);};
  s.start(this.a0,Math.max(0,offset/1000));
 }
 private release(s:AudioBufferSourceNode){if(this.source===s){this.source=null;this.liveSources=Math.max(0,this.liveSources-1);}s.onended=null;s.disconnect();}
 stop(){this.generation++;if(this.source){const s=this.source;s.onended=null;try{s.stop();}catch{/* already ended */}this.release(s);this.stops++;}}
 time(p=performance.now()){return this.clock?.songAt(p,this.a0,this.s0,this.settings.audioDelayMs)??-2000;}

 /** Player stroke sound: one per input, never layered with effects. */
 hit(color:Color,accent=false){if(!this.context)return;this.playSample(this.hitSample(color),'hit',accent?1.15:1);}
 /** Festival effect or UI sound. */
 effect(name:EffectName){this.playSample(name,UI_EFFECTS.has(name)?'ui':'effect');}
 /** Combo milestone chime: 1 = 10 combo, 2 = 50, 3 = 100+. */
 chime(level=1){this.effect(level>=3?'combo100':level===2?'combo50':'combo10');}
 dispose(){
  this.stop();this.buffer=null;this.suspended=undefined;this.preparing++;
  if(this.context){
   this.context.removeEventListener?.('statechange',this.onState);
   if(this.context.onstatechange===this.onState)this.context.onstatechange=null;
   for(const g of Object.values(this.gains))g?.disconnect();
   this.context=null;this.gains={};this.samples=new Map();
  }
 }
}
