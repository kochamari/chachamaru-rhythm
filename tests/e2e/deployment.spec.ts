import {test,expect} from '@playwright/test';

test('E08 production root and repository subpath load scoped assets and survive network failure',async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const base of ['/','/test-repo/']){
  await context.addCookies([{name:'chacha-network',value:'online',url:'http://127.0.0.1:8792'}]);
  await page.goto('http://127.0.0.1:8792'+base);
  await expect(page.getByRole('link',{name:/はじめる/})).toBeVisible();
  // Bundled songs finish downloading in the background before the network is cut.
  await expect(page.locator('html[data-bundled="ready"]')).toHaveCount(1,{timeout:30000});
  expect(await page.evaluate(()=>typeof (window as unknown as {__chacha?:unknown}).__chacha)).toBe('undefined');
  await expect.poll(()=>page.evaluate(async base=>{const r=await navigator.serviceWorker.getRegistration(base);return r?.active?.scriptURL;},base)).toBe('http://127.0.0.1:8792'+base+'sw.js');
  await page.reload();
  await expect(page.getByRole('link',{name:/はじめる/})).toBeVisible();
  await expect(page.locator('html[data-bundled="ready"]')).toHaveCount(1,{timeout:30000});
  expect(await page.evaluate(()=>navigator.serviceWorker.controller?.scriptURL)).toBe('http://127.0.0.1:8792'+base+'sw.js');
  // The test server closes sockets for this context's cookie, proving a
  // real network failure without Web Inspector's pre-SW interception.
  await context.addCookies([{name:'chacha-network',value:'offline',url:'http://127.0.0.1:8792'}]);
  await expect(context.request.get('http://127.0.0.1:8792'+base,{timeout:3000})).rejects.toThrow();
  await page.reload();
  await expect(page.getByRole('link',{name:/はじめる/})).toBeVisible();
  await page.getByRole('link',{name:/はじめる/}).click();
  await page.getByRole('button',{name:/ひまわり囃子/}).click();
  await page.locator('#auto-song').click();await page.locator('#resume-play').click();
  await expect(page.locator('.play-overlay')).toBeHidden();
  await page.waitForTimeout(2400);await page.locator('.pause-button').click();
  await expect(page.getByRole('heading',{name:'ひとやすみ'})).toBeVisible();
 }
 await context.addCookies([{name:'chacha-network',value:'online',url:'http://127.0.0.1:8792'}]);expect(errors).toEqual([]);
});
