// Developer screenshot helper: node scripts/shoot.mjs <url-hash> <out.png> [width] [height] [waitMs] [actions]
import {chromium,webkit} from '@playwright/test';
const [hash='/',out='shot.png',w='1280',h='720',wait='1500',actions='',engine='chromium']=process.argv.slice(2);
const browser=await (engine==='webkit'?webkit:chromium).launch();
const page=await browser.newPage({viewport:{width:Number(w),height:Number(h)},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const base=process.env.SHOOT_BASE||'http://127.0.0.1:5190/';
await page.goto(base+'#'+hash);
await page.waitForTimeout(800);
for(const a of actions.split(';').filter(Boolean)){
 const [kind,arg]=a.split('=');
 if(kind==='click')await page.locator(arg).first().click();
 else if(kind==='key')await page.keyboard.press(arg);
 else if(kind==='wait')await page.waitForTimeout(Number(arg));
 else if(kind==='eval')await page.evaluate(arg);
 else if(kind==='shot')await page.screenshot({path:arg});
}
await page.waitForTimeout(Number(wait));
await page.screenshot({path:out});
console.log(JSON.stringify({errors}));
await browser.close();
