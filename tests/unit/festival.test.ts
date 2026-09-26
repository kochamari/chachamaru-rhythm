import 'fake-indexeddb/auto';
import {beforeEach,it,expect} from 'vitest';
import {boneGain,finishBones,BoneCounter,inFever,FEVER_COMBO,ALL_FRIENDS_BONES,ALL_FRIENDS_GAUGE,drawFriends,joinBonuses,isReach,mergeBonuses,RARE_COATS,COMMON_COATS} from '../../web/src/game/festival';
import {awardBones,loadFestival,validFestival,emptyFestival} from '../../web/src/storage/festival';
import {db} from '../../web/src/storage/Database';
import type {EffectEvent} from '../../contracts/public-types';

beforeEach(async()=>{await (await db()).clear('settings');});
const hit=(kind:EffectEvent['kind'],extra:Partial<EffectEvent>={}):EffectEvent=>({kind,timeMs:0,...extra});

it('ほねっこ: 良 1 (big note 2), doubled in FEVER, +10 every 50 combo; 可 and misses give none',()=>{
 expect(boneGain(hit('great'),false)).toBe(1);
 expect(boneGain(hit('great',{size:'large'}),false)).toBe(2);
 expect(boneGain(hit('great',{size:'large'}),true)).toBe(4);
 expect(boneGain(hit('ok'),true)).toBe(0);expect(boneGain(hit('miss'),true)).toBe(0);
 expect(boneGain(hit('combo',{value:50}),false)).toBe(10);expect(boneGain(hit('combo',{value:10}),false)).toBe(0);
 expect(inFever(FEVER_COMBO-1)).toBe(false);expect(inFever(FEVER_COMBO)).toBe(true);
});

it('counts a run live: FEVER from the 31st hit on, ends on a miss; all four friends pay once',()=>{
 const c=new BoneCounter();c.setFriends(['kuro','shiro','goma','aka']);
 c.add(Array.from({length:30},()=>hit('great')),40);
 expect(c.bones).toBe(30);
 c.add([hit('great'),hit('great')],50);
 expect(c.bones).toBe(34);
 c.add([hit('miss'),hit('great')],60);
 expect(c.bones).toBe(35);
 c.add([],ALL_FRIENDS_GAUGE);expect(c.bones).toBe(35+ALL_FRIENDS_BONES);expect(c.play).toBe(35);
 c.add([],ALL_FRIENDS_GAUGE-20);c.add([],ALL_FRIENDS_GAUGE);expect(c.bones).toBe(35+ALL_FRIENDS_BONES);
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

/** Deterministic random numbers. */
function lcg(seed:number){return ()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};}

it('the four friends are a slot draw: rare coats get likelier friend by friend, and more so when found in the draw',()=>{
 const N=40000,rare=[0,0,0,0],rareOwned=[0,0,0,0],sets={pair:0,twoPair:0,three:0,four:0,none:0};
 const random=lcg(11);
 for(let n=0;n<N;n++){
  const coats=drawFriends(random,{});
  expect(coats).toHaveLength(4);
  coats.forEach((c,i)=>{expect([...COMMON_COATS,...RARE_COATS]).toContain(c);if((RARE_COATS as readonly string[]).includes(c))rare[i]++;});
  let best:ReturnType<typeof joinBonuses>['set']=null;
  coats.forEach((c,i)=>{const {set}=joinBonuses(coats.slice(0,i),c);if(set)best=set;});
  sets[best??'none']++;
  drawFriends(random,{kin:1,sakura:1}).forEach((c,i)=>{if((RARE_COATS as readonly string[]).includes(c))rareOwned[i]++;});
 }
 const rate=(x:number)=>x/N;
 // 3 rare coats: 6% → 10.5% → 18% → 30% (before the リーチ boost on the fourth).
 expect(rate(rare[0])).toBeCloseTo(.06,1);expect(rate(rare[1])).toBeGreaterThan(rate(rare[0]));expect(rate(rare[2])).toBeGreaterThan(rate(rare[1]));expect(rate(rare[3])).toBeGreaterThan(rate(rare[2]));
 expect(rate(rareOwned[2])).toBeGreaterThan(rate(rare[2])*1.4);
 // Sets: a pair is common, three of a kind now and then, four rare but real.
 expect(rate(sets.pair+sets.twoPair)).toBeGreaterThan(.4);
 expect(rate(sets.three)).toBeGreaterThan(.08);expect(rate(sets.three)).toBeLessThan(.3);
 expect(rate(sets.four)).toBeGreaterThan(.005);expect(rate(sets.four)).toBeLessThan(.05);
});

it('each friend pays for what their coat completes; リーチ when the fourth can complete a set',()=>{
 expect(joinBonuses([],'kuro')).toEqual({items:[],set:null,rare:false});
 expect(joinBonuses(['kuro'],'kuro').items).toEqual([{label:'ペア',bones:10}]);
 expect(joinBonuses(['kuro','kuro','shiro'],'shiro')).toMatchObject({set:'twoPair',items:[{label:'ダブルペア',bones:30}]});
 expect(joinBonuses(['kin','kin'],'kin')).toEqual({set:'three',rare:true,items:[{label:'3匹そろい',bones:50},{label:'レア柴',bones:20}]});
 expect(joinBonuses(['aka','aka','aka'],'aka').items[0]).toEqual({label:'4匹そろい',bones:200});
 expect([isReach(['kuro','shiro','goma']),isReach(['kuro','shiro','kuro']),isReach(['gin','gin','gin']),isReach(['kuro','kuro'])]).toEqual([false,true,true,false]);
 const c=new BoneCounter();c.setFriends(['kuro','kuro','kin','kuro']);
 c.add([],30);c.add([],50);expect(c.bonuses).toEqual([{label:'ペア',bones:10}]);
 c.add([],100);
 expect(c.bonuses.map(b=>b.label)).toEqual(['ペア','レア柴','3匹そろい','全員集合']);
 expect(mergeBonuses([...c.bonuses,{label:'レア柴',bones:20},{label:'クリア',bones:20}])).toEqual([{label:'ペア',bones:10},{label:'レア柴',bones:40},{label:'3匹そろい',bones:50},{label:'全員集合',bones:30},{label:'クリア',bones:20}]);
});
