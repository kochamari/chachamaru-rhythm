// WebGL puppet: the same rig as the SVG puppet, rendered with sprites so the
// whole play screen draws in one pass.
import {Container,Sprite,Graphics,Texture,Rectangle} from 'pixi.js';
import type {RigSpec,RigNode,Drawing,BoneName,Pose,AtlasName,Point} from './rig';
import {DRUM_HEAD} from './rig';

export type AtlasTextures=Record<AtlasName,Texture>;
const frameCache=new WeakMap<Texture,Map<string,Texture>>();
/** Sub-texture for an atlas frame; `scale` maps source-atlas pixels to this texture. */
function cropped(base:Texture,frame:Drawing['frame'],scale=1){
 let cache=frameCache.get(base);if(!cache){cache=new Map();frameCache.set(base,cache);}
 const key=frame.join(',');let t=cache.get(key);
 if(!t){t=new Texture({source:base.source,frame:new Rectangle(frame[0]*scale,frame[1]*scale,frame[2]*scale,frame[3]*scale)});cache.set(key,t);}
 return t;
}

export class PixiCharacter {
 readonly view=new Container();
 private readonly back=new Container();
 private readonly front=new Container();
 private readonly drumLayer=new Container();
 private readonly bones=new Map<BoneName,{c:Container;rest:number}>();
 private readonly open:Sprite[]=[];
 private readonly closed:Sprite[]=[];
 private readonly headGlow=new Graphics();
 private readonly rimGlow=new Graphics();
 /** Size of the rig root space. */
 static readonly ROOT={w:400,h:420,footX:207,footY:399};

 private scales:Record<AtlasName,number>;
 constructor(private spec:RigSpec,textures:AtlasTextures,opts:{showFlower?:boolean;scales?:Partial<Record<AtlasName,number>>}={}){
  this.scales={character:1,arms:1,...opts.scales};
  const shadow=new Graphics().ellipse(spec.shadow.cx,spec.shadow.cy,spec.shadow.rx,spec.shadow.ry).fill({color:0x2a1c12,alpha:.22});
  this.view.addChild(shadow,this.back,this.drumLayer,this.front);
  for(const n of spec.back)this.back.addChild(this.build(n,[0,0],textures,opts));
  for(const n of spec.front)this.front.addChild(this.build(n,[0,0],textures,opts));
  if(spec.drum){
   const d=spec.drum,s=new Sprite(cropped(textures[d.atlas],d.frame,this.scales[d.atlas]));
   s.position.set(d.x,d.y);s.width=d.w;s.height=d.h;
   this.headGlow.ellipse(DRUM_HEAD.cx,DRUM_HEAD.cy,DRUM_HEAD.rx*.92,DRUM_HEAD.ry*.9).fill({color:0xff8a3d,alpha:.75});
   this.rimGlow.ellipse(DRUM_HEAD.cx,DRUM_HEAD.cy+2,DRUM_HEAD.rx+6,DRUM_HEAD.ry+5).stroke({color:0x63e6ff,width:6,alpha:.9});
   this.headGlow.blendMode='add';this.rimGlow.blendMode='add';
   this.headGlow.alpha=0;this.rimGlow.alpha=0;
   this.drumLayer.addChild(s,this.headGlow,this.rimGlow);
  }
 }

 private build(n:RigNode,origin:Point,textures:AtlasTextures,opts:{showFlower?:boolean}):Container{
  const c=new Container();c.label=n.className;
  const own:Point=n.bone?n.pivot:origin;
  if(n.bone){c.position.set(n.pivot[0]-origin[0],n.pivot[1]-origin[1]);c.angle=n.rest;this.bones.set(n.bone,{c,rest:n.rest});}
  if(n.className==='dog-flower'&&opts.showFlower===false)c.visible=false;
  for(const d of n.drawings){
   const s=new Sprite(cropped(textures[d.atlas],d.frame,this.scales[d.atlas]));
   s.position.set(d.x-own[0],d.y-own[1]);s.width=d.w;s.height=d.h;
   if(d.role==='open')this.open.push(s);
   if(d.role==='closed'){this.closed.push(s);s.visible=false;}
   c.addChild(s);
  }
  for(const child of n.children)c.addChild(this.build(child,own,textures,opts));
  return c;
 }

 /** Place the puppet so its feet stand on (x,y) with the given body height. */
 place(x:number,y:number,height:number,flip=false){
  const s=height/395;
  this.view.scale.set(flip?-s:s,s);
  this.view.position.set(x-PixiCharacter.ROOT.footX*(flip?-s:s),y-PixiCharacter.ROOT.footY*s);
 }

 apply(pose:Pose){
  const scale=pose.bodyScaleY,y=pose.bodyY+this.spec.groundY*(1-scale);
  for(const layer of [this.back,this.front]){layer.scale.set(1,scale);layer.position.set(0,y);}
  for(const [bone,{c,rest}] of this.bones)c.angle=rest+pose.angles[bone];
  for(const s of this.open)s.visible=!pose.blink;
  for(const s of this.closed)s.visible=pose.blink;
  this.headGlow.alpha=pose.drumGlow.don*.9;this.rimGlow.alpha=pose.drumGlow.ka;
 }

 /** Current rotation of each bone in degrees, for tests and diagnostics. */
 angles(){return Object.fromEntries([...this.bones].map(([k,v])=>[k,Math.round(v.c.angle*1000)/1000]));}
 destroy(){this.view.destroy({children:true});}
}
