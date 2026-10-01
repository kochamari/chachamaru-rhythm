// The result screen's rewards, revealed one after another after the score:
// ほねっこ counting up (with a little ticking) while today's mission bars fill,
// the bonus slot (three reels, リーチ when the first two match), the
// first-run-of-the-day bonus, the 太鼓レベル bar (LEVEL UP!) and, last, any
// new titles. The award itself was saved before this screen opened; this
// only shows it. A tap on the panel shows everything at once.
import {escape,boneSvg} from '../app/ui';
import {flowerSvg} from '../render/Character';
import {uiAudio} from '../app/context';
import {levelFor,slotPayout,SLOT_SYMBOLS,DAILY_BONES,type SlotSymbol} from '../game/festival';
import {ATLAS_FILES,REGIONS} from '../render/rig';
import {MISSION_BY_ID} from '../game/daily';
import {PULL_COST} from '../game/gacha';
import type {Award,FestivalData} from '../storage/festival';

const SLOT_LINE=/^スロット /;
const LATER=new Set(['きょうの初プレイ','レベルアップ']);

export function slotIcon(symbol:SlotSymbol){
 if(symbol==='bone')return boneSvg();
 if(symbol==='flower')return flowerSvg();
 if(symbol==='drum')return '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="12" width="26" height="20" rx="4" fill="#d8392b" stroke="#1e1726" stroke-width="2.5"/><ellipse cx="20" cy="12" rx="13" ry="5" fill="#fbf1dc" stroke="#1e1726" stroke-width="2.5"/><path d="M9 22h22" stroke="#ffd86b" stroke-width="2" stroke-dasharray="2 3"/></svg>';
 const [x,y,w,h]=REGIONS.head;
 return `<svg viewBox="${x} ${y} ${w} ${h}" aria-hidden="true"><image href="${import.meta.env.BASE_URL}${ATLAS_FILES.character}" width="1254" height="1254"/></svg>`;
}
const SYMBOL_NAME:Record<SlotSymbol,string>={bone:'ほねっこ',flower:'ひまわり',drum:'太鼓',chacha:'ちゃちゃまる'};

/** Today's three missions: bars that fill from before to after this run; "達成！" on the ones this run finished. */
function missionsRow(award:Award){
 if(!award.missions?.length)return '';
 return `<div class="reward-row reward-missions" aria-label="きょうのミッション">${award.missions.map(m=>{
  const def=MISSION_BY_ID.get(m.id);if(!def)return '';
  const done=m.after>=def.target,newly=done&&m.before<def.target;
  return `<span class="rm ${done&&!newly?'done':''}" data-after="${(m.after/def.target*100).toFixed(1)}" data-new="${newly}"><b>${escape(def.name)}</b><i><em style="width:${(m.before/def.target*100).toFixed(1)}%"></em></i><small>${newly?'':done?'達成':`${m.after.toLocaleString()}/${def.target.toLocaleString()}`}</small></span>`;
 }).join('')}</div>`;
}

/** The way to しばガチャ: a thin bar fills toward the next draw; ひける！ (and a glow) once there are bones for one. */
function gachaButton(bones:number,href:string){
 if(bones>=PULL_COST)return `<a class="button bone-gacha ready" href="${escape(href)}" data-nav aria-label="ガチャ（1回ひけます）">ガチャ<small>ひける！</small></a>`;
 return `<a class="button bone-gacha" href="${escape(href)}" data-nav aria-label="ガチャ（あと${(PULL_COST-bones).toLocaleString()}本で1回ひけます）" style="--fill:${(bones/PULL_COST).toFixed(3)}">ガチャ<i class="gacha-fill" aria-hidden="true"></i></a>`;
}
export function rewardsHtml(award:Award,festival:FestivalData,gachaHref:string){
 const level=levelFor(award.xp?.before??festival.xp??0);
 return `<section class="result-rewards" aria-label="ごほうび（タップですぐ全部表示）">
  <div class="reward-row reward-bones"><span class="bone-award-icon">${boneSvg()}</span><div class="bone-main"><b>ほねっこ ＋<span id="bone-count">0</span></b><span class="bone-line"><span class="bone-total">もっている <b id="bone-total">${(festival.bones-award.total).toLocaleString()}</b></span>${award.daily?'<span class="daily-chip" id="daily-chip" hidden><span class="long">きょうの</span>初プレイ ＋'+(award.items.find(i=>i.label==='きょうの初プレイ')?.bones??DAILY_BONES)+'</span>':''}</span></div>${gachaButton(festival.bones,gachaHref)}<div class="bone-items" id="bone-items"></div></div>
  ${award.slot?`<div class="reward-row reward-slot"><span class="slot-label">ボーナス<br>スロット</span><div class="slot-reels">${[0,1,2].map(()=>'<span class="reel"><span class="strip"></span></span>').join('')}</div><b class="slot-result" id="slot-result" aria-live="polite"></b></div>`:''}
  ${missionsRow(award)}
  ${award.titles?.length?`<div class="reward-titles" id="reward-titles" hidden><span class="title-get-head">称号ゲット！</span>${award.titles.map(t=>`<b class="title-get">${escape(t)}</b>`).join('')}</div>`:''}
  ${award.xp?`<div class="reward-row reward-level"><span class="level-badge">太鼓Lv.<b id="level-num">${level.level}</b></span><div class="level-bar"><i id="level-fill" style="width:${level.into/level.need*100}%"></i></div><span class="level-xp" id="level-xp">＋${award.xp.gain} XP</span><span class="level-up" id="level-up" hidden>LEVEL UP!</span></div>`:''}
 </section>`;
}

/** Runs the reveal from `delay` ms on; returns a function that stops it. */
export function playRewards(root:HTMLElement,award:Award,festival:FestivalData,delay=1400){
 const $=<T extends HTMLElement>(q:string)=>root.querySelector<T>(q);
 const panelEl=$('.result-rewards'),countEl=$('#bone-count'),itemsEl=$('#bone-items'),totalEl=$('#bone-total');
 if(!panelEl||!countEl||!itemsEl||!totalEl)return ()=>{};
 const panel:HTMLElement=panelEl,count:HTMLElement=countEl,items:HTMLElement=itemsEl,total:HTMLElement=totalEl;
 const titlesEl=$('#reward-titles');
 const timers:number[]=[];let ticker=0,shown=0,done=false;
 const later=(ms:number,fn:()=>void)=>timers.push(window.setTimeout(fn,ms));
 const startTotal=festival.bones-award.total;
 const slotItem=award.items.find(i=>SLOT_LINE.test(i.label));
 const base=award.items.filter(i=>!SLOT_LINE.test(i.label)&&!LATER.has(i.label));
 const baseBones=award.play+base.reduce((a,i)=>a+i.bones,0);
 /** The bones so far as small tags (the newest pops in). */
 const describe=(parts:{label:string;bones:number}[])=>[`<span>演奏 ＋${award.play}</span>`,...parts.map(i=>`<span class="${i.label==='きょうの初プレイ'?'daily':i.label.startsWith('スロット')?'slot':''}">${escape(i.label)} ＋${i.bones}</span>`)].join('');
 const set=(n:number)=>{shown=n;count.textContent=n.toLocaleString();total.textContent=(startTotal+n).toLocaleString();};
 /** Counts up to `to` over `ms`, ticking softly. */
 const countTo=(to:number,ms=600)=>{
  const from=shown,t0=performance.now();let lastTick=0;
  const step=(now:number)=>{
   if(done)return;
   const k=Math.min(1,(now-t0)/ms),v=Math.round(from+(to-from)*(1-Math.pow(1-k,2)));
   set(v);
   if(now-lastTick>55&&k<1){lastTick=now;uiAudio.effect('reel');}
   if(k<1)ticker=requestAnimationFrame(step);
  };
  ticker=requestAnimationFrame(step);
 };
 const pop=(el:Element|null)=>{if(!el)return;el.classList.remove('pop');void (el as HTMLElement).offsetWidth;el.classList.add('pop');};
 // Everything at once (a tap on the panel, or leaving early).
 const finish=()=>{
  if(done)return;done=true;
  timers.forEach(clearTimeout);cancelAnimationFrame(ticker);
  set(award.total);items.innerHTML=describe(award.items);
  fillMissions(true);
  if(award.slot)showSlot(true);
  const daily=$('#daily-chip');if(daily)daily.hidden=false;
  if(award.xp)showLevel(true);
  if(titlesEl)titlesEl.hidden=false;
 };
 panel.addEventListener('click',e=>{if(!(e.target as Element).closest('a'))finish();});

 // Mission bars fill; the ones this run finished say 達成！
 const missionBars=[...root.querySelectorAll<HTMLElement>('.reward-missions .rm')];
 const fillMissions=(instant:boolean)=>missionBars.forEach(el=>{
  const bar=el.querySelector<HTMLElement>('em');if(bar){if(instant)bar.style.transition='none';bar.style.width=`${el.dataset.after}%`;}
  if(el.dataset.new==='true'&&!el.classList.contains('done')){el.classList.add('done','pop');const label=el.querySelector('small');if(label)label.textContent='達成！';}
 });
 // 1. The bones from play and from the friends.
 later(delay,()=>{items.innerHTML=describe(base);countTo(baseBones,700);});
 if(missionBars.length)later(delay+450,()=>{fillMissions(false);if(missionBars.some(el=>el.dataset.new==='true'))uiAudio.effect('combo50');});
 let t=delay+900;
 // 2. The bonus slot.
 const reels=[...root.querySelectorAll<HTMLElement>('.reel .strip')];
 function showSlot(instant=false){
  const s=award.slot!;
  reels.forEach((strip,i)=>{
   const n=instant?1:14+i*5+(i===2&&s.symbols[0]===s.symbols[1]?9:0);
   strip.innerHTML=Array.from({length:n},(_,k)=>k===n-1?s.symbols[i]:SLOT_SYMBOLS[(k*7+i*3)%SLOT_SYMBOLS.length]).map(sym=>`<span class="sym" title="${SYMBOL_NAME[sym]}">${slotIcon(sym)}</span>`).join('');
   strip.style.transition='none';strip.style.transform='translateY(0)';
   if(!instant){void strip.offsetHeight;strip.style.transition=`transform ${900+i*450+(i===2&&s.symbols[0]===s.symbols[1]?1000:0)}ms cubic-bezier(.12,.72,.18,1)`;}
   strip.style.transform=`translateY(calc(-${n-1} * var(--sym)))`;
  });
  const result=$('#slot-result');
  const {mult,label}=slotPayout(s.symbols);
  const says=(what:string,times:string)=>`<span class="what">${escape(what)}</span><span class="mult">${escape(times)}</span>`;
  if(result)result.innerHTML=instant?(mult>1?says(label,`×${mult}！`):says('','はずれ')):'';
  if(instant)return;
  const reach=s.symbols[0]===s.symbols[1];
  let spinning=window.setInterval(()=>uiAudio.effect('reel'),80);
  later(900,()=>uiAudio.effect('join'));
  later(1350,()=>{uiAudio.effect('join');if(reach&&result){result.innerHTML=says('','リーチ！');result.className='slot-result reach';}});
  const stop=1800+(reach?1000:0);
  later(stop,()=>{
   clearInterval(spinning);spinning=0;
   uiAudio.effect(mult>=2?'gachaRare':mult>1?'combo10':'join');
   if(result){result.className=`slot-result ${mult>=3?'jackpot':mult>=2?'big':mult>1?'win':'miss'}`;result.innerHTML=mult>1?says(label,`×${mult}！`):says('','はずれ');pop(result);}
   if(slotItem){items.innerHTML=describe([...base,slotItem]);countTo(shown+slotItem.bones,600);}
  });
  timers.push(spinning);
  return stop;
 }
 // On a tall phone screen the panel sits under the score: bring it into view for the slot.
 const reveal=()=>{const r=panel.getBoundingClientRect();if(r.bottom>innerHeight||r.top<0)panel.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'end'});};
 if(award.slot){later(t,()=>{reveal();showSlot();});t+=1800+(award.slot.symbols[0]===award.slot.symbols[1]?1000:0)+800;}
 // 3. The first finished run of the day.
 if(award.daily){later(t,()=>{const chip=$('#daily-chip');if(chip){chip.hidden=false;pop(chip);}uiAudio.effect('combo10');items.innerHTML=describe(award.items.filter(i=>i.label!=='レベルアップ'));countTo(shown+(award.items.find(i=>i.label==='きょうの初プレイ')?.bones??DAILY_BONES),500);});t+=700;}
 // 4. 太鼓レベル: the bar fills; LEVEL UP when it passes the end.
 function showLevel(instant=false){
  const xp=award.xp!,fill=$('#level-fill'),num=$('#level-num'),up=$('#level-up');
  const before=levelFor(xp.before),after=levelFor(xp.before+xp.gain);
  if(!fill||!num)return;
  if(instant){num.textContent=String(after.level);fill.style.transition='none';fill.style.width=`${after.into/after.need*100}%`;if(up&&after.level!==before.level){up.hidden=false;const xpText=$('#level-xp');if(xpText)xpText.hidden=true;}return;}
  if(after.level===before.level){fill.style.width=`${after.into/after.need*100}%`;return;}
  fill.style.width='100%';
  later(650,()=>{
   num.textContent=String(after.level);if(up){up.hidden=false;pop(up);const xpText=$('#level-xp');if(xpText)xpText.hidden=true;}
   uiAudio.effect('fullCombo');
   fill.style.transition='none';fill.style.width='0%';void fill.offsetWidth;fill.style.transition='';fill.style.width=`${after.into/after.need*100}%`;
   const lvl=award.items.find(i=>i.label==='レベルアップ');
   if(lvl){items.innerHTML=describe(award.items);countTo(shown+lvl.bones,600);}
  });
 }
 if(award.xp){later(t,()=>showLevel());t+=award.items.some(i=>i.label==='レベルアップ')?1300:500;}
 // 5. New titles (やりこみ), last.
 if(titlesEl)later(t,()=>{titlesEl.hidden=false;pop(titlesEl);uiAudio.effect('fullHouse');});
 later(t+1600,()=>{if(!done){done=true;set(award.total);items.innerHTML=describe(award.items);if(titlesEl)titlesEl.hidden=false;}});
 return ()=>{done=true;timers.forEach(clearTimeout);timers.forEach(clearInterval);cancelAnimationFrame(ticker);};
}
