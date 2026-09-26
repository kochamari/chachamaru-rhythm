import {test,expect,devices,type Page} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {unzipSync,zipSync,strToU8,strFromU8} from 'fflate';
import type {Session} from '../../web/src/game/Session';
import type {InputRouter,MidiAdapter} from '../../web/src/input/InputRouter';
import type {Settings,SongPackage} from '../../contracts/public-types';
type Hook={session:Session|null;input:InputRouter;midi:MidiAdapter;settings:Settings;getSong:(id:string)=>Promise<SongPackage>;saveSong:(p:SongPackage,mode?:string)=>Promise<string>;db:()=>Promise<{get:(store:string,key:unknown)=>Promise<unknown>;getAll:(store:string)=>Promise<unknown[]>}>};
declare global {interface Window {__chacha:Hook;__mockMidi?:{port:MIDIInput;access:MIDIAccess;send:(bytes:number[],stamp?:number)=>void};}}
async function boot(page:Page){await page.goto('/');await expect(page.getByRole('link',{name:/はじめる/})).toBeVisible();await page.waitForFunction(()=>(window as unknown as {__chacha:{bundledReady:boolean}}).__chacha.bundledReady);}
async function selectDemo(page:Page,auto=false){await page.goto('/#/songs');await page.getByRole('button',{name:/ひまわり囃子/}).click();await page.getByRole('button',{name:/ふつう/}).click();await page.locator('#input-mode').selectOption('keyboard');await page.locator(auto?'#auto-song':'#play-song').click();await expect(page.getByRole('button',{name:'演奏をはじめる'})).toBeVisible();}
const screenshot=async(page:Page,name:string)=>{mkdirSync('reports/screenshots',{recursive:true});await page.screenshot({path:`reports/screenshots/${name}.png`,fullPage:true});};
// Game tests run like the iPhone: no local Mac Studio. Its background sync
// would otherwise add the Studio tests' songs while a test counts songs.
test.beforeEach(async({page})=>{await page.route('**/api/**',r=>r.fulfill({status:404,contentType:'application/json',body:'{"detail":"no Mac Studio in game tests"}'}));const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});page.on('close',()=>{});Object.assign(page,{appErrors:errors});});
test.afterEach(async({page})=>{expect((page as Page&{appErrors:string[]}).appErrors).toEqual([]);});
test('E01 E09 E12 real 64-second demo completes and retries',async({page},info)=>{test.setTimeout(150000);await boot(page);await screenshot(page,`home-${info.project.name}`);await selectDemo(page,true);await screenshot(page,`library-ready-${info.project.name}`);await page.getByRole('button',{name:'演奏をはじめる'}).click();await expect.poll(()=>page.evaluate(()=>window.__chacha.session?.status)).toBe('PLAYING');await screenshot(page,`playing-live-${info.project.name}`);await expect(page.locator('.auto-badge')).toContainText('おてほん再生中');await page.keyboard.press('KeyF');await expect(page.locator('.auto-badge')).toContainText('自分であそぶ');await expect(page.locator('.result-card')).toBeVisible({timeout:75000});await expect(page.locator('.result-score')).toContainText('1,000,000');await expect(page.locator('.result-dog h1')).toHaveText('全 良！');await screenshot(page,`result-all-great-${info.project.name}`);expect(await page.evaluate(async()=> (await(await window.__chacha.db()).getAll('records')).length)).toBe(0);await expect(page.locator('#retry-auto')).toBeVisible();await page.getByRole('button',{name:/自分であそぶ/}).click();await expect(page.getByRole('button',{name:'演奏をはじめる'})).toBeVisible();expect(await page.evaluate(()=>window.__chacha.session?.autoplay)).toBe(false);await expect(page.locator('.auto-badge')).toHaveCount(0);});
test('E02 U15 U16 simultaneous pointers and keyboard use the production input route',async({page})=>{await boot(page);await selectDemo(page);await page.locator('#resume-play').click();await expect.poll(()=>page.evaluate(()=>window.__chacha.session?.status)).toBe('PLAYING');await page.evaluate(()=>{const s=window.__chacha.session!;const n=s.engine.taps.find(n=>!s.engine.outcomes.has(n.id))!;s.audio.s0=n.timeMs;s.audio.a0=s.audio.context!.currentTime;const pads=document.querySelectorAll<HTMLElement>('[data-pad="don"]');pads[0].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:71,pointerType:'touch'}));pads[1].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:72,pointerType:'touch',isPrimary:false}));});expect(await page.evaluate(()=>window.__chacha.input.pointers.size)).toBe(2);expect(await page.evaluate(()=>window.__chacha.session!.engine.snapshot().great)).toBeGreaterThan(0);const count=await page.evaluate(()=>window.__chacha.input.count);await page.evaluate(()=>{document.querySelectorAll('[data-pad="don"]')[0].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:71,pointerType:'touch'}));window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF',repeat:true,bubbles:true}));});expect(await page.evaluate(()=>window.__chacha.input.count)).toBe(count);await page.evaluate(()=>{document.querySelectorAll('[data-pad="don"]')[0].dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:71}));});expect(await page.evaluate(()=>window.__chacha.input.pointers.size)).toBe(1);await page.setViewportSize({width:844,height:390});await expect.poll(()=>page.evaluate(()=>window.__chacha.input.pointers.size)).toBe(0);await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:'ひとやすみ'})).toBeVisible();});
test('P08 P10 settings, imported ZIP and backup persist across reload',async({page})=>{await boot(page);await page.goto('/#/import');await page.locator('#pack-file').setInputFiles('web/public/original-demo/himawari.zip');await expect(page).toHaveURL(/#\/songs/);await page.goto('/#/settings');await page.locator('#audioDelayMs').fill('37');await page.locator('#audioDelayMs').dispatchEvent('change');await expect.poll(()=>page.evaluate(async()=> (await(await window.__chacha.db()).get('settings','main') as Settings).audioDelayMs)).toBe(37);const downloadPromise=page.waitForEvent('download');await page.locator('#backup').click();const d=await downloadPromise;const file=await d.path();expect(file).toBeTruthy();await page.locator('#audioDelayMs').fill('0');await page.locator('#audioDelayMs').dispatchEvent('change');await page.locator('#restore').setInputFiles(file!);await expect(page.locator('#audioDelayMs')).toHaveValue('37');await page.reload();await expect(page.locator('#audioDelayMs')).toHaveValue('37');await page.goto('/#/songs');await expect(page.getByRole('button',{name:/ひまわり囃子/})).toBeVisible();});
test('E03 U14 MIDI Learn, rapid events, reconnect, disconnect pause',async({page})=>{await page.addInitScript(()=>{const port={id:'fixture-port',name:'Diagnostic Drum',state:'connected',type:'input',onmidimessage:null} as unknown as MIDIInput;const access={inputs:new Map([[port.id,port]]),outputs:new Map(),onstatechange:null} as unknown as MIDIAccess;Object.defineProperty(navigator,'requestMIDIAccess',{configurable:true,value:async()=>access});window.__mockMidi={port,access,send:(bytes,stamp=performance.now())=>{port.onmidimessage?.call(port,{data:new Uint8Array(bytes),timeStamp:stamp} as MIDIMessageEvent);}};});await boot(page);await page.goto('/#/settings');await page.locator('#connect-midi').click();await page.locator('#midi-port').selectOption('fixture-port');for(const [color,note] of [['don',38],['ka',43]] as const){await page.locator(`[data-learn="${color}"]`).click();await page.evaluate(n=>window.__mockMidi!.send([0x99,n,90]),note);await page.locator('#register-midi').click();}await expect(page.locator('#map-don')).toContainText('Note 38');await expect(page.locator('#map-ka')).toContainText('チャンネル 10');const before=await page.evaluate(()=>window.__chacha.input.count);await page.evaluate(()=>{for(let i=0;i<5;i++){window.__chacha.midi.select('');window.__chacha.midi.select('fixture-port');}window.__mockMidi!.send([0x99,38,90]);window.__mockMidi!.send([0x99,38,90],performance.now()+1);window.__mockMidi!.send([0x89,38,90]);window.__mockMidi!.send([0x99,38,0]);});expect(await page.evaluate(()=>window.__chacha.input.count)).toBe(before+2);await selectDemo(page);await page.locator('#resume-play').click();await expect.poll(()=>page.evaluate(()=>window.__chacha.session?.status)).toBe('PLAYING');await page.evaluate(()=>{Object.defineProperty(window.__mockMidi!.port,'state',{value:'disconnected'});window.__mockMidi!.access.onstatechange?.call(window.__mockMidi!.access,{} as MIDIConnectionEvent);});await expect(page.getByRole('heading',{name:'ひとやすみ'})).toBeVisible();});
test('E04 V03 V04 responsive stage and chorus fixtures',async({page},info)=>{await boot(page);for(const [scene,width,height] of [['normal',1280,720],['chorus',1280,720],['midi',1280,720],['portrait',440,956],['touch',956,440],['touch',844,390]] as const){await page.setViewportSize({width,height});await page.goto(`/#/showcase?scene=${scene}&w=${width}`);await expect(page.locator('.game-canvas')).toBeVisible();await expect(page.locator('.play-overlay')).toBeHidden();await screenshot(page,`showcase-${scene}-${width}-${info.project.name}`);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 // The touch drum is shown for touch play and folded away for keyboard/MIDI play.
 if(scene==='touch'||scene==='portrait'){for(const pad of await page.locator('.pad').all()){const b=await pad.boundingBox();expect(b!.height).toBeGreaterThanOrEqual(44);expect(b!.width).toBeGreaterThanOrEqual(44);expect(b!.y+b!.height).toBeLessThanOrEqual(height);}}
 else await expect(page.locator('.pads')).toBeHidden();
 if(scene==='chorus')await expect(page.locator('.game-scene')).toHaveClass(/chorus/);}});
test('E05 count-in and hidden return never auto resume',async({page})=>{await boot(page);await selectDemo(page);await page.locator('#resume-play').click();expect(await page.evaluate(()=>window.__chacha.session!.engine.snapshot().resolved)).toBe(0);await expect.poll(()=>page.evaluate(()=>window.__chacha.session?.status)).toBe('PLAYING');await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(page.locator('.play-overlay')).toBeVisible();const score=await page.evaluate(()=>window.__chacha.session!.engine.snapshot().score);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(300);expect(await page.evaluate(()=>window.__chacha.session!.status)).toBe('PAUSED');expect(await page.evaluate(()=>window.__chacha.session!.engine.snapshot().score)).toBe(score);await page.getByRole('button',{name:'つづきから'}).click();await expect.poll(()=>page.evaluate(()=>window.__chacha.session!.status)).toBe('PLAYING');await page.evaluate(()=>{window.__chacha.session!.audio.clock!.audioAt=()=>{throw Error('Clock unavailable');};});await expect(page.getByRole('heading',{name:'ひとやすみ'})).toBeVisible();await expect(page.getByText('音声時計が停止しました。もう一度再開してください')).toBeVisible();});
test('E07 unknown route, missing song and decoding failure recover',async({page})=>{await boot(page);await page.goto('/#/not-a-route');await expect(page.getByRole('heading',{name:'データを開けませんでした'})).toBeVisible();await page.getByRole('link',{name:'曲一覧に戻る'}).click();await page.goto('/#/play/no-such-song/normal');await expect(page.getByText(/データがありません/)).toBeVisible();await page.evaluate(async()=>{const pack=await window.__chacha.getSong('himawari-demo');pack.manifest.packId='bad-audio';pack.audio=new Blob(['invalid audio']);await window.__chacha.saveSong(pack);});await page.goto('/#/play/bad-audio/normal');await page.locator('#resume-play').click();await expect(page.getByRole('heading',{name:'曲を再生できませんでした'})).toBeVisible();await expect(page.getByRole('link',{name:'曲一覧に戻る'})).toBeVisible();});
test('U25 P11 missing optional APIs permit play, E10 twenty retries dispose sources',async({page})=>{await page.addInitScript(()=>{Object.defineProperty(navigator,'requestMIDIAccess',{value:undefined,configurable:true});Object.defineProperty(navigator,'wakeLock',{value:undefined,configurable:true});});await boot(page);await page.goto('/#/settings');await page.locator('#connect-midi').click();await expect(page.locator('#midi-status')).toContainText('未対応');for(let i=0;i<20;i++){await page.goto('/#/play/himawari-demo/easy?retry='+i);await page.locator('#resume-play').click();await expect.poll(()=>page.evaluate(()=>window.__chacha.session?.status)).toBe('COUNT_IN');const old=await page.evaluate(()=>({sources:window.__chacha.session!.audio.liveSources,starts:window.__chacha.session!.audio.starts}));expect(old).toEqual({sources:1,starts:1});await page.goto('/#/songs');await expect(page.getByRole('button',{name:/ひまわり囃子/})).toBeVisible();expect(await page.evaluate(()=>window.__chacha.input.pointers.size)).toBe(0);}});
test('P04 P05 P06 invalid ZIP and cancelled worker preserve saved songs',async({page})=>{await boot(page);const count=await page.evaluate(async()=> (await(await window.__chacha.db()).getAll('songs')).length);await page.goto('/#/import');await page.locator('#pack-file').setInputFiles({name:'bad.zip',mimeType:'application/zip',buffer:Buffer.from('bad file')});await expect(page.locator('#import-status')).toContainText('ZIP');expect(await page.evaluate(async()=> (await(await window.__chacha.db()).getAll('songs')).length)).toBe(count);await page.locator('#pack-file').setInputFiles('web/public/original-demo/himawari.zip');if(await page.locator('#cancel-import').isVisible())await page.locator('#cancel-import').click();expect(await page.evaluate(async()=> (await(await window.__chacha.db()).getAll('songs')).length)).toBe(count);});
test('P12 requests never send audio to any external origin',async({page})=>{const requests:{url:string;method:string}[]=[];page.on('request',r=>requests.push({url:r.url(),method:r.method()}));await boot(page);await selectDemo(page,true);await page.locator('#resume-play').click();await expect.poll(()=>page.evaluate(()=>window.__chacha.session?.status)).toBe('PLAYING');expect(requests.filter(r=>!r.url.startsWith('http://127.0.0.1:5181/')&&!r.url.startsWith('blob:')&&!r.url.startsWith('data:'))).toEqual([]);});

/** A song collection ZIP as the Mac Studio makes it (bundle.json + songs/*.zip). */
function collection(packs:{from:string;packId:string;title:string;revision?:number}[]){
 const songs:Record<string,unknown>[]=[];const files:Record<string,[Uint8Array,{level:0}]>={};
 for(const p of packs){
  const inner=unzipSync(new Uint8Array(readFileSync(p.from)));const m=JSON.parse(strFromU8(inner['manifest.json']));
  Object.assign(m,{packId:p.packId,title:p.title},p.revision?{revision:p.revision}:{});inner['manifest.json']=strToU8(JSON.stringify(m));
  const data=zipSync(inner);const path=`songs/${p.packId}.zip`;files[path]=[data,{level:0}];
  songs.push({packId:p.packId,revision:m.revision,title:p.title,artist:m.artist,path,sha256:createHash('sha256').update(data).digest('hex')});
 }
 return Buffer.from(zipSync({'bundle.json':strToU8(JSON.stringify({kind:'chachamaru-bundle',schemaVersion:1,songs})),...files}));
}
test('P13 a collection ZIP adds only new songs, skips the ones already here and updates changed ones',async({page})=>{
 await boot(page);await page.goto('/#/import');
 const first=collection([{from:'web/public/original-demo/himawari.zip',packId:'himawari-demo',title:'ひまわり囃子'},{from:'web/public/original-demo/himawari.zip',packId:'bundle-e2e-a',title:'まとめ試験A'},{from:'web/public/original-demo/ondo.zip',packId:'bundle-e2e-b',title:'まとめ試験B'}]);
 await page.locator('#pack-file').setInputFiles({name:'ちゃちゃまる曲パック_3曲.zip',mimeType:'application/zip',buffer:first});
 await expect(page.locator('.import-summary strong')).toHaveText('追加 2曲・すでにある 1曲',{timeout:60000});
 await page.locator('#pack-file').setInputFiles({name:'ちゃちゃまる曲パック_3曲.zip',mimeType:'application/zip',buffer:first});
 await expect(page.locator('.import-summary strong')).toHaveText('すでにある 3曲',{timeout:60000});
 const newer=collection([{from:'web/public/original-demo/himawari.zip',packId:'bundle-e2e-a',title:'まとめ試験A',revision:5}]);
 await page.locator('#pack-file').setInputFiles({name:'ちゃちゃまる曲パック_1曲.zip',mimeType:'application/zip',buffer:newer});
 await expect(page.locator('.import-summary strong')).toHaveText('更新 1曲',{timeout:60000});
 const titles=await page.evaluate(async()=>(await window.__chacha.db().then(d=>d.getAll('songs')) as {manifest:{title:string;packId:string;revision:number}}[]).map(s=>s.manifest));
 expect(titles.filter(m=>m.packId.startsWith('bundle-e2e')).map(m=>[m.title,m.revision])).toEqual([['まとめ試験A',5],['まとめ試験B',1]]);
 await page.locator('#to-songs').click();await expect(page.getByRole('button',{name:/まとめ試験A/})).toBeVisible();
});

test('U26 touch pads on an iPhone hit the drum with no vibration parts, and the play screen does not zoom',async({browser},info)=>{
 // Tap vibration was removed at the user's request (iPhone could only vibrate
 // on release). The pads are plain again and each tap is one hit.
 const phone=await browser.newContext({...devices['iPhone 13'],baseURL:info.project.use.baseURL});
 const p=await phone.newPage();await p.route('**/api/**',r=>r.fulfill({status:404,contentType:'application/json',body:'{}'}));
 await p.goto('/');await p.waitForFunction(()=>window.__chacha?.bundledReady,null,{timeout:60000});
 await p.evaluate(()=>{window.__chacha.settings.inputMode='touch';});
 await p.goto('/#/play/himawari-demo/easy');await p.locator('#resume-play').click();
 await expect.poll(()=>p.evaluate(()=>window.__chacha.session?.status)).toMatch(/COUNT_IN|PLAYING/);
 await expect(p.locator('.pads input')).toHaveCount(0);
 // The play screen never zooms (pinch, double tap, focus on a small field): the viewport is fixed while it is shown.
 const viewport=()=>p.evaluate(()=>document.querySelector('meta[name="viewport"]')!.getAttribute('content'));
 expect(await viewport()).toContain('maximum-scale=1');
 const before=await p.evaluate(()=>window.__chacha.input.count);
 await p.locator('[data-pad="don"]').first().tap();await p.locator('[data-pad="ka"]').first().tap();
 expect(await p.evaluate(()=>window.__chacha.input.count)).toBe(before+2);
 await p.goto('/#/settings');await expect(p.locator('#haptics')).toHaveCount(0);
 expect(await viewport()).not.toContain('maximum-scale');
 await phone.close();
});
test('U27 hitting the electronic drum switches to drum play, and the snare starts the song',async({page})=>{
 const drum=(color:'don'|'ka')=>page.evaluate(c=>{window.__chacha.input.emit(c,performance.now(),'midi');},color);
 await boot(page);await page.evaluate(()=>{window.__chacha.settings.inputMode='touch';});
 // In a menu, the first drum hit switches the input for good and says so.
 await page.goto('/#/songs');await page.getByRole('button',{name:/ひまわり囃子/}).click();
 await expect(page.locator('#input-mode')).toHaveValue('touch');
 await drum('ka');
 await expect(page.locator('#input-mode')).toHaveValue('midi');
 await expect(page.locator('#toast')).toContainText('電子ドラム');
 expect(await page.evaluate(()=>window.__chacha.settings.inputMode)).toBe('midi');
 // The play screen opens without the touch drum and with the large drum
 // lane; after that tap, a snare hit can start the song.
 await page.locator('#play-song').click();
 await expect(page.getByRole('button',{name:'演奏をはじめる'})).toBeVisible();
 await expect(page.locator('.game-scene')).toHaveClass(/mode-midi/);await expect(page.locator('.pads')).toBeHidden();
 await expect(page.locator('.dialog-hint')).toContainText('スネア');
 expect(await page.evaluate(()=>window.__chacha.session!.renderer.layout.drumMode)).toBe(true);
 await drum('don');
 await expect.poll(()=>page.evaluate(()=>window.__chacha.session?.status)).toMatch(/COUNT_IN|PLAYING/);
 // A run set up for touch that the drum takes over before any hit is still drum play (not mixed).
 await page.evaluate(()=>{window.__chacha.settings.inputMode='touch';});
 await page.goto('/#/play/himawari-demo/easy?retry=1');
 await expect(page.getByRole('button',{name:'演奏をはじめる'})).toBeVisible();await expect(page.locator('.pads')).toBeVisible();
 await drum('ka');
 await expect(page.locator('.pads')).toBeHidden();
 expect(await page.evaluate(()=>[window.__chacha.session?.mode,window.__chacha.session?.status])).toEqual(['midi','READY']);
});
test('U28 音ズレ合わせ measures how late the drum hits the heard beat and keeps it per sound output',async({page})=>{
 test.setTimeout(90000);
 await boot(page);
 await page.goto('/#/sync?back=%23%2Fsongs');
 await page.locator('[data-output="td17-bluetooth"]').click();
 await expect(page.locator('[data-output="td17-bluetooth"]')).toHaveAttribute('aria-checked','true');
 // Hit every beat 150 ms (±6) after the browser plays it, as a drummer
 // would with Bluetooth delay.
 await page.locator('#sync-start').click();
 await page.evaluate(async()=>{
  const sync=(window as unknown as {__sync:{beatPerformanceMs:(k:number)=>number}}).__sync;
  for(let k=0;k<20;k++){
   const at=sync.beatPerformanceMs(k)+150+(k%3-1)*6;
   while(performance.now()<at+2)await new Promise(r=>setTimeout(r,5));
   window.__chacha.input.emit('don',at,'midi');
  }
 });
 await expect(page.locator('#sync-result')).toContainText('ms',{timeout:10000});
 const measured=await page.evaluate(()=>window.__chacha.settings.audioDelayMs);
 expect(Math.abs(measured-150)).toBeLessThanOrEqual(5);
 await expect.poll(()=>page.evaluate(async()=>((await(await window.__chacha.db()).get('settings','main')) as Settings).calibrationProfiles['td17-bluetooth']?.audioDelayMs)).toBe(measured);
 await expect(page.locator('[data-output="td17-bluetooth"] small')).toHaveText(`＋${measured}ms`);
 // Undo, then fine-tune by hand.
 await page.locator('#sync-undo').click();
 expect(await page.evaluate(()=>window.__chacha.settings.audioDelayMs)).toBe(0);
 await page.locator('[data-nudge="10"]').click();await page.locator('[data-nudge="5"]').click();
 await expect(page.locator('#sync-delay')).toHaveText('音の遅れ ＋15ms');
 // Each output keeps its own delay; the song select and the play dialog switch between them.
 await page.locator('#sync-back').click();
 await page.getByRole('button',{name:/ひまわり囃子/}).click();
 await expect(page.locator('#output-profile')).toHaveValue('td17-bluetooth');
 await page.locator('#output-profile').selectOption('phone-speaker');
 expect(await page.evaluate(()=>[window.__chacha.settings.profile,window.__chacha.settings.audioDelayMs])).toEqual(['phone-speaker',0]);
 await page.goto('/#/play/himawari-demo/easy');
 await expect(page.locator('#dialog-output')).toHaveValue('phone-speaker');
 await page.locator('#dialog-output').selectOption('td17-bluetooth');
 expect(await page.evaluate(()=>[window.__chacha.settings.profile,window.__chacha.settings.audioDelayMs])).toEqual(['td17-bluetooth',15]);
 await expect(page.locator('.play-dialog a[href^="#/sync?back="]')).toBeVisible();
});
test('U29 a normal run earns ほねっこ (paid once, kept); the example run earns none',async({page})=>{
 await boot(page);
 await page.goto('/#/import');await page.locator('#pack-file').setInputFiles('fixtures/diagnostic-pack.zip');await expect(page).toHaveURL(/#\/songs/);
 await page.evaluate(()=>{window.__chacha.settings.inputMode='keyboard';});
 const play=async(auto:boolean)=>{
  await page.goto(`/#/play/song-6b8b6c53e6dd3d9d/hard?${auto?'auto=1&':''}r=${Date.now()}`);
  await page.locator('#resume-play').click();
  // Hit each note on time: the stamp is the moment the note is heard, so a
  // busy test machine that runs this loop late still hits it on time.
  if(!auto)await page.evaluate(async()=>{
   const s=window.__chacha.session!;
   for(const n of s.engine.taps){
    const target=n.timeMs+s.chart.offsetMs;
    while(s.audio.time()<target)await new Promise(r=>setTimeout(r,1));
    const now=performance.now();
    window.__chacha.input.emit(n.color,now-(s.audio.time(now)-target),'keyboard');
   }
  });
  await expect(page.locator('.result-card')).toBeVisible({timeout:20000});
 };
 const stored=()=>page.evaluate(async()=>(await(await window.__chacha.db()).get('settings','festival')) as {bones:number;awards:{runId:string;total:number}[]}|undefined);
 await play(false);
 await expect(page.locator('.result-rewards')).toBeVisible();
 const f=(await stored())!;
 expect(f.awards).toHaveLength(1);
 expect(f.awards[0].total).toBeGreaterThan(0);
 expect(f.bones).toBe(f.awards[0].total);
 // The rewards count up one after another; a tap shows the final numbers at once.
 await page.locator('.result-rewards .bone-main').click();
 await expect(page.locator('#bone-count')).toHaveText(f.awards[0].total.toLocaleString('en-US'));
 await expect(page.locator('#bone-total')).toHaveText(f.bones.toLocaleString('en-US'));
 await expect(page.locator('#slot-result')).not.toBeEmpty();
 await expect(page.locator('#level-num')).not.toBeEmpty();
 // Showing the same result again does not pay twice.
 await page.reload();await expect(page.locator('.result-card')).toBeVisible();
 expect((await stored())!.bones).toBe(f.bones);
 await play(true);
 await expect(page.locator('.result-rewards')).toHaveCount(0);
 expect((await stored())!.bones).toBe(f.bones);
});
test('U30 しばガチャ spends ほねっこ, opens capsules and fills the collection',async({page})=>{
 await boot(page);
 await page.evaluate(async()=>{await (await window.__chacha.db()).put('settings',{schemaVersion:1,bones:1150,earned:1150,owned:{},pulls:0,awards:[]},'festival');});
 await page.goto('/#/gacha');
 await expect(page.locator('#wallet')).toHaveText('1,150');
 await expect(page.locator('#zukan-count')).toHaveText(/^0 \/ \d+$/);
 const total=Number((await page.locator('#zukan-count').textContent())!.split('/')[1]);
 expect(total).toBeGreaterThanOrEqual(60);
 // One draw: capsule, then the card.
 await page.locator('#pull-1').click();
 await expect(page.locator('.gacha-reveal .reveal-capsule')).toBeVisible();
 // One tap opens it; a rare capsule may first change colour and need a second tap.
 await page.locator('#reveal-next').click();
 if(await page.locator('.reveal-capsule.upgrade').count())await page.locator('#reveal-next').click();
 await expect(page.locator('.reveal-card')).toBeVisible();await expect(page.locator('.reveal-card .card-new')).toHaveText('NEW!');
 await page.locator('#reveal-next').click();
 await expect(page.locator('.gacha-reveal')).toHaveCount(0);
 await expect(page.locator('#zukan-count')).toHaveText(`1 / ${total}`);
 await expect(page.locator('#wallet')).toHaveText('1,050');
 // Ten draws: the summary shows ten outfits, at least one of them SR or better.
 await page.locator('#pull-10').click();
 await page.locator('#reveal-skip').click();
 await expect(page.locator('.summary-tile')).toHaveCount(10);
 expect(await page.locator('.summary-tile[data-rarity="SR"],.summary-tile[data-rarity="SSR"]').count()).toBeGreaterThan(0);
 await page.locator('#reveal-next').click();
 const f=await page.evaluate(async()=>(await(await window.__chacha.db()).get('settings','festival')) as {bones:number;pulls:number;owned:Record<string,number>});
 expect(f.pulls).toBe(11);expect(Object.values(f.owned).reduce((a,b)=>a+b,0)).toBe(11);
 await expect(page.locator('#wallet')).toHaveText(f.bones.toLocaleString('en-US'));
 await expect(page.locator('#pull-10')).toBeDisabled();
 // 天井: after 79 draws without ウルトラレア the next one is ウルトラレア. A series
 // completed (the お面 set here) pays its bonus once, with a celebration.
 await page.evaluate(async()=>{await (await window.__chacha.db()).put('settings',{schemaVersion:1,bones:200,earned:200,owned:{kitsune:1,oni:1,tengu:1,hyottoko:1,okame:1},pulls:79,awards:[],sinceSSR:79},'festival');});
 await page.reload();
 await expect(page.locator('#pity-left')).toHaveText('1');
 await page.locator('#pull-1').click();
 await page.locator('#reveal-next').click();
 if(await page.locator('.reveal-capsule.upgrade').count())await page.locator('#reveal-next').click();
 await expect(page.locator('.reveal-card .card-rarity')).toContainText('ウルトラレア');
 await expect(page.locator('.reveal-card .card-rarity')).toContainText('天井');
 await page.locator('#reveal-next').click();
 await expect(page.locator('.complete-reveal')).toContainText('お面');
 await expect(page.locator('.complete-reveal')).toContainText('＋250');
 await page.locator('#complete-close').click();
 await expect(page.locator('.series-shelf[data-series="omen"]')).toHaveClass(/done/);
 const g=await page.evaluate(async()=>(await(await window.__chacha.db()).get('settings','festival')) as {bones:number;sets:string[];sinceSSR:number});
 expect(g).toMatchObject({bones:350,sets:['omen'],sinceSSR:0});
 await expect(page.locator('#pity-left')).toHaveText('80');
});
