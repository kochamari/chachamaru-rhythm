import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const selected=JSON.parse(readFileSync('_private/selected-project.json','utf8'));
const project=JSON.parse(readFileSync(selected.directory+'/project.json','utf8'));
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900}});
const page=await context.newPage();
const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:8787/')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
const start=Date.now();
try{
 await page.goto('http://127.0.0.1:8787/#/songs');
 await page.getByRole('button',{name:new RegExp(project.manifest.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).waitFor({timeout:30000});
 await page.getByRole('button',{name:new RegExp(project.manifest.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).click();
 await page.getByRole('button',{name:/ふつう/}).click();
 await page.locator('#auto-song').click();await page.locator('#resume-play').click();
 const playingAt=Date.now();
 await page.waitForTimeout(7000);mkdirSync('reports/screenshots',{recursive:true});
 await page.screenshot({path:'reports/screenshots/selected-song-playing.png'});
 console.log('Selected song is playing; waiting for the actual decoded audio to end.');
 await page.locator('.result-card').waitFor({timeout:project.manifest.durationMs+15000});
 const elapsed=Date.now()-playingAt;
 const result=await page.locator('.result-card').innerText();
 if(!result.includes('1,000,000')||elapsed<project.manifest.durationMs||errors.length||external.length)throw Error(JSON.stringify({elapsed,result,errors,external}));
 await page.screenshot({path:'reports/screenshots/selected-song-result.png'});
 const report={status:'PASS',date:new Date().toISOString(),projectId:selected.projectId,durationMs:project.manifest.durationMs,elapsedMs:elapsed,totalElapsedMs:Date.now()-start,difficulty:'normal',autoplay:true,productionTestHooks:false,result,errors,externalRequests:external,limits:'Browser automation confirms full-duration playback and scoring. Human listening, iPhone and TD-17 hardware are not verified.'};
 writeFileSync('reports/selected-song.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
