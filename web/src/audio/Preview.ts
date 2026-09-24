import {sharedAudioContext} from './AudioEngine';

/**
 * Song preview for the song select screen. Decodes one song at a time and
 * hands the decoded buffer to the play session so the song starts quickly.
 * Plays only after the shared AudioContext was unlocked by a user gesture.
 */
export class PreviewPlayer {
 private cached:{key:string;buffer:AudioBuffer}|null=null;
 private node:{source:AudioBufferSourceNode;gain:GainNode}|null=null;
 private token=0;
 volume=.75;

 async play(key:string,blob:Blob,startMs:number,lengthMs=16000){
  const token=++this.token;
  this.stop();
  const c=sharedAudioContext();
  if(!c||c.state!=='running')return;
  let buffer=this.cached?.key===key?this.cached.buffer:null;
  if(!buffer){
   try{
    const bytes=await blob.arrayBuffer();
    if(token!==this.token)return;
    buffer=await c.decodeAudioData(bytes);
   }catch{return;}
   if(token!==this.token)return;
   this.cached={key,buffer};
  }
  const start=Math.max(0,Math.min(startMs/1000,buffer.duration-4));
  const length=Math.min(lengthMs/1000,buffer.duration-start);
  const source=c.createBufferSource(),gain=c.createGain();
  source.buffer=buffer;source.loop=true;source.loopStart=start;source.loopEnd=start+length;
  const t=c.currentTime;
  gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(this.volume,t+.6);
  source.connect(gain);gain.connect(c.destination);
  source.start(t,start);
  this.node={source,gain};
 }
 stop(fadeMs=250){
  const n=this.node;this.node=null;
  if(!n)return;
  const c=sharedAudioContext();
  try{
   if(c){const t=c.currentTime;n.gain.gain.cancelScheduledValues(t);n.gain.gain.setValueAtTime(n.gain.gain.value,t);n.gain.gain.linearRampToValueAtTime(0,t+fadeMs/1000);n.source.stop(t+fadeMs/1000+.02);}
   else n.source.stop();
  }catch{/* already stopped */}
  n.source.onended=()=>{n.source.disconnect();n.gain.disconnect();};
 }
 /** Give the decoded buffer to a play session (and forget it here). */
 take(key:string):AudioBuffer|null{
  if(this.cached?.key!==key)return null;
  const b=this.cached.buffer;this.cached=null;return b;
 }
 clear(){this.token++;this.stop(0);this.cached=null;}
}
