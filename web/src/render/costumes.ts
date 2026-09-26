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
export interface Costume {id:string;name:string;rarity:Rarity;blurb:string;series:string;outfit?:Outfit;coat?:Variant;cardPose?:number}
/** A set of outfits; collecting all of a series pays its bonus once. */
export interface Series {id:string;name:string;bonus:number}
export const SERIES:Series[]=[
 {id:'hachimaki',name:'はちまき',bonus:150},
 {id:'yatai',name:'屋台のごちそう',bonus:200},
 {id:'ennichi',name:'縁日あそび',bonus:150},
 {id:'omen',name:'お面',bonus:250},
 {id:'ishou',name:'お祭りの衣装',bonus:300},
 {id:'natsuyo',name:'夏の夜',bonus:300},
 {id:'oshare',name:'おしゃれ小物',bonus:200},
 {id:'boushi',name:'ぼうし・かざり',bonus:250},
 {id:'hare',name:'晴れの日',bonus:350},
 {id:'kenami',name:'特別な毛色',bonus:600},
 {id:'densetsu',name:'伝説の柴',bonus:800},
];
/** Bones for collecting every outfit. */
export const COMPLETE_BONUS=3000;

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
function happi(color:string,dark:string,letter:string,letterColor='#fff8e8'):Paint{
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
  g.fillStyle=letterColor;g.font='900 26px "Hiragino Sans","Yu Gothic",sans-serif';g.textAlign='center';g.textBaseline='middle';
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

/** A held thing drawn larger (scaled about the grip). */
const scaled=(k:number,hold:Outfit['hold']):Outfit['hold']=>hold&&{...hold,paint:g=>{g.scale(k,k);hold.paint(g);}};
/** Centred text (Japanese sans). */
function text(g:CanvasRenderingContext2D,str:string,x:number,y:number,size:number,color:string){g.fillStyle=color;g.font=`900 ${size}px "Hiragino Sans","Yu Gothic",sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(str,x,y);}
/** A small five-petal flower. */
function flower(g:CanvasRenderingContext2D,x:number,y:number,r:number,petal:string,center='#ffd86b'){for(let i=0;i<5;i++){const a=i/5*Math.PI*2-Math.PI/2;ellipse(g,x+Math.cos(a)*r*.6,y+Math.sin(a)*r*.6,r*.48,r*.48);fill(g,petal);}ellipse(g,x,y,r*.34,r*.34);fill(g,center);}
/** A heart shape centred at (x,y), about 2s wide. */
function heart(g:CanvasRenderingContext2D,x:number,y:number,s:number){g.beginPath();g.moveTo(x,y+s*.9);g.bezierCurveTo(x-s*1.3,y+s*.1,x-s*.9,y-s*.95,x,y-s*.35);g.bezierCurveTo(x+s*.9,y-s*.95,x+s*1.3,y+s*.1,x,y+s*.9);g.closePath();}
/** Points along the headband's top and bottom edges (t from the left end to the knot). */
const bandTop=(t:number)=>[(1-t)**2*108+2*t*(1-t)*207+t*t*308,(1-t)**2*104+2*t*(1-t)*68+t*t*96];
const bandBottom=(t:number)=>[(1-t)**2*110+2*t*(1-t)*207+t*t*306,(1-t)**2*122+2*t*(1-t)*88+t*t*114];
/** A yukata: long crossed panels with a pattern, a wide obi and a cord. */
function yukata(base:string,pattern:(g:CanvasRenderingContext2D,x:number,y:number,i:number)=>void,obi:string,cord:string,collar='#f7f1e3'):Paint{
 return g=>{
  for(const side of [-1,1]){
   g.beginPath();g.moveTo(207+side*16,196);g.quadraticCurveTo(207+side*70,186,207+side*98,214);g.lineTo(207+side*104,330);g.quadraticCurveTo(207+side*60,342,207+side*4,336);g.closePath();fill(g,base);stroke(g,3);
   [[50,236],[78,270],[40,300],[84,318]].forEach(([x,y],i)=>pattern(g,207+side*x,y,i));
  }
  g.beginPath();g.moveTo(223,196);g.lineTo(191,336);g.lineWidth=5;g.strokeStyle=collar;g.stroke();
  g.beginPath();g.roundRect(112,280,190,28,6);fill(g,obi);stroke(g,3);
  g.beginPath();g.moveTo(114,294);g.lineTo(300,294);g.lineWidth=4;g.strokeStyle=cord;g.stroke();
  ellipse(g,207,294,8,6);fill(g,cord);stroke(g,2);
 };
}
/** A mask worn on the side of the head, drawn in its own small box (scaled up). */
const sideMask=(side:'left'|'right',paint:Paint)=>side==='left'?mask(132,76,-.42,g=>{g.scale(1.35,1.35);paint(g);}):mask(282,76,.42,g=>{g.scale(1.4,1.4);paint(g);});

/** Special coats. The reddest "fur" pixels are the tongue: they keep their colour. */
const coat=(id:string,name:string,fur:(s:number,v:number)=>[number,number,number],scarfHue:number):Variant=>({id,name,scarfHue,fur:(h,s,v)=>h<16?[h,s,v]:fur(s,v)});
export const COATS={
 kin:coat('kin','きんまる',(s,v)=>[42,Math.min(1,s*1.05+.1),Math.min(1,.3+v*.78)],350),
 sakura:coat('sakura','さくらまる',(s,v)=>[344,Math.min(1,s*.42),Math.min(1,.62+v*.42)],120),
 /** Only met on stage (not in the draw). */
 gin:coat('gin','ぎんまる',(s,v)=>[212,s*.16,Math.min(1,.5+v*.55)],208),
 sora:coat('sora','そらまる',(s,v)=>[198,Math.min(1,s*.55+.12),Math.min(1,.5+v*.52)],28),
 yoru:coat('yoru','よるまる',(s,v)=>[236,Math.min(1,s*.5+.22),Math.min(1,.14+v*.5)],48),
 mint:coat('mint','ミントまる',(s,v)=>[160,Math.min(1,s*.46),Math.min(1,.55+v*.45)],330),
 choco:coat('choco','チョコまる',(s,v)=>[20,Math.min(1,s*.85),Math.min(1,.1+v*.4)],150),
};

export const COSTUMES:Costume[]=[
 // N
 {id:'hachimaki',series:'hachimaki',name:'赤はちまき',rarity:'N',blurb:'気合いが入る、お祭りの定番。',outfit:{head:hachimaki('#e3402b','#ff8c6b')}},
 {id:'hachimaki-ai',series:'hachimaki',name:'藍はちまき',rarity:'N',blurb:'しぶい藍色で、きりっと。',outfit:{head:hachimaki('#2c4a8c','#6f8fd6',g=>{g.fillStyle='#fff8e8';for(const x of [150,190,230,270])g.fillRect(x,88+(x-207)*(x-207)/1500,6,6);})}},
 {id:'uchiwa',series:'ennichi',name:'うちわ',rarity:'N',blurb:'ぱたぱた、夏の風。',outfit:{hold:onStick(34,g=>{ellipse(g,0,-66,36,34);fill(g,'#fffaf0');stroke(g,3.5);for(let i=-3;i<=3;i++){g.beginPath();g.moveTo(0,-34);g.lineTo(i*11,-96+Math.abs(i)*6);g.lineWidth=1;g.strokeStyle='rgba(30,23,38,.25)';g.stroke();}ellipse(g,0,-66,16,16);fill(g,'#e3402b');})}},
 {id:'kingyo',series:'ennichi',name:'金魚',rarity:'N',blurb:'金魚すくいで、一匹ゲット。',cardPose:3,outfit:{hold:hanging(22,g=>{
  g.beginPath();g.moveTo(-8,22);g.quadraticCurveTo(0,18,8,22);g.lineTo(24,34);g.quadraticCurveTo(34,80,0,86);g.quadraticCurveTo(-34,80,-24,34);g.closePath();g.fillStyle='rgba(170,220,255,.6)';g.fill();stroke(g,3);
  g.beginPath();g.moveTo(-22,52);g.quadraticCurveTo(0,58,22,52);g.lineWidth=2;g.strokeStyle='rgba(255,255,255,.8)';g.stroke();
  ellipse(g,2,66,12,7,.25);fill(g,'#ff7a2e');g.beginPath();g.moveTo(-9,62);g.lineTo(-19,55);g.lineTo(-17,72);g.closePath();fill(g,'#ff7a2e');ellipse(g,8,64,1.8,1.8);fill(g,INK);})}},
 {id:'wataame',series:'yatai',name:'わたあめ',rarity:'N',blurb:'ふわふわ、あまい雲。',outfit:{hold:onStick(40,g=>{ellipse(g,0,-70,34,31);stroke(g,5,'rgba(30,23,38,.55)');for(const [x,y,r] of [[0,-70,30],[-18,-60,20],[18,-62,21],[-8,-88,19],[12,-86,18]]){ellipse(g,x,y,r,r);fill(g,'#ffc7e0');}for(const [x,y] of [[-10,-78],[12,-64],[-4,-58]]){ellipse(g,x,y,6,4);fill(g,'#fff0f7');}})}},
 {id:'ringoame',series:'yatai',name:'りんごあめ',rarity:'N',blurb:'つやつや、真っ赤。',outfit:{hold:onStick(34,g=>{ellipse(g,0,-56,24,23);fill(g,'#e3262b');stroke(g,3.5);g.beginPath();g.moveTo(0,-78);g.quadraticCurveTo(8,-90,16,-86);stroke(g,3,'#5a8a3a');ellipse(g,-9,-64,8,5,-.5);fill(g,'rgba(255,255,255,.85)');})}},
 {id:'yoyo',series:'ennichi',name:'水ヨーヨー',rarity:'N',blurb:'ぽよん、ぽよん。',cardPose:3,outfit:{hold:hanging(34,g=>{ellipse(g,0,58,24,23);fill(g,'#6ed0f5');stroke(g,3);g.beginPath();g.moveTo(-22,50);g.quadraticCurveTo(0,42,22,50);g.moveTo(-23,62);g.quadraticCurveTo(0,70,23,62);g.lineWidth=4;g.strokeStyle='#ff7eb6';g.stroke();ellipse(g,-8,48,6,4,-.4);fill(g,'rgba(255,255,255,.8)');},'#ff7eb6')}},
 {id:'kazaguruma',series:'ennichi',name:'風車',rarity:'N',blurb:'くるくる回って、いい気分。',outfit:{hold:onStick(46,g=>{const cy=-62;for(let i=0;i<4;i++){g.save();g.translate(0,cy);g.rotate(i*Math.PI/2+.3);g.beginPath();g.moveTo(0,0);g.lineTo(36,-6);g.quadraticCurveTo(30,18,0,0);g.closePath();fill(g,['#ff6b5a','#ffd86b','#6ee7ff','#7ed36f'][i]);stroke(g,2.5);g.restore();}ellipse(g,0,cy,5,5);fill(g,INK);})}},
 // R
 {id:'kitsune',series:'omen',name:'きつねのお面',rarity:'R',blurb:'横にかけるのが、通っぽい。',outfit:{head:mask(282,76,.42,g=>{g.scale(1.4,1.4);
  g.beginPath();g.moveTo(-26,-26);g.lineTo(-18,-50);g.lineTo(-6,-28);g.lineTo(6,-28);g.lineTo(18,-50);g.lineTo(26,-26);g.quadraticCurveTo(34,4,0,34);g.quadraticCurveTo(-34,4,-26,-26);g.closePath();fill(g,'#fffaf0');stroke(g,3);
  g.beginPath();g.moveTo(-18,-6);g.quadraticCurveTo(-10,-12,-4,-6);g.moveTo(4,-6);g.quadraticCurveTo(10,-12,18,-6);g.lineWidth=3;g.strokeStyle='#e3402b';g.stroke();
  for(const s of [-1,1]){g.beginPath();g.moveTo(s*16,-40);g.lineTo(s*19,-30);g.lineWidth=4;g.strokeStyle='#e3402b';g.stroke();}
  ellipse(g,0,18,4,3);fill(g,INK);g.beginPath();g.moveTo(-12,8);g.lineTo(-20,12);g.moveTo(12,8);g.lineTo(20,12);g.lineWidth=2.5;g.strokeStyle='#e3402b';g.stroke();})}},
 {id:'oni',series:'omen',name:'赤おにのお面',rarity:'R',blurb:'こわくない、やさしい鬼。',outfit:{head:mask(132,76,-.42,g=>{g.scale(1.35,1.35);
  for(const s of [-1,1]){g.beginPath();g.moveTo(s*12,-24);g.lineTo(s*20,-48);g.lineTo(s*26,-22);g.closePath();fill(g,'#ffe066');stroke(g,2.5);}
  ellipse(g,0,0,29,31);fill(g,'#e3402b');stroke(g,3);
  for(const s of [-1,1]){g.beginPath();g.moveTo(s*20,-12);g.lineTo(s*6,-6);g.lineWidth=4;g.strokeStyle=INK;g.stroke();ellipse(g,s*11,2,5,4);fill(g,'#fff');}
  g.beginPath();g.moveTo(-12,16);g.quadraticCurveTo(0,24,12,16);g.lineWidth=3;g.strokeStyle=INK;g.stroke();
  for(const s of [-1,1]){g.beginPath();g.moveTo(s*7,17);g.lineTo(s*9,25);g.lineTo(s*11,16);g.closePath();fill(g,'#fff');}})}},
 {id:'happi',series:'ishou',cardPose:3,name:'はっぴ（赤）',rarity:'R',blurb:'祭の字を背負って、ドン！',outfit:{body:happi('#d8392b','#2b2440','祭')}},
 {id:'happi-ai',series:'ishou',cardPose:3,name:'はっぴ（藍）',rarity:'R',blurb:'藍染めで、粋に。',outfit:{body:happi('#2c4a8c','#e3402b','粋')}},
 {id:'yukata',series:'ishou',cardPose:3,name:'ゆかた',rarity:'R',blurb:'夕涼みの、おでかけ着。',outfit:{body:g=>{
  for(const side of [-1,1]){g.beginPath();g.moveTo(207+side*16,196);g.quadraticCurveTo(207+side*70,186,207+side*98,214);g.lineTo(207+side*104,330);g.quadraticCurveTo(207+side*60,342,207+side*4,336);g.closePath();fill(g,'#2e3f6e');stroke(g,3);
   for(const [x,y] of [[50,236],[78,270],[40,300],[84,318]]){g.save();g.translate(207+side*x,y);for(let i=0;i<5;i++){ellipse(g,Math.cos(i*1.257)*5,Math.sin(i*1.257)*5,4,4);fill(g,'#f7f1e3');}ellipse(g,0,0,2.5,2.5);fill(g,'#ffd86b');g.restore();}}
  g.beginPath();g.moveTo(223,196);g.lineTo(191,336);g.lineWidth=5;g.strokeStyle='#f7f1e3';g.stroke();
  // Obi: a wide sash with a yellow cord and a small knot in front.
  g.beginPath();g.roundRect(112,280,190,28,6);fill(g,'#e3402b');stroke(g,3);
  g.beginPath();g.moveTo(114,294);g.lineTo(300,294);g.lineWidth=4;g.strokeStyle='#ffd86b';g.stroke();
  ellipse(g,207,294,8,6);fill(g,'#ffd86b');stroke(g,2);
  for(const s2 of [-1,1]){g.beginPath();g.moveTo(207+s2*4,298);g.quadraticCurveTo(207+s2*10,310,207+s2*6,320);g.lineWidth=3;g.strokeStyle='#ffd86b';g.stroke();}}}},
 {id:'sangurasu',series:'oshare',name:'サングラス',rarity:'R',blurb:'今日の主役は、ぼく。',outfit:{head:g=>{
  for(const x of [160,254]){g.beginPath();g.roundRect(x-30,112,60,34,12);fill(g,'#231c2e');stroke(g,3);g.beginPath();g.moveTo(x-18,120);g.lineTo(x-6,120);g.lineWidth=3;g.strokeStyle='rgba(255,255,255,.55)';g.stroke();}
  g.beginPath();g.moveTo(190,124);g.quadraticCurveTo(207,116,224,124);stroke(g,4);}}},
 // SR
 {id:'senkou',series:'natsuyo',name:'線香花火',rarity:'SR',blurb:'ぱちぱち、夏の夜のひかり。',cardPose:3,outfit:{hold:{paw:'right',paint:g=>{g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(4,26,10,52);g.lineWidth=3.5;g.strokeStyle='#b0578f';g.stroke();
  const glow=g.createRadialGradient(11,60,0,11,60,44);glow.addColorStop(0,'rgba(255,225,130,.95)');glow.addColorStop(.3,'rgba(255,150,60,.55)');glow.addColorStop(1,'rgba(255,120,40,0)');g.fillStyle=glow;g.fillRect(-33,16,88,88);
  ellipse(g,11,60,8,8);fill(g,'#ff8a3d');
  for(let i=0;i<12;i++){const a=i/12*Math.PI*2,r=20+(i%3)*10;g.beginPath();g.moveTo(11+Math.cos(a)*11,60+Math.sin(a)*11);g.lineTo(11+Math.cos(a)*r,60+Math.sin(a)*r);g.lineTo(11+Math.cos(a+.3)*(r+8),60+Math.sin(a+.3)*(r+8));g.lineWidth=2.5;g.strokeStyle='#ffd86b';g.stroke();}}}}},
 {id:'chochin',series:'natsuyo',name:'ちょうちん',rarity:'SR',blurb:'ぼんやり灯る、祭の灯り。',cardPose:3,outfit:{hold:hanging(16,g=>{
  const glow=g.createRadialGradient(0,50,0,0,50,64);glow.addColorStop(0,'rgba(255,190,90,.7)');glow.addColorStop(1,'rgba(255,150,60,0)');g.fillStyle=glow;g.fillRect(-64,-14,128,128);
  g.beginPath();g.roundRect(-20,16,40,8,2);fill(g,INK);g.beginPath();g.roundRect(-20,78,40,8,2);fill(g,INK);
  ellipse(g,0,51,29,31);fill(g,'#ff6a3d');stroke(g,3.5);
  for(const dx of [-15,0,15]){g.beginPath();g.moveTo(dx*.8,22);g.quadraticCurveTo(dx*1.35,51,dx*.8,80);g.lineWidth=1.5;g.strokeStyle='rgba(122,31,22,.7)';g.stroke();}
  g.fillStyle='#fff3c4';g.font='900 22px "Hiragino Sans","Yu Gothic",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('祭',0,53);},'#5a3a24')}},
 {id:'kin-hachimaki',series:'hachimaki',name:'達人のはちまき',rarity:'SR',blurb:'金の刺しゅう「達人」。',outfit:{head:hachimaki('#f4c13d','#fff1a8',g=>{g.fillStyle='#8a3a12';g.font='900 18px "Hiragino Sans","Yu Gothic",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('達人',207,94);})}},
 {id:'mini-taiko',series:'densetsu',cardPose:3,name:'ミニ太鼓',rarity:'SR',blurb:'どこでもドン！ カッ！',outfit:{body:g=>{
  g.beginPath();g.moveTo(150,238);g.quadraticCurveTo(207,200,264,238);g.lineWidth=4;g.strokeStyle='#e3402b';g.stroke();
  g.beginPath();g.moveTo(166,272);g.lineTo(166,318);g.quadraticCurveTo(207,336,248,318);g.lineTo(248,272);g.closePath();fill(g,'#c7352b');stroke(g,3);
  for(let i=0;i<9;i++){ellipse(g,170+i*9.2,300+Math.sin(i/8*Math.PI)*8,2.2,2.2);fill(g,'#ffd86b');}
  ellipse(g,207,272,41,12);fill(g,'#fbf1dc');stroke(g,3);
  g.fillStyle='#e3402b';g.font='900 13px "Hiragino Sans","Yu Gothic",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('ドン',207,273);}}},
 // SSR
 {id:'kin',series:'kenami',name:'きんまる',rarity:'SSR',blurb:'見ると、いいことがある。',coat:COATS.kin},
 {id:'sakura',series:'kenami',name:'さくらまる',rarity:'SSR',blurb:'春をつれてくる、さくら色。',coat:COATS.sakura},
 {id:'oukan',series:'densetsu',name:'おうさま',rarity:'SSR',blurb:'祭の王さま、ここに。',outfit:{
  under:g=>{g.beginPath();g.moveTo(140,210);g.quadraticCurveTo(207,196,274,210);g.lineTo(318,378);g.quadraticCurveTo(207,396,96,378);g.closePath();fill(g,'#c4213b');stroke(g,3);
   g.beginPath();g.moveTo(104,370);g.quadraticCurveTo(207,388,310,370);g.lineWidth=9;g.strokeStyle='#fff8e8';g.stroke();for(let i=0;i<7;i++){ellipse(g,120+i*29,374+Math.sin(i/6*Math.PI)*8,2.5,3.5);fill(g,INK);}},
  head:g=>{g.beginPath();g.moveTo(166,50);g.lineTo(160,12);g.lineTo(184,32);g.lineTo(207,4);g.lineTo(230,32);g.lineTo(254,12);g.lineTo(248,50);g.closePath();fill(g,'#ffd23f');stroke(g,3);
   g.beginPath();g.rect(166,44,82,12);fill(g,'#e8b84f');stroke(g,2.5);
   for(const [x,y,c] of [[207,28,'#e3402b'],[184,40,'#2cbbd5'],[230,40,'#7ed36f']] as const){ellipse(g,x,y,5,5);fill(g,c);stroke(g,1.5);}}}},
 // ---- Added in the big update (2026-09-26) ----
 // N
 {id:'nejiri',series:'hachimaki',name:'ねじりはちまき',rarity:'N',blurb:'ぎゅっとねじって、気合い倍増。',outfit:{head:hachimaki('#e3402b','#e3402b',g=>{for(let t=.05;t<.93;t+=.075){const [x1,y1]=bandTop(t),[x2,y2]=bandBottom(Math.min(1,t+.05));g.beginPath();g.moveTo(x1,y1+2);g.lineTo(x2,y2-2);g.lineWidth=5;g.strokeStyle='#fffaf0';g.lineCap='round';g.stroke();}})}},
 {id:'hissho',series:'hachimaki',name:'必勝はちまき',rarity:'N',blurb:'今日こそ、フルコンボ。',outfit:{head:hachimaki('#fffaf0','#e3402b',g=>{ellipse(g,158,99,7,7);fill(g,'#e3402b');text(g,'必勝',216,94,18,'#e3402b');})}},
 {id:'ribbon',series:'oshare',name:'おおきなリボン',rarity:'N',blurb:'きょうは、とびきりおめかし。',outfit:{head:g=>{g.save();g.translate(146,80);g.rotate(-.35);
  for(const s of [-1,1]){g.beginPath();g.moveTo(-3*s,6);g.lineTo(-18*s,34);g.lineTo(-10*s,36);g.lineTo(-4*s,26);g.lineTo(2*s,38);g.lineTo(0,8);g.closePath();fill(g,'#ff5fa2');stroke(g,2.5);}
  for(const s of [-1,1]){g.beginPath();g.moveTo(0,0);g.bezierCurveTo(s*18,-28,s*46,-18,s*40,0);g.bezierCurveTo(s*46,18,s*18,26,0,0);g.closePath();fill(g,'#ff7eb6');stroke(g,3);g.beginPath();g.moveTo(s*8,-5);g.quadraticCurveTo(s*22,-13,s*32,-5);stroke(g,2,'rgba(255,255,255,.75)');}
  ellipse(g,0,0,9,8);fill(g,'#ff5fa2');stroke(g,2.5);g.restore();}}},
 {id:'kanzashi',series:'oshare',name:'さくらのかんざし',rarity:'N',blurb:'ゆれる花びら、しゃらん。',outfit:{head:g=>{
  g.beginPath();g.moveTo(244,104);g.lineTo(300,62);g.lineWidth=6;g.strokeStyle=INK;g.lineCap='round';g.stroke();g.lineWidth=3;g.strokeStyle='#c93b5a';g.stroke();
  for(const [x,y] of [[276,110],[284,114],[292,110]]){g.beginPath();g.moveTo(x,96);g.lineTo(x,y);g.lineWidth=1.5;g.strokeStyle='#d9a400';g.stroke();ellipse(g,x,y+4,3.5,3.5);fill(g,'#ffb3cf');stroke(g,1.2);}
  flower(g,262,88,12,'#ffc2d8','#ff6f9e');flower(g,280,80,10,'#fff0f6','#ff6f9e');flower(g,270,100,8,'#ff9ec0','#ffd86b');}}},
 {id:'megane',series:'oshare',name:'まるメガネ',rarity:'N',blurb:'かしこそうに見える、はず。',outfit:{head:g=>{
  for(const x of [160,254]){ellipse(g,x,129,27,25);fill(g,'rgba(210,235,255,.25)');stroke(g,4.5,'#4a2e1a');ellipse(g,x-9,120,8,4.5,-.5);fill(g,'rgba(255,255,255,.65)');}
  g.beginPath();g.moveTo(187,126);g.quadraticCurveTo(207,114,227,126);stroke(g,4,'#4a2e1a');
  for(const s of [-1,1]){g.beginPath();g.moveTo(207+s*74,124);g.lineTo(207+s*96,116);stroke(g,4,'#4a2e1a');}}}},
 {id:'hige',series:'oshare',name:'カイゼルひげ',rarity:'N',blurb:'ごきげんよう、の顔になる。',outfit:{head:g=>{
  for(const s of [-1,1]){g.beginPath();g.moveTo(207,168);g.bezierCurveTo(207+s*14,158,207+s*34,176,207+s*48,162);g.bezierCurveTo(207+s*56,154,207+s*52,142,207+s*43,146);g.lineWidth=8;g.strokeStyle='#3a2414';g.lineCap='round';g.stroke();}}}},
 {id:'tsuno',series:'boushi',name:'おにのツノ',rarity:'N',blurb:'がおー。でも中身はやさしい。',outfit:{head:g=>{
  for(const s of [-1,1]){const x=207+s*30;g.beginPath();g.moveTo(x-12,70);g.quadraticCurveTo(x+s*2,42,x+s*12,20);g.quadraticCurveTo(x+s*12,48,x+12,72);g.closePath();fill(g,'#ffe066');stroke(g,3);
   for(const k of [0,1]){g.beginPath();g.moveTo(x-8+s*k*2,60-k*13);g.lineTo(x+8+s*k*4,62-k*13);g.lineWidth=2;g.strokeStyle='#d9a400';g.stroke();}}}}},
 {id:'bowtie',series:'oshare',name:'ちょうネクタイ',rarity:'N',blurb:'水玉で、ちょっとおしゃれ。',cardPose:3,outfit:{body:g=>{
  for(const s of [-1,1]){g.beginPath();g.moveTo(207,258);g.lineTo(207+s*30,242);g.lineTo(207+s*30,274);g.closePath();fill(g,'#e3402b');stroke(g,3);
   for(const [dx,dy] of [[14,-5],[23,4],[15,8]]){ellipse(g,207+s*dx,258+dy,2.6,2.6);fill(g,'#fffaf0');}}
  ellipse(g,207,258,8,9);fill(g,'#c42a20');stroke(g,2.5);}}},
 {id:'bell',series:'oshare',name:'すずのくびわ',rarity:'N',blurb:'歩くと、ちりんと鳴る。',cardPose:3,outfit:{body:g=>{
  g.beginPath();g.moveTo(148,244);g.quadraticCurveTo(207,270,266,244);g.lineWidth=10;g.strokeStyle=INK;g.lineCap='round';g.stroke();g.lineWidth=7;g.strokeStyle='#e3402b';g.stroke();
  ellipse(g,207,274,13,13);fill(g,'#ffd23f');stroke(g,3);g.beginPath();g.moveTo(195,272);g.lineTo(219,272);stroke(g,2);ellipse(g,207,280,3,3);fill(g,INK);ellipse(g,201,267,4,2.6,-.5);fill(g,'rgba(255,255,255,.75)');}}},
 {id:'takoyaki',series:'yatai',name:'たこ焼き',rarity:'N',blurb:'外はカリッ、中はとろっ。',cardPose:3,outfit:{hold:scaled(1.45,{paw:'right',angle:-8,paint:g=>{
  g.beginPath();g.moveTo(-32,-14);g.lineTo(32,-14);g.lineTo(26,6);g.lineTo(-26,6);g.closePath();fill(g,'#d9b27a');stroke(g,3);
  for(const [x,y] of [[-18,-20],[0,-22],[18,-20],[-9,-33],[9,-33]]){ellipse(g,x,y,11,10);fill(g,'#c98a4b');stroke(g,2.5);ellipse(g,x,y-3,9,5);fill(g,'#6b3a1c');}
  g.beginPath();g.moveTo(-24,-28);for(let i=0;i<8;i++)g.lineTo(-20+i*6,-32+(i%2)*9);g.lineWidth=2.5;g.strokeStyle='#fffaf0';g.stroke();
  for(const [x,y] of [[-14,-37],[4,-30],[16,-24],[-4,-20]]){ellipse(g,x,y,1.8,1.4);fill(g,'#4f8a3a');}
  g.beginPath();g.moveTo(9,-34);g.lineTo(26,-60);stroke(g,3,'#e8cf9a');}})}},
 {id:'kakigori',series:'yatai',name:'かき氷',rarity:'N',blurb:'いちご味で、頭キーン。',cardPose:3,outfit:{hold:scaled(1.4,{paw:'right',paint:g=>{
  g.beginPath();g.moveTo(-18,-26);g.lineTo(18,-26);g.lineTo(13,8);g.lineTo(-13,8);g.closePath();fill(g,'#fffaf0');stroke(g,3);
  for(const x of [-10,0,10]){g.beginPath();g.moveTo(x,-24);g.lineTo(x*.72,6);stroke(g,4,'#3aa0e8');}
  g.beginPath();g.moveTo(-24,-26);g.quadraticCurveTo(-18,-66,0,-70);g.quadraticCurveTo(18,-66,24,-26);g.closePath();fill(g,'#ffffff');stroke(g,3);
  g.beginPath();g.moveTo(-17,-46);g.quadraticCurveTo(0,-76,17,-46);g.quadraticCurveTo(0,-38,-17,-46);g.closePath();fill(g,'#ff4d6d');
  g.beginPath();g.moveTo(8,-52);g.lineTo(26,-82);stroke(g,4,'#ffd23f');}})}},
 {id:'chocobanana',series:'yatai',name:'チョコバナナ',rarity:'N',blurb:'カラフルなつぶつぶ付き。',cardPose:3,outfit:{hold:scaled(1.35,onStick(30,g=>{g.save();g.translate(0,-62);g.rotate(.1);ellipse(g,0,0,12,32);fill(g,'#5a3218');stroke(g,3);
  const cs=['#ff6b8a','#ffd23f','#6ee7ff','#7ed36f','#fffaf0'];for(let i=0;i<16;i++){const x=((i*37)%18)-9,y=((i*53)%50)-25;g.save();g.translate(x,y);g.rotate(i);g.fillStyle=cs[i%cs.length];g.fillRect(-3,-1,6,2.4);g.restore();}
  ellipse(g,-4,-14,3,9,.1);fill(g,'rgba(255,255,255,.3)');g.restore();}))}},
 {id:'corn',series:'yatai',name:'焼きとうもろこし',rarity:'N',blurb:'しょうゆの香ばしいにおい。',cardPose:3,outfit:{hold:scaled(1.35,onStick(26,g=>{
  for(const s of [-1,1]){g.beginPath();g.moveTo(0,-28);g.quadraticCurveTo(s*20,-36,s*16,-60);g.quadraticCurveTo(s*8,-44,0,-34);g.closePath();fill(g,'#7fbf4a');stroke(g,2.5);}
  ellipse(g,0,-60,13,32);fill(g,'#f7c948');stroke(g,3);
  for(let y=-84;y<=-36;y+=7)for(let x=-8;x<=8;x+=6){ellipse(g,x,y,2.4,2.8);fill(g,'#e3a52a');}
  for(const y of [-76,-58,-42]){g.beginPath();g.moveTo(-11,y);g.lineTo(11,y-6);stroke(g,3,'rgba(120,60,20,.65)');}}))}},
 {id:'ramune',series:'yatai',name:'ラムネ',rarity:'N',blurb:'ビー玉、カランコロン。',cardPose:3,outfit:{hold:scaled(1.45,{paw:'right',paint:g=>{
  g.beginPath();g.moveTo(-13,8);g.lineTo(-13,-30);g.quadraticCurveTo(-13,-36,-6,-40);g.quadraticCurveTo(-11,-46,-8,-52);g.lineTo(-6,-64);g.lineTo(6,-64);g.lineTo(8,-52);g.quadraticCurveTo(11,-46,6,-40);g.quadraticCurveTo(13,-36,13,-30);g.lineTo(13,8);g.closePath();fill(g,'rgba(110,205,240,.85)');stroke(g,3);
  ellipse(g,0,-46,5.5,5.5);fill(g,'#e8fbff');stroke(g,1.5);
  g.beginPath();g.roundRect(-7,-72,14,9,3);fill(g,'#2c7fd8');stroke(g,2.5);
  g.beginPath();g.moveTo(-8,-26);g.lineTo(-8,2);stroke(g,3,'rgba(255,255,255,.7)');
  g.beginPath();g.rect(-13,-18,26,12);fill(g,'#fffaf0');text(g,'ラムネ',0,-12,8,'#2c7fd8');}})}},
 {id:'omamori',series:'ennichi',name:'お守り',rarity:'N',blurb:'リズム上達、祈願。',cardPose:3,outfit:{hold:scaled(1.4,hanging(16,g=>{
  g.beginPath();g.moveTo(-14,26);g.quadraticCurveTo(-14,16,0,14);g.quadraticCurveTo(14,16,14,26);g.lineTo(14,58);g.lineTo(-14,58);g.closePath();fill(g,'#e3402b');stroke(g,3);
  g.beginPath();g.rect(-9,24,18,30);stroke(g,1.5,'#ffd86b');
  text(g,'御',0,32,11,'#ffd86b');text(g,'守',0,46,11,'#ffd86b');ellipse(g,0,14,5,4);fill(g,'#ffd86b');stroke(g,1.5);},'#ffd86b'))}},
 // R
 {id:'strawhat',series:'boushi',name:'むぎわらぼうし',rarity:'R',blurb:'夏休みの、あのにおい。',outfit:{head:g=>{
  ellipse(g,207,74,96,21);fill(g,'#f0d27a');stroke(g,3);
  for(let i=-4;i<=4;i++){ellipse(g,207,74,96-Math.abs(i)*4,21-Math.abs(i),0);}
  g.beginPath();g.moveTo(152,74);g.bezierCurveTo(150,20,264,20,262,74);g.closePath();fill(g,'#f4d98a');stroke(g,3);
  for(let k=1;k<4;k++){g.beginPath();g.moveTo(156+k*2,70-k*12);g.quadraticCurveTo(207,56-k*14,258-k*2,70-k*12);stroke(g,1.5,'rgba(160,110,30,.45)');}
  g.beginPath();g.moveTo(153,62);g.bezierCurveTo(170,68,244,68,261,62);g.lineTo(262,74);g.bezierCurveTo(244,80,170,80,152,74);g.closePath();fill(g,'#e3402b');stroke(g,2);}}},
 {id:'flowercrown',series:'boushi',name:'花かんむり',rarity:'R',blurb:'野原でつくった、宝物。',outfit:{head:g=>{
  g.beginPath();g.moveTo(126,100);g.quadraticCurveTo(207,48,290,98);stroke(g,5,'#4f8a3a');
  const pts=[[132,96],[152,80],[174,70],[196,64],[220,64],[243,70],[265,80],[284,94]];
  pts.forEach(([x,y])=>{ellipse(g,x+7,y+8,7,4,.6);fill(g,'#6fbf4a');});
  pts.forEach(([x,y],i)=>flower(g,x,y,i%2?11:13,['#ff9ec4','#fffaf0','#ffd86b','#b9a2ff'][i%4],i%4===2?'#e3402b':'#ffd86b'));}}},
 {id:'heart-glasses',series:'oshare',name:'ハートのサングラス',rarity:'R',blurb:'きみに、むちゅう。',outfit:{head:g=>{
  for(const x of [160,254]){heart(g,x,130,24);fill(g,'rgba(255,77,141,.88)');stroke(g,3);ellipse(g,x-9,120,6,3.5,-.5);fill(g,'rgba(255,255,255,.7)');}
  g.beginPath();g.moveTo(186,124);g.quadraticCurveTo(207,114,228,124);stroke(g,4);}}},
 {id:'tengu',series:'omen',name:'天狗のお面',rarity:'R',blurb:'はなが高い、山の主。',outfit:{head:sideMask('right',g=>{
  ellipse(g,0,0,26,30);fill(g,'#d8392b');stroke(g,3);
  for(const s of [-1,1]){g.beginPath();g.moveTo(s*20,-14);g.quadraticCurveTo(s*10,-24,s*3,-12);g.lineWidth=5;g.strokeStyle='#fffaf0';g.stroke();ellipse(g,s*10,-4,4,3);fill(g,INK);}
  g.beginPath();g.moveTo(-5,-2);g.quadraticCurveTo(26,6,34,22);g.quadraticCurveTo(24,24,-2,10);g.closePath();fill(g,'#e8453a');stroke(g,2.5);
  for(let i=-2;i<=2;i++){g.beginPath();g.moveTo(i*7,24);g.quadraticCurveTo(i*8+3,34,i*6,42);g.lineWidth=3;g.strokeStyle='#fffaf0';g.stroke();}})}},
 {id:'hyottoko',series:'omen',name:'ひょっとこのお面',rarity:'R',blurb:'くちびるを、ちゅっと。',outfit:{head:sideMask('left',g=>{
  ellipse(g,0,0,26,30);fill(g,'#f6e2c0');stroke(g,3);
  g.beginPath();g.arc(0,-4,27,Math.PI*1.08,Math.PI*1.92);g.lineWidth=9;g.strokeStyle='#3a66b8';g.stroke();for(let i=0;i<5;i++){const a=Math.PI*(1.15+i*.17);ellipse(g,Math.cos(a)*27,-4+Math.sin(a)*27,1.8,1.8);fill(g,'#fffaf0');}
  ellipse(g,-10,-2,6,6);fill(g,'#fff');stroke(g,2);ellipse(g,-10,-2,2.5,2.5);fill(g,INK);
  ellipse(g,10,0,4,4);fill(g,'#fff');stroke(g,2);ellipse(g,10,0,1.8,1.8);fill(g,INK);
  ellipse(g,10,17,7,6);fill(g,'#e3402b');stroke(g,2.5);ellipse(g,11,17,3,2.4);fill(g,INK);
  ellipse(g,-14,11,5,3.5);fill(g,'rgba(255,120,120,.6)');})}},
 {id:'okame',series:'omen',name:'おかめのお面',rarity:'R',blurb:'えがおで、福を呼ぶ。',outfit:{head:sideMask('right',g=>{
  g.beginPath();g.arc(0,-2,28,Math.PI*1.08,Math.PI*1.92);g.lineWidth=12;g.strokeStyle=INK;g.stroke();
  ellipse(g,0,2,26,30);fill(g,'#fffaf3');stroke(g,3);
  ellipse(g,-10,-16,4,2.2);fill(g,INK);ellipse(g,10,-16,4,2.2);fill(g,INK);
  for(const s of [-1,1]){g.beginPath();g.arc(s*10,-2,6,Math.PI*1.1,Math.PI*1.9);stroke(g,2.5);}
  ellipse(g,-15,10,7,5);fill(g,'rgba(255,110,120,.7)');ellipse(g,15,10,7,5);fill(g,'rgba(255,110,120,.7)');
  ellipse(g,0,16,3.5,2.6);fill(g,'#e3402b');})}},
 {id:'haragake',series:'ishou',name:'金の腹掛け',rarity:'R',blurb:'力もち、まさかりはないけど。',cardPose:3,outfit:{body:g=>{
  g.beginPath();g.moveTo(158,200);g.lineTo(256,200);g.quadraticCurveTo(292,262,258,330);g.lineTo(156,330);g.quadraticCurveTo(122,262,158,200);g.closePath();fill(g,'#d8392b');stroke(g,3);
  for(const s of [-1,1]){g.beginPath();g.moveTo(207+s*46,204);g.lineTo(207+s*72,190);stroke(g,4,'#8a1616');}
  ellipse(g,207,264,30,30);fill(g,'#ffd23f');stroke(g,3);text(g,'金',207,265,34,'#8a1616');}}},
 {id:'happi-momo',series:'ishou',name:'はっぴ（桃）',rarity:'R',blurb:'華やかに、宵の祭へ。',cardPose:3,outfit:{body:happi('#ff8fb8','#8a2a55','華','#8a2a55')}},
 {id:'yukata-asagao',series:'ishou',name:'ゆかた（朝顔）',rarity:'R',blurb:'朝顔もようで、すずしげ。',cardPose:3,outfit:{body:yukata('#fde3ec',(g,x,y,i)=>{ellipse(g,x+8,y+7,7,4,.7);fill(g,'#6fbf4a');ellipse(g,x,y,9,9);fill(g,i%2?'#b05fd8':'#4f6fe8');for(let k=0;k<5;k++){const a=k/5*Math.PI*2;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*8,y+Math.sin(a)*8);g.lineWidth=1.2;g.strokeStyle='rgba(255,255,255,.8)';g.stroke();}ellipse(g,x,y,2.6,2.6);fill(g,'#fffaf0');},'#7b4bb3','#ffd86b','#fffaf0')}},
 {id:'jinbei',series:'ishou',name:'甚平',rarity:'R',blurb:'風がとおって、夏らくらく。',cardPose:3,outfit:{body:g=>{
  for(const side of [-1,1]){
   g.beginPath();g.moveTo(207+side*16,196);g.quadraticCurveTo(207+side*70,186,207+side*98,214);g.lineTo(207+side*100,304);g.quadraticCurveTo(207+side*60,314,207+side*4,308);g.closePath();fill(g,'#56708f');
   g.save();g.clip();for(let x=108;x<310;x+=9){g.beginPath();g.moveTo(x,186);g.lineTo(x,320);g.lineWidth=1.5;g.strokeStyle='rgba(255,255,255,.3)';g.stroke();}g.restore();
   stroke(g,3);
  }
  g.beginPath();g.moveTo(223,196);g.lineTo(191,300);g.lineWidth=8;g.strokeStyle='#394a63';g.stroke();
  for(const [x,y] of [[200,250],[212,276]]){for(const s of [-1,1]){ellipse(g,x+s*6,y,6,3.5,s*.5);fill(g,'#394a63');stroke(g,1.5);}}}}},
 {id:'sensu',series:'hare',name:'扇子',rarity:'R',blurb:'ひらりと、舞うように。',cardPose:3,outfit:{hold:scaled(1.2,{paw:'right',angle:10,paint:g=>{
  const r=56;
  for(let i=0;i<10;i++){const a0=-Math.PI*.9+i*(Math.PI*.8/10),a1=a0+Math.PI*.08;g.beginPath();g.moveTo(0,-6);g.arc(0,-6,r,a0,a1);g.closePath();fill(g,i%2?'#e3402b':'#ffd86b');}
  g.beginPath();g.moveTo(0,-6);g.arc(0,-6,r,-Math.PI*.9,-Math.PI*.1);g.closePath();stroke(g,3);
  g.beginPath();g.arc(0,-6,r*.36,-Math.PI*.9,-Math.PI*.1);stroke(g,2);
  ellipse(g,0,-44,9,9);fill(g,'#fffaf0');stroke(g,1.5);ellipse(g,0,-6,4,4);fill(g,INK);}})}},
 {id:'furin',series:'natsuyo',name:'風鈴',rarity:'R',blurb:'ちりーん、夏の音。',cardPose:3,outfit:{hold:scaled(1.35,hanging(18,g=>{
  g.beginPath();g.moveTo(-18,42);g.quadraticCurveTo(-18,18,0,18);g.quadraticCurveTo(18,18,18,42);g.closePath();fill(g,'rgba(210,240,255,.85)');stroke(g,3);
  ellipse(g,-4,32,5,3);fill(g,'#ff7a2e');g.beginPath();g.moveTo(1,32);g.lineTo(6,28);g.lineTo(6,36);g.closePath();fill(g,'#ff7a2e');
  g.beginPath();g.moveTo(0,42);g.lineTo(0,54);stroke(g,1.5,'#5a3a24');
  g.beginPath();g.rect(-7,54,14,30);fill(g,'#7ed3ff');stroke(g,2);
  g.beginPath();g.moveTo(-4,64);g.quadraticCurveTo(0,60,4,64);g.moveTo(-4,72);g.quadraticCurveTo(0,68,4,72);stroke(g,1.5,'#fffaf0');},'#5a3a24'))}},
 {id:'santa',series:'boushi',name:'サンタのぼうし',rarity:'R',blurb:'冬のお祭りも、まかせて。',outfit:{head:g=>{
  g.beginPath();g.moveTo(150,82);g.quadraticCurveTo(196,-8,300,26);g.quadraticCurveTo(260,40,266,82);g.closePath();fill(g,'#d8262b');stroke(g,3);
  g.beginPath();g.roundRect(140,70,134,22,11);fill(g,'#fffaf0');stroke(g,3);
  ellipse(g,304,28,13,13);fill(g,'#fffaf0');stroke(g,3);}}},
 {id:'witch',series:'boushi',name:'まじょのぼうし',rarity:'R',blurb:'ハロウィンの夜に、ドン。',outfit:{head:g=>{
  ellipse(g,207,80,100,17);fill(g,'#2b2440');stroke(g,3);
  g.beginPath();g.moveTo(160,80);g.quadraticCurveTo(186,22,238,-4);g.quadraticCurveTo(244,34,256,80);g.closePath();fill(g,'#2b2440');stroke(g,3);
  g.beginPath();g.moveTo(166,66);g.quadraticCurveTo(208,74,252,66);g.lineTo(254,78);g.quadraticCurveTo(208,86,162,78);g.closePath();fill(g,'#ff8a3d');stroke(g,2);
  g.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?4:9;g.lineTo(226+Math.cos(a)*r,40+Math.sin(a)*r);}g.closePath();fill(g,'#ffd23f');stroke(g,1.5);}}},
 // SR
 {id:'amigasa',series:'boushi',name:'盆おどりの編み笠',rarity:'SR',blurb:'輪になって、夜どおし踊ろう。',outfit:{head:g=>{
  g.beginPath();g.moveTo(96,112);g.quadraticCurveTo(207,-86,318,112);g.quadraticCurveTo(207,70,96,112);g.closePath();fill(g,'#d7ae62');stroke(g,3);
  for(let k=1;k<5;k++){g.beginPath();g.moveTo(96+k*9,112-k*5);g.quadraticCurveTo(207,-86+k*22,318-k*9,112-k*5);stroke(g,1.5,'rgba(120,80,30,.45)');}
  for(let k=-3;k<=3;k++){g.beginPath();g.moveTo(207+k*30,94-Math.abs(k)*3);g.lineTo(207+k*18,16+Math.abs(k)*10);stroke(g,1.2,'rgba(120,80,30,.35)');}
  for(const s of [-1,1]){g.beginPath();g.moveTo(207+s*104,110);g.quadraticCurveTo(207+s*96,170,207+s*62,236);stroke(g,3.5,'#c93b3b');}}}},
 {id:'tebanabi',series:'natsuyo',name:'手持ち花火',rarity:'SR',blurb:'しゅわしゅわ、七色のしぶき。',cardPose:3,outfit:{hold:scaled(1.25,onStick(40,g=>{
  const glow=g.createRadialGradient(0,-46,0,0,-46,56);glow.addColorStop(0,'rgba(255,240,180,.9)');glow.addColorStop(1,'rgba(255,180,90,0)');g.fillStyle=glow;g.fillRect(-56,-102,112,112);
  const cs=['#ff6b8a','#ffd23f','#6ee7ff','#7ed36f','#ffffff','#b58cff'];
  for(let i=0;i<18;i++){const a=-Math.PI/2+(i/17-.5)*1.7,len=26+(i%3)*9;g.beginPath();g.moveTo(Math.cos(a)*6,-44+Math.sin(a)*6);g.lineTo(Math.cos(a)*len,-44+Math.sin(a)*len);g.lineWidth=2.5;g.strokeStyle=cs[i%cs.length];g.lineCap='round';g.stroke();ellipse(g,Math.cos(a)*(len+4),-44+Math.sin(a)*(len+4),2.2,2.2);fill(g,cs[i%cs.length]);}
  ellipse(g,0,-42,6,6);fill(g,'#ff8a3d');}))}},
 {id:'kagurasuzu',series:'hare',name:'神楽鈴',rarity:'SR',blurb:'しゃんしゃん、神さまも踊る。',cardPose:3,outfit:{hold:scaled(1.2,onStick(34,g=>{
  for(const [i,c] of ['#e3402b','#ffd23f','#3a9a4a','#2c6fd8','#8a4ad8'].entries()){g.beginPath();g.moveTo(-6+i*3,8);g.bezierCurveTo(-20+i*10,30,-10+i*8,50,-24+i*12,78);g.lineWidth=5;g.strokeStyle=c;g.lineCap='round';g.stroke();}
  g.beginPath();g.moveTo(0,-34);g.lineTo(0,-86);g.moveTo(-18,-60);g.lineTo(18,-60);g.moveTo(-12,-74);g.lineTo(12,-74);stroke(g,2.5,'#b58a2a');
  for(const [x,y] of [[0,-40],[-11,-50],[11,-50],[-18,-62],[0,-62],[18,-62],[-10,-76],[10,-76],[0,-88]]){ellipse(g,x,y,6,6);fill(g,'#ffd23f');stroke(g,2);g.beginPath();g.moveTo(x-4,y+1);g.lineTo(x+4,y+1);stroke(g,1.2);}},6))}},
 {id:'flag',series:'hare',name:'祭の旗',rarity:'SR',blurb:'ここが、お祭りのまんなか。',cardPose:3,outfit:{hold:scaled(1.15,onStick(72,g=>{
  g.beginPath();g.moveTo(3,-70);g.lineTo(48,-66);g.lineTo(46,-24);g.lineTo(3,-28);g.closePath();fill(g,'#e3402b');stroke(g,3);
  for(let i=0;i<5;i++){g.beginPath();g.moveTo(6+i*9,-27);g.lineTo(10+i*9,-19);g.lineTo(14+i*9,-26);fill(g,'#ffd23f');}
  text(g,'祭',25,-47,24,'#fffaf0');ellipse(g,0,-75,5,5);fill(g,'#ffd23f');stroke(g,1.5);},6))}},
 {id:'maneki',series:'hare',name:'まねき猫',rarity:'SR',blurb:'ほねっこ、まねいてます。',cardPose:3,outfit:{hold:scaled(1.4,{paw:'right',angle:-6,paint:g=>{g.save();g.translate(0,-32);
  ellipse(g,0,16,18,20);fill(g,'#fffaf0');stroke(g,3);
  for(const s of [-1,1]){g.beginPath();g.moveTo(s*14,-22);g.lineTo(s*12,-38);g.lineTo(s*3,-27);g.closePath();fill(g,'#fffaf0');stroke(g,2.5);}
  ellipse(g,0,-13,17,15);fill(g,'#fffaf0');stroke(g,3);ellipse(g,-8,-19,5,4);fill(g,'#ff9a3d');ellipse(g,9,-22,4,3);fill(g,'#3a2414');
  ellipse(g,17,-2,6,9,-.3);fill(g,'#fffaf0');stroke(g,2.5);
  for(const s of [-1,1]){g.beginPath();g.arc(s*6,-13,3,Math.PI*1.1,Math.PI*1.9);stroke(g,2);}
  ellipse(g,0,-7,2,1.6);fill(g,'#ff7a8a');
  g.beginPath();g.moveTo(-12,2);g.quadraticCurveTo(0,8,12,2);stroke(g,3,'#e3402b');ellipse(g,0,6,4,4);fill(g,'#ffd23f');stroke(g,1.5);
  ellipse(g,-7,22,8,11);fill(g,'#ffd23f');stroke(g,2);text(g,'両',-7,23,9,'#8a5a1a');
  g.restore();}})}},
 {id:'koinobori',series:'hare',name:'こいのぼり',rarity:'SR',blurb:'空をおよぐ、元気なこい。',cardPose:3,outfit:{hold:scaled(1.1,onStick(88,g=>{
  const fish=(y:number,len:number,c:string)=>{g.beginPath();g.moveTo(3,y-9);g.quadraticCurveTo(len*.5,y-14,len,y-6);g.lineTo(len-10,y);g.lineTo(len,y+6);g.quadraticCurveTo(len*.5,y+14,3,y+9);g.closePath();fill(g,c);stroke(g,2.5);
   for(let x=24;x<len-14;x+=9){g.beginPath();g.arc(x,y,5,-Math.PI/2,Math.PI/2);stroke(g,1.5,'rgba(255,255,255,.7)');}
   ellipse(g,12,y-1,5,5);fill(g,'#fffaf0');stroke(g,1.5);ellipse(g,12,y-1,2,2);fill(g,INK);};
  fish(-78,64,'#e3402b');fish(-54,54,'#2c6fd8');ellipse(g,0,-92,6,6);fill(g,'#ffd23f');stroke(g,2);},4))}},
 {id:'fireworks',series:'natsuyo',name:'せなかに打ち上げ花火',rarity:'SR',blurb:'ドーン！と、うしろで大輪。',cardPose:3,outfit:{under:g=>{
  const burst=(x:number,y:number,r:number,c1:string,c2:string)=>{for(let i=0;i<16;i++){const a=i/16*Math.PI*2;g.beginPath();g.moveTo(x+Math.cos(a)*r*.25,y+Math.sin(a)*r*.25);g.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);g.lineWidth=3;g.strokeStyle=i%2?c1:c2;g.lineCap='round';g.stroke();ellipse(g,x+Math.cos(a)*(r+5),y+Math.sin(a)*(r+5),3,3);fill(g,i%2?c1:c2);}};
  burst(70,110,52,'#ff7eb6','#ffd86b');burst(338,82,58,'#6ee7ff','#fffaf0');burst(344,250,38,'#ffd86b','#ff6b5a');burst(58,272,34,'#b58cff','#7ed36f');}}},
 {id:'mint',series:'kenami',name:'ミントまる',rarity:'SR',blurb:'すーっと、さわやか。',coat:COATS.mint},
 {id:'choco',series:'kenami',name:'チョコまる',rarity:'SR',blurb:'あまくて、ちょっとビター。',coat:COATS.choco},
 // SSR
 {id:'sora',series:'kenami',name:'そらまる',rarity:'SSR',blurb:'夏の空をうつした、ふしぎな毛色。',coat:COATS.sora},
 {id:'yoru',series:'kenami',name:'よるまる',rarity:'SSR',blurb:'星空みたいに、しずかで深い。',coat:COATS.yoru},
 {id:'shishimai',series:'densetsu',name:'獅子舞の柴',rarity:'SSR',blurb:'かぷっとかまれて、一年じゅう元気。',cardPose:3,outfit:{
  // The lion-dance cloth: green with white 唐草 swirls, hanging behind the body.
  under:g=>{
   g.beginPath();g.moveTo(128,48);g.bezierCurveTo(84,110,64,200,76,330);g.quadraticCurveTo(207,356,338,330);g.bezierCurveTo(350,200,330,110,286,48);g.closePath();
   fill(g,'#1f7a44');
   g.save();g.clip();
   for(let y=70;y<340;y+=46)for(let x=60+((y/46)%2)*23;x<360;x+=46){
    g.beginPath();for(let k=0;k<=28;k++){const a=k/28*Math.PI*3.2,r=2+k*.55;g.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}
    g.lineWidth=3.5;g.strokeStyle='#f4f1e6';g.lineCap='round';g.stroke();
   }
   g.restore();
   g.beginPath();g.moveTo(128,48);g.bezierCurveTo(84,110,64,200,76,330);g.quadraticCurveTo(207,356,338,330);g.bezierCurveTo(350,200,330,110,286,48);stroke(g,3);
  },
  // The lion head worn on top, "biting" the head (for good luck): upper jaw above, lower jaw on the forehead.
  head:g=>{
   // Mane tufts behind the head.
   for(let i=0;i<9;i++){const x=136+i*17.5,up=i%2?6:0;ellipse(g,x,26-up,11,13);fill(g,i%2?'#ffd23f':'#231c2e');}
   // Ears.
   for(const s of [-1,1]){g.beginPath();g.moveTo(207+s*62,30);g.quadraticCurveTo(207+s*92,14,207+s*84,46);g.closePath();fill(g,'#d8262b');stroke(g,2.5);ellipse(g,207+s*76,32,5,8,s*.5);fill(g,'#ffd23f');}
   // Head.
   ellipse(g,207,46,72,38);fill(g,'#d8262b');stroke(g,3);
   ellipse(g,188,30,22,9,-.2);fill(g,'rgba(255,255,255,.22)');
   // Brows, eyes, nose and cheeks.
   for(const s of [-1,1]){
    g.beginPath();g.moveTo(207+s*12,34);g.quadraticCurveTo(207+s*28,14,207+s*46,28);g.lineWidth=7;g.strokeStyle='#ffd23f';g.lineCap='round';g.stroke();g.lineWidth=2;g.strokeStyle=INK;g.stroke();
    ellipse(g,207+s*27,44,11,11);fill(g,'#ffe066');stroke(g,2.5);
    ellipse(g,207+s*25,45,5,5);fill(g,INK);ellipse(g,207+s*23,42,1.8,1.8);fill(g,'#fff');
    ellipse(g,207+s*50,60,6,6);fill(g,'#ffd23f');stroke(g,1.5);
   }
   ellipse(g,207,58,15,11);fill(g,'#b8161b');stroke(g,2.5);
   ellipse(g,201,60,3.5,2.6);fill(g,INK);ellipse(g,213,60,3.5,2.6);fill(g,INK);
   // Upper teeth.
   g.beginPath();g.roundRect(162,70,90,12,5);fill(g,'#fffaf0');stroke(g,2.5);
   for(let x=173;x<250;x+=11){g.beginPath();g.moveTo(x,70);g.lineTo(x,82);g.lineWidth=1.5;g.strokeStyle=INK;g.stroke();}
   // Lower jaw with its teeth, on the forehead.
   g.beginPath();g.moveTo(166,88);g.quadraticCurveTo(207,112,248,88);g.lineTo(246,98);g.quadraticCurveTo(207,122,168,98);g.closePath();fill(g,'#d8262b');stroke(g,2.5);
   for(let k=0;k<6;k++){const x=176+k*12,y=91+Math.sin((k+.5)/6*Math.PI)*9;g.beginPath();g.moveTo(x-4,y+1);g.lineTo(x,y-7);g.lineTo(x+4,y+1);g.closePath();fill(g,'#fffaf0');stroke(g,1.5);}
  }}},
 {id:'tonosama',series:'densetsu',name:'とのさま',rarity:'SSR',blurb:'よきにはからえ、ドン。',cardPose:3,outfit:{
  body:g=>{
   for(const s of [-1,1]){g.beginPath();g.moveTo(207+s*18,198);g.lineTo(207+s*62,232);g.lineTo(207+s*66,320);g.lineTo(207+s*10,320);g.closePath();fill(g,'#2c3e6e');stroke(g,3);}
   for(const s of [-1,1]){g.beginPath();g.moveTo(207+s*24,196);g.lineTo(207+s*140,186);g.lineTo(207+s*132,222);g.lineTo(207+s*62,234);g.closePath();fill(g,'#2c3e6e');stroke(g,3);
    ellipse(g,207+s*104,206,10,10);fill(g,'#fffaf0');stroke(g,1.5);flower(g,207+s*104,206,8,'#ffd86b','#8a5a1a');}
   ellipse(g,207+40,262,12,12);fill(g,'#fffaf0');stroke(g,1.5);flower(g,207+40,262,10,'#ffd86b','#8a5a1a');},
  head:g=>{g.beginPath();g.moveTo(184,54);g.quadraticCurveTo(198,20,234,32);g.quadraticCurveTo(242,40,232,48);g.quadraticCurveTo(208,40,196,60);g.closePath();fill(g,'#231c2e');stroke(g,2.5);
   g.beginPath();g.moveTo(205,42);g.lineTo(214,54);g.lineWidth=5;g.strokeStyle='#fffaf0';g.lineCap='round';g.stroke();}}},
];

export const COSTUME_BY_ID=new Map(COSTUMES.map(c=>[c.id,c]));
export const RARITY_LABEL:Record<Rarity,string>={N:'ノーマル',R:'レア',SR:'スーパーレア',SSR:'ウルトラレア'};
export const RARITY_COLOR:Record<Rarity,string>={N:'#9aa7b8',R:'#4fb3e8',SR:'#f0b429',SSR:'#ff5fa2'};
