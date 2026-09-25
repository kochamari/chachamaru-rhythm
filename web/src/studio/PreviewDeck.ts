import {uiAudio} from '../app/context';

/**
 * Studio preview playback on the shared AudioContext (the same path as the
 * game) instead of an <audio> element. It mirrors the few HTMLMediaElement
 * members the editor uses: paused, currentTime (seconds), play(), pause().
 * On a Mac without an audio device WebKit silently paused the <audio>
 * element right after play(), so the preview never started (M01 on CI).
 */
export class PreviewDeck {
 private buffer:AudioBuffer|null=null;
 private loading:Promise<AudioBuffer>|null=null;
 private source:AudioBufferSourceNode|null=null;
 private gain:GainNode|null=null;
 private startedAt=0;private offset=0;
 // Like HTMLMediaElement: play() makes it "not paused" at once, even while
 // the song is still being decoded; pause() in that time cancels the start.
 private wanted=false;
 /** Called when play/pause state changes (not tied to rendering frames). */
 onchange:(()=>void)|null=null;

 constructor(private blob:Blob,private durationMs:number){}

 get paused(){return !this.wanted;}
 /** paused, starting (decoding), or playing (the source has started). */
 get state(){return !this.wanted?'paused':this.source?'playing':'starting';}

 get currentTime(){
  const ctx=uiAudio.context;
  if(!this.source||!ctx)return this.offset;
  return Math.min(this.duration,this.offset+(ctx.currentTime-this.startedAt));
 }
 set currentTime(seconds:number){
  const playing=!!this.source;
  this.halt();
  this.offset=Math.max(0,Math.min(this.duration,Number.isFinite(seconds)?seconds:0));
  if(playing)this.begin();
 }

 async play(){
  this.wanted=true;this.onchange?.();
  try{
   await uiAudio.unlock();
   this.buffer??=await (this.loading??=this.decode());
  }catch(e){this.wanted=false;this.loading=null;this.onchange?.();throw e;}
  if(this.wanted&&!this.source){this.begin();this.onchange?.();}
 }
 pause(){
  this.wanted=false;
  if(this.source){this.offset=this.currentTime;this.halt();}
  this.onchange?.();
 }
 dispose(){this.onchange=null;this.wanted=false;this.halt();this.gain?.disconnect();this.gain=null;this.buffer=null;}

 private get duration(){return this.buffer?.duration??this.durationMs/1000;}
 private async decode(){
  const ctx=uiAudio.context!;
  return ctx.decodeAudioData(await this.blob.arrayBuffer());
 }
 private begin(){
  const ctx=uiAudio.context;
  if(!ctx||!this.buffer)return;
  if(this.offset>=this.buffer.duration-.01)this.offset=0;
  if(!this.gain){this.gain=ctx.createGain();this.gain.gain.value=uiAudio.settings.bgm;this.gain.connect(ctx.destination);}
  const source=ctx.createBufferSource();
  source.buffer=this.buffer;source.connect(this.gain);
  // Reaching the end pauses at the end, like a media element.
  source.onended=()=>{if(this.source===source){this.source=null;this.wanted=false;this.offset=this.duration;this.onchange?.();}};
  this.startedAt=ctx.currentTime;
  source.start(0,this.offset);
  this.source=source;
 }
 private halt(){
  const source=this.source;
  this.source=null;
  if(!source)return;
  source.onended=null;
  try{source.stop();}catch{/* already stopped */}
  source.disconnect();
 }
}
