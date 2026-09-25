import {chromium,webkit,devices} from '@playwright/test';
const out=process.argv[2],engine=process.argv[3]==='webkit'?webkit:chromium,lag=Number(process.argv[4]??150);
const b=await engine.launch();
const ctx=await b.newContext({...devices['iPhone 13'],baseURL:'http://localhost:5190'});
const p=await ctx.newPage();
p.on('console',m=>{if(m.type()==='error')console.log('console error:',m.text());});
await p.route('**/api/**',r=>r.fulfill({status:404,contentType:'application/json',body:'{}'}));
await p.goto('/');await p.waitForFunction(()=>window.__chacha?.bundledReady,null,{timeout:60000});
await p.goto('/#/sync?back=%23%2Fsongs');await p.locator('#sync-start').waitFor();
await p.screenshot({path:`${out}/sync-0.png`,fullPage:true});
await p.locator('[data-output="td17-bluetooth"]').click();
await p.locator('#sync-start').click();
// Hit every beat `lag` ms after the browser expects it to be heard.
await p.evaluate(async lag=>{
 for(let k=0;k<20;k++){
  const at=window.__sync.beatPerformanceMs(k)+lag+(k%3-1)*6;
  while(performance.now()<at+2)await new Promise(r=>setTimeout(r,5));
  window.__chacha.input.emit('don',at,'midi');
 }
},lag);
await p.locator('#sync-result').filter({hasText:'ms'}).waitFor({timeout:8000});
console.log('result:',await p.locator('#sync-result').innerText());
console.log('settings:',JSON.stringify(await p.evaluate(()=>({d:window.__chacha.settings.audioDelayMs,profile:window.__chacha.settings.profile,profiles:window.__chacha.settings.calibrationProfiles}))));
await p.locator('.sync-steps .paper').nth(1).screenshot({path:`${out}/sync-1.png`});
await p.locator('#check-start').click();await p.waitForTimeout(1200);
await p.evaluate(async lag=>{
 for(let k=0;k<8;k++){
  const base=Math.ceil((performance.now()-window.__sync.beatPerformanceMs(0))/700)+1;
  const at=window.__sync.beatPerformanceMs(base)+lag;
  while(performance.now()<at+2)await new Promise(r=>setTimeout(r,5));
  window.__chacha.input.emit('don',at,'midi');
 }
},lag+20);
console.log('judge:',await p.locator('#sync-judge').innerText());
await p.locator('.sync-steps .paper').nth(2).screenshot({path:`${out}/sync-2.png`});
await b.close();
