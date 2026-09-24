import {describe,it,expect} from 'vitest';
import {computeLayout,logicalSize,noteX,TRAVEL_MS} from '../../web/src/render/layout';
import {noteSyllables} from '../../web/src/render/syllables';
import {beatPhase,friendsForGauge,downbeatTimes,inSection} from '../../web/src/render/timing';
import {DrummerState,drummerPose,dancerPose,strikeEnvelope,stickTip,drumHeadDistance,STRIKE_ANGLE,DRUMMER,DANCER} from '../../web/src/render/rig';
import {classify,recolorPixels,FRIEND_VARIANTS,rgbToHsv,hsvToRgb} from '../../web/src/render/recolor';
import {chartLevel,songColor} from '../../web/src/app/songinfo';
import {crownOf} from '../../web/src/app/records';
import {isSoftwareRenderer} from '../../web/src/app/gpu';
import type {Chart,Note} from '../../contracts/public-types';

const tap=(id:string,timeMs:number,color:'don'|'ka'='don',size:'normal'|'large'='normal'):Note=>({id,kind:'tap',timeMs,color,size});

describe('layout',()=>{
 it.each([[1280,720],[844,390],[956,440],[1920,1080],[2400,800],[1024,768]])('landscape %ix%i keeps every region on screen',(w,h)=>{
  const size=logicalSize(w,h);
  expect(size.portrait).toBe(false);
  expect(size.H).toBe(720);expect(size.W).toBeGreaterThanOrEqual(960);expect(size.W).toBeLessThanOrEqual(2000);
  for(const pads of [true,false]){
   const L=computeLayout(size.W,size.H,pads);
   expect(L.lane.x+L.lane.w).toBeLessThanOrEqual(L.W+.001);
   expect(L.hitX).toBeGreaterThan(L.lane.x+L.judgeR);
   expect(L.laneRight).toBeGreaterThan(L.hitX+400);
   expect(L.stage.h).toBeGreaterThan(pads?200:380);
   expect(L.syllables.y).toBe(L.lane.y+L.lane.h);
   if(pads){expect(L.pads!.y+L.pads!.h).toBeLessThanOrEqual(L.H);expect(L.pads!.y).toBeGreaterThan(L.stage.y);}
   else expect(L.pads).toBeNull();
   expect(L.character.y).toBeLessThanOrEqual(L.stage.y+L.stage.h);
   expect(L.title.x+L.title.w).toBeLessThanOrEqual(L.W-90);
  }
 });
 it.each([[390,844],[440,956],[768,1024]])('portrait %ix%i stacks lane, stage and drum',(w,h)=>{
  const size=logicalSize(w,h);
  expect(size.portrait).toBe(true);expect(size.W).toBe(720);
  const L=computeLayout(size.W,size.H,true);
  expect(L.portrait).toBe(true);
  expect(L.lane.y).toBeGreaterThan(L.band.y+L.band.h);
  expect(L.stage.y).toBeGreaterThan(L.lane.y+L.lane.h);
  expect(L.pads!.y+L.pads!.h).toBeLessThanOrEqual(L.H);
  expect(L.pads!.h).toBeGreaterThanOrEqual(220);
 });
 it('notes reach the judge circle exactly at their time and enter from the right',()=>{
  const L=computeLayout(1280,720,false);
  expect(noteX(L,5000,5000)).toBe(L.hitX);
  expect(noteX(L,5000+TRAVEL_MS,5000)).toBeCloseTo(L.laneRight,6);
  expect(noteX(L,4000,5000)).toBeLessThan(L.hitX);
 });
});

describe('syllables',()=>{
 it('isolated notes read ドン / カッ and big notes carry (大)',()=>{
  const s=noteSyllables([tap('a',0),tap('b',500,'ka'),tap('c',1000,'don','large'),tap('d',1500,'ka','large')],[0,500,1000,1500,2000]);
  expect([...s.values()]).toEqual(['ドン','カッ','ドン(大)','カッ(大)']);
 });
 it('quick runs alternate ド・コ and end on the full sound; ka in a run reads カ',()=>{
  const beats=[0,500,1000,1500,2000];
  const s=noteSyllables([tap('a',0),tap('b',125),tap('c',250),tap('d',1000),tap('e',1125,'ka'),tap('f',1250)],beats);
  expect([...s.values()]).toEqual(['ド','コ','ドン','ド','カ','ドン']);
 });
 it('rolls read 連打 and reset runs',()=>{
  const s=noteSyllables([tap('a',0),{id:'r',kind:'roll',timeMs:100,endMs:900},tap('b',1000)],[0,500,1000]);
  expect(s.get('r')).toBe('連打');expect(s.get('a')).toBe('ドン');
 });
});

describe('timing helpers',()=>{
 it('beat phase follows tempo changes without drift',()=>{
  const beats=[0,500,1000,1400,1800,2200];
  expect(beatPhase(beats,0)).toBe(0);expect(beatPhase(beats,750)).toBeCloseTo(1.5);expect(beatPhase(beats,1600)).toBeCloseTo(3.5);
  expect(beatPhase(beats,-250)).toBeCloseTo(-.5);expect(beatPhase(beats,2600)).toBeCloseTo(6);
  let last=-Infinity;for(let t=-500;t<3000;t+=37){const b=beatPhase(beats,t);expect(b).toBeGreaterThan(last);last=b;}
 });
 it('bar lines come from downbeat indices and chorus sections are half-open',()=>{
  expect(downbeatTimes([0,500,1000,1500,2000,2500],[0,4,9])).toEqual([0,2000]);
  const sections=[{kind:'chorus',startMs:1000,endMs:2000}];
  expect(inSection(sections,'chorus',999)).toBe(false);expect(inSection(sections,'chorus',1000)).toBe(true);expect(inSection(sections,'chorus',2000)).toBe(false);
 });
 it('friends join at gauge 30/50/70/100 and leave when it drops',()=>{
  expect([0,29.9,30,49,50,69.9,70,99,100].map(friendsForGauge)).toEqual([0,0,1,1,2,2,3,3,4]);
 });
});

describe('puppet rig',()=>{
 it('strokes reach the drum head in 40 ms and return by 130 ms',()=>{
  expect(strikeEnvelope(-1)).toBe(0);expect(strikeEnvelope(0)).toBe(0);expect(strikeEnvelope(40)).toBe(1);expect(strikeEnvelope(85)).toBeCloseTo(.5);expect(strikeEnvelope(130)).toBe(0);
 });
 it('don lands on the head centre and ka on its front rim, both inside the drum head',()=>{
  for(const [arm,sign] of [['armLeft',1],['armRight',-1]] as const){
   const don=drumHeadDistance(stickTip(arm,sign*STRIKE_ANGLE.don)),ka=drumHeadDistance(stickTip(arm,sign*STRIKE_ANGLE.ka));
   expect(don).toBeLessThan(.5);expect(ka).toBeLessThan(1);expect(ka).toBeGreaterThan(don);
   expect(stickTip(arm,sign*STRIKE_ANGLE.ka)[1]).toBeGreaterThan(stickTip(arm,sign*STRIKE_ANGLE.don)[1]);
  }
 });
 it('touch/keys strike with their side; MIDI alternates paws in quick runs',()=>{
  const s=new DrummerState();
  s.hit('don',1000,'right');expect(s.lastRight).toBe(1000);
  const m=new DrummerState();
  m.hit('don',0);m.hit('don',60);m.hit('don',200);
  expect(m.lastLeft).toBe(200);expect(m.lastRight).toBe(60);
 });
 it('poses differ between don and ka and keep the body grounded',()=>{
  const a=new DrummerState();a.hit('don',1000,'left');
  const b=new DrummerState();b.hit('ka',1000,'left');
  const pa=drummerPose(a,1040,0,'idle'),pb=drummerPose(b,1040,0,'idle');
  expect(pa.angles.armLeft).toBeCloseTo(STRIKE_ANGLE.don);expect(pb.angles.armLeft).toBeCloseTo(STRIKE_ANGLE.ka);
  expect(pb.angles.tail).toBeGreaterThan(pa.angles.tail);
  expect(pa.drumGlow.don).toBe(1);expect(pb.drumGlow.ka).toBe(1);
  expect(pa.bodyScaleY).toBeCloseTo(.97);
  for(let t=0;t<4000;t+=50){const p=dancerPose(t,t/500,1,t%2===0);expect(Math.abs(p.angles.armLeft)).toBeLessThan(60);expect(p.bodyY).toBeLessThanOrEqual(0);}
 });
 it('drummer and dancer share the same head and body parts',()=>{
  const names=(spec:typeof DRUMMER)=>JSON.stringify([...spec.back,...spec.front].map(n=>n.className).filter(n=>!n.includes('arm')));
  expect(names(DANCER)).toBe(names(DRUMMER).replace(/"upper-arm-left","upper-arm-right",/,''));
 });
});

describe('friend colours',()=>{
 it('recolours orange fur and green scarf only',()=>{
  expect(classify(217,122,43,255)).toBe(1);
  expect(classify(40,110,60,255)).toBe(2);
  expect(classify(255,242,206,255)).toBe(0);
  expect(classify(30,23,38,255)).toBe(0);
  expect(classify(217,122,43,0)).toBe(0);
  const px=new Uint8ClampedArray([217,122,43,255,255,242,206,255,40,110,60,255]);
  const out=recolorPixels(px,FRIEND_VARIANTS[0]);
  expect([...out.slice(4,8)]).toEqual([255,242,206,255]);
  expect([...out.slice(0,3)]).not.toEqual([217,122,43]);
  expect(out[3]).toBe(255);
 });
 it('hsv round trips',()=>{for(const c of [[255,0,0],[12,200,90],[250,250,250],[3,4,5]] as [number,number,number][]){const [h,s,v]=rgbToHsv(c[0],c[1],c[2]);expect(hsvToRgb(h,s,v)).toEqual(c);}});
});

describe('song info',()=>{
 const chart=(gap:number,count:number):Chart=>({schemaVersion:1,chartId:'x',difficulty:'normal',offsetMs:0,notes:Array.from({length:count},(_,i)=>tap('n'+i,1000+i*gap))});
 it('denser charts rate higher, within 1..10',()=>{
  const levels=[1000,500,250,125].map(g=>chartLevel(chart(g,200)));
  for(let i=1;i<levels.length;i++)expect(levels[i]).toBeGreaterThan(levels[i-1]);
  expect(Math.min(...levels)).toBeGreaterThanOrEqual(1);expect(Math.max(...levels)).toBeLessThanOrEqual(10);
 });
 it('song colours are stable per song',()=>{expect(songColor('abc')).toBe(songColor('abc'));expect(songColor('himawari-demo')).toBe('#e9772e');});
 it('crowns: all-great > full combo > clear',()=>{
  const r=(o:Partial<{allGreat:boolean;fullCombo:boolean;gauge:number}>)=>({stats:{allGreat:false,fullCombo:false,gauge:0,...o}}) as Parameters<typeof crownOf>[0];
  expect(crownOf(r({allGreat:true,fullCombo:true,gauge:100}))).toBe('ag');
  expect(crownOf(r({fullCombo:true,gauge:90}))).toBe('fc');
  expect(crownOf(r({gauge:70}))).toBe('clear');
  expect(crownOf(r({gauge:69.9}))).toBe('none');
 });
});

describe('software WebGL detection',()=>{
 it('recognises CPU renderers and leaves real GPUs alone',()=>{
  for(const name of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)','llvmpipe (LLVM 15.0.7, 256 bits)','Microsoft Basic Render Driver','Google SwiftShader'])expect(isSoftwareRenderer(name)).toBe(true);
  for(const name of ['Apple GPU','ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)','Adreno (TM) 740','Mali-G78','ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)'])expect(isSoftwareRenderer(name)).toBe(false);
 });
});
