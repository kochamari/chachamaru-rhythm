// WebGL puppet: the same rig as the SVG puppet, rendered with sprites so the
// whole play screen draws in one pass.
import {Container,Sprite,Graphics,Texture,Rectangle} from 'pixi.js';
import type {RigSpec,RigNode,Drawing,BoneName,Pose,AtlasName,Point} from './rig';
import {DRUM_HEAD} from './rig';
import type {Outfit} from './costumes';
import {GRIP} from './portrait';

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
 private readonly pivots=new Map<BoneName,readonly [number,number]>();
 private readonly open:Sprite[]=[];
 private readonly closed:Sprite[]=[];
 private readonly headGlow=new Graphics();
 private readonly rimGlow=new Graphics();
 /** Size of the rig root space. */
 static readonly ROOT={w:400,h:420,footX:207,footY:399};

 private scales:Record<AtlasName,number>;
 /** A held thing stays upright: its holder turns against the paw each pose. */
 private holder:{c:Container;bone:BoneName;angle:number}|null=null;
 private outfitTextures:Texture[]=[];
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
  if(n.bone){c.position.set(n.pivot[0]-origin[0],n.pivot[1]-origin[1]);c.angle=n.rest;this.bones.set(n.bone,{c,rest:n.rest});this.pivots.set(n.bone,n.pivot);}
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
  if(this.holder){const b=this.bones.get(this.holder.bone);if(b)this.holder.c.angle=-b.c.angle+this.holder.angle;}
  for(const s of this.open)s.visible=!pose.blink;
  for(const s of this.closed)s.visible=pose.blink;
  this.headGlow.alpha=pose.drumGlow.don*.9;this.rimGlow.alpha=pose.drumGlow.ka;
 }

 /** Current rotation of each bone in degrees, for tests and diagnostics. */
 angles(){return Object.fromEntries([...this.bones].map(([k,v])=>[k,Math.round(v.c.angle*1000)/1000]));}
 /**
  * Puts on a festival outfit (from the draw). Each part is painted once in
  * rig root coordinates and attached where it belongs: behind the body, over
  * the body, on the head, or held in a paw. `quality` is canvas pixels per
  * root unit.
  */
 dress(outfit:Outfit,quality=.7){
  const layer=(paint:(g:CanvasRenderingContext2D)=>void,w=400,h=420,ox=0,oy=0)=>{
   const canvas=document.createElement('canvas');canvas.width=Math.round(w*quality);canvas.height=Math.round(h*quality);
   const g=canvas.getContext('2d');if(!g)return null;
   g.scale(quality,quality);g.translate(ox,oy);paint(g);
   const t=Texture.from(canvas);this.outfitTextures.push(t);
   const sp=new Sprite(t);sp.scale.set(1/quality);sp.position.set(-ox,-oy);return sp;
  };
  if(outfit.under){const sp=layer(outfit.under);if(sp)this.back.addChildAt(sp,0);}
  if(outfit.body){const sp=layer(outfit.body);if(sp)this.back.addChild(sp);}
  const head=this.bones.get('head');
  // Head outfits (hats) may rise above the rig box: paint them with 80 units of headroom.
  if(outfit.head&&head){const sp=layer(outfit.head,400,500,0,80);if(sp){const [px,py]=this.pivots.get('head')!;sp.position.set(sp.x-px,sp.y-py);head.c.addChild(sp);}}
  const hold=outfit.hold,bone=hold?.paw==='left'?'armLeft':'armRight',paw=this.bones.get(bone);
  if(hold&&paw){
   // Painted around the grip (the grip is at the middle of a 300-unit square).
   const sp=layer(hold.paint,300,300,150,150);
   if(sp){
    const c=new Container();const [px,py]=this.pivots.get(bone)!;const [gx,gy]=GRIP[bone];
    c.position.set(gx-px,gy-py);c.addChild(sp);paw.c.addChildAt(c,0);
    this.holder={c,bone,angle:(hold.angle??0)*(hold.paw==='left'?-1:1)};
   }
  }
 }
 /** Frees the outfit pictures (the renderer destroys the views). */
 disposeOutfit(){for(const t of this.outfitTextures)t.destroy(true);this.outfitTextures=[];}
 destroy(){this.view.destroy({children:true});this.disposeOutfit();}
}
