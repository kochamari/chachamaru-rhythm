import 'fake-indexeddb/auto';
import {beforeEach,it,expect} from 'vitest';
import {crowdStep,crowdSize,boneGain,finishBones,BoneCounter,inFever,CROWD_MAX,FEVER_COMBO,FULL_HOUSE_BONES} from '../../web/src/game/festival';
import {awardBones,loadFestival,validFestival,emptyFestival} from '../../web/src/storage/festival';
import {db} from '../../web/src/storage/Database';
import type {EffectEvent} from '../../contracts/public-types';

beforeEach(async()=>{await (await db()).clear('settings');});
const hit=(kind:EffectEvent['kind'],extra:Partial<EffectEvent>={}):EffectEvent=>({kind,timeMs:0,...extra});

it('the crowd fills near the end of a nine-in-ten run, whatever the song length',()=>{
 for(const taps of [120,200,400]){
  const step=crowdStep(taps);
  expect(crowdSize(Math.round(taps*.9),step)).toBe(CROWD_MAX);
  expect(crowdSize(Math.round(taps*.6),step)).toBeLessThan(CROWD_MAX);
 }
 expect(crowdStep(20)).toBe(4);expect(crowdStep(2000)).toBe(14);
 expect(crowdSize(0,8)).toBe(0);expect(crowdSize(8,8)).toBe(1);expect(crowdSize(10000,8)).toBe(CROWD_MAX);
});

it('ほねっこ: 良 1 (big note 2), doubled in FEVER, +10 every 50 combo; 可 and misses give none',()=>{
 expect(boneGain(hit('great'),false)).toBe(1);
 expect(boneGain(hit('great',{size:'large'}),false)).toBe(2);
 expect(boneGain(hit('great',{size:'large'}),true)).toBe(4);
 expect(boneGain(hit('ok'),true)).toBe(0);expect(boneGain(hit('miss'),true)).toBe(0);
 expect(boneGain(hit('combo',{value:50}),false)).toBe(10);expect(boneGain(hit('combo',{value:10}),false)).toBe(0);
 expect(inFever(FEVER_COMBO-1)).toBe(false);expect(inFever(FEVER_COMBO)).toBe(true);
});

it('counts a run live: FEVER from the 31st hit on, ends on a miss; the full crowd pays once',()=>{
 const c=new BoneCounter(4);
 c.add(Array.from({length:30},()=>hit('great')),30);
 expect(c.bones).toBe(30);
 c.add([hit('great'),hit('great')],32);
 expect(c.bones).toBe(34);
 c.add([hit('miss'),hit('great')],33);
 expect(c.bones).toBe(35);
 c.add([],CROWD_MAX*4);expect(c.bones).toBe(35+FULL_HOUSE_BONES);
 c.add([],CROWD_MAX*4+10);expect(c.bones).toBe(35+FULL_HOUSE_BONES);
 expect(finishBones({gauge:72,fullCombo:false,allGreat:false})).toEqual([{label:'クリア',bones:20}]);
 expect(finishBones({gauge:100,fullCombo:true,allGreat:true}).map(i=>i.bones)).toEqual([20,100]);
 expect(finishBones({gauge:40,fullCombo:false,allGreat:false})).toEqual([]);
});

it('a finished run is paid once and kept with the saved data',async()=>{
 expect(await loadFestival()).toEqual(emptyFestival());
 const a=await awardBones('run-1',120,[{label:'クリア',bones:20}]);
 expect(a.total).toBe(140);
 const again=await awardBones('run-1',120,[{label:'クリア',bones:20}]);
 expect(again.date).toBe(a.date);
 await awardBones('run-2',30,[]);
 const f=await loadFestival();
 expect([f.bones,f.earned,f.awards.map(x=>x.runId)]).toEqual([170,170,['run-2','run-1']]);
 expect(validFestival(f)).toBe(true);
 expect(validFestival({...f,bones:-1})).toBe(false);
 expect(validFestival({...f,owned:{'<script>':1}})).toBe(false);
});

import {drawOutfits,rarityFor,collected,RATES,PULL_COST,DUPLICATE_BONES} from '../../web/src/game/gacha';
import {spendOnDraws,saveFestival} from '../../web/src/storage/festival';
import {COSTUMES} from '../../web/src/render/costumes';

/** Deterministic random numbers for the draw. */
function seeded(seed:number){return ()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};}

it('しばガチャ: rates add up, every rarity has outfits, and draws follow the rates',()=>{
 expect(Object.values(RATES).reduce((a,b)=>a+b,0)).toBeCloseTo(1,9);
 for(const r of ['N','R','SR','SSR'] as const)expect(COSTUMES.some(c=>c.rarity===r)).toBe(true);
 expect([rarityFor(0),rarityFor(.579),rarityFor(.58),rarityFor(.879),rarityFor(.88),rarityFor(.979),rarityFor(.98),rarityFor(.9999)]).toEqual(['N','N','R','R','SR','SR','SSR','SSR']);
 const counts={N:0,R:0,SR:0,SSR:0};const rnd=seeded(7);
 for(let i=0;i<20000;i++)counts[rarityFor(rnd())]++;
 expect(counts.N/20000).toBeCloseTo(.58,1);expect(counts.SSR/20000).toBeGreaterThan(.01);expect(counts.SSR/20000).toBeLessThan(.03);
 expect(new Set(COSTUMES.map(c=>c.id)).size).toBe(COSTUMES.length);
});

it('a ten-draw always brings SR or better; repeats are marked and pay bones back',()=>{
 for(let seed=1;seed<300;seed++){
  const pulls=drawOutfits(10,seeded(seed),{});
  expect(pulls.some(p=>p.rarity==='SR'||p.rarity==='SSR')).toBe(true);
  const firsts=new Set<string>();
  for(const p of pulls){expect(p.isNew).toBe(!firsts.has(p.id));expect(p.refund).toBe(p.isNew?0:DUPLICATE_BONES[p.rarity]);firsts.add(p.id);}
 }
 // Only N and R forced: the tenth becomes SR+ (all N/R draws before it).
 const low=[.1,.5,.1,.5,.1,.5,.1,.5,.1,.5,.1,.5,.1,.5,.1,.5,.1,.5,.2,.5];let i=0;
 const pulls=drawOutfits(10,()=>low[i++%low.length],{});
 expect(pulls.slice(0,9).every(p=>p.rarity==='N')).toBe(true);expect(pulls[9].rarity).toBe('SR');
 // Always 0.1: the first N outfit, already owned here.
 const owned={hachimaki:1};
 expect(drawOutfits(1,()=>.1,owned)[0]).toEqual({id:'hachimaki',rarity:'N',isNew:false,refund:10});
 expect(collected(owned)).toEqual({have:1,all:COSTUMES.length});
});

it('spending bones checks the balance and saves the new outfits',async()=>{
 await expect(spendOnDraws(1,o=>drawOutfits(1,seeded(3),o),PULL_COST)).rejects.toThrow('ほねっこが足りません');
 await awardBones('run-x',250,[]);
 const first=await spendOnDraws(1,o=>drawOutfits(1,seeded(3),o),PULL_COST);
 expect(first.festival.bones).toBe(150);expect(first.festival.owned[first.pulls[0].id]).toBe(1);expect(first.festival.pulls).toBe(1);
 // The same outfit again: 100 spent, the repeat bonus paid back.
 const again=await spendOnDraws(1,()=>[{id:first.pulls[0].id,refund:10}],PULL_COST);
 expect(again.festival.bones).toBe(60);expect(again.festival.owned[first.pulls[0].id]).toBe(2);
 const f=await loadFestival();expect(f.bones).toBe(60);
 await saveFestival({...f,bones:5});expect((await loadFestival()).bones).toBe(5);
});

import {backup,restore,saveSettings} from '../../web/src/storage/Database';
import {defaults} from '../../web/src/app/store';

it('backups carry ほねっこ and collected outfits; a broken one is refused',async()=>{
 await saveSettings(defaults);
 await awardBones('run-b',300,[]);
 await spendOnDraws(1,()=>[{id:'kin',refund:0}],PULL_COST);
 const b=await backup();
 expect(b.festival?.owned).toEqual({kin:1});
 await (await db()).clear('settings');await saveSettings(defaults);
 await restore(JSON.parse(JSON.stringify(b)));
 expect((await loadFestival()).bones).toBe(200);expect((await loadFestival()).owned).toEqual({kin:1});
 await expect(restore({...b,festival:{...b.festival,bones:-5}})).rejects.toThrow('ごほうびのデータが不正です');
 expect((await loadFestival()).bones).toBe(200);
 // Older backups without the festival part still restore and leave it alone.
 const {festival:_ignored,...older}=b;
 await restore(older);expect((await loadFestival()).bones).toBe(200);
});
