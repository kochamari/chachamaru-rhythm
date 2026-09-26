// Festival outfits for the shibas that the draw (しばガチャ) hands out.
// Each is drawn with Canvas 2D in rig root coordinates (400 × 420) inside the
// right joint (head, paw) or between the body and the front parts, so it
// follows every pose. Coats are fur colours (recoloured atlas), like friends.
import type {Variant} from './recolor';

export type Rarity='N'|'R'|'SR'|'SSR';
type Paint=(g:CanvasRenderingContext2D)=>void;
/**
 * Where an outfit is drawn: behind everything, over the body (under head and
 * paws), on the head (turns with it), or held in a paw: painted upright (or
 * hanging) from the paw's grip at (0,0), just behind the paw.
 */
export interface Outfit {under?:Paint;body?:Paint;head?:Paint;hold?:{paw:'left'|'right';angle?:number;paint:Paint}}
/** Pose for the card: 1 = paws at the cheeks, 3 = paws up and out (shows the body). */
export interface Costume {id:string;name:string;rarity:Rarity;blurb:string;outfit?:Outfit;coat?:Variant;cardPose?:number}

const INK='#1e1726';
function stroke(g:CanvasRenderingContext2D,width=3,color=INK){g.lineWidth=width;g.strokeStyle=color;g.lineJoin='round';g.lineCap='round';g.stroke();}
function fill(g:CanvasRenderingContext2D,color:string){g.fillStyle=color;g.fill();}
function ellipse(g:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,rot=0){g.beginPath();g.ellipse(x,y,rx,ry,rot,0,Math.PI*2);}

/** A headband across the forehead, knotted at the right with two tails. */
function hachimaki(color:string,edge:string,mark?:(g:CanvasRenderingContext2D)=>void):Paint{
 return g=>{
  // Tails behind the knot.
  for(const [dx,dy,tx,ty] of [[10,4,44,40],[4,10,26,52]]){
   g.beginPath();g.moveTo(300,92);g.quadraticCurveTo(300+dx+18,92+dy+6,300+tx,92+ty);g.lineTo(300+tx-10,92+ty+4);g.quadraticCurveTo(300+dx+4,92+dy+14,294,100);g.closePath();
   fill(g,color);stroke(g,2.5);
  }
  g.beginPath();g.moveTo(108,104);g.quadraticCurveTo(207,68,308,96);g.lineTo(306,114);g.quadraticCurveTo(207,88,110,122);g.closePath();
  fill(g,color);stroke(g,3);
  g.beginPath();g.moveTo(118,106);g.quadraticCurveTo(207,76,298,98);g.lineWidth=2.5;g.strokeStyle=edge;g.stroke();
  // Knot.
  ellipse(g,302,103,11,9,.4);fill(g,color);stroke(g,2.5);
  mark?.(g);
 };
}
/** A festival mask worn on the side of the head. */
function mask(cx:number,cy:number,rot:number,paint:(g:CanvasRenderingContext2D)=>void):Paint{
 return g=>{g.save();g.translate(cx,cy);g.rotate(rot);paint(g);g.restore();};
}
/** A short festival coat over the body: two front panels, dark collar, white hem. */
function happi(color:string,dark:string,letter:string):Paint{
 return g=>{
  for(const side of [-1,1]){
   g.beginPath();
   g.moveTo(207+side*18,196);g.quadraticCurveTo(207+side*70,188,207+side*96,214);
   g.lineTo(207+side*100,300);g.quadraticCurveTo(207+side*60,312,207+side*14,306);g.closePath();
   fill(g,color);stroke(g,3);
   // Collar along the front opening.
   g.beginPath();g.moveTo(207+side*18,196);g.lineTo(207+side*14,306);g.lineWidth=13;g.strokeStyle=dark;g.lineCap='butt';g.stroke();
   // White wave hem.
   g.beginPath();g.moveTo(207+side*20,296);
   for(let i=1;i<=4;i++)g.quadraticCurveTo(207+side*(20+i*20-10),288,207+side*(20+i*20),296);
   g.lineWidth=4;g.strokeStyle='#fff8e8';g.lineCap='round';g.stroke();
  }
  g.fillStyle='#fff8e8';g.font='900 26px "Hiragino Sans","Yu Gothic",sans-serif';g.textAlign='center';g.textBaseline='middle';
  g.fillText(letter,207+54,248);
 };
}
/** Something on a stick, held up in the right paw and leaning outwards. */
function onStick(length:number,paint:Paint,angle=16):Outfit['hold']{
 return {paw:'right',angle,paint:g=>{g.beginPath();g.moveTo(0,8);g.lineTo(0,-length);g.lineWidth=7;g.strokeStyle=INK;g.lineCap='round';g.stroke();g.lineWidth=4;g.strokeStyle='#d8b27a';g.stroke();paint(g);}};
}
/** Something hanging from the left paw on a string. */
function hanging(length:number,paint:Paint,color='#e3402b'):Outfit['hold']{
 return {paw:'left',paint:g=>{g.beginPath();g.moveTo(0,0);g.lineTo(0,length);g.lineWidth=2.5;g.strokeStyle=color;g.stroke();paint(g);}};
}

/** Special coats. The reddest "fur" pixels are the tongue: they keep their colour. */
const coat=(id:string,name:string,fur:(s:number,v:number)=>[number,number,number],scarfHue:number):Variant=>({id,name,scarfHue,fur:(h,s,v)=>h<16?[h,s,v]:fur(s,v)});
export const COATS={
 kin:coat('kin','きんまる',(s,v)=>[42,Math.min(1,s*1.05+.1),Math.min(1,.3+v*.78)],350),
 sakura:coat('sakura','さくらまる',(s,v)=>[344,Math.min(1,s*.42),Math.min(1,.62+v*.42)],120),
 /** Only met on stage (not in the draw). */
 gin:coat('gin','ぎんまる',(s,v)=>[212,s*.16,Math.min(1,.5+v*.55)],208),
};

export const COSTUMES:Costume[]=[
 // N
 {id:'hachimaki',name:'赤はちまき',rarity:'N',blurb:'気合いが入る、お祭りの定番。',outfit:{head:hachimaki('#e3402b','#ff8c6b')}},
 {id:'hachimaki-ai',name:'藍はちまき',rarity:'N',blurb:'しぶい藍色で、きりっと。',outfit:{head:hachimaki('#2c4a8c','#6f8fd6',g=>{g.fillStyle='#fff8e8';for(const x of [150,190,230,270])g.fillRect(x,88+(x-207)*(x-207)/1500,6,6);})}},
 {id:'uchiwa',name:'うちわ',rarity:'N',blurb:'ぱたぱた、夏の風。',outfit:{hold:onStick(34,g=>{ellipse(g,0,-66,36,34);fill(g,'#fffaf0');stroke(g,3.5);for(let i=-3;i<=3;i++){g.beginPath();g.moveTo(0,-34);g.lineTo(i*11,-96+Math.abs(i)*6);g.lineWidth=1;g.strokeStyle='rgba(30,23,38,.25)';g.stroke();}ellipse(g,0,-66,16,16);fill(g,'#e3402b');})}},
 {id:'kingyo',name:'金魚',rarity:'N',blurb:'金魚すくいで、一匹ゲット。',cardPose:3,outfit:{hold:hanging(22,g=>{
  g.beginPath();g.moveTo(-8,22);g.quadraticCurveTo(0,18,8,22);g.lineTo(24,34);g.quadraticCurveTo(34,80,0,86);g.quadraticCurveTo(-34,80,-24,34);g.closePath();g.fillStyle='rgba(170,220,255,.6)';g.fill();stroke(g,3);
  g.beginPath();g.moveTo(-22,52);g.quadraticCurveTo(0,58,22,52);g.lineWidth=2;g.strokeStyle='rgba(255,255,255,.8)';g.stroke();
  ellipse(g,2,66,12,7,.25);fill(g,'#ff7a2e');g.beginPath();g.moveTo(-9,62);g.lineTo(-19,55);g.lineTo(-17,72);g.closePath();fill(g,'#ff7a2e');ellipse(g,8,64,1.8,1.8);fill(g,INK);})}},
 {id:'wataame',name:'わたあめ',rarity:'N',blurb:'ふわふわ、あまい雲。',outfit:{hold:onStick(40,g=>{ellipse(g,0,-70,34,31);stroke(g,5,'rgba(30,23,38,.55)');for(const [x,y,r] of [[0,-70,30],[-18,-60,20],[18,-62,21],[-8,-88,19],[12,-86,18]]){ellipse(g,x,y,r,r);fill(g,'#ffc7e0');}for(const [x,y] of [[-10,-78],[12,-64],[-4,-58]]){ellipse(g,x,y,6,4);fill(g,'#fff0f7');}})}},
 {id:'ringoame',name:'りんごあめ',rarity:'N',blurb:'つやつや、真っ赤。',outfit:{hold:onStick(34,g=>{ellipse(g,0,-56,24,23);fill(g,'#e3262b');stroke(g,3.5);g.beginPath();g.moveTo(0,-78);g.quadraticCurveTo(8,-90,16,-86);stroke(g,3,'#5a8a3a');ellipse(g,-9,-64,8,5,-.5);fill(g,'rgba(255,255,255,.85)');})}},
 {id:'yoyo',name:'水ヨーヨー',rarity:'N',blurb:'ぽよん、ぽよん。',cardPose:3,outfit:{hold:hanging(34,g=>{ellipse(g,0,58,24,23);fill(g,'#6ed0f5');stroke(g,3);g.beginPath();g.moveTo(-22,50);g.quadraticCurveTo(0,42,22,50);g.moveTo(-23,62);g.quadraticCurveTo(0,70,23,62);g.lineWidth=4;g.strokeStyle='#ff7eb6';g.stroke();ellipse(g,-8,48,6,4,-.4);fill(g,'rgba(255,255,255,.8)');},'#ff7eb6')}},
 {id:'kazaguruma',name:'風車',rarity:'N',blurb:'くるくる回って、いい気分。',outfit:{hold:onStick(46,g=>{const cy=-62;for(let i=0;i<4;i++){g.save();g.translate(0,cy);g.rotate(i*Math.PI/2+.3);g.beginPath();g.moveTo(0,0);g.lineTo(36,-6);g.quadraticCurveTo(30,18,0,0);g.closePath();fill(g,['#ff6b5a','#ffd86b','#6ee7ff','#7ed36f'][i]);stroke(g,2.5);g.restore();}ellipse(g,0,cy,5,5);fill(g,INK);})}},
 // R
 {id:'kitsune',name:'きつねのお面',rarity:'R',blurb:'横にかけるのが、通っぽい。',outfit:{head:mask(282,76,.42,g=>{g.scale(1.4,1.4);
  g.beginPath();g.moveTo(-26,-26);g.lineTo(-18,-50);g.lineTo(-6,-28);g.lineTo(6,-28);g.lineTo(18,-50);g.lineTo(26,-26);g.quadraticCurveTo(34,4,0,34);g.quadraticCurveTo(-34,4,-26,-26);g.closePath();fill(g,'#fffaf0');stroke(g,3);
  g.beginPath();g.moveTo(-18,-6);g.quadraticCurveTo(-10,-12,-4,-6);g.moveTo(4,-6);g.quadraticCurveTo(10,-12,18,-6);g.lineWidth=3;g.strokeStyle='#e3402b';g.stroke();
  for(const s of [-1,1]){g.beginPath();g.moveTo(s*16,-40);g.lineTo(s*19,-30);g.lineWidth=4;g.strokeStyle='#e3402b';g.stroke();}
  ellipse(g,0,18,4,3);fill(g,INK);g.beginPath();g.moveTo(-12,8);g.lineTo(-20,12);g.moveTo(12,8);g.lineTo(20,12);g.lineWidth=2.5;g.strokeStyle='#e3402b';g.stroke();})}},
 {id:'oni',name:'赤おにのお面',rarity:'R',blurb:'こわくない、やさしい鬼。',outfit:{head:mask(132,76,-.42,g=>{g.scale(1.35,1.35);
  for(const s of [-1,1]){g.beginPath();g.moveTo(s*12,-24);g.lineTo(s*20,-48);g.lineTo(s*26,-22);g.closePath();fill(g,'#ffe066');stroke(g,2.5);}
  ellipse(g,0,0,29,31);fill(g,'#e3402b');stroke(g,3);
  for(const s of [-1,1]){g.beginPath();g.moveTo(s*20,-12);g.lineTo(s*6,-6);g.lineWidth=4;g.strokeStyle=INK;g.stroke();ellipse(g,s*11,2,5,4);fill(g,'#fff');}
  g.beginPath();g.moveTo(-12,16);g.quadraticCurveTo(0,24,12,16);g.lineWidth=3;g.strokeStyle=INK;g.stroke();
  for(const s of [-1,1]){g.beginPath();g.moveTo(s*7,17);g.lineTo(s*9,25);g.lineTo(s*11,16);g.closePath();fill(g,'#fff');}})}},
 {id:'happi',cardPose:3,name:'はっぴ（赤）',rarity:'R',blurb:'祭の字を背負って、ドン！',outfit:{body:happi('#d8392b','#2b2440','祭')}},
 {id:'happi-ai',cardPose:3,name:'はっぴ（藍）',rarity:'R',blurb:'藍染めで、粋に。',outfit:{body:happi('#2c4a8c','#e3402b','粋')}},
 {id:'yukata',cardPose:3,name:'ゆかた',rarity:'R',blurb:'夕涼みの、おでかけ着。',outfit:{body:g=>{
  for(const side of [-1,1]){g.beginPath();g.moveTo(207+side*16,196);g.quadraticCurveTo(207+side*70,186,207+side*98,214);g.lineTo(207+side*104,330);g.quadraticCurveTo(207+side*60,342,207+side*4,336);g.closePath();fill(g,'#2e3f6e');stroke(g,3);
   for(const [x,y] of [[50,236],[78,270],[40,300],[84,318]]){g.save();g.translate(207+side*x,y);for(let i=0;i<5;i++){ellipse(g,Math.cos(i*1.257)*5,Math.sin(i*1.257)*5,4,4);fill(g,'#f7f1e3');}ellipse(g,0,0,2.5,2.5);fill(g,'#ffd86b');g.restore();}}
  g.beginPath();g.moveTo(223,196);g.lineTo(191,336);g.lineWidth=5;g.strokeStyle='#f7f1e3';g.stroke();
  // Obi: a wide sash with a yellow cord and a small knot in front.
  g.beginPath();g.roundRect(112,280,190,28,6);fill(g,'#e3402b');stroke(g,3);
  g.beginPath();g.moveTo(114,294);g.lineTo(300,294);g.lineWidth=4;g.strokeStyle='#ffd86b';g.stroke();
  ellipse(g,207,294,8,6);fill(g,'#ffd86b');stroke(g,2);
  for(const s2 of [-1,1]){g.beginPath();g.moveTo(207+s2*4,298);g.quadraticCurveTo(207+s2*10,310,207+s2*6,320);g.lineWidth=3;g.strokeStyle='#ffd86b';g.stroke();}}}},
 {id:'sangurasu',name:'サングラス',rarity:'R',blurb:'今日の主役は、ぼく。',outfit:{head:g=>{
  for(const x of [160,254]){g.beginPath();g.roundRect(x-30,112,60,34,12);fill(g,'#231c2e');stroke(g,3);g.beginPath();g.moveTo(x-18,120);g.lineTo(x-6,120);g.lineWidth=3;g.strokeStyle='rgba(255,255,255,.55)';g.stroke();}
  g.beginPath();g.moveTo(190,124);g.quadraticCurveTo(207,116,224,124);stroke(g,4);}}},
 // SR
 {id:'senkou',name:'線香花火',rarity:'SR',blurb:'ぱちぱち、夏の夜のひかり。',cardPose:3,outfit:{hold:{paw:'right',paint:g=>{g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(4,26,10,52);g.lineWidth=3.5;g.strokeStyle='#b0578f';g.stroke();
  const glow=g.createRadialGradient(11,60,0,11,60,44);glow.addColorStop(0,'rgba(255,225,130,.95)');glow.addColorStop(.3,'rgba(255,150,60,.55)');glow.addColorStop(1,'rgba(255,120,40,0)');g.fillStyle=glow;g.fillRect(-33,16,88,88);
  ellipse(g,11,60,8,8);fill(g,'#ff8a3d');
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2,r=20+(i%3)*10;g.beginPath();g.moveTo(11+Math.cos(a)*11,60+Math.sin(a)*11);g.lineTo(11+Math.cos(a)*r,60+Math.sin(a)*r);g.lineTo(11+Math.cos(a+.3)*(r+8),60+Math.sin(a+.3)*(r+8));g.lineWidth=2.5;g.strokeStyle='#ffd86b';g.stroke();}}}}},
 {id:'chochin',name:'ちょうちん',rarity:'SR',blurb:'ぼんやり灯る、祭の灯り。',cardPose:3,outfit:{hold:hanging(16,g=>{
  const glow=g.createRadialGradient(0,50,0,0,50,64);glow.addColorStop(0,'rgba(255,190,90,.7)');glow.addColorStop(1,'rgba(255,150,60,0)');g.fillStyle=glow;g.fillRect(-64,-14,128,128);
  g.beginPath();g.roundRect(-20,16,40,8,2);fill(g,INK);g.beginPath();g.roundRect(-20,78,40,8,2);fill(g,INK);
  ellipse(g,0,51,29,31);fill(g,'#ff6a3d');stroke(g,3.5);
  for(const dx of [-15,0,15]){g.beginPath();g.moveTo(dx*.8,22);g.quadraticCurveTo(dx*1.35,51,dx*.8,80);g.lineWidth=1.5;g.strokeStyle='rgba(122,31,22,.7)';g.stroke();}
  g.fillStyle='#fff3c4';g.font='900 22px "Hiragino Sans","Yu Gothic",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('祭',0,53);},'#5a3a24')}},
 {id:'kin-hachimaki',name:'達人のはちまき',rarity:'SR',blurb:'金の刺しゅう「達人」。',outfit:{head:hachimaki('#f4c13d','#fff1a8',g=>{g.fillStyle='#8a3a12';g.font='900 18px "Hiragino Sans","Yu Gothic",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('達人',207,94);})}},
 {id:'mini-taiko',cardPose:3,name:'ミニ太鼓',rarity:'SR',blurb:'どこでもドン！ カッ！',outfit:{body:g=>{
  g.beginPath();g.moveTo(150,238);g.quadraticCurveTo(207,200,264,238);g.lineWidth=4;g.strokeStyle='#e3402b';g.stroke();
  g.beginPath();g.moveTo(166,272);g.lineTo(166,318);g.quadraticCurveTo(207,336,248,318);g.lineTo(248,272);g.closePath();fill(g,'#c7352b');stroke(g,3);
  for(let i=0;i<9;i++){ellipse(g,170+i*9.2,300+Math.sin(i/8*Math.PI)*8,2.2,2.2);fill(g,'#ffd86b');}
  ellipse(g,207,272,41,12);fill(g,'#fbf1dc');stroke(g,3);
  g.fillStyle='#e3402b';g.font='900 13px "Hiragino Sans","Yu Gothic",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('ドン',207,273);}}},
 // SSR
 {id:'kin',name:'きんまる',rarity:'SSR',blurb:'見ると、いいことがある。',coat:COATS.kin},
 {id:'sakura',name:'さくらまる',rarity:'SSR',blurb:'春をつれてくる、さくら色。',coat:COATS.sakura},
 {id:'oukan',name:'おうさま',rarity:'SSR',blurb:'祭の王さま、ここに。',outfit:{
  under:g=>{g.beginPath();g.moveTo(140,210);g.quadraticCurveTo(207,196,274,210);g.lineTo(318,378);g.quadraticCurveTo(207,396,96,378);g.closePath();fill(g,'#c4213b');stroke(g,3);
   g.beginPath();g.moveTo(104,370);g.quadraticCurveTo(207,388,310,370);g.lineWidth=9;g.strokeStyle='#fff8e8';g.stroke();for(let i=0;i<7;i++){ellipse(g,120+i*29,374+Math.sin(i/6*Math.PI)*8,2.5,3.5);fill(g,INK);}},
  head:g=>{g.beginPath();g.moveTo(166,50);g.lineTo(160,12);g.lineTo(184,32);g.lineTo(207,4);g.lineTo(230,32);g.lineTo(254,12);g.lineTo(248,50);g.closePath();fill(g,'#ffd23f');stroke(g,3);
   g.beginPath();g.rect(166,44,82,12);fill(g,'#e8b84f');stroke(g,2.5);
   for(const [x,y,c] of [[207,28,'#e3402b'],[184,40,'#2cbbd5'],[230,40,'#7ed36f']] as const){ellipse(g,x,y,5,5);fill(g,c);stroke(g,1.5);}}}},
];

export const COSTUME_BY_ID=new Map(COSTUMES.map(c=>[c.id,c]));
export const RARITY_LABEL:Record<Rarity,string>={N:'ノーマル',R:'レア',SR:'スーパーレア',SSR:'ウルトラレア'};
export const RARITY_COLOR:Record<Rarity,string>={N:'#9aa7b8',R:'#4fb3e8',SR:'#f0b429',SSR:'#ff5fa2'};
