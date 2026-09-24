// SVG puppet used on menus (title, song select, result). The in-game puppet
// is drawn with WebGL from the same rig in PixiCharacter.ts.
import {DRUMMER,DANCER,ATLAS_FILES,ATLAS_SIZE,DrummerState,drummerPose,dancerPose,type RigNode,type RigSpec,type Drawing,type BoneName,type Mood,type Side,type Pose} from './rig';

export function crownSvg(){return '<svg viewBox="0 0 40 34" aria-hidden="true"><path d="M5 26 2 9 13 18 20 3 27 18 38 9 35 26Z" fill="#ffe484" stroke="#b37c28" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 29H34V33H6Z" fill="#e8b84f" stroke="#b37c28"/><circle cx="20" cy="3" r="2.5" fill="#fff3bf"/><circle cx="2" cy="9" r="2" fill="#fff3bf"/><circle cx="38" cy="9" r="2" fill="#fff3bf"/><path d="M20 19 23 23 20 27 17 23Z" fill="#397261"/></svg>';}
export function flowerSvg(){return '<svg viewBox="0 0 64 64" aria-hidden="true">'+Array.from({length:12},(_,i)=>`<ellipse cx="32" cy="14" rx="7" ry="12" fill="#ffd166" transform="rotate(${i*30} 32 32)"/>`).join('')+'<circle cx="32" cy="32" r="13" fill="#674829"/><circle cx="28" cy="28" r="3" fill="#9a6b38"/></svg>';}

const atlasUrl=(name:Drawing['atlas'])=>`${import.meta.env.BASE_URL}${ATLAS_FILES[name]}`;
function drawingSvg(d:Drawing){
 const [fx,fy,fw,fh]=d.frame;
 return `<svg x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" viewBox="${fx} ${fy} ${fw} ${fh}" overflow="hidden" aria-hidden="true"><image href="${atlasUrl(d.atlas)}" width="${ATLAS_SIZE}" height="${ATLAS_SIZE}"/></svg>`;
}
function nodeSvg(n:RigNode):string{
 const drawings=n.drawings.map(d=>d.role?`<g class="eyes-${d.role}">${drawingSvg(d)}</g>`:drawingSvg(d)).join('');
 const inner=drawings+n.children.map(nodeSvg).join('');
 if(!n.bone)return `<g class="${n.className}">${inner}</g>`;
 const [x,y]=n.pivot;
 // Drawings live in root space: undo the joint translation inside the rotation.
 return `<g class="joint" data-joint="${n.className}" transform="translate(${x} ${y})"><g class="${n.className}" transform="rotate(${n.rest})"><g transform="translate(${-x} ${-y})">${inner}</g></g></g>`;
}
export function rigSvg(spec:RigSpec,label='ひまわりと緑の唐草スカーフをつけた赤柴のちゃちゃまる'){
 const s=spec.shadow;
 return `<svg class="chacha chacha-anime ${spec.kind}" viewBox="0 0 400 420" role="img" aria-label="${label}">
 <ellipse cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" fill="#392c22" opacity=".18"/>
 <g class="dog-body">${spec.back.map(nodeSvg).join('')}${spec.drum?`<g class="dog-drum">${drawingSvg(spec.drum)}</g>`:''}${spec.front.map(nodeSvg).join('')}</g>
 </svg>`;
}
export function characterSvg(drum=true):string{return rigSvg(drum?DRUMMER:DANCER);}

export function rigBones(spec:RigSpec){const out:RigNode[]=[];const walk=(n:RigNode)=>{if(n.bone)out.push(n);n.children.forEach(walk);};[...spec.back,...spec.front].forEach(walk);return out;}

export class Character {
 readonly state=new DrummerState();
 private readonly parts=new Map<BoneName,SVGElement>();
 private readonly rest=new Map<BoneName,number>();
 private readonly body:SVGElement;
 private readonly drum:SVGElement|null;
 private readonly eyes:SVGElement|null;
 constructor(private root:HTMLElement,private spec:RigSpec=DRUMMER){
  root.innerHTML=rigSvg(spec);
  for(const n of rigBones(spec)){
   const el=root.querySelector<SVGElement>(`[data-joint="${n.className}"] > g`);
   if(el&&n.bone){this.parts.set(n.bone,el);this.rest.set(n.bone,n.rest);}
  }
  this.body=root.querySelector<SVGElement>('.dog-body')!;
  this.drum=root.querySelector<SVGElement>('.dog-drum');
  this.eyes=root.querySelector<SVGElement>('.dog-eyes');
 }
 hit(color:string,time:number,side?:Side){this.state.hit(color==='ka'?'ka':'don',time,side);}
 jump(time:number){this.state.jump(time);}
 react(kind:'happy'|'miss',time:number){this.state.react(kind,time);}
 animate(mood:Mood|'dance'):()=>void{
  // Absolute performance time, so hit(color, performance.now()) lines up.
  let frame=0;
  const tick=(now:number)=>{this.update(now,now/500,mood);frame=requestAnimationFrame(tick);};
  frame=requestAnimationFrame(tick);
  return ()=>cancelAnimationFrame(frame);
 }
 update(time:number,beat:number,mood:string):Pose{
  const pose=this.spec.kind==='dancer'||mood==='dance'?dancerPose(time,beat,mood==='chorusDance'?1:.6,false):drummerPose(this.state,time,beat,mood==='chorusDance'||mood==='resultWin'?mood:'idle');
  this.apply(pose);
  return pose;
 }
 apply(pose:Pose){
  this.root.dataset.state=pose.state;
  const scale=pose.bodyScaleY,y=pose.bodyY+this.spec.groundY*(1-scale);
  // Every limb inherits the same body matrix. The drum is painted between the
  // torso and the paws; the inverse matrix keeps its feet on the ground.
  this.body.setAttribute('transform',`matrix(1 0 0 ${scale} 0 ${y})`);
  this.drum?.setAttribute('transform',`matrix(1 0 0 ${1/scale} 0 ${-y/scale})`);
  for(const [bone,el] of this.parts)el.setAttribute('transform',`rotate(${(this.rest.get(bone)??0)+pose.angles[bone]})`);
  this.eyes?.classList.toggle('is-blinking',pose.blink);
 }
}
