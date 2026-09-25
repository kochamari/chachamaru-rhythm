import type {Color,InputMode,Settings} from '../../../contracts/public-types';
import {normalizeTimestamp} from '../audio/ClockBridge';

export type Side='left'|'right';
export interface Input {id:string;color:Color;performanceMs:number;receiptMs:number;source:InputMode;degraded:boolean;side?:Side}
export const isTyping=(target:EventTarget|null)=>target instanceof HTMLElement&&(target.matches('input,textarea,select')||target.isContentEditable);

export function midiNote(data:ArrayLike<number>){
 if(data.length<3)return null;
 const [status,note,velocity]=Array.from(data);
 if(!Number.isInteger(status)||status<0||status>255||(status&0xf0)!==0x90||!Number.isInteger(note)||note<0||note>127||!Number.isInteger(velocity)||velocity<1||velocity>127)return null;
 return {note,channel:status&15,velocity};
}

const KEYS:Record<string,{color:Color;side:Side}>={KeyD:{color:'ka',side:'left'},KeyF:{color:'don',side:'left'},KeyJ:{color:'don',side:'right'},KeyK:{color:'ka',side:'right'}};

/**
 * Turns raw pointer, key and MIDI events into timestamped inputs. It never
 * scores anything; the current screen decides what an input means.
 */
export class InputRouter {
 pointers=new Map<number,HTMLElement>();
 count=0;fallbacks=0;timestampMode='not-received';
 private abort=new AbortController();private seq=0;
 onHit:(input:Input)=>void=()=>{};
 onPause:()=>void=()=>{};
 onMonitor:(value:unknown)=>void=()=>{};
 constructor(private root:HTMLElement){
  const signal=this.abort.signal;
  root.addEventListener('pointerdown',e=>{
   const pad=(e.target as HTMLElement).closest<HTMLElement>('[data-pad]');
   if(!pad||(e.pointerType==='mouse'&&e.button!==0)||this.pointers.has(e.pointerId))return;
   e.preventDefault();
   this.pointers.set(e.pointerId,pad);pad.classList.add('pressed');
   try{pad.setPointerCapture(e.pointerId);}catch{/* synthetic events have no capture */}
   this.emit(pad.dataset.pad as Color,e.timeStamp,'touch',pad.dataset.side as Side|undefined);
  },{signal});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(name,e=>this.release((e as PointerEvent).pointerId),{signal});
  window.addEventListener('keydown',e=>{
   if(e.repeat||isTyping(e.target))return;
   if(e.code==='Escape'){this.onPause();return;}
   const key=KEYS[e.code];
   if(key&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();this.emit(key.color,e.timeStamp,'keyboard',key.side);}
  },{signal});
  window.addEventListener('resize',()=>this.clear(),{signal});
  document.addEventListener('visibilitychange',()=>this.clear(),{signal});
 }
 emit(color:Color,stamp:number,source:InputMode,side?:Side){
  const receiptMs=performance.now();
  const t=normalizeTimestamp(stamp,receiptMs,performance.timeOrigin);
  if(t.degraded)this.fallbacks++;
  this.timestampMode=t.mode;this.count++;
  const input:Input={id:`input-${++this.seq}`,color,performanceMs:t.time,receiptMs,source,degraded:t.degraded,side};
  this.onHit(input);this.onMonitor(input);
 }
 release(id:number){
  const pad=this.pointers.get(id);this.pointers.delete(id);
  if(pad&&![...this.pointers.values()].includes(pad))pad.classList.remove('pressed');
 }
 clear(){for(const id of this.pointers.keys())this.release(id);}
 dispose(){this.abort.abort();this.clear();}
}

export class MidiAdapter {
 access:MIDIAccess|null=null;port:MIDIInput|null=null;
 learn:'don'|'ka'|null=null;candidate:{note:number;channel:number}|null=null;
 received=0;status='電子ドラムは未接続';
 onChange:()=>void=()=>{};onDisconnect:()=>void=()=>{};onMonitor:(data:unknown)=>void=()=>{};
 constructor(private router:InputRouter,private settings:Settings){}
 async connect(){
  if(!navigator.requestMIDIAccess){this.status='このブラウザはWeb MIDIに未対応です。タッチ・キーボードで遊べます。';this.onChange();return;}
  try{
   this.access=await navigator.requestMIDIAccess({sysex:false});
   this.access.onstatechange=()=>{
    if(this.port?.state==='disconnected'){this.select('');this.status='接続が切れました。ポートを選び直してください';this.onDisconnect();}
    this.onChange();
   };
   this.status=this.access.inputs.size?'入力ポートを選択してください':'許可されましたが、MIDI機器が見つかりません';
  }catch{this.status='MIDI接続が許可されませんでした。ブラウザの権限を確認してください';}
  this.onChange();
 }
 select(id:string){
  if(this.port)this.port.onmidimessage=null;
  this.port=this.access?.inputs.get(id)??null;
  if(this.port){this.port.onmidimessage=e=>this.receive(e.data??[],e.timeStamp);this.status=`接続中: ${this.port.name??'MIDI入力'}`;}
  this.onChange();
 }
 receive(data:ArrayLike<number>,timestamp:number){
  const m=midiNote(data);
  this.onMonitor({data:Array.from(data),timestamp,receipt:performance.now(),...m});
  if(!m||m.velocity<this.settings.midi.velocity)return;
  this.received++;
  if(this.learn){this.candidate={note:m.note,channel:m.channel};this.onChange();return;}
  for(const color of ['don','ka'] as const){const map=this.settings.midi[color];if(map&&map.note===m.note&&map.channel===m.channel)this.router.emit(color,timestamp,'midi');}
 }
 register(){
  if(!this.learn||!this.candidate)throw Error('先に登録するパッドを叩いてください');
  const other=this.settings.midi[this.learn==='don'?'ka':'don'];
  if(other&&other.note===this.candidate.note&&other.channel===this.candidate.channel)throw Error('同じノートとチャンネルは両方に登録できません');
  this.settings.midi[this.learn]={...this.candidate};this.learn=null;this.candidate=null;this.onChange();
 }
 dispose(){if(this.port)this.port.onmidimessage=null;if(this.access)this.access.onstatechange=null;this.port=null;}
}
