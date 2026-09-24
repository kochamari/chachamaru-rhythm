// Fur and scarf colour variants of the approved puppet atlas, computed once in
// the browser. Only saturated orange fur and green scarf pixels change; ink
// lines, cream markings, eyes, tongue and the sunflower keep their colours.

export interface Variant {id:string;name:string;fur:(h:number,s:number,v:number)=>[number,number,number];scarfHue:number}
export const FRIEND_VARIANTS:Variant[]=[
 {id:'kuro',name:'くろまる',fur:(_h,_s,v)=>[24,.34,.05+v*.27],scarfHue:352},
 {id:'shiro',name:'しろまる',fur:(_h,s,v)=>[38,s*.16,Math.min(1,.7+v*.3)],scarfHue:222},
 {id:'goma',name:'ごままる',fur:(_h,s,v)=>[21,s*.62,v*.64],scarfHue:282},
 {id:'aka',name:'あかまる',fur:(h,s,v)=>[h-5,Math.min(1,s*1.06),v*.93],scarfHue:204},
];

export function rgbToHsv(r:number,g:number,b:number):[number,number,number]{
 const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
 let h=0;
 if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}
 return [h,max?d/max:0,max/255];
}
export function hsvToRgb(h:number,s:number,v:number):[number,number,number]{
 h=((h%360)+360)%360;s=Math.min(1,Math.max(0,s));v=Math.min(1,Math.max(0,v));
 const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
 const [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
 return [Math.round((r+m)*255),Math.round((g+m)*255),Math.round((b+m)*255)];
}
export type PixelClass=0|1|2;
/** 1 = orange fur, 2 = green scarf, 0 = keep. */
export function classify(r:number,g:number,b:number,a:number):PixelClass{
 if(a<8)return 0;
 const [h,s,v]=rgbToHsv(r,g,b);
 if(h>=8&&h<=42&&s>.42&&v>.38)return 1;
 if(h>=80&&h<=175&&s>.22&&v>.18)return 2;
 return 0;
}

export function recolorPixels(data:Uint8ClampedArray,variant:Variant,mask?:Uint8Array){
 const out=new Uint8ClampedArray(data);
 for(let i=0,p=0;i<data.length;i+=4,p++){
  const k=mask?mask[p]:classify(data[i],data[i+1],data[i+2],data[i+3]);
  if(!k)continue;
  const [h,s,v]=rgbToHsv(data[i],data[i+1],data[i+2]);
  const [nh,ns,nv]=k===1?variant.fur(h,s,v):[variant.scarfHue+(h-125)*.4,s,v];
  const [r,g,b]=hsvToRgb(nh,ns,nv);
  out[i]=r;out[i+1]=g;out[i+2]=b;
 }
 return out;
}

const cache=new Map<string,Promise<HTMLCanvasElement|null>>();
/**
 * Returns a canvas with the recoloured atlas at `scale` of the source size
 * (friends are drawn small, so half resolution saves most of the memory),
 * or null when canvas is unavailable.
 */
export function recolorAtlas(image:CanvasImageSource&{width:number;height:number},variant:Variant,key:string,scale=1):Promise<HTMLCanvasElement|null>{
 const id=`${key}:${variant.id}:${scale}`;
 let job=cache.get(id);
 if(!job){
  job=(async()=>{
   try{
    const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const img=ctx.getImageData(0,0,canvas.width,canvas.height);
    const mask=maskFor(`${key}:${scale}`,img.data);
    img.data.set(recolorPixels(img.data,variant,mask));
    ctx.putImageData(img,0,0);
    return canvas;
   }catch{return null;}
  })();
  cache.set(id,job);
 }
 return job;
}
const masks=new Map<string,Uint8Array>();
function maskFor(key:string,data:Uint8ClampedArray){
 let m=masks.get(key);
 if(!m){m=new Uint8Array(data.length/4);for(let i=0,p=0;i<data.length;i+=4,p++)m[p]=classify(data[i],data[i+1],data[i+2],data[i+3]);masks.set(key,m);}
 return m;
}
