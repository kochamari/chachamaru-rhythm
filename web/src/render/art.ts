// Procedural artwork for the play screen. Everything here is original vector
// drawing baked once into textures, so the per-frame work is only sprites.
import {Graphics,Container,Text,Texture,type Renderer,FillGradient,type TextStyleOptions} from 'pixi.js';

export const C={
 don:0xf35a43,donDark:0xb8322a,ka:0x2cbbd5,kaDark:0x1b7f98,gold:0xffd86b,goldDeep:0xe9a93a,
 ink:0x1e1726,cream:0xfff2ce,green:0x467843,lacquer:0xc23b2c,lacquerDark:0x8e2a22,wood:0x6b3f24,woodDark:0x3d2416,
 lane:0x26222b,laneEdge:0x3a3441,roll:0xffc93c,rollDark:0xd89a1c,blush:0xff8f8f,
};
export const FONT='"Hiragino Maru Gothic ProN","Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic",system-ui,sans-serif';
export const SERIF='"Hiragino Mincho ProN","Yu Mincho",serif';

export interface Baked {texture:Texture;anchorX:number;anchorY:number}
export function bake(renderer:Renderer,target:Container,resolution=2):Baked{
 // Text is laid out from its top-left corner; centre it so sprites anchor on the glyphs.
 if(target instanceof Text)target.anchor.set(.5);
 const b=target.getLocalBounds();
 const texture=renderer.generateTexture({target,resolution,antialias:true});
 target.destroy({children:true});
 return {texture,anchorX:b.width?-b.x/b.width:.5,anchorY:b.height?-b.y/b.height:.5};
}

/** A round note with small dog ears and a friendly face. */
export function noteGraphic(color:'don'|'ka',r:number):Container{
 const g=new Graphics();
 const fill=color==='don'?C.don:C.ka,dark=color==='don'?C.donDark:C.kaDark;
 // Ears first so the rim overlaps their base.
 for(const s of [-1,1]){
  g.poly([s*r*.86,-r*.3,s*r*.74,-r*1.1,s*r*.2,-r*.86]).fill(fill).stroke({color:C.ink,width:Math.max(2.5,r*.09),join:'round'});
  g.poly([s*r*.74,-r*.46,s*r*.67,-r*.92,s*r*.36,-r*.78]).fill({color:C.cream,alpha:.85});
 }
 g.circle(0,0,r+2).fill(C.ink);
 g.circle(0,0,r-1).fill(C.cream);
 const face=new FillGradient({type:'radial',center:{x:.42,y:.36},innerRadius:0,outerCenter:{x:.5,y:.5},outerRadius:.62,colorStops:[{offset:0,color:lighten(fill,.18)},{offset:.7,color:fill},{offset:1,color:dark}]});
 g.circle(0,0,r-r*.17).fill(face);
 g.circle(0,0,r-r*.17).stroke({color:dark,width:1.5,alpha:.6});
 // Face.
 const ey=-r*.06,ex=r*.3;
 for(const s of [-1,1]){
  g.ellipse(s*ex,ey,r*.1,r*.13).fill(C.ink);
  g.circle(s*ex-r*.03,ey-r*.05,r*.04).fill(0xffffff);
  g.ellipse(s*r*.5,r*.2,r*.12,r*.07).fill({color:C.blush,alpha:.55});
 }
 g.moveTo(-r*.17,r*.18).quadraticCurveTo(-r*.085,r*.3,0,r*.19).quadraticCurveTo(r*.085,r*.3,r*.17,r*.18).stroke({color:C.ink,width:Math.max(2,r*.07),cap:'round',join:'round'});
 g.ellipse(0,r*.1,r*.08,r*.055).fill(C.ink);
 // Soft highlight.
 g.ellipse(-r*.3,-r*.42,r*.3,r*.13).fill({color:0xffffff,alpha:.3});
 return g;
}

export function rollHeadGraphic(r:number):Container{
 const g=new Graphics();
 g.circle(0,0,r+2).fill(C.ink);g.circle(0,0,r-1).fill(C.cream);
 g.circle(0,0,r-r*.17).fill(new FillGradient({type:'radial',center:{x:.4,y:.35},innerRadius:0,outerCenter:{x:.5,y:.5},outerRadius:.62,colorStops:[{offset:0,color:0xfff0a8},{offset:.7,color:C.roll},{offset:1,color:C.rollDark}]}));
 const ey=-r*.06,ex=r*.3;
 for(const s of [-1,1]){g.moveTo(s*ex-r*.12,ey+r*.04).quadraticCurveTo(s*ex,ey-r*.12,s*ex+r*.12,ey+r*.04).stroke({color:C.ink,width:r*.08,cap:'round'});}
 g.ellipse(0,r*.22,r*.16,r*.14).fill(C.ink);g.ellipse(0,r*.27,r*.1,r*.06).fill(0xff7b7b);
 g.ellipse(-r*.3,-r*.42,r*.3,r*.13).fill({color:0xffffff,alpha:.35});
 return g;
}
/** One pixel wide slice of the roll body, stretched horizontally. */
export function rollBodyGraphic(r:number):Container{
 const g=new Graphics();const h=(r-2)*2;
 g.rect(0,-h/2-2,4,h+4).fill(C.ink);
 g.rect(0,-h/2+1,4,h-2).fill(C.cream);
 g.rect(0,-h/2+r*.17,4,h-r*.34).fill(new FillGradient({type:'linear',start:{x:0,y:0},end:{x:0,y:1},colorStops:[{offset:0,color:0xfff0a8},{offset:.45,color:C.roll},{offset:1,color:C.rollDark}]}));
 return g;
}
export function rollTailGraphic(r:number):Container{
 const g=new Graphics();const h=r-2;
 g.arc(0,0,h+2,-Math.PI/2,Math.PI/2).fill(C.ink);
 g.arc(0,0,h-1,-Math.PI/2,Math.PI/2).fill(C.cream);
 g.arc(0,0,h-r*.17,-Math.PI/2,Math.PI/2).fill(C.roll);
 return g;
}

export function lighten(color:number,amount:number){
 const r=(color>>16)&255,g=(color>>8)&255,b=color&255;
 const f=(v:number)=>Math.round(v+(255-v)*amount);
 return (f(r)<<16)|(f(g)<<8)|f(b);
}
export function darken(color:number,amount:number){
 const r=(color>>16)&255,g=(color>>8)&255,b=color&255;
 const f=(v:number)=>Math.round(v*(1-amount));
 return (f(r)<<16)|(f(g)<<8)|f(b);
}

/** Top view of a festival drum: wooden rim ring with studs and a skin. */
export function drumGraphic(r:number):Container{
 const c=new Container();const g=new Graphics();
 g.circle(0,0,r+4).fill(C.ink);
 g.circle(0,0,r).fill(new FillGradient({type:'radial',center:{x:.5,y:.45},innerRadius:0,outerCenter:{x:.5,y:.5},outerRadius:.55,colorStops:[{offset:.6,color:0x9a5a32},{offset:1,color:C.woodDark}]}));
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2;g.circle(Math.cos(a)*r*.87,Math.sin(a)*r*.87,r*.045).fill(0xf6d58a);}
 const skin=r*.74;
 g.circle(0,0,skin+2).fill(C.ink);
 g.circle(0,0,skin).fill(new FillGradient({type:'radial',center:{x:.42,y:.38},innerRadius:0,outerCenter:{x:.5,y:.5},outerRadius:.6,colorStops:[{offset:0,color:0xfffaf0},{offset:.8,color:0xf6e6c0},{offset:1,color:0xe1c894}]}));
 // Faint sunflower mark on the skin.
 for(let i=0;i<10;i++){const a=i/10*Math.PI*2;g.ellipse(Math.cos(a)*skin*.36,Math.sin(a)*skin*.36,skin*.14,skin*.07).fill({color:0xd8a64e,alpha:.18});}
 g.circle(0,0,skin*.2).fill({color:0x8a5a2b,alpha:.16});
 g.moveTo(0,-skin).lineTo(0,skin).stroke({color:0xb89660,width:1.5,alpha:.5});
 c.addChild(g);return c;
}
/** Half-disc (skin) or half-ring (rim) used to light the drum on hits. */
export function drumHalfGraphic(r:number,part:'skin'|'rim',side:'left'|'right',color:number):Container{
 const g=new Graphics();const skin=r*.74;
 // y points down: π/2 is the bottom, 3π/2 the top.
 const [a0,a1]=side==='left'?[Math.PI/2,Math.PI*1.5]:[-Math.PI/2,Math.PI/2];
 if(part==='skin'){g.arc(0,0,skin,a0,a1,false);g.closePath();g.fill({color,alpha:.85});}
 else{g.arc(0,0,r+2,a0,a1,false);g.arc(0,0,skin+2,a1,a0,true);g.closePath();g.fill({color,alpha:.9});}
 return g;
}

export function sunflowerGraphic(r:number,petals=14):Container{
 const g=new Graphics();
 for(let i=0;i<petals;i++){
  const a=i/petals*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a);
  const pts:number[]=[];
  for(let k=0;k<12;k++){const t=k/12*Math.PI*2;const px=Math.cos(t)*r*.2,py=Math.sin(t)*r*.44-r*.55;pts.push(px*ca-py*sa,px*sa+py*ca);}
  g.poly(pts).fill(i%2?0xffd24a:0xffbd2e).stroke({color:0xb37c28,width:Math.max(1,r*.05)});
 }
 g.circle(0,0,r*.36).fill(0x6b4423).stroke({color:0x3f2714,width:Math.max(1,r*.05)});
 for(let i=0;i<9;i++){const a=i*2.4;const d=Math.sqrt(i+.5)*r*.09;g.circle(Math.cos(a)*d,Math.sin(a)*d,r*.035).fill(0x9a6b38);}
 return g;
}

/** Festival flame tongue (additive) for the judge circle in chorus. */
export function flameGraphic(h:number):Container{
 const c=new Container();
 const layer=(scale:number,stops:{offset:number;color:number}[])=>{
  const g=new Graphics();const hh=h*scale,w=hh*.36;
  g.moveTo(0,0).bezierCurveTo(w*1.1,-hh*.12,w*.9,-hh*.55,w*.12,-hh*.78).quadraticCurveTo(-w*.05,-hh*.9,0,-hh)
   .quadraticCurveTo(-w*.2,-hh*.8,-w*.45,-hh*.62).bezierCurveTo(-w*1.05,-hh*.4,-w*1.1,-hh*.1,0,0)
   .fill(new FillGradient({type:'linear',start:{x:0,y:1},end:{x:0,y:0},colorStops:stops}));
  return g;
 };
 c.addChild(layer(1,[{offset:0,color:0xff3d14},{offset:.5,color:0xff7a1f},{offset:1,color:0xffb347}]));
 c.addChild(layer(.62,[{offset:0,color:0xffd166},{offset:1,color:0xfff6c8}]));
 return c;
}

/** Soft round glow: a radial gradient fading to transparent. */
export function glowGraphic(r:number,color:number):Container{
 const rgb=`${(color>>16)&255},${(color>>8)&255},${color&255}`;
 return new Graphics().circle(0,0,r).fill(new FillGradient({type:'radial',center:{x:.5,y:.5},innerRadius:0,outerCenter:{x:.5,y:.5},outerRadius:.5,colorStops:[{offset:0,color:`rgba(${rgb},0.95)`},{offset:.35,color:`rgba(${rgb},0.55)`},{offset:.7,color:`rgba(${rgb},0.16)`},{offset:1,color:`rgba(${rgb},0)`}]}));
}
export function ringGraphic(r:number,width:number,color:number):Container{
 return new Graphics().circle(0,0,r).stroke({color,width});
}
export function sparkGraphic(r:number,color:number):Container{
 const g=new Graphics();const pts:number[]=[];
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2-Math.PI/2;const d=i%2?r*.38:r;pts.push(Math.cos(a)*d,Math.sin(a)*d);}
 return g.poly(pts).fill(color);
}
export function petalGraphic(r:number,color:number):Container{
 return new Graphics().ellipse(0,0,r*.45,r).fill(color).stroke({color:darken(color,.3),width:1});
}
export function dotGraphic(r:number,color:number):Container{return new Graphics().circle(0,0,r).fill(color);}
/** Impact rays: thin tapered spikes around a hole, white (tinted when used). */
export function raysGraphic(r:number,count=16):Container{
 const g=new Graphics();
 for(let i=0;i<count;i++){
  const a=i/count*Math.PI*2,w=r*(i%2?.05:.08),inner=r*(i%2?.5:.4),outer=r*(i%2?.82:1);
  const cx=Math.cos(a),cy=Math.sin(a),px=-cy,py=cx;
  g.poly([cx*inner+px*w,cy*inner+py*w,cx*outer,cy*outer,cx*inner-px*w,cy*inner-py*w]).fill(0xffffff);
 }
 return g;
}
/** A long thin diamond: a shard flying off a hit note (white, tinted when used). */
export function shardGraphic(r:number):Container{
 return new Graphics().poly([0,-r,r*.34,0,0,r,-r*.34,0]).fill(0xffffff);
}

export function textGraphic(text:string,style:TextStyleOptions):Container{
 const t=new Text({text,style});return t;
}
export function judgementGraphic(kind:'great'|'ok'|'miss'):Container{
 const label=kind==='great'?'良':kind==='ok'?'可':'不可';
 const fill=kind==='great'?0xffc233:kind==='ok'?0xffffff:0x9fb4d8;
 return new Text({text:label,style:{fontFamily:SERIF,fontSize:44,fontWeight:'900',fill,stroke:{color:kind==='miss'?0x243049:0x5b1d12,width:8,join:'round'},letterSpacing:2,dropShadow:{color:0x000000,alpha:.35,distance:2,blur:0,angle:Math.PI/2}}});
}

/** Burst balloon ("12 連打!"), rebuilt only when the count changes. */
export function burstPoints(r:number,spikes=14){const pts:number[]=[];for(let i=0;i<spikes*2;i++){const a=i/(spikes*2)*Math.PI*2;const d=i%2?r*.78:r;pts.push(Math.cos(a)*d*1.3,Math.sin(a)*d*.8);}return pts;}

export function bannerPattern(width:number,height:number):Container{
 const c=new Container();const g=new Graphics();
 g.rect(0,0,width,height).fill(C.lacquer);
 // Hemp-leaf (asanoha) inspired lattice, drawn with thin lines.
 const s=height/2;
 for(let x=-s;x<width+s;x+=s){for(let y=0;y<=height;y+=s){
  g.moveTo(x,y).lineTo(x+s/2,y+s/2).lineTo(x+s,y).stroke({color:0xffffff,width:1,alpha:.08});
  g.moveTo(x+s/2,y+s/2).lineTo(x+s/2,y-s/2).stroke({color:0xffffff,width:1,alpha:.06});
 }}
 c.addChild(g);return c;
}
