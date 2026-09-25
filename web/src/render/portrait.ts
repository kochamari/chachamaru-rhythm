// Draws the rig as a still picture on a 2D canvas: the cheering crowd on the
// play screen (as textures) and shiba cards on menus. The joints follow the
// same rig definition as the SVG and WebGL puppets (rest angle plus pose, in
// local coordinates around each pivot).
import {DANCER,type RigNode,type RigSpec,type AtlasName,type BoneName} from './rig';
import type {Outfit} from './costumes';

export type BoneAngles=Partial<Record<BoneName,number>>;
/** Paws together at the chest, head a little to one side. Offsets from the rest angles. */
export const CHEER:BoneAngles={armLeft:-22,armRight:22,head:-4,tail:12,earLeft:-3,earRight:3};
/** Crowd poses: rest (paws at the chest) and three ways to cheer, switched on the beat. */
export const CROWD_POSES:BoneAngles[]=[
 CHEER,
 {armLeft:-100,armRight:100,head:-3,tail:14,earLeft:-4,earRight:4},
 {armLeft:-90,armRight:22,head:-7,tail:14,earLeft:-4,earRight:2},
 {armLeft:-150,armRight:150,head:0,tail:16,earLeft:-5,earRight:5},
];
export const ROOT={w:400,h:420};

/**
 * Draws `spec` in root coordinates (400 × 420, feet at y 399). `images` are
 * atlases drawn at `scale` of the source size (recoloured friends use 0.5).
 */
export function drawRig(g:CanvasRenderingContext2D,images:Partial<Record<AtlasName,CanvasImageSource>>,scale:Partial<Record<AtlasName,number>>,angles:BoneAngles=CHEER,spec:RigSpec=DANCER,opts:{flower?:boolean;shadow?:boolean;outfit?:Outfit}={}){
 const outfit=opts.outfit??{};
 const root=g.getTransform();
 /** Paw grips (where the pads are) in each paw joint's own coordinates. */
 const GRIP={armLeft:[182,242],armRight:[238,242]} as const;
 if(opts.shadow!==false){
  const s=spec.shadow;
  g.save();g.fillStyle='rgba(42,28,18,.2)';g.beginPath();g.ellipse(s.cx,s.cy,s.rx,s.ry,0,0,Math.PI*2);g.fill();g.restore();
 }
 const draw=(n:RigNode)=>{
  if(n.className==='dog-flower'&&opts.flower===false)return;
  g.save();
  if(n.bone){const [x,y]=n.pivot;g.translate(x,y);g.rotate((n.rest+(angles[n.bone]??0))*Math.PI/180);g.translate(-x,-y);}
  // Held things hang or stand upright from the grip, whatever the paw's angle; the paw covers the grip.
  const hold=outfit.hold,holding=hold&&n.bone===(hold.paw==='left'?'armLeft':'armRight');
  if(holding){
   const [gx,gy]=GRIP[n.bone as 'armLeft'];
   const at=new DOMPoint(gx,gy).matrixTransform(g.getTransform()).matrixTransform(root.inverse());
   g.save();g.setTransform(root);g.translate(at.x,at.y);g.rotate((hold.angle??0)*(hold.paw==='left'?-1:1)*Math.PI/180);hold.paint(g);g.restore();
  }
  for(const d of n.drawings){
   const image=images[d.atlas];if(!image||d.role==='closed')continue;
   const k=scale[d.atlas]??1,[fx,fy,fw,fh]=d.frame;
   g.drawImage(image,fx*k,fy*k,fw*k,fh*k,d.x,d.y,d.w,d.h);
  }
  n.children.forEach(draw);
  if(n.bone==='head'&&outfit.head){g.save();outfit.head(g);g.restore();}
  g.restore();
 };
 if(outfit.under){g.save();outfit.under(g);g.restore();}
 spec.back.forEach(draw);
 if(outfit.body){g.save();outfit.body(g);g.restore();}
 spec.front.forEach(draw);
}

/** A canvas `height` pixels tall with the whole rig root (feet near the bottom). */
export function rigCanvas(height:number,paint:(g:CanvasRenderingContext2D)=>void){
 const canvas=document.createElement('canvas');
 const k=height/ROOT.h;
 canvas.width=Math.round(ROOT.w*k);canvas.height=Math.round(height);
 const g=canvas.getContext('2d');
 if(g){g.imageSmoothingQuality='high';g.scale(k,k);paint(g);}
 return canvas;
}
