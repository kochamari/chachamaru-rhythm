import {flowerSvg} from '../render/Character';

// A festival curtain between menus and play: two lacquer doors with a
// sunflower crest close (about 0.2 s) while the next screen is built behind
// them, then slide open. It never takes clicks, reopens by itself after a few
// seconds if something went wrong, and is skipped with reduced motion.

const CLOSE_MS=210,OPEN_MS=340,HOLD_MS=70,SAFETY_MS=4000;
let el:HTMLElement|null=null,closedAt=0,safety=0,opening=0;

const reduced=()=>matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Starts closing the curtain (the caller navigates right away). */
export function closeShutter(){
 if(reduced())return;
 clearTimeout(opening);clearTimeout(safety);
 if(!el){
  el=document.createElement('div');el.className='shutter';el.setAttribute('aria-hidden','true');
  el.innerHTML=`<i class="door left"></i><i class="door right"></i><span class="crest">${flowerSvg()}</span>`;
  document.body.append(el);
 }
 el.classList.remove('opening');void el.offsetWidth;el.classList.add('closing');
 closedAt=performance.now()+CLOSE_MS;
 safety=window.setTimeout(openShutter,SAFETY_MS);
}

/** Opens the curtain once it has fully closed (does nothing when it is not shown). */
export function openShutter(){
 if(!el)return;
 clearTimeout(safety);clearTimeout(opening);
 const wait=Math.max(0,closedAt-performance.now()+HOLD_MS);
 opening=window.setTimeout(()=>{
  const door=el;if(!door)return;
  door.classList.remove('closing');door.classList.add('opening');
  opening=window.setTimeout(()=>{if(el===door){door.remove();el=null;}},OPEN_MS);
 },wait);
}
