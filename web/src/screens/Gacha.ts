import {header,escape,toast,boneSvg} from '../app/ui';
import {nav,uiAudio} from '../app/context';
import {loadFestival,spendOnDraws,type FestivalData} from '../storage/festival';
import {drawOutfits,cryptoRandom,collected,seriesProgress,settleCollection,PULL_COST,TEN_PULLS,DUPLICATE_BONES,PITY,type Pull} from '../game/gacha';
import {COSTUMES,COSTUME_BY_ID,RARITY_LABEL,COMPLETE_BONUS,type Costume,type Rarity} from '../render/costumes';
import {shibaPicture} from '../render/shibaCard';

declare const __TEST__:boolean;

// しばガチャ and しばずかん: spend ほねっこ on outfits. Each draw turns the
// capsule machine, drops a capsule in the rarity's colour (a rare one may
// first look ordinary and then change) and opens it on a tap or a drum hit.
// Outfits found here are worn by the four friends on the play screen.

const STARS:Record<Rarity,string>={N:'★',R:'★★',SR:'★★★',SSR:'★★★★'};
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));

function machineSvg(){
 const caps=[[82,142,'#ff6b5a'],[112,150,'#8fd3ff'],[142,146,'#ffcf3f'],[168,138,'#7ed36f'],[96,120,'#c9a2ff'],[128,124,'#ff9fce'],[156,114,'#8fd3ff'],[74,108,'#ffcf3f'],[118,98,'#7ed36f'],[146,90,'#ff6b5a']];
 return `<svg class="gacha-svg" viewBox="0 0 240 330" aria-hidden="true">
  <defs><linearGradient id="rainbow" x1="0" x2="1"><stop offset="0" stop-color="#ff6b8a"/><stop offset=".33" stop-color="#ffd23f"/><stop offset=".66" stop-color="#6ee7ff"/><stop offset="1" stop-color="#c9a2ff"/></linearGradient>
  <radialGradient id="dome" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".5" stop-color="#dff4ff" stop-opacity=".45"/><stop offset="1" stop-color="#a8d8f0" stop-opacity=".55"/></radialGradient></defs>
  <rect x="44" y="176" width="152" height="136" rx="18" fill="#d8392b" stroke="#1e1726" stroke-width="4"/>
  <rect x="44" y="296" width="152" height="18" rx="8" fill="#9a2418" stroke="#1e1726" stroke-width="4"/>
  <g class="gacha-caps">${caps.map(([x,y,c])=>`<g transform="translate(${x} ${y})"><circle r="15" fill="#fff" stroke="#1e1726" stroke-width="3"/><path d="M-15 0A15 15 0 0 1 15 0Z" fill="${c}" stroke="#1e1726" stroke-width="3"/></g>`).join('')}</g>
  <circle cx="120" cy="104" r="86" fill="url(#dome)" stroke="#1e1726" stroke-width="4"/>
  <path d="M62 60Q84 34 116 28" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".8"/>
  <rect x="60" y="186" width="120" height="30" rx="10" fill="#fff4d8" stroke="#1e1726" stroke-width="3"/>
  <text x="120" y="207" text-anchor="middle" font-size="17" font-weight="900" fill="#b8322a">しばガチャ</text>
  <g class="gacha-handle" style="transform-origin:120px 254px"><circle cx="120" cy="254" r="28" fill="#ffd86b" stroke="#1e1726" stroke-width="4"/><rect x="92" y="247" width="56" height="14" rx="7" fill="#fff4d8" stroke="#1e1726" stroke-width="3"/></g>
  <rect x="150" y="280" width="40" height="22" rx="7" fill="#2b1b2e" stroke="#1e1726" stroke-width="3"/>
 </svg>`;
}

export async function gachaScreen(root:HTMLElement,backParam:string|null):Promise<()=>void>{
 const back=backParam&&/^#\/(?!gacha)[\w/?=&%.-]*$/.test(backParam)?backParam:'#/';
 let festival:FestivalData=await loadFestival();
 let busy=false,disposed=false;
 root.innerHTML=`${header()}<section class="page gacha-page"><div class="page-heading"><div><span class="eyebrow">ほねっこで、お祭りの仲間をふやそう</span><h1>しばガチャ</h1><p>当たった衣装は、演奏中に来てくれる仲間の柴犬が着て登場します。当てた毛色の柴犬も、演奏中に仲間として来るようになります。</p><p class="gacha-news"><b>大型アップデート</b> 衣装が${COSTUMES.length}種類に！ シリーズをそろえると ほねっこボーナス、80回で ウルトラレア確定。</p></div><a class="button" id="gacha-back" href="${escape(back)}" data-nav>もどる</a></div>
  <div class="gacha-main">
   <div class="gacha-machine">${machineSvg()}<div class="drop-capsule" hidden></div></div>
   <div class="gacha-panel paper">
    <div class="wallet"><span class="wallet-icon">${boneSvg()}</span><span>もっている ほねっこ</span><b id="wallet">0</b></div>
    <button class="primary gacha-one" id="pull-1" data-nav>1回ひく<small>ほねっこ ${PULL_COST}</small></button>
    <button class="gacha-ten" id="pull-10" data-nav>10回ひく<small>ほねっこ ${PULL_COST*TEN_PULLS}・スーパーレア以上が1つ確定</small></button>
    <p class="gacha-hint" id="gacha-hint" role="status"></p>
    <div class="pity" aria-label="ウルトラレア確定までの回数"><span>ウルトラレア確定まで</span><b id="pity-left">${PITY}</b><span>回</span><i><em id="pity-bar"></em></i></div>
    <details class="gacha-rates"><summary>出る確率と、かぶったとき</summary><p>ノーマル 58%・レア 30%・スーパーレア 10%・ウルトラレア 2%。10回ひくと、最後の1回はスーパーレア以上です。<br>同じ衣装が出たら ほねっこが戻ります（ノーマル ${DUPLICATE_BONES.N}・レア ${DUPLICATE_BONES.R}・スーパーレア ${DUPLICATE_BONES.SR}・ウルトラレア ${DUPLICATE_BONES.SSR}）。<br>ウルトラレアが出ないまま${PITY}回ひくと、${PITY}回目はウルトラレアです（天井）。<br>シリーズをぜんぶ集めると ほねっこボーナス、しばずかんをコンプリートすると ＋${COMPLETE_BONUS.toLocaleString()}。<br>ほねっこは演奏でたまります（良1本、フィーバー中は2本、50コンボごと・全員集合・クリアなどでボーナス）。</p></details>
   </div>
  </div>
  <section class="zukan paper"><h2>しばずかん <span id="zukan-count"></span></h2><div class="zukan-series" id="zukan"></div></section>
 </section>`;
 const $=<T extends HTMLElement>(q:string)=>root.querySelector<T>(q)!;
 const wallet=$('#wallet'),one=$<HTMLButtonElement>('#pull-1'),ten=$<HTMLButtonElement>('#pull-10'),hint=$('#gacha-hint'),machine=$('.gacha-machine'),drop=$('.drop-capsule');

 function refresh(){
  wallet.textContent=festival.bones.toLocaleString();
  one.disabled=busy||festival.bones<PULL_COST;ten.disabled=busy||festival.bones<PULL_COST*TEN_PULLS;
  hint.textContent=festival.bones<PULL_COST?`あと ${PULL_COST-festival.bones}本で1回ひけます。演奏して ほねっこを集めよう！`:festival.bones<PULL_COST*TEN_PULLS?`あと ${PULL_COST*TEN_PULLS-festival.bones}本で10回まとめてひけます。`:'';
  const since=festival.sinceSSR??0;
  $('#pity-left').textContent=String(PITY-since);$<HTMLElement>('#pity-bar').style.width=`${since/PITY*100}%`;
 }
 async function renderZukan(){
  const {have,all}=collected(festival.owned);
  $('#zukan-count').textContent=`${have} / ${all}`;
  const grid=$('#zukan');
  // Smaller cards on phones so 60+ outfits fit in a reasonable scroll.
  const picSize=innerWidth<560?56:88;
  const card=(c:Costume)=>{const n=festival.owned[c.id]??0;return `<button class="zukan-card ${n?'owned':'unknown'}" data-rarity="${c.rarity}" data-costume="${c.id}" ${n?'':'disabled'} aria-label="${n?escape(c.name):'まだ見つけていない衣装'}（${RARITY_LABEL[c.rarity]}）"><span class="zukan-pic"></span><b>${n?escape(c.name):'？？？'}</b><small>${STARS[c.rarity]}${n>1?` ×${n}`:''}</small></button>`;};
  // One shelf per series: its progress, its bonus, and a gold "コンプ" when complete.
  grid.innerHTML=seriesProgress(festival.owned).map(({series,have,all,done})=>`<section class="series-shelf ${done?'done':''}" data-series="${series.id}"><h3><span>${escape(series.name)}</span><span class="series-count">${have} / ${all}</span><span class="series-bonus">${done?'コンプ ✓':`そろえると ＋${series.bonus}`}</span></h3><div class="zukan-grid">${COSTUMES.filter(c=>c.series===series.id).map(card).join('')}</div></section>`).join('');
  for(const card of grid.querySelectorAll<HTMLElement>('.zukan-card')){
   const c=COSTUME_BY_ID.get(card.dataset.costume!)!;
   void shibaPicture(c,picSize,{silhouette:!festival.owned[c.id]}).then(pic=>{if(!disposed)card.querySelector('.zukan-pic')?.append(pic);}).catch(()=>{});
   if(festival.owned[c.id])card.onclick=()=>void reveal([{id:c.id,rarity:c.rarity,isNew:false,refund:0}],true);
  }
 }

 async function pull(count:number){
  if(busy)return;
  busy=true;refresh();
  let result:{pulls:Pull[];festival:FestivalData;bonuses:{label:string;bones:number}[]};
  try{result=await spendOnDraws(count,(owned,pity)=>drawOutfits(count,cryptoRandom,owned,pity),PULL_COST*count,settleCollection);}
  catch(e){toast(e instanceof Error?e.message:'ガチャをひけませんでした');busy=false;refresh();return;}
  festival=result.festival;wallet.textContent=festival.bones.toLocaleString();
  // Turn the handle; a capsule rolls out of the chute.
  uiAudio.effect('gachaTurn');
  machine.classList.remove('turning');void machine.offsetWidth;machine.classList.add('turning');
  await wait(760);if(disposed)return;
  const best=result.pulls.reduce((a,p)=>rank(p.rarity)>rank(a)?p.rarity:a,'N' as Rarity);
  drop.dataset.rarity=best;drop.hidden=false;drop.classList.remove('dropping');void drop.offsetWidth;drop.classList.add('dropping');
  await wait(620);if(disposed)return;
  drop.hidden=true;machine.classList.remove('turning');
  await reveal(result.pulls,false);
  if(disposed)return;
  // Series (or the whole book) completed by this draw: a celebration and its bonus.
  if(result.bonuses.length)await celebrate(result.bonuses);
  busy=false;if(disposed)return;
  refresh();void renderZukan();
 }

 /** Capsules one by one (or a card from the collection); resolves when closed. */
 function reveal(pulls:Pull[],fromZukan:boolean){
  return new Promise<void>(resolve=>{
   const layer=document.createElement('div');layer.className='gacha-reveal';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label','ガチャの結果');
   layer.innerHTML=`<div class="reveal-rays" aria-hidden="true"></div><div class="reveal-body"><button class="reveal-capsule" aria-label="カプセルをひらく"><i class="cap-top"></i><i class="cap-bottom"></i></button><div class="reveal-card" hidden></div></div>
    <p class="reveal-count"></p><div class="reveal-actions"><button class="primary" id="reveal-next">ひらく</button>${pulls.length>1?'<button id="reveal-skip">まとめて見る</button>':''}</div><div class="reveal-summary" hidden></div>`;
   root.append(layer);
   const capsule=layer.querySelector<HTMLElement>('.reveal-capsule')!,card=layer.querySelector<HTMLElement>('.reveal-card')!,next=layer.querySelector<HTMLButtonElement>('#reveal-next')!,count=layer.querySelector<HTMLElement>('.reveal-count')!;
   const saved=nav.handlers;
   let i=0,stage:'capsule'|'upgrade'|'card'|'summary'='capsule',upgraded=false,stepping=false;
   const close=()=>{nav.handlers=saved;layer.remove();resolve();};
   nav.handlers={decide:()=>{void step();return true;},move:()=>true,back:close};
   const showCapsule=()=>{
    const p=pulls[i];
    // A rare capsule sometimes arrives looking ordinary and changes colour on the first tap.
    upgraded=(p.rarity==='SR'||p.rarity==='SSR')&&cryptoRandom()<.4;
    stage='capsule';layer.dataset.rarity='';capsule.hidden=false;card.hidden=true;capsule.className='reveal-capsule';
    capsule.dataset.rarity=upgraded?'R':p.rarity;
    count.textContent=pulls.length>1?`${i+1} / ${pulls.length}`:'';
    next.textContent='ひらく';next.focus({preventScroll:true});
   };
   const showCard=async()=>{
    const p=pulls[i],c=COSTUME_BY_ID.get(p.id) as Costume;
    stage='card';capsule.classList.add('open');uiAudio.effect(p.rarity==='SR'||p.rarity==='SSR'?'gachaRare':'gachaOpen');
    layer.dataset.rarity=p.rarity;
    await wait(260);
    capsule.hidden=true;card.hidden=false;card.dataset.rarity=p.rarity;
    card.innerHTML=`<span class="card-rarity">${RARITY_LABEL[p.rarity]} ${STARS[p.rarity]}${p.pity?' ・天井':''}</span><span class="card-pic"></span><h3>${escape(c.name)}</h3><p>${escape(c.blurb)}</p>${fromZukan?'':p.isNew?'<span class="card-new">NEW!</span>':`<span class="card-dup">かぶり → ほねっこ ＋${p.refund}</span>`}`;
    card.classList.remove('pop');void card.offsetWidth;card.classList.add('pop');
    // Super rare or better: confetti bursts out of the card.
    if((p.rarity==='SR'||p.rarity==='SSR')&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
     const colors=['#ff5fa2','#ffd23f','#39d2f2','#7ed36f','#b58cff','#ffffff'];
     const burst=document.createElement('div');burst.className='reveal-confetti';burst.setAttribute('aria-hidden','true');
     burst.innerHTML=Array.from({length:p.rarity==='SSR'?40:20},(_,k)=>`<i style="--x:${(Math.random()*2-1).toFixed(2)};--up:${(18+Math.random()*16).toFixed(0)}vh;--r:${Math.round(Math.random()*900-450)}deg;--d:${(Math.random()*.2).toFixed(2)}s;background:${colors[k%colors.length]}"></i>`).join('');
     layer.append(burst);window.setTimeout(()=>burst.remove(),2000);
    }
    try{const pic=await shibaPicture(c,Math.min(220,innerHeight*.34));card.querySelector('.card-pic')?.append(pic);}catch{/* the name is enough */}
    next.textContent=i+1<pulls.length?'つぎへ':pulls.length>1?'まとめて見る':'とじる';
   };
   const showSummary=async()=>{
    stage='summary';layer.dataset.rarity='';layer.classList.add('summary-open');
    const summary=layer.querySelector<HTMLElement>('.reveal-summary')!;summary.hidden=false;
    layer.querySelector('.reveal-body')!.remove();layer.querySelector('#reveal-skip')?.remove();count.remove();
    layer.append(layer.querySelector('.reveal-actions')!);
    const refund=pulls.reduce((a,p)=>a+p.refund,0);
    summary.innerHTML=`<h3>${pulls.length}回の結果${refund?`<small>かぶり ほねっこ ＋${refund}</small>`:''}</h3><div class="summary-grid">${pulls.map(p=>{const c=COSTUME_BY_ID.get(p.id)!;return `<div class="summary-tile" data-rarity="${p.rarity}"><span class="tile-pic"></span><b>${escape(c.name)}</b>${p.isNew?'<i>NEW</i>':''}</div>`;}).join('')}</div>`;
    summary.querySelectorAll<HTMLElement>('.tile-pic').forEach((el,k)=>void shibaPicture(COSTUME_BY_ID.get(pulls[k].id)!,70).then(pic=>el.append(pic)).catch(()=>{}));
    next.textContent='とじる';next.focus({preventScroll:true});
   };
   const step=async()=>{
    if(stepping)return;stepping=true;
    try{
     if(stage==='capsule'&&upgraded){stage='upgrade';capsule.dataset.rarity=pulls[i].rarity;capsule.classList.add('upgrade');uiAudio.effect('gachaRare');next.textContent='ひらく';return;}
     if(stage==='capsule'||stage==='upgrade'){await showCard();return;}
     if(stage==='card'){i++;if(i<pulls.length){showCapsule();uiAudio.effect('gachaTurn');}else if(pulls.length>1)await showSummary();else close();return;}
     close();
    }finally{stepping=false;}
   };
   capsule.onclick=()=>void step();next.onclick=()=>void step();
   layer.querySelector<HTMLElement>('#reveal-skip')?.addEventListener('click',()=>void showSummary());
   if(fromZukan){i=0;void showCard();}else showCapsule();
  });
 }
 /** "シリーズ コンプリート！": the series (or the whole book) and the bones it paid. */
 function celebrate(bonuses:{label:string;bones:number}[]){
  return new Promise<void>(resolve=>{
   const all=bonuses.some(b=>b.label.startsWith('しばずかん'));
   const layer=document.createElement('div');layer.className='gacha-reveal complete-reveal';layer.dataset.rarity=all?'SSR':'SR';layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label','コンプリート');
   layer.innerHTML=`<div class="reveal-rays" aria-hidden="true"></div><div class="complete-card"><span class="complete-kicker">${all?'おめでとう！':'シリーズ'}</span><h3>${all?'しばずかん<br>コンプリート！！':'コンプリート！'}</h3><ul>${bonuses.map(b=>`<li><b>${escape(b.label.replace(/ コンプ$/,''))}</b><span>ほねっこ ＋${b.bones.toLocaleString()}</span></li>`).join('')}</ul></div><div class="reveal-actions"><button class="primary" id="complete-close">やったね！</button></div>`;
   if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    const colors=['#ff5fa2','#ffd23f','#39d2f2','#7ed36f','#b58cff','#ffffff'];
    const burst=document.createElement('div');burst.className='reveal-confetti';burst.setAttribute('aria-hidden','true');
    burst.innerHTML=Array.from({length:all?60:36},(_,k)=>`<i style="--x:${(Math.random()*2-1).toFixed(2)};--up:${(18+Math.random()*16).toFixed(0)}vh;--r:${Math.round(Math.random()*900-450)}deg;--d:${(Math.random()*.25).toFixed(2)}s;background:${colors[k%colors.length]}"></i>`).join('');
    layer.append(burst);
   }
   root.append(layer);
   uiAudio.effect(all?'allGreat':'fullCombo');
   const saved=nav.handlers;
   const close=()=>{nav.handlers=saved;layer.remove();resolve();};
   nav.handlers={decide:()=>{close();return true;},move:()=>true,back:close};
   const button=layer.querySelector<HTMLButtonElement>('#complete-close')!;button.onclick=close;button.focus({preventScroll:true});
  });
 }
 const rank=(r:Rarity)=>['N','R','SR','SSR'].indexOf(r);

 one.onclick=()=>void pull(1);
 ten.onclick=()=>void pull(TEN_PULLS);
 refresh();void renderZukan();
 // Test hook: how many outfits and bones this screen shows.
 if(__TEST__)Object.assign(window,{__gacha:{get festival(){return festival;},get busy(){return busy;}}});
 return ()=>{disposed=true;root.querySelector('.gacha-reveal')?.remove();};
}
