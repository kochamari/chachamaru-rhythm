import {sprite} from './character-rig';

export function crownSvg(){return '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M5 26 2 9 13 18 20 3 27 18 38 9 35 26Z" fill="#ffe484" stroke="#b37c28" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 29H34V33H6Z" fill="#e8b84f" stroke="#b37c28"/><circle cx="20" cy="3" r="2.5" fill="#fff3bf"/><circle cx="2" cy="9" r="2" fill="#fff3bf"/><circle cx="38" cy="9" r="2" fill="#fff3bf"/><path d="M20 19 23 23 20 27 17 23Z" fill="#397261"/></svg>';}
export function flowerSvg(){return '<svg viewBox="0 0 64 64" aria-hidden="true">'+Array.from({length:12},(_,i)=>`<ellipse cx="32" cy="14" rx="7" ry="12" fill="#ffd166" transform="rotate(${i*30} 32 32)"/>`).join('')+'<circle cx="32" cy="32" r="13" fill="#674829"/><circle cx="28" cy="28" r="3" fill="#9a6b38"/></svg>';}

export function characterSvg(drum = true): string {
 return `<svg class="chacha chacha-anime" viewBox="0 0 400 420" role="img" aria-label="ひまわりと緑の唐草スカーフをつけた赤柴のちゃちゃまる">
 <ellipse cx="207" cy="399" rx="138" ry="11" fill="#392c22" opacity=".18"/>
 <g class="dog-body">
  <g class="dog-tail">${sprite('tail', 267, 206, 111)}</g>
  <g class="dog-leg back-left">${sprite('footLeft', 90, 297, 85)}</g>
  <g class="dog-leg back-right">${sprite('footRight', 249, 297, 85)}</g>
  ${sprite('torso', 123, 191, 182)}
  <g class="dog-scarf">${sprite('scarf', 254, 202, 95)}</g>
  ${sprite('band', 123, 183, 179)}
  <g class="dog-head">
   <g class="dog-ear left">${sprite('earLeft', 113, 6, 75)}</g>
   <g class="dog-ear right">${sprite('earRight', 243, 16, 83)}</g>
   <g class="dog-eyes"><g class="eyes-open">${sprite('head', 97, 41, 225)}</g><g class="eyes-closed">${sprite('blink', 97, 41, 225)}</g></g>
  </g>
  <g class="dog-flower">${sprite('flower', 260, 209, 67)}</g>
 </g>
 ${drum ? `<g class="dog-drum">${sprite('drum', 128, 267, 178)}</g>` : ''}
 <g class="dog-paws">
  <g class="dog-arm arm-left">${drum ? sprite('armRight', 103, 223, 109) : sprite('pawRight', 95, 257, 109)}</g>
  <g class="dog-arm arm-right">${drum ? sprite('armLeft', 226, 223, 109) : sprite('pawLeft', 237, 257, 109)}</g>
 </g>
 </svg>`;
}

const selectors = ['.dog-body', '.dog-paws', '.dog-tail', '.dog-head', '.arm-left', '.arm-right', '.back-left', '.back-right', '.dog-scarf', '.dog-ear.left', '.dog-ear.right', '.dog-eyes'] as const;
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
  q('.dog-body').style.transform = `translateY(${bounce - Math.sin(jump * Math.PI) * 24}px) scaleY(${1 - strike * .03})`;
  q('.dog-paws').style.transform = q('.dog-body').style.transform;
  q('.dog-tail').style.transform = `rotate(${Math.sin(phase) * 8 + (chorus ? 8 : 0) + (happy ? 12 : 0)}deg)`;
  q('.dog-head').style.transform = `rotate(${Math.sin(phase / 2) * (chorus ? 5 : 2) + (missed ? -8 : 0)}deg)`;
  q('.arm-left').style.transform = `rotate(${strike * (this.hitColor === 'don' ? 42 : 0) + (chorus ? Math.sin(phase / 2) * 12 : 0) + (win ? -30 : 0)}deg)`;
  q('.arm-right').style.transform = `rotate(${-strike * (this.hitColor === 'ka' ? 42 : 0) + (chorus ? Math.cos(phase / 2) * 12 : 0) + (win ? 30 : 0)}deg)`;
  q('.back-left').style.transform = `translateY(${chorus ? Math.max(0, Math.sin(phase)) * -8 : jump * 4}px)`;
  q('.back-right').style.transform = `translateY(${chorus ? Math.max(0, -Math.sin(phase)) * -8 : 0}px)`;
  q('.dog-scarf').style.transform = `rotate(${Math.sin(phase + .4) * (chorus ? 6 : 2)}deg)`;
  q('.dog-ear.left').style.transform = `rotate(${Math.sin(phase / 2) * 2 + (missed ? -10 : 0)}deg)`;
  q('.dog-ear.right').style.transform = `rotate(${-Math.sin(phase / 2) * 2 + (missed ? -10 : 0)}deg)`;
  q('.dog-eyes').classList.toggle('is-blinking', time % 4100 > 3970 || happy);
 }
}
