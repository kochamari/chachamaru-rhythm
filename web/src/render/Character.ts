import {armSprite, attachedSprite, bone, placedBone, sprite} from './character-rig';

export function crownSvg(){return '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M5 26 2 9 13 18 20 3 27 18 38 9 35 26Z" fill="#ffe484" stroke="#b37c28" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 29H34V33H6Z" fill="#e8b84f" stroke="#b37c28"/><circle cx="20" cy="3" r="2.5" fill="#fff3bf"/><circle cx="2" cy="9" r="2" fill="#fff3bf"/><circle cx="38" cy="9" r="2" fill="#fff3bf"/><path d="M20 19 23 23 20 27 17 23Z" fill="#397261"/></svg>';}
export function flowerSvg(){return '<svg viewBox="0 0 64 64" aria-hidden="true">'+Array.from({length:12},(_,i)=>`<ellipse cx="32" cy="14" rx="7" ry="12" fill="#ffd166" transform="rotate(${i*30} 32 32)"/>`).join('')+'<circle cx="32" cy="32" r="13" fill="#674829"/><circle cx="28" cy="28" r="3" fill="#9a6b38"/></svg>';}

export function characterSvg(drum = true): string {
 return `<svg class="chacha chacha-anime" viewBox="0 0 400 420" role="img" aria-label="ひまわりと緑の唐草スカーフをつけた赤柴のちゃちゃまる">
 <ellipse cx="207" cy="399" rx="138" ry="11" fill="#392c22" opacity=".18"/>
 <g class="dog-body">
  ${placedBone('dog-tail', [287, 307], sprite('tail', 267, 206, 111))}
  ${placedBone('dog-leg back-left', [155, 308], sprite('footLeft', 90, 297, 85))}
  ${placedBone('dog-leg back-right', [269, 308], sprite('footRight', 249, 297, 85))}
  ${sprite('torso', 113, 182, 198)}
  ${drum ? bone('upper-arm-left', [147, 240], armSprite([710, 80, 485, 450], [1037, 144], .13)) : ''}
  ${drum ? bone('upper-arm-right', [277, 240], armSprite([60, 80, 485, 450], [217, 144], .13)) : ''}
  ${placedBone('dog-scarf', [273, 223], sprite('scarf', 254, 202, 95))}
  ${sprite('band', 123, 183, 179)}
  ${drum ? `<g class="dog-drum">${sprite('drum', 128, 267, 178)}</g>` : ''}
  ${placedBone('dog-head', [207, 217], `
   ${placedBone('dog-ear left', [150, 88], sprite('earLeft', 113, 6, 75))}
   ${placedBone('dog-ear right', [278, 98], sprite('earRight', 243, 16, 83))}
   <g class="dog-eyes"><g class="eyes-open">${sprite('head', 97, 41, 225)}</g><g class="eyes-closed">${sprite('blink', 97, 41, 225)}</g></g>
  `)}
  <g class="dog-flower">${sprite('flower', 260, 209, 67)}</g>
  ${drum ? bone('dog-arm arm-left', [119.31, 278.35], armSprite([275, 548, 282, 555], [306, 986], .15)) : bone('dog-arm arm-left', [142, 252], attachedSprite('pawRight', [1005, 1106], 85), 45)}
  ${drum ? bone('dog-arm arm-right', [304.69, 278.35], armSprite([697, 548, 282, 555], [948, 986], .15)) : bone('dog-arm arm-right', [281, 252], attachedSprite('pawLeft', [871, 1118], 85), -45)}
 </g>
 </svg>`;
}

const selectors = ['.dog-body', '.dog-drum', '.dog-tail', '.dog-head', '.arm-left', '.arm-right', '.back-left', '.back-right', '.dog-scarf', '.dog-ear.left', '.dog-ear.right', '.dog-eyes'] as const;
type Part = typeof selectors[number];

export class Character {
 private readonly parts: Record<Part, SVGElement>;
 private lastHit = -1000;
 private hitColor = 'don';
 private comboAt = -1000;
 private happyAt = -1000;
 private missAt = -1000;

 constructor(private root: HTMLElement) {
  root.innerHTML = characterSvg();
  this.parts = Object.fromEntries(selectors.map(s => [s, root.querySelector<SVGElement>(s)!])) as Record<Part, SVGElement>;
 }

 hit(color: string, time: number): void { this.lastHit = time; this.hitColor = color; }
 jump(time: number): void { this.comboAt = time; }
 react(kind: 'happy' | 'miss', time: number): void { if (kind === 'happy') this.happyAt = time; else this.missAt = time; }

 animate(state: 'idle' | 'resultWin'): () => void {
  let frame = 0;
  const start = performance.now();
  const tick = (now: number) => {
   const time = now - start;
   this.update(time, time / 500, state);
   frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
 }

 update(time: number, beat: number, state: string): void {
  const q = (s: Part) => this.parts[s];
  const phase = beat * Math.PI * 2, bounce = Math.sin(phase) * 3;
  const jump = time >= this.comboAt ? Math.max(0, 1 - (time - this.comboAt) / 350) : 0;
  // Reach the drum in 40 ms and return over 90 ms. Repeated inputs replace
  // the current stroke; there is no animation queue to fall behind the song.
  const age = time - this.lastHit;
  const strike = age >= 0 && age < 130 ? age < 40 ? age / 40 : (130 - age) / 90 : 0;
  const chorus = state === 'chorusDance', win = state === 'resultWin';
  const missed = time >= this.missAt && time - this.missAt < 120;
  const happy = time >= this.happyAt && time - this.happyAt < 220;
  this.root.dataset.state = strike > 0 ? this.hitColor : jump > 0 ? 'comboJump' : missed ? 'miss' : happy ? 'happy' : state;
  // Every limb inherits the same body matrix. The fixed drum is painted between
  // torso and paws, with the inverse matrix keeping its feet on the ground.
  const scale = 1 - strike * .03;
  const y = bounce - Math.sin(jump * Math.PI) * 24 + 391 * (1 - scale);
  q('.dog-body').setAttribute('transform', `matrix(1 0 0 ${scale} 0 ${y})`);
  q('.dog-drum').setAttribute('transform', `matrix(1 0 0 ${1 / scale} 0 ${-y / scale})`);
  const rotate = (part: Part, angle: number) => q(part).setAttribute('transform', `rotate(${angle})`);
  rotate('.dog-tail', Math.sin(phase) * 6 + (chorus ? 5 : 0) + (happy ? 6 : 0));
  rotate('.dog-head', Math.sin(phase / 2) * (chorus ? 4 : 2) + (missed ? -6 : 0));
  rotate('.arm-left', strike * (this.hitColor === 'don' ? 65 : 0) + (chorus ? Math.sin(phase / 2) * 5 : 0) + (win ? -16 : 0));
  rotate('.arm-right', -strike * (this.hitColor === 'ka' ? 65 : 0) + (chorus ? Math.cos(phase / 2) * 5 : 0) + (win ? 16 : 0));
  rotate('.back-left', chorus ? Math.max(0, Math.sin(phase)) * 7 : jump * 3);
  rotate('.back-right', chorus ? Math.max(0, -Math.sin(phase)) * -7 : jump * -3);
  rotate('.dog-scarf', Math.sin(phase + .4) * (chorus ? 5 : 2));
  rotate('.dog-ear.left', Math.sin(phase / 2) * 2 + (missed ? -8 : 0));
  rotate('.dog-ear.right', -Math.sin(phase / 2) * 2 + (missed ? -8 : 0));
  q('.dog-eyes').classList.toggle('is-blinking', time % 4100 > 3970 || happy);
 }
}
