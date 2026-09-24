import {BRAND} from '../app/brand';
import {Character,flowerSvg} from '../render/Character';
import {nav} from '../app/context';

const icon={
 plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
 gear:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M5.5 18.5l2.1-2.1M16.4 7.6l2.1-2.1" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
 studio:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18V6M9 18V9M14 18V4M19 18v-6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
 plug:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/></svg>',
};

export function homeScreen(root:HTMLElement):()=>void{
 root.innerHTML=`<section class="title-screen" aria-label="タイトル">
  <div class="title-copy">
   <span class="festival-tag">${flowerSvg().replace('<svg','<svg width="18" height="18"')} ひまわりの里の音楽祭</span>
   <h1 class="logo"><span class="logo-name">${BRAND.short}</span><span class="logo-plate">太鼓の達人</span></h1>
   <p class="tagline">${BRAND.tagline} 好きな曲で、ドンとカッ！</p>
   <div class="title-actions">
    <a class="drum-start" href="#/songs" data-nav id="start-game"><strong>はじめる</strong><small>ドン で スタート</small></a>
    <div class="title-links">
     <a class="chip-button" href="#/import" data-nav>${icon.plus} 曲を追加</a>
     <a class="chip-button" href="#/settings" data-nav>${icon.gear} 設定・電子ドラム</a>
     <a class="chip-button" href="#/studio" data-nav>${icon.studio} 譜面工房</a>
    </div>
   </div>
  </div>
  <div class="title-character"><div class="speech">いっしょに叩こう！</div><div class="hero-character"></div></div>
  <footer class="title-footer"><span>タッチ・キーボード（F J / D K）・電子ドラムで遊べます</span><div class="pills"><span>オリジナル曲収録</span><span>自分の曲も追加できる</span><a href="#/diagnostics">${icon.plug.replace('<svg','<svg width="14" height="14" style="vertical-align:-2px"')} 接続診断</a></div></footer>
 </section>`;
 const character=new Character(root.querySelector('.hero-character')!);
 const stop=character.animate('idle');
 // Drum a little on the title screen so the character feels alive.
 const pattern=['don','don','ka',''] as const;let beat=0;
 const drummer=window.setInterval(()=>{const c=pattern[beat++%pattern.length];if(c)character.hit(c,performance.now(),beat%2?'left':'right');},500);
 nav.handlers={decide:()=>{const focused=document.activeElement as HTMLElement|null;if(focused?.dataset.nav!==undefined&&focused!==root.querySelector('#start-game'))return false;location.hash='/songs';return true;}};
 root.querySelector<HTMLElement>('#start-game')?.focus({preventScroll:true});
 return ()=>{stop();clearInterval(drummer);nav.reset();};
}
