import type {RunResult} from '../../../contracts/public-types';
import {header,escape} from '../app/ui';
import {difficultyNames} from '../app/store';
import {Character,flowerSvg,crownSvg} from '../render/Character';
import {recordEligible} from '../storage/Database';
import {previousBest,crownOf} from '../app/records';
import {nav,uiAudio,memory} from '../app/context';
import {loadFestival} from '../storage/festival';
import {nearMiss,fortuneFor} from '../game/festival';
import {rewardsHtml,playRewards} from './rewards';
import {closeShutter} from '../app/shutter';

function timingSummary(values:readonly number[]){
 if(!values.length)return '命中した音符のタイミングデータがありません。';
 const a=[...values].sort((x,y)=>x-y);const median=a[Math.floor(a.length/2)];
 const early=values.filter(v=>v<-20).length,late=values.filter(v=>v>20).length;
 return `中央値 ${median<0?'はやめ':'おそめ'} ${Math.abs(median).toFixed(1)}ms ／ ${a.length}打（はやい ${early}・おそい ${late}）`;
}

export async function resultScreen(root:HTMLElement,r:RunResult):Promise<()=>void>{
 const s=r.stats;
 const crown=crownOf(r);
 const cleared=s.gauge>=70;
 const title=crown==='ag'?'全 良！':crown==='fc'?'フルコンボ！':cleared?'クリア！':'ざんねん…';
 const cls=crown==='ag'?'ag':crown==='fc'?'fc':cleared?'clear':'fail';
 const eligible=recordEligible(r);
 const prev=eligible?await previousBest(r):null;
 const newBest=eligible&&(prev===null||s.score>prev);
 // ほねっこ paid for this run (normal play only; AUTO and practice earn none).
 const festival=await loadFestival().catch(()=>null);
 const award=festival?.awards.find(a=>a.runId===r.runId)??null;
 // One line that makes another try tempting (normal play only).
 const near=eligible?nearMiss(s,prev):null;
 // The おみくじ stamp lands after the score has counted up (normal runs that cleared).
 const fortune=!r.autoplay&&!r.practice?fortuneFor(s.score,cleared):null;
 const fortuneCls={大吉:'daikichi',中吉:'chukichi',小吉:'shokichi',吉:'kichi',末吉:'suekichi'} as const;
 const tag=r.autoplay?'AUTO · 参考記録':r.practice?'練習 · 参考記録':r.inputMode==='mixed'?'操作を途中で変更 · 参考記録':r.timingUnstable?'配送遅延あり · 参考記録':`通常プレイ · ${r.inputMode==='touch'?'タッチ':r.inputMode==='midi'?'電子ドラム':'キーボード'}`;
 const confetti=crown!=='none'&&crown!=='clear'?`<div class="confetti" aria-hidden="true">${Array.from({length:32},(_,i)=>`<i style="left:${(i*37)%100}%;background:${['#ff6b5a','#ffd86b','#6ee7ff','#7ed36f','#fff'][i%5]};animation-delay:${-(i%9)*.45}s;animation-duration:${3+i%4}s"></i>`).join('')}</div>`:'';
 root.innerHTML=`${header()}<section class="result-page ${cleared?'':'failed'} ${award?'has-rewards':''}">${confetti}
  <div class="result-dog"><span class="eyebrow">${crown==='ag'?'ひまわりの里の、名人！':crown==='fc'?'お祭りは大盛り上がり！':cleared?'ちゃちゃまるも、にっこり。':'もう一回、いっしょに叩こう！'}</span>
   <h1 class="${cls}">${title}</h1>
   <div class="result-character">${crown==='ag'?`<div class="winner-crown" aria-label="全良の王冠">${crownSvg()}</div>`:''}${crown==='fc'||crown==='ag'?`<div class="sunflower-wreath" aria-hidden="true">${Array.from({length:12},(_,i)=>`<span style="--i:${i}">${flowerSvg()}</span>`).join('')}</div>`:''}<div class="result-rig"></div></div>
   <p class="celebration">${crown==='ag'?'すべて「良」！ 完ぺきなリズムです。':crown==='fc'?'ミスなし！ 見事なリズム！':cleared?'お祭りゲージ 70% 突破！':'ゲージ70%でクリア。次はきっと！'}</p>
  </div>
  <div class="result-card">${fortune?`<div class="fortune ${fortuneCls[fortune]}" role="img" aria-label="おみくじ ${fortune}"><small>おみくじ</small><span>${fortune}</span>${Array.from({length:10},(_,i)=>`<b style="--a:${i*36+(i%2?9:0)}deg"></b>`).join('')}</div>`:''}<span class="eyebrow">演奏結果 ／ ${difficultyNames[r.difficulty]}</span>
   <h2>${escape(r.title)}</h2><span class="tag">${escape(tag)}</span> ${newBest?'<span class="new-best">自己ベスト更新！</span>':''}
   ${near?`<p class="near-miss">${escape(near)}</p>`:''}
   <div class="result-score"><span id="score-count">0</span><small>基本点 ${s.baseScore.toLocaleString()} ＋ 連打 ${s.rollBonus.toLocaleString()}${prev!==null?`　／　これまでのベスト ${prev.toLocaleString()}`:''}</small></div>
   <div class="result-stats"><div class="great"><span>良</span><strong data-count="${s.great}">0</strong></div><div class="ok"><span>可</span><strong data-count="${s.ok}">0</strong></div><div class="miss"><span>不可</span><strong data-count="${s.miss}">0</strong></div><div class="roll"><span>連打</span><strong data-count="${s.rollHits}">0</strong></div></div>
   <div class="result-gauge" aria-label="お祭りゲージ ${Math.round(s.gauge)}%"><i style="width:0%;--p:${Math.max(.01,s.gauge/100)}"></i><em></em></div>
   <div class="result-sub"><span>最大 <b>${s.maxCombo}</b> コンボ</span><span>精度 <b>${(s.accuracy*100).toFixed(1)}%</b></span><span>ゲージ <b>${Math.round(s.gauge)}%</b></span></div>
   <div class="result-actions"><button class="primary" id="retry" data-nav>${r.autoplay?'自分であそぶ ↻':'もう一度あそぶ ↻'}</button>${r.autoplay?'<button id="retry-auto" data-nav>もう一度おてほん</button>':''}<a class="button" href="#/songs" data-nav id="to-songs">曲一覧へ</a></div>
   <details class="result-detail"><summary>タイミングの詳細</summary><p>${timingSummary(s.deltas)}<br>打撃の判定差であり、機器の物理遅延の測定ではありません。<br>入力: ${r.inputMode} ／ ルール: ${r.ruleset}${r.timingUnstable?'<br>80msを超える配送遅延を検知しました。通常記録は更新していません。':''}</p></details>
  </div>${award&&festival?rewardsHtml(award,festival,`#/gacha?back=${encodeURIComponent(location.hash)}`):''}</section>`;
 memory.selected=r.packId;memory.difficulty=r.difficulty;
 // After an example (AUTO) run, "retry" means playing yourself; the example
 // has its own button, so a drum decision never loops into AUTO.
 const retry=()=>{closeShutter();location.hash=`/play/${r.packId}/${r.chartId}${!r.autoplay&&r.practice?'?practice=1':''}`;};
 root.querySelector<HTMLElement>('#retry')!.onclick=retry;
 root.querySelector<HTMLElement>('#retry-auto')?.addEventListener('click',()=>{closeShutter();location.hash=`/play/${r.packId}/${r.chartId}?auto=1`;});
 const character=new Character(root.querySelector('.result-rig')!);
 const stopAnimation=character.animate(cleared?'resultWin':'idle');
 // Tally: score rolls up, counts follow, gauge fills.
 const start=performance.now(),dur=1100;let raf=0;
 const scoreEl=root.querySelector<HTMLElement>('#score-count')!;
 const counts=[...root.querySelectorAll<HTMLElement>('[data-count]')];
 const gauge=root.querySelector<HTMLElement>('.result-gauge i')!;
 let lastTick=0;
 const tick=(now:number)=>{
  const k=Math.min(1,(now-start)/dur),e=1-Math.pow(1-k,3);
  // A soft tick while the score counts up.
  if(k<1&&now-lastTick>60){lastTick=now;uiAudio.effect('reel');}
  scoreEl.textContent=Math.round(s.score*e).toLocaleString();
  counts.forEach((c,i)=>{const kk=Math.min(1,Math.max(0,(now-start-120*i)/700));c.textContent=String(Math.round(Number(c.dataset.count)*kk));});
  gauge.style.width=`${s.gauge*e}%`;
  if(k<1||now-start<1300)raf=requestAnimationFrame(tick);
  else scoreEl.textContent=s.score.toLocaleString();
 };
 raf=requestAnimationFrame(tick);
 const stopRewards=award&&festival?playRewards(root,award,festival):()=>{};
 // The stamp lands with a drum hit (its CSS animation starts at 1.3 s and lands at about 1.53 s).
 const stampTimer=fortune?window.setTimeout(()=>{uiAudio.hit('don',true);if(fortune==='大吉')uiAudio.effect('gachaRare');else uiAudio.effect('combo10');},1530):0;
 void uiAudio.unlock().then(()=>uiAudio.chime(crown==='ag'?3:crown==='fc'?2:1)).catch(()=>{});
 root.querySelector<HTMLElement>('#retry')!.focus({preventScroll:true});
 const key=(e:KeyboardEvent)=>{if(e.code==='Enter'&&!(e.target instanceof HTMLButtonElement)&&!(e.target instanceof HTMLAnchorElement)){e.preventDefault();retry();}};
 window.addEventListener('keydown',key);
 nav.handlers={back:()=>{location.hash='/songs';}};
 return ()=>{stopAnimation();stopRewards();clearTimeout(stampTimer);cancelAnimationFrame(raf);window.removeEventListener('keydown',key);nav.reset();};
}
