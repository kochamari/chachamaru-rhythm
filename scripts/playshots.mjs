// Developer helper: play a song in AUTO and capture the play screen at given song times.
// node scripts/playshots.mjs <packId> <chart> <outDir> <engine> <w> <h> <ms,ms,...> [touch]
import {chromium,webkit} from '@playwright/test';
import {mkdirSync} from 'node:fs';
const [pack='himawari-demo',chart='normal',out='shots',engine='chromium',w='1280',h='720',times='5000',mode='keyboard']=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await (engine==='webkit'?webkit:chromium).launch();
const page=await browser.newPage({viewport:{width:Number(w),height:Number(h)}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('502'))errors.push(m.text());});
const base=process.env.SHOOT_BASE||'http://127.0.0.1:5190/';
await page.goto(base+'#/');
await page.waitForFunction(()=>window.__chacha?.bundledReady,null,{timeout:60000});
await page.evaluate(m=>{window.__chacha.settings.inputMode=m;},mode);
await page.goto(base+`#/play/${pack}/${chart}?auto=1`);
await page.locator('#resume-play').click();
for(const t of times.split(',').map(Number)){
 await page.waitForFunction(t=>{const s=window.__chacha.session;return s&&(s.status==='FINISHING'||s.status==='RESULT'||s.audio.time()>=t);},t,{timeout:120000,polling:16});
 await page.screenshot({path:`${out}/${pack}-${chart}-${engine}-${w}x${h}-${t}.png`});
}
console.log(JSON.stringify({errors}));
await browser.close();
