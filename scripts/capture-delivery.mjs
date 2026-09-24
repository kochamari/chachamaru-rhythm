import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const selected=JSON.parse(readFileSync('_private/selected-project.json','utf8'));
const project=JSON.parse(readFileSync(selected.directory+'/project.json','utf8'));
const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
mkdirSync('reports/screenshots',{recursive:true});
try{
 await page.goto('http://127.0.0.1:8787/');
 await page.getByRole('link',{name:/はじめる/}).waitFor({timeout:30000});
 await page.screenshot({path:'reports/screenshots/delivery-home.png'});
 await page.getByRole('link',{name:/はじめる/}).click();
 await page.locator(`[data-song="${project.manifest.packId}"]`).click();
 await page.locator('#auto-song').waitFor();
 await page.screenshot({path:'reports/screenshots/delivery-library.png'});
 await page.locator('#auto-song').click();await page.locator('#resume-play').click();
 await page.waitForTimeout(4500);
 await page.screenshot({path:'reports/screenshots/delivery-playing.png'});
 await page.setViewportSize({width:440,height:956});
 await page.waitForTimeout(300);
 await page.screenshot({path:'reports/screenshots/delivery-portrait.png'});
 const metrics=await page.evaluate(()=>({viewport:[innerWidth,innerHeight],canvas:[document.querySelector('canvas').width,document.querySelector('canvas').height],pads:[...document.querySelectorAll('.pad')].map(p=>{const r=p.getBoundingClientRect();return {width:r.width,height:r.height,bottom:r.bottom};})}));
 if(errors.length)throw Error(errors.join('\n'));
 writeFileSync('reports/delivery-capture.json',JSON.stringify({date:new Date().toISOString(),production:true,errors,metrics},null,2));
 console.log('Home, library, playing and settled portrait captured from the production app.');
}finally{await browser.close();}
