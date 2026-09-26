import type {Chart,SongPackage,RunResult,InputMode,Roll} from '../../../contracts/public-types';
import {Engine,RULESET} from './Engine';
import {AudioEngine,sharedAudioContext} from '../audio/AudioEngine';
import {InputRouter,type Input} from '../input/InputRouter';
import {PlayRenderer,stageThemeFor} from '../render/PlayRenderer';
import {state,difficultyNames} from '../app/store';
import {escape,toast} from '../app/ui';
import {saveRun,saveSettings} from '../storage/Database';
import {adoptDrum} from '../app/drumMode';
import {lockZoom} from '../app/zoom';
import {outputOptions,useOutput,setTiming,clampDelay,signedMs} from '../app/output';
import {BoneCounter,feverLevel,finishBones,drawFriends,mergeBonuses,drawSlot,xpForRun} from './festival';
import {cryptoRandom} from './gacha';
import {awardBones,loadFestival} from '../storage/festival';

export type SessionStatus='LOADING'|'READY'|'COUNT_IN'|'PLAYING'|'PAUSED'|'FINISHING'|'RESULT'|'LOAD_ERROR'|'SHOWCASE';
const AUTO_ROLL_INTERVAL_MS=80;

/**
 * One run of one chart: owns the engine, audio and renderer for that run and
 * wires inputs to them. Everything is released in dispose().
 */
export class Session {
 readonly engine:Engine;readonly audio:AudioEngine;readonly renderer:PlayRenderer;
 runId=crypto.randomUUID();status:SessionStatus='LOADING';mode:InputMode;autoplay=false;practice=false;
 private pausedAt=0;private frame=0;private disposed=false;private done=false;private autoIndex=0;private autoRollAt=-1e9;
 private celebrated=false;private countShown=-1;private finishTimer=0;
 /** Player hits judged so far, and whether the screen is set up for the electronic drum. */
 private judged=0;private drumUi=false;
 /** ほねっこ for this run (normal play only), and the festival moments that get a sound. */
 private readonly rewards:boolean;private readonly boneCounter=new BoneCounter();private fever=0;
 /** The four friends of this run (a slot draw; rare coats found in しばガチャ come more often). */
 private readonly friendDraw:Promise<{coats:string[];owned:Readonly<Record<string,number>>}>;
 private abort=new AbortController();private wake:WakeLockSentinel|null=null;
 /** The play screen never zooms (pinch, double tap, focus on a small field). */
 private readonly unlockZoom=lockZoom();
 private readonly scene:HTMLElement;
 onResult:(r:RunResult)=>void=()=>{};
 private visibility=()=>{if(document.hidden)this.pause('別の画面に移動したため一時停止しました');};

 constructor(private root:HTMLElement,readonly pack:SongPackage,readonly chart:Chart,private input:InputRouter,opts:{autoplay?:boolean;practice?:boolean;startMs?:number;decoded?:AudioBuffer|null}={}){
  // Practice from a later position judges only the notes that are still ahead.
  const startMs=Math.max(0,opts.startMs??0);
  const ahead=startMs>0?chart.notes.filter(n=>(n.kind==='roll'?n.endMs:n.timeMs)+chart.offsetMs>=startMs):chart.notes;
  this.engine=new Engine(startMs>0&&ahead.some(n=>n.kind==='tap')?{...chart,notes:ahead}:chart,this.runId);
  this.audio=new AudioEngine(state.settings);
  // Reuse the buffer decoded for the song-select preview (same AudioContext).
  if(opts.decoded)this.audio.buffer=opts.decoded;
  this.mode=state.settings.inputMode;
  this.autoplay=opts.autoplay??false;this.practice=opts.practice??false;
  this.pausedAt=Math.max(0,opts.startMs??0);
  this.rewards=!this.autoplay&&!this.practice;
  this.friendDraw=loadFestival().then(f=>f.owned).catch(()=>({})).then(owned=>({owned,coats:drawFriends(cryptoRandom,owned)}));
  void this.friendDraw.then(d=>this.boneCounter.setFriends(d.coats));
  const inputMode=this.mode==='mixed'?'keyboard':this.mode;
  this.drumUi=inputMode==='midi';
  root.innerHTML=`<section class="game-scene mode-${inputMode}" aria-label="演奏画面">
   <button class="pause-button" aria-label="一時停止"><span></span><span></span></button>
   <div class="pads" aria-label="太鼓の打面">
    <div class="pad ka rim-left" role="button" data-pad="ka" data-side="left" aria-label="カッ（左のふち）"><span>カッ</span><small>D</small></div>
    <div class="pad don skin-left" role="button" data-pad="don" data-side="left" aria-label="ドン（左の面）"><span>ドン</span><small>F</small></div>
    <div class="pad don skin-right" role="button" data-pad="don" data-side="right" aria-label="ドン（右の面）"><span>ドン</span><small>J</small></div>
    <div class="pad ka rim-right" role="button" data-pad="ka" data-side="right" aria-label="カッ（右のふち）"><span>カッ</span><small>K</small></div>
   </div>
   <div class="play-overlay"><div class="play-dialog"><span class="eyebrow">準備しています</span><h2>曲を読み込み中…</h2></div></div>
   <button class="rotate-hint">横向きにすると、もっと遊びやすくなります <b>×</b></button>
   ${this.autoplay?'<div class="auto-badge" role="status"><b>おてほん再生中</b><span>自動で叩いています（記録されません）</span></div>':''}
  </section>`;
  this.scene=root.querySelector<HTMLElement>('.game-scene')!;
  const tag=this.autoplay?'AUTO':this.practice?'練習':'';
  this.renderer=new PlayRenderer(this.scene,{chart,manifest:pack.manifest,settings:state.settings,difficulty:chart.difficulty,title:pack.manifest.title,artist:pack.manifest.artist,showPads:inputMode==='touch',tag,inputHint:inputMode,theme:stageThemeFor(pack.manifest.packId),rewards:this.rewards,friends:()=>this.friendDraw,onSound:name=>this.audio.effect(name)});
  const signal=this.abort.signal;
  this.scene.querySelector('.pause-button')!.addEventListener('click',()=>this.pause(),{signal});
  this.scene.querySelector('.rotate-hint')!.addEventListener('click',e=>(e.currentTarget as HTMLElement).remove(),{signal});
  this.input.onHit=i=>this.hit(i);
  this.input.onPause=()=>this.pause();
  this.audio.onSuspend(()=>this.pause('音声が停止したため一時停止しました'));
  document.addEventListener('visibilitychange',this.visibility);
  this.scene.addEventListener('webglcontextlost',e=>{e.preventDefault();this.pause('描画を再開するには曲一覧から読み直してください');},{signal,capture:true});
  window.addEventListener('keydown',e=>{if(this.status==='READY'&&(e.code==='Enter'||e.code==='Space')&&!(e.target instanceof HTMLButtonElement)){e.preventDefault();void this.start();}},{signal});
 }

 async init(){
  await this.renderer.init();
  if(this.disposed)return;
  this.status='READY';
  this.readyOverlay();
  this.frame=requestAnimationFrame(this.drawFrame);
 }

 private readyOverlay(){
  const how=this.mode==='touch'?'太鼓の面でドン、ふちでカッ！':this.drumUi?'スネアでドン、フロアタムでカッ！':'F・J でドン、D・K でカッ！';
  if(this.autoplay)this.overlay('おてほん（自動演奏）',`${difficultyNames[this.chart.difficulty]}｜ちゃちゃまるが自動で叩きます。\nあなたの入力は判定・記録されません。`,'演奏をはじめる',()=>void this.start());
  else this.overlay('準備はいい？',`${difficultyNames[this.chart.difficulty]}｜${how}\n音符が丸に重なったら叩こう。`,'演奏をはじめる',()=>void this.start());
 }

 /** Touch drum, key hint and layout for one input; the audio uses the drum-module volume for MIDI. */
 private showMode(mode:'touch'|'keyboard'|'midi'){
  for(const m of ['touch','keyboard','midi'])this.scene.classList.toggle('mode-'+m,m===mode);
  this.drumUi=mode==='midi';
  this.renderer.setInput(mode);this.audio.volume();
 }

 /**
  * The electronic drum was hit while the screen was set up for another
  * input: switch to drum play. A run that already judged other hits keeps
  * counting as mixed input.
  */
 private useDrum(){
  adoptDrum();
  if(this.mode!=='mixed')this.mode=this.judged?'mixed':'midi';
  this.showMode('midi');
  if(this.status==='READY')this.readyOverlay();
 }

 private overlay(title:string,body:string,label:string,action:()=>void,paused=false){
  const overlay=this.scene.querySelector<HTMLElement>('.play-overlay')!;
  overlay.hidden=false;
  const [path,query]=location.hash.split('?');const params=new URLSearchParams(query);params.set('retry',String(Date.now()));
  const retry=escape(path+'?'+params.toString());
  overlay.innerHTML=`<div class="play-dialog ${paused?'is-paused':''}">
   <span class="eyebrow">${paused?'ひとやすみ中':escape(this.pack.manifest.title)}</span>
   <h2>${escape(title)}</h2><p>${escape(body).replace(/\n/g,'<br>')}</p>
   ${paused?'':`<div class="note-legend" aria-label="音符の見かた"><span><i class="n don"></i>ドン</span><span><i class="n ka"></i>カッ</span><span><i class="n don big"></i>大きい音符も1回</span><span><i class="n roll"></i>連打はたくさん</span></div>`}
   <button class="primary" id="resume-play">${escape(label)}</button>
   ${paused?`<div class="pause-options"><label>操作 <select id="pause-mode"><option value="touch">タッチ</option><option value="keyboard">キーボード</option><option value="midi">電子ドラム</option></select></label><a class="button" href="${retry}">最初から</a>${this.autoplay?`<a class="button primary" id="play-myself" href="${escape(path+'?retry='+Date.now())}">自分であそぶ</a>`:''}</div>`:`<p class="dialog-hint">${this.drumUi?'スネア（ドン）を叩いても、はじめられます':this.mode==='keyboard'?'Enter でもはじめられます':''}</p>`}
   <div class="dialog-output"><label>音の出力 <select id="dialog-output">${outputOptions(state.settings,escape)}</select></label>${paused?`<span class="delay-nudge">音の遅れ <button type="button" data-nudge="-10" aria-label="音の遅れを10ms減らす">−10</button><output id="dialog-delay">${signedMs(state.settings.audioDelayMs)}</output><button type="button" data-nudge="10" aria-label="音の遅れを10ms増やす">＋10</button></span>`:''}<a class="text-link" href="${escape('#/sync?back='+encodeURIComponent(location.hash))}">音ズレ合わせ</a></div>
   <a class="text-link" href="#/songs">曲一覧に戻る</a></div>`;
  overlay.querySelector('#resume-play')!.addEventListener('click',action);
  (overlay.querySelector('#resume-play') as HTMLButtonElement).focus({preventScroll:true});
  // Sound output and its delay: a different output loads its own timing;
  // while paused, ±10 ms nudges apply when the song resumes.
  const output=overlay.querySelector<HTMLSelectElement>('#dialog-output')!,delay=overlay.querySelector<HTMLElement>('#dialog-delay');
  const saved=()=>{void saveSettings(state.settings).catch(()=>{});output.innerHTML=outputOptions(state.settings,escape);if(delay)delay.textContent=signedMs(state.settings.audioDelayMs);};
  output.onchange=()=>{useOutput(state.settings,output.value);saved();};
  overlay.querySelectorAll<HTMLElement>('[data-nudge]').forEach(b=>b.onclick=()=>{setTiming(state.settings,{audioDelayMs:clampDelay(state.settings.audioDelayMs+Number(b.dataset.nudge))});saved();});
  const select=overlay.querySelector<HTMLSelectElement>('#pause-mode');
  if(select){
   select.value=state.settings.inputMode==='mixed'?'keyboard':state.settings.inputMode;
   select.onchange=()=>{
    state.settings.inputMode=select.value as InputMode;this.mode='mixed';
    this.showMode(select.value as 'touch');
   };
  }
 }

 async start(){
  if(!['READY','PAUSED','LOAD_ERROR'].includes(this.status))return;
  try{
   this.status='LOADING';
   await this.audio.unlock();
   if(!this.audio.buffer)await this.audio.load(this.pack.audio);
   await this.audio.settle();
   if(this.disposed)return;
   this.audio.start(this.pausedAt);
   this.engine.active=false;this.status='COUNT_IN';this.countShown=-1;
   this.input.clear();
   this.scene.querySelector<HTMLElement>('.play-overlay')!.hidden=true;
   try{if('wakeLock' in navigator)this.wake=await navigator.wakeLock.request('screen');}catch{/* optional API */}
  }catch(err){
   this.status='LOAD_ERROR';
   this.overlay('曲を再生できませんでした',err instanceof Error?err.message:String(err),'もう一度読み込む',()=>void this.start());
  }
 }

 private hit(i:Input){
  if(i.source==='midi'&&!this.drumUi&&this.status!=='SHOWCASE')this.useDrum();
  if(this.status==='READY'&&i.color==='don'&&i.source==='keyboard'){void this.start();return;}
  // A drum hit is not a tap: it can start the song only once the phone has
  // allowed sound (any earlier tap in the menus does that).
  if(this.status==='READY'&&i.color==='don'&&i.source==='midi'){
   if(sharedAudioContext()?.state==='running')void this.start();
   else this.readyHint('音を出すため、最初の1回だけ「演奏をはじめる」をタップしてください');
   return;
  }
  if(!['READY','COUNT_IN','PLAYING'].includes(this.status))return;
  this.audio.hit(i.color);
  let t=0;
  try{t=this.audio.time(i.performanceMs);}catch{this.pause('音声時計を再確認してください');return;}
  this.renderer.hit(i.color,Math.max(-2000,t),i.side);
  if(this.autoplay){this.autoNudge();return;}
  if(this.status!=='PLAYING'||this.autoplay)return;
  if(i.source!==state.settings.inputMode&&this.mode!=='mixed'){this.mode='mixed';}
  this.judged++;
  this.engine.hit({id:i.id,runId:this.runId,color:i.color,inputSongMs:this.audio.time(i.performanceMs-state.settings.inputLagMs),receiptSongMs:this.audio.time(i.receiptMs),deliveryDelayMs:i.receiptMs-i.performanceMs,source:i.source});
 }

 private readyHint(text:string){
  const hint=this.scene.querySelector<HTMLElement>('.dialog-hint');if(!hint)return;
  hint.textContent=text;hint.classList.remove('nudge');void hint.offsetWidth;hint.classList.add('nudge');
 }

 /** The player hits during an example run: say so (their hits do not count). */
 private autoNudge(){
  const badge=this.scene.querySelector<HTMLElement>('.auto-badge');if(!badge)return;
  badge.querySelector('span')!.textContent='自分で叩くときは ⏸ →「自分であそぶ」';
  badge.classList.remove('nudge');void badge.offsetWidth;badge.classList.add('nudge');
 }
 pause(reason='曲の続きから、2秒のカウントで再開します。'){
  if(!['PLAYING','COUNT_IN'].includes(this.status))return;
  try{this.pausedAt=Math.max(this.pausedAt,Math.max(0,this.audio.time()));}catch{/* Keep the last safe position when the clock is unavailable. */}
  this.engine.active=false;this.status='PAUSED';
  this.audio.stop();this.input.clear();
  void this.wake?.release();this.wake=null;
  this.renderer.hideMessage();
  this.overlay('ひとやすみ',reason,'つづきから',()=>void this.start(),true);
 }

 private drawFrame=()=>{
  if(this.disposed)return;
  let t=this.pausedAt;
  if(this.status==='PLAYING'||this.status==='COUNT_IN'||this.status==='FINISHING'){
   try{t=this.audio.time();}catch{this.pause('音声時計が停止しました。もう一度再開してください');}
  }
  if(this.status==='COUNT_IN'){
   const left=Math.ceil((this.pausedAt-t)/1000);
   if(left!==this.countShown&&left>0){this.countShown=left;this.renderer.showMessage(String(left),this.pausedAt>0?'つづきから':'音に合わせて、ドン・カッ！');this.audio.effect('count');this.renderer.countBeat();}
   if(t>=this.pausedAt){this.status='PLAYING';this.engine.active=true;this.renderer.showMessage('はじめ！','');this.renderer.startBurst();}
  }
  if(this.status==='PLAYING'){
   if(this.autoplay)this.autoPlay(t);
   this.engine.advance(t);
  }
  const s=this.engine.snapshot(),events=this.engine.takeEvents();
  for(const e of events){
   if(e.kind==='combo')this.audio.chime(e.value!>=100?3:e.value!>=50?2:1);
  }
  if(this.rewards)this.boneCounter.add(events,s.gauge);
  // FEVER at 30 combo, SUPER FEVER at 100: a rising run each time it goes up.
  const fever=feverLevel(s.combo);
  if(fever>this.fever&&this.status==='PLAYING')this.audio.effect('fever');
  this.fever=fever;
  if(s.finished&&!this.celebrated&&this.status==='PLAYING'&&!this.practice){
   this.celebrated=true;
   if(s.allGreat){this.renderer.celebrate('allGreat');this.audio.effect('allGreat');}
   else if(s.fullCombo){this.renderer.celebrate('fullCombo');this.audio.effect('fullCombo');}
  }
  // Bones from play; the renderer adds the friends' bonuses as their reels stop.
  this.renderer.draw(t,s,events,this.rewards?this.boneCounter.play:undefined);
  if(this.status==='PLAYING'&&t>=this.pack.manifest.durationMs+170&&this.audio.ended&&s.finished&&!this.done)this.finish();
  this.frame=requestAnimationFrame(this.drawFrame);
 };

 private autoPlay(t:number){
  const offset=this.chart.offsetMs;
  while(this.autoIndex<this.engine.taps.length&&this.engine.taps[this.autoIndex].timeMs+offset<=t){
   const n=this.engine.taps[this.autoIndex++],target=n.timeMs+offset;
   if(target<this.pausedAt&&this.practice)continue;
   this.engine.hit({id:'auto-'+n.id,runId:this.runId,color:n.color,inputSongMs:target,receiptSongMs:target,source:this.mode});
   this.audio.hit(n.color);this.renderer.hit(n.color,t);
  }
  const roll=this.engine.rolls.find((r:Roll)=>t>=r.timeMs+offset&&t<r.endMs+offset-20);
  if(roll&&t-this.autoRollAt>=AUTO_ROLL_INTERVAL_MS){
   this.autoRollAt=t;const color=Math.floor(t/AUTO_ROLL_INTERVAL_MS)%4===3?'ka':'don';
   this.engine.hit({id:`auto-roll-${Math.round(t)}`,runId:this.runId,color,inputSongMs:t,receiptSongMs:t,source:this.mode});
   this.audio.hit(color);this.renderer.hit(color,t);
  }
 }

 private finish(){
  this.done=true;this.status='FINISHING';this.engine.active=false;
  void this.wake?.release();
  const {outcomes:_outcomes,...stats}=this.engine.snapshot();
  const result:RunResult={runId:this.runId,packId:this.pack.manifest.packId,chartId:this.chart.chartId,audioHash:this.pack.manifest.audio.sha256,chartHash:this.pack.manifest.charts.find(c=>c.chartId===this.chart.chartId)!.sha256,ruleset:RULESET,inputMode:this.mode,autoplay:this.autoplay,practice:this.practice,date:new Date().toISOString(),settings:structuredClone(state.settings),stats,title:this.pack.manifest.title,difficulty:this.chart.difficulty,timingUnstable:stats.timingUnstable};
  const cleared=stats.gauge>=70;
  if(!this.celebrated){this.celebrated=true;this.renderer.celebrate(cleared?'clear':'finish');this.audio.effect(cleared?'clear':'fail');}
  // ほねっこ are paid once per finished normal run, before the result screen reads them.
  // The bonus slot on the result screen is drawn here and only shown there.
  const award=this.rewards?awardBones(this.runId,this.boneCounter.play,mergeBonuses([...this.boneCounter.bonuses,...finishBones(stats)]),{slot:drawSlot(cryptoRandom),xp:xpForRun(stats)}).catch(()=>null):Promise.resolve(null);
  const save=Promise.all([saveRun(result),award]).catch(()=>toast('結果を保存できませんでした。ストレージ容量を確認してください'));
  this.finishTimer=window.setTimeout(()=>{void save.then(()=>{this.audio.stop();this.status='RESULT';if(!this.disposed)this.onResult(result);});},1500);
 }

 showcaseSnapshot(time:number,combo:number,gauge=0){
  if(!import.meta.env.DEV)return;
  this.scene.querySelector('.auto-badge')?.remove();
  this.practice=true;this.autoplay=true;this.pausedAt=time;this.status='SHOWCASE';this.engine.active=true;
  for(const n of this.engine.taps.slice(0,combo))this.engine.hit({id:'fixture-'+n.id,runId:this.runId,color:n.color,inputSongMs:n.timeMs+this.chart.offsetMs,receiptSongMs:n.timeMs+this.chart.offsetMs,source:'keyboard'});
  void gauge;
  this.engine.active=false;
  this.scene.querySelector<HTMLElement>('.play-overlay')!.hidden=true;
 }

 dispose(){
  this.unlockZoom();
  this.disposed=true;cancelAnimationFrame(this.frame);clearTimeout(this.finishTimer);this.abort.abort();
  document.removeEventListener('visibilitychange',this.visibility);
  this.input.onHit=()=>{};this.input.onPause=()=>{};this.input.clear();
  this.audio.dispose();this.renderer.dispose();void this.wake?.release();
 }
}
