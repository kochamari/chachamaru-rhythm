import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';

test('V02 independently animated head, tail, paws and scarf during real chorus playback',async({page},info)=>{
 await page.goto('/#/play/himawari-demo/normal?practice=1&auto=1&start=48000');
 await page.locator('#resume-play').click();
 await expect.poll(()=>page.evaluate(()=>window.__chacha.session?.status)).toBe('PLAYING');
 await expect(page.locator('.game-scene')).toHaveClass(/chorus/);
 mkdirSync('reports/screenshots',{recursive:true});
 await page.screenshot({path:`reports/screenshots/animation-${info.project.name}-0.png`});
 const frames=await page.evaluate(async()=>{
  const frames:Record<string,string>[]=[],until=performance.now()+2200;
  do{
   frames.push(Object.fromEntries(['.dog-head','.dog-tail','.arm-left','.arm-right','.back-left','.back-right','.dog-scarf'].map(s=>[s,document.querySelector('.character '+s)!.getAttribute('transform')!])));
   await new Promise(requestAnimationFrame);
  }while(performance.now()<until);
  return frames;
 });
 await page.screenshot({path:`reports/screenshots/animation-${info.project.name}-1.png`});
 writeFileSync(`reports/animation-${info.project.name}.json`,JSON.stringify({engine:info.project.name,source:'actual 1x playback from chorus, same production renderer',frames},null,2));
 for(const part of ['.dog-head','.dog-tail','.arm-left','.arm-right','.back-left','.back-right','.dog-scarf'])expect(new Set(frames.map(f=>f[part])).size,part).toBeGreaterThan(1);
 await page.setViewportSize({width:440,height:956});
 await page.screenshot({path:`reports/screenshots/portrait-live-${info.project.name}.png`});
 for(const pad of await page.locator('.pad').all()){const b=await pad.boundingBox();expect(b!.width).toBeGreaterThanOrEqual(44);expect(b!.height).toBeGreaterThanOrEqual(44);expect(b!.y+b!.height).toBeLessThanOrEqual(956);}
});

test('V03 source-art shoulders and wrists stay attached through strokes, jumps and responsive layouts',async({page},info)=>{
 await page.goto('/');
 await expect(page.locator('.hero-character .arm-left')).toBeVisible();
 const layouts=[];
 for(const viewport of [{width:1440,height:900},{width:1124,height:1024},{width:440,height:956}]){
  await page.setViewportSize(viewport);
  const evidence=await page.evaluate(async()=>{
   const root=document.querySelector<HTMLElement>('.hero-character')!;
   const point=(selector:string,x:number,y:number)=>new DOMPoint(x,y).matrixTransform(root.querySelector<SVGGraphicsElement>(selector)!.getScreenCTM()!);
   const distance=(a:DOMPoint,b:DOMPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
   const measure=()=>({
    // These are anatomical source-image points, not the rig's exported constants.
    leftShoulder:distance(point('.upper-arm-left image',1037,144),point('.dog-body',147,240)),
    rightShoulder:distance(point('.upper-arm-right image',217,144),point('.dog-body',277,240)),
    leftWrist:distance(point('.upper-arm-left image',824,439),point('.arm-left image',306,986)),
    rightWrist:distance(point('.upper-arm-right image',430,439),point('.arm-right image',948,986)),
    drumPosition:distance(point('.dog-drum',0,0),point('svg.chacha',0,0)),
    drumScale:distance(point('.dog-drum',100,100),point('svg.chacha',100,100)),
   });
   const maxima:Record<string,number>={};let frames=0;
   const sample=()=>{for(const [key,value] of Object.entries(measure()))maxima[key]=Math.max(maxima[key]??0,value);frames++;};
   // Sample the real home loop as well as controlled poses of the same class.
   for(let i=0;i<20;i++){await new Promise(requestAnimationFrame);sample();}
   const modulePath='/src/render/Character.ts';
   const {Character}=await import(/* @vite-ignore */ modulePath);
   const tips:{action:string;x:number;y:number;insideDrum:number}[]=[];
   for(const action of ['idle','don','ka','jump','chorusDance','resultWin','happy','miss']){
    const character=new Character(root);
    if(action==='don'||action==='ka')character.hit(action,1000);
    if(action==='jump')character.jump(1000);
    if(action==='happy'||action==='miss')character.react(action,1000);
    for(let t=0;t<=500;t+=8){character.update(1000+t,t/500,action);sample();}
    if(action==='don'||action==='ka'){
     character.update(1040,0,'idle');sample();
     const tip=action==='don'?point('.arm-left image',505,583):point('.arm-right image',749,583);
     const local=tip.matrixTransform(root.querySelector<SVGGraphicsElement>('svg.chacha')!.getScreenCTM()!.inverse());
     tips.push({action,x:local.x,y:local.y,insideDrum:((local.x-217)/73)**2+((local.y-285)/14)**2});
    }
   }
   return {frames,maxima,tips};
  });
  for(const [joint,error] of Object.entries(evidence.maxima))expect(error,`${viewport.width}px ${joint} gap in CSS pixels`).toBeLessThan(.5);
  for(const tip of evidence.tips)expect(tip.insideDrum,`${tip.action} long end reaches the drumhead`).toBeLessThan(1);
  layouts.push({viewport,...evidence});
 }
 mkdirSync('reports',{recursive:true});
 writeFileSync(`reports/character-joints-${info.project.name}.json`,JSON.stringify({engine:info.project.name,layouts},null,2));
});
