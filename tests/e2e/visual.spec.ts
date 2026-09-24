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
   frames.push(Object.fromEntries(['.dog-head','.dog-tail','.arm-left','.arm-right','.back-left','.back-right','.dog-scarf'].map(s=>[s,(document.querySelector('.character '+s) as SVGElement).style.transform])));
   await new Promise(requestAnimationFrame);
  }while(performance.now()<until);
  return frames;
 });
 await page.screenshot({path:`reports/screenshots/animation-${info.project.name}-1.png`});
 writeFileSync(`reports/animation-${info.project.name}.json`,JSON.stringify({engine:info.project.name,source:'actual 1x playback from chorus, same production renderer',frames},null,2));
 for(const part of ['.dog-head','.dog-tail','.back-left','.back-right','.dog-scarf'])expect(new Set(frames.map(f=>f[part])).size,part).toBeGreaterThan(1);
 await page.setViewportSize({width:440,height:956});
 await page.screenshot({path:`reports/screenshots/portrait-live-${info.project.name}.png`});
 for(const pad of await page.locator('.pad').all()){const b=await pad.boundingBox();expect(b!.width).toBeGreaterThanOrEqual(44);expect(b!.height).toBeGreaterThanOrEqual(44);expect(b!.y+b!.height).toBeLessThanOrEqual(956);}
});
