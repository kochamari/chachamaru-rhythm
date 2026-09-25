// Shiba pictures for menus (gacha cards, the collection): the rig drawn once
// on a canvas in a costume, or as a dark silhouette for outfits not found yet.
import {drawRig,rigCanvas,CROWD_POSES} from './portrait';
import {recolorAtlas} from './recolor';
import {ATLAS_FILES} from './rig';
import type {Costume} from './costumes';

let atlas:Promise<HTMLImageElement>|null=null;
export function baseAtlas(){
 return atlas??=new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>{atlas=null;reject(Error('絵を読み込めませんでした'));};img.src=import.meta.env.BASE_URL+ATLAS_FILES.character;});
}

/** A canvas `height` CSS pixels tall (sharp on this screen) of a shiba in `costume`. */
export async function shibaPicture(costume:Costume,height:number,opts:{silhouette?:boolean;pose?:number}={}){
 const img=await baseAtlas();
 const coat=costume.coat?await recolorAtlas(img,costume.coat,'chachamaru-anime-v1',.5):null;
 const scale=Math.min(3,devicePixelRatio||1);
 const canvas=rigCanvas(height*scale,g=>drawRig(g,{character:coat??img},{character:coat?.5:1},CROWD_POSES[opts.pose??costume.cardPose??1],undefined,{flower:false,outfit:costume.outfit,shadow:!opts.silhouette}));
 canvas.style.height=`${height}px`;canvas.style.width=`${canvas.width/scale}px`;
 if(opts.silhouette){const g=canvas.getContext('2d');if(g){g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-in';g.fillStyle='#3b2d40';g.fillRect(0,0,canvas.width,canvas.height);}}
 return canvas;
}
