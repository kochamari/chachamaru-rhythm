import {header,escape,toast} from '../app/ui';
import {state} from '../app/store';
import {input,uiAudio} from '../app/context';
import {saveSettings} from '../storage/Database';
import {ClockBridge} from '../audio/ClockBridge';
import {renderWood} from '../audio/synth';
import {GREAT_MS,OK_MS} from '../game/Engine';
import {estimateDelay,nearestBeat,beatOffset,SYNC_PERIOD_MS,SYNC_BEATS,SYNC_WARMUP,SYNC_MIN_HITS} from '../game/sync';
import {outputNames,timingOf,useOutput,setTiming,clampDelay,signedMs,OUTPUTS} from '../app/output';
import type {Input} from '../input/InputRouter';

declare const __TEST__:boolean;

// 音ズレ合わせ: pick the sound output, hit along with a steady beat to measure
// how late its sound arrives, then check it on a small lane and fine-tune.
// The value is the output's audioDelayMs, which moves notes and judgement
// together, so the notes meet the circle when the sound is heard.

const LEAD_S=.9;
const LANE_TRAVEL_MS=1400;

/** A steady wood-block beat on the shared AudioContext, and the game's clock for it. */
class Beat {
 readonly clock:ClockBridge;readonly t0:number;
 private out:GainNode;private sources:AudioBufferSourceNode[]=[];private scheduled=0;
 private buffers:[AudioBuffer,AudioBuffer];
 constructor(private ctx:AudioContext,volume:number){
  this.clock=new ClockBridge(ctx);
  this.out=ctx.createGain();this.out.gain.value=volume;this.out.connect(ctx.destination);
  const buffer=(data:Float32Array)=>{const b=ctx.createBuffer(1,data.length,ctx.sampleRate);b.copyToChannel(data as Float32Array<ArrayBuffer>,0);return b;};
  this.buffers=[buffer(renderWood(ctx.sampleRate,false)),buffer(renderWood(ctx.sampleRate,true))];
  this.t0=ctx.currentTime+LEAD_S;
 }
 /** Schedules beats up to (not including) `until`. */
 schedule(until:number){
  for(;this.scheduled<until;this.scheduled++){
   const s=this.ctx.createBufferSource();s.buffer=this.buffers[this.scheduled%4===0?0:1];s.connect(this.out);
   s.onended=()=>{s.disconnect();this.sources=this.sources.filter(x=>x!==s);};
   s.start(this.t0+this.scheduled*SYNC_PERIOD_MS/1000);this.sources.push(s);
  }
 }
 /** Milliseconds since the first beat on the game's audio clock, for a performance time. */
 ms(performanceMs:number){return 1000*(this.clock.audioAt(performanceMs)-this.t0);}
 /** The beat number that is due now (heard by the browser's estimate). */
 current(){return Math.floor(this.ms(performance.now())/SYNC_PERIOD_MS);}
 stop(){for(const s of this.sources){s.onended=null;try{s.stop();}catch{/* not started */}s.disconnect();}this.sources=[];this.out.disconnect();}
}

export function syncScreen(root:HTMLElement,backParam:string|null):()=>void{
 const s=state.settings;
 const back=backParam&&/^#\/(?!sync)[\w/?=&%.-]*$/.test(backParam)?backParam:'#/settings';
 let beat:Beat|null=null,mode:'idle'|'measure'|'check'='idle',timer=0,raf=0,hits:number[]=[],checks:number[]=[],undo:number|null=null,flashTimer=0;
 const counted=new Set<number>();let disposed=false;
 const outputs=()=>outputNames(s).map(([k,v])=>`<button type="button" role="radio" data-output="${escape(k)}" aria-checked="${k===s.profile}"><span>${escape(v)}</span><small>${signedMs(timingOf(s,k).audioDelayMs)}</small></button>`).join('');
 root.innerHTML=`${header('settings')}<section class="page sync-page"><div class="page-heading"><div><span class="eyebrow">Bluetoothでも、音と音符をぴったりに。</span><h1>音ズレ合わせ</h1><p>Bluetoothで音を飛ばすと、音が少し遅れて届きます。聞こえた音に合わせて叩くだけで、その遅れを測ってゲームを合わせます。</p></div><a class="button" id="sync-back" href="${escape(back)}">もどる</a></div>
  <div class="sync-steps">
   <section class="paper"><h2><b class="step">1</b>音を出している機器</h2>
    <div class="output-choices" role="radiogroup" aria-label="音の出力">${outputs()}</div>
    <p class="sync-note">いま音が出ている機器を選んでください。機器ごとに合わせた値を覚えるので、次からは選ぶだけです。</p></section>
   <section class="paper"><h2><b class="step">2</b>音に合わせて叩く<small>約15秒</small></h2>
    <p>「コッ、コッ、コッ…」と一定のリズムが鳴ります。<b>聞こえた音にぴったり合わせて</b>、遊ぶときと同じもの（電子ドラムのスネア・下の大きなボタン・キーボードのF/J）で叩いてください。音だけを聞けば大丈夫です。</p>
    <div class="sync-pad" data-pad="don" role="button" aria-label="音に合わせてここを叩く"><strong id="sync-count">「はかる」を押してください</strong><small id="sync-sub">最初の${SYNC_WARMUP}回は慣らし（数えません）</small><i class="sync-progress" id="sync-progress"></i></div>
    <div class="inline-actions"><button class="primary" id="sync-start">はかる</button><button id="sync-stop" hidden>やめる</button><button id="sync-undo" hidden>元に戻す</button></div>
    <p id="sync-result" class="sync-result" role="status"></p></section>
   <section class="paper"><h2><b class="step">3</b>たしかめる・微調整</h2>
    <p>音符が丸に重なった瞬間に音が聞こえればOK。音に合わせて叩くと、早い・遅いが出ます。</p>
    <canvas id="sync-lane" class="sync-lane" aria-label="たしかめ用のレーン"></canvas>
    <div class="sync-judge" id="sync-judge" aria-live="polite"></div>
    <div class="sync-adjust"><button data-nudge="-10">−10</button><button data-nudge="-5">−5</button><output id="sync-delay"></output><button data-nudge="5">＋5</button><button data-nudge="10">＋10</button></div>
    <p class="sync-note">音符より音が<b>遅れて</b>聞こえる → ＋ ／ 音が<b>先に</b>聞こえる → −</p>
    <div class="inline-actions"><button id="check-start">試し叩きをはじめる</button><button id="check-stop" hidden>止める</button><button id="check-apply" hidden>叩いた平均に合わせる</button></div></section>
  </div></section>`;
 const $=<T extends HTMLElement>(q:string)=>root.querySelector<T>(q)!;
 const count=$('#sync-count'),sub=$('#sync-sub'),progress=$('#sync-progress'),result=$('#sync-result'),start=$<HTMLButtonElement>('#sync-start'),stopButton=$<HTMLButtonElement>('#sync-stop'),undoButton=$<HTMLButtonElement>('#sync-undo');
 const lane=$<HTMLCanvasElement>('#sync-lane'),judge=$('#sync-judge'),delayOut=$('#sync-delay'),checkStart=$<HTMLButtonElement>('#check-start'),checkStop=$<HTMLButtonElement>('#check-stop'),checkApply=$<HTMLButtonElement>('#check-apply');

 const persist=()=>saveSettings(s).catch(()=>toast('設定を保存できませんでした'));
 const showDelay=()=>{
  delayOut.textContent=`音の遅れ ${signedMs(s.audioDelayMs)}`;
  root.querySelectorAll<HTMLElement>('[data-output]').forEach(b=>{b.setAttribute('aria-checked',String(b.dataset.output===s.profile));b.querySelector('small')!.textContent=signedMs(timingOf(s,b.dataset.output!).audioDelayMs);});
 };
 const setDelay=(ms:number)=>{setTiming(s,{audioDelayMs:clampDelay(ms)});showDelay();void persist();};
 root.querySelectorAll<HTMLElement>('[data-output]').forEach(b=>b.onclick=()=>{useOutput(s,b.dataset.output!);undo=null;undoButton.hidden=true;result.textContent='';showDelay();void persist();});
 root.querySelectorAll<HTMLElement>('[data-nudge]').forEach(b=>b.onclick=()=>setDelay(s.audioDelayMs+Number(b.dataset.nudge)));

 function stop(){
  clearInterval(timer);cancelAnimationFrame(raf);beat?.stop();beat=null;
  const was=mode;mode='idle';
  start.hidden=false;start.disabled=false;stopButton.hidden=true;checkStart.hidden=false;checkStop.hidden=true;
  root.classList.remove('sync-running');
  if(was==='measure'){count.textContent='「はかる」を押してください';sub.textContent=`最初の${SYNC_WARMUP}回は慣らし（数えません）`;progress.style.transform='scaleX(0)';}
 }
 async function begin(next:'measure'|'check'){
  stop();
  await uiAudio.unlock();await uiAudio.settle();
  const ctx=uiAudio.context;if(!ctx||ctx.state!=='running'){toast('音を出せませんでした。もう一度押してください');return;}
  if(disposed)return;
  beat=new Beat(ctx,Math.max(.35,s.bgm));mode=next;root.classList.add('sync-running');
  start.hidden=next==='measure';stopButton.hidden=next!=='measure';start.disabled=next==='check';
  checkStart.hidden=next==='check';checkStop.hidden=next!=='check';
  hits=[];checks=[];counted.clear();
  if(next==='measure'){
   beat.schedule(SYNC_BEATS);undoButton.hidden=true;result.textContent='';
   count.textContent='音に合わせて叩いてください';sub.textContent=`0 / ${SYNC_BEATS - SYNC_WARMUP}`;
   // Room after the last beat for a late hit (up to the measured range).
   const began=performance.now(),total=LEAD_S*1000+(SYNC_BEATS-1)*SYNC_PERIOD_MS+650;
   const tick=()=>{if(mode!=='measure')return;const done=Math.min(1,(performance.now()-began)/total);progress.style.transform=`scaleX(${done})`;if(done<1)raf=requestAnimationFrame(tick);else finishMeasure();};
   raf=requestAnimationFrame(tick);
  }else{
   judge.textContent='音に合わせて叩いてみてください';checkApply.hidden=true;
   const keepAhead=()=>{if(beat&&mode==='check')beat.schedule(Math.max(0,beat.current())+6);};
   keepAhead();timer=window.setInterval(keepAhead,250);
   raf=requestAnimationFrame(drawLane);
  }
 }
 function finishMeasure(){
  const estimate=estimateDelay(hits);
  stop();
  if(!estimate){result.textContent=`うまく測れませんでした。音に合わせて${SYNC_MIN_HITS}回以上叩いてください（叩けた回数 ${Math.max(0,hits.length-SYNC_WARMUP)}）。`;return;}
  undo=s.audioDelayMs;
  const had=s.inputLagMs;
  setTiming(s,{audioDelayMs:clampDelay(estimate.delayMs),inputLagMs:0});showDelay();void persist();
  const name=OUTPUTS[s.profile]??s.profile;
  result.innerHTML=`測った遅れは <b>${estimate.delayMs}ms</b>（ばらつき ±${estimate.spreadMs}ms、叩き方のくせも含みます）。「${escape(name)}」の音の遅れにしました。`
   +(estimate.delayMs>500?'<br>500msより大きいため、500msにしました。':'')
   +(estimate.spreadMs>35?'<br>ばらつきが大きめです。もう一度はかると安定します。':'')
   +(had?'<br>入力の補正は0に戻しました（この値にまとめて合わせます）。':'')
   +'<br>下の「たしかめる」で、音符と音が合っているか確かめられます。';
  undoButton.hidden=false;undoButton.textContent=`元に戻す（${signedMs(undo)}）`;
 }
 function drawLane(){
  if(mode!=='check'||!beat)return;
  const dpr=Math.min(2,devicePixelRatio||1),w=lane.clientWidth||300,h=lane.clientHeight||110;
  if(lane.width!==Math.round(w*dpr)||lane.height!==Math.round(h*dpr)){lane.width=Math.round(w*dpr);lane.height=Math.round(h*dpr);}
  const g=lane.getContext('2d');if(!g){return;}
  g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
  const hitX=Math.min(90,w*.18),cy=h/2,r=Math.min(26,h*.26);
  g.fillStyle='#2d1b2e';g.fillRect(0,0,w,h);
  g.lineWidth=4;g.strokeStyle='#d9d2c4';g.beginPath();g.arc(hitX,cy,r+6,0,Math.PI*2);g.stroke();
  let now:number;
  try{now=beat.ms(performance.now())-s.audioDelayMs+s.visualAdvanceMs;}catch{raf=requestAnimationFrame(drawLane);return;}
  const speed=(w-hitX)/LANE_TRAVEL_MS;
  const first=Math.floor((now-hitX/speed)/SYNC_PERIOD_MS),last=Math.ceil((now+LANE_TRAVEL_MS)/SYNC_PERIOD_MS);
  for(let k=Math.max(0,first);k<=last;k++){
   const x=hitX+(k*SYNC_PERIOD_MS-now)*speed;if(x<-r||x>w+r)continue;
   g.beginPath();g.arc(x,cy,k%4===0?r*1.2:r,0,Math.PI*2);g.fillStyle=k%4===0?'#f35a43':'#2cbbd5';g.fill();g.lineWidth=3;g.strokeStyle='#fff2ce';g.stroke();
  }
  raf=requestAnimationFrame(drawLane);
 }
 /** The player's own hit, shown on the pad (never a cue for the beat). */
 function flash(){const pad=root.querySelector<HTMLElement>('.sync-pad');if(!pad)return;pad.classList.add('hit');clearTimeout(flashTimer);flashTimer=window.setTimeout(()=>pad.classList.remove('hit'),110);}
 function onHit(i:Input){
  if(!beat||mode==='idle')return;
  let ms:number;try{ms=beat.ms(i.performanceMs);}catch{return;}
  flash();
  if(mode==='measure'){
   hits.push(ms);
   const {beat:k}=beatOffset(ms);
   if(k>=SYNC_WARMUP&&k<SYNC_BEATS)counted.add(k);
   count.textContent=k<SYNC_WARMUP?'慣らし中（まだ数えません）':'そのまま、音に合わせて';
   sub.textContent=`${counted.size} / ${SYNC_BEATS-SYNC_WARMUP}`;
   return;
  }
  // Check: judged like the play screen (same clock and corrections).
  const delta=Math.round(nearestBeat(beat.ms(i.performanceMs-s.inputLagMs)-s.audioDelayMs));
  checks=[...checks.slice(-7),delta];
  const word=Math.abs(delta)<=GREAT_MS?'良':Math.abs(delta)<=OK_MS?'可':'ずれ';
  const avg=Math.round(checks.reduce((a,b)=>a+b,0)/checks.length);
  judge.innerHTML=`<b class="${word==='良'?'great':word==='可'?'ok':'bad'}">${word}</b> ${delta>0?'遅い':delta<0?'早い':'ぴったり'} ${signedMs(delta)}<small>直近${checks.length}回の平均 ${signedMs(avg)}</small>`;
  checkApply.hidden=checks.length<6||Math.abs(avg)<5;
  checkApply.textContent=`叩いた平均に合わせる（${signedMs(avg)}）`;
  checkApply.onclick=()=>{setDelay(s.audioDelayMs+avg);checks=[];checkApply.hidden=true;judge.textContent=`${signedMs(avg)} 合わせました。続けて叩いて確かめられます`;};
 }
 input.onHit=onHit;
 start.onclick=()=>void begin('measure');
 stopButton.onclick=()=>{stop();result.textContent='測るのをやめました。';};
 undoButton.onclick=()=>{if(undo===null)return;setDelay(undo);result.textContent=`元に戻しました（${signedMs(undo)}）。`;undo=null;undoButton.hidden=true;};
 checkStart.onclick=()=>void begin('check');
 checkStop.onclick=()=>{stop();judge.textContent='';};
 showDelay();
 // Test hook: the scheduled beats' times on the same clock the hits use.
 if(__TEST__)Object.assign(window,{__sync:{beatPerformanceMs:(k:number)=>beat?(beat.t0+k*SYNC_PERIOD_MS/1000-(beat.clock.audioAt(performance.now())-performance.now()/1000))*1000:NaN,get mode(){return mode;}}});
 return ()=>{disposed=true;stop();clearTimeout(flashTimer);input.onHit=()=>{};};
}
