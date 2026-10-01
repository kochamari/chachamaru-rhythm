import 'fake-indexeddb/auto';
import {beforeEach,it,expect} from 'vitest';
import {daysBetween,nextLogin,nextStreakGoal,missionsFor,todayDaily,advanceMissions,featuredSong,newTiers,tierFor,unlockedTitles,titleName,runStats,festivalStats,MISSIONS,MISSION_BY_ID,ACHIEVEMENTS,LOGIN_REWARDS,STREAK_BONUS,ALL_MISSIONS_BONES,TIER_BONES,DEFAULT_TITLE,type RunFacts} from '../../web/src/game/daily';
import {claimLogin,awardBones,spendOnDraws,loadFestival,saveFestival,setTitle,validFestival,emptyFestival,featuredToday} from '../../web/src/storage/festival';
import {db,saveRun} from '../../web/src/storage/Database';
import {PULL_COST} from '../../web/src/game/gacha';
import {COSTUMES} from '../../web/src/render/costumes';
import type {RunResult} from '../../contracts/public-types';
import {defaults} from '../../web/src/app/store';

beforeEach(async()=>{const d=await db();for(const name of ['settings','runs'])await d.clear(name);});
const noon=(day:string)=>new Date(`${day}T12:00:00`);
const facts=(over:Partial<RunFacts>={}):RunFacts=>({cleared:false,great:0,maxCombo:0,rollHits:0,fevers:0,friendsAll:false,anySet:false,jackpot:false,hard:false,fullCombo:false,allGreat:false,featured:false,...over});

it('login bonus: a stamp a day on a 7-day card, a streak with milestones, a welcome back; once a day',()=>{
 expect(daysBetween('2026-09-30','2026-10-01')).toBe(1);expect(daysBetween('2026-12-31','2027-01-03')).toBe(3);
 let s=nextLogin(undefined,'2026-10-01')!;
 expect(s.state).toEqual({day:'2026-10-01',count:1,card:1,streak:1,best:1});
 expect(s.items).toEqual([{label:'ログインボーナス 1日目',bones:LOGIN_REWARDS[0]}]);
 expect(nextLogin(s.state,'2026-10-01')).toBe(null);
 expect(nextLogin(s.state,'2026-09-30')).toBe(null);
 s=nextLogin(s.state,'2026-10-02')!;s=nextLogin(s.state,'2026-10-03')!;
 expect(s.state.streak).toBe(3);expect(s.items.map(i=>i.label)).toEqual(['ログインボーナス 3日目','3日連続ログイン']);
 // A missed day: the streak starts again, the card goes on.
 s=nextLogin(s.state,'2026-10-05')!;expect([s.state.card,s.state.streak,s.state.best]).toEqual([4,1,3]);
 // After the 7th stamp a new card starts; four days away earns a welcome back.
 let t=s.state;for(const day of ['2026-10-06','2026-10-07','2026-10-08'])t=nextLogin(t,day)!.state;
 expect(t.card).toBe(7);
 const back=nextLogin(t,'2026-10-12')!;
 expect(back.state.card).toBe(1);expect(back.items.map(i=>i.label)).toContain('おかえりボーナス');
 expect(nextStreakGoal(1)).toEqual({day:3,left:2,bones:STREAK_BONUS[3]});expect(nextStreakGoal(5)?.day).toBe(7);
});

it('missions: three a day (easy, middle, fun), the same all day; paid once, plus a bonus for all three',()=>{
 const a=missionsFor('2026-10-01');
 expect(a).toEqual(missionsFor('2026-10-01'));
 expect(a.map(id=>MISSION_BY_ID.get(id)!.tier)).toEqual(['easy','mid','fun']);
 const days=Array.from({length:40},(_,i)=>missionsFor(`2026-11-${String(i%28+1).padStart(2,'0')}`).join());
 expect(new Set(days).size).toBeGreaterThan(5);
 // A day with fixed missions: 2 plays, 150 良, a pair.
 const state=todayDaily({day:'2026-10-01',ids:['play2','great150','pair'],progress:{},paid:[],allPaid:false},'2026-10-01');
 let r=advanceMissions(state,'2026-10-01',m=>m.gain(facts({great:100})));
 expect(r.items).toEqual([]);expect(r.moves).toEqual([{id:'play2',before:0,after:1},{id:'great150',before:0,after:100},{id:'pair',before:0,after:0}]);
 r=advanceMissions(r.state,'2026-10-01',m=>m.gain(facts({great:80,anySet:true})));
 expect(r.items.map(i=>i.label)).toEqual(['ミッション「2曲あそぶ」','ミッション「良を150回出す」','ミッション「仲間の毛色をそろえる」','ミッション全部クリア']);
 expect(r.items.at(-1)!.bones).toBe(ALL_MISSIONS_BONES);
 expect(r.state.progress.great150).toBe(150);
 r=advanceMissions(r.state,'2026-10-01',m=>m.gain(facts({great:500,anySet:true})));
 expect(r.items).toEqual([]);
 // A new day brings new missions.
 expect(advanceMissions(r.state,'2026-10-02',()=>0).state).toMatchObject({day:'2026-10-02',ids:missionsFor('2026-10-02'),paid:[],allPaid:false});
 for(const m of MISSIONS){expect(m.target).toBeGreaterThan(0);expect(m.name.length).toBeLessThanOrEqual(20);}
});

it('featured song: one of the installed songs, the same all day, changing over days',()=>{
 const ids=['b','a','c','d'];
 expect(featuredSong('2026-10-01',ids)).toBe(featuredSong('2026-10-01',[...ids].reverse()));
 expect(ids).toContain(featuredSong('2026-10-01',ids));
 expect(new Set(Array.from({length:20},(_,i)=>featuredSong(`2026-10-${String(i+1).padStart(2,'0')}`,ids))).size).toBeGreaterThan(1);
 expect(featuredSong('2026-10-01',[])).toBe(null);
});

it('やりこみ: tiers pay once each, skip unknown stats, and unlock titles',()=>{
 const plays=ACHIEVEMENTS.find(a=>a.id==='plays')!;
 expect([tierFor(plays,9),tierFor(plays,10),tierFor(plays,200)]).toEqual([0,1,3]);
 const first=newTiers({plays:60,fc:1},{});
 expect(first.map(u=>[u.id,u.tier,u.bones])).toEqual([['plays',1,TIER_BONES[0]],['plays',2,TIER_BONES[1]],['fc',1,TIER_BONES[0]]]);
 expect(newTiers({plays:60,fc:1},{plays:2,fc:1})).toEqual([]);
 expect(newTiers({},{})).toEqual([]);
 const titles=unlockedTitles({plays:2});
 expect(titles.map(t=>t.name)).toEqual(['お祭りデビュー','お祭りの常連']);
 expect(titleName('plays:2',{plays:2})).toBe('お祭りの常連');
 expect(titleName('plays:3',{plays:2})).toBe(DEFAULT_TITLE);expect(titleName(undefined,{})).toBe(DEFAULT_TITLE);
 const zukan=ACHIEVEMENTS.find(a=>a.id==='zukan')!;expect(zukan.tiers.at(-1)).toBe(COSTUMES.length);
});

const run=(over:Omit<Partial<RunResult>,'stats'>&{stats?:Partial<RunResult['stats']>}={}):RunResult=>({runId:crypto.randomUUID(),packId:'p',chartId:'c',audioHash:'a'.repeat(64),chartHash:'b'.repeat(64),ruleset:'chacha-v1',inputMode:'keyboard',autoplay:false,practice:false,date:new Date().toISOString(),settings:structuredClone(defaults),title:'t',difficulty:'normal',timingUnstable:false,...over,
 stats:{score:900000,baseScore:900000,rollBonus:0,rollHits:10,great:100,ok:5,miss:0,combo:105,maxCombo:105,gauge:90,accuracy:.97,fullCombo:true,allGreat:false,timingUnstable:false,finished:true,deltas:[],...over.stats}} as RunResult);

it('lifetime stats count normal play only',()=>{
 const runs=[run(),run({difficulty:'hard'}),run({autoplay:true}),run({practice:true}),run({stats:{maxCombo:300,fullCombo:false,gauge:40}})];
 expect(runStats(runs)).toEqual({plays:3,great:300,maxCombo:300,fc:2,ag:0,hardClears:1,rolls:30});
 expect(festivalStats({owned:{kin:1,hachimaki:2,unknown:1},xp:130,jackpots:2,login:{count:5,best:3}})).toEqual({jackpots:2,collected:2,loginDays:5,streakBest:3,level:2});
});

it('claiming the login bonus pays once a day and starts today’s missions',async()=>{
 const a=await claimLogin(noon('2026-10-01'));
 expect(a).toMatchObject({total:LOGIN_REWARDS[0],login:{card:1,streak:1}});
 expect(await claimLogin(noon('2026-10-01'))).toBe(null);
 const f=await loadFestival();
 expect([f.bones,f.earned,f.daily?.day,f.daily?.ids]).toEqual([LOGIN_REWARDS[0],LOGIN_REWARDS[0],'2026-10-01',missionsFor('2026-10-01')]);
 expect(validFestival(f)).toBe(true);
 const b=await claimLogin(noon('2026-10-02'));
 expect(b?.login).toMatchObject({card:2,streak:2,count:2});
});

it('a finished run advances missions and pays やりこみ from the saved runs; the featured song doubles play bones',async()=>{
 await saveFestival({...emptyFestival(),daily:{day:'2026-10-01',ids:['play2','fc1','osusume'],progress:{play2:1},paid:[],allPaid:false}});
 // Ten normal runs saved already (the tenth, a full combo, is this one): 演奏した曲 and フルコンボ reach their first tier.
 for(let i=0;i<10;i++)await saveRun(run({stats:{great:20,maxCombo:20,rollHits:0,fullCombo:i===9}}));
 const award=await awardBones('r1',120,[],{slot:['bone','drum','flower'],xp:30,now:noon('2026-10-01'),run:facts({fullCombo:true,featured:true})});
 const labels=award.items.map(i=>i.label);
 expect(labels).toContain('おすすめ曲 ×2');
 expect(labels).toEqual(expect.arrayContaining(['ミッション「2曲あそぶ」','ミッション「フルコンボを出す」','ミッション「おすすめ曲をあそぶ」','ミッション全部クリア','称号「お祭りデビュー」','称号「ノーミスデビュー」']));
 expect(award.items.find(i=>i.label==='おすすめ曲 ×2')!.bones).toBe(120);
 expect(award.missions).toEqual([{id:'play2',before:1,after:2},{id:'fc1',before:0,after:1},{id:'osusume',before:0,after:1}]);
 expect(award.titles).toEqual(['お祭りデビュー','ノーミスデビュー']);
 const f=await loadFestival();
 expect(f.achieved).toMatchObject({plays:1,fc:1});expect(f.daily?.allPaid).toBe(true);
 expect(f.bones).toBe(award.total);expect(validFestival(f)).toBe(true);
 // Titles can be chosen once unlocked.
 await setTitle('plays:1');expect((await loadFestival()).title).toBe('plays:1');
 await expect(setTitle('plays:3')).rejects.toThrow('まだ手に入れていない称号です');
});

it('one free draw a day; a draw advances the gacha mission',async()=>{
 await saveFestival({...emptyFestival(),bones:0,daily:{day:'2026-10-01',ids:['play2','great150','gacha1'],progress:{},paid:[],allPaid:false}});
 const one=await spendOnDraws(1,()=>[{id:'hachimaki',refund:0}],PULL_COST,undefined,{free:true,now:noon('2026-10-01')});
 const gacha1=MISSION_BY_ID.get('gacha1')!.bones;
 expect(one.extras).toEqual([{label:'ミッション「しばガチャをひく」',bones:gacha1}]);
 expect(one.festival.bones).toBe(gacha1);expect(one.festival.freeDay).toBe('2026-10-01');
 await expect(spendOnDraws(1,()=>[{id:'uchiwa',refund:0}],PULL_COST,undefined,{free:true,now:noon('2026-10-01')})).rejects.toThrow('きょうの無料ガチャは、もうひきました');
 const next=await spendOnDraws(1,()=>[{id:'uchiwa',refund:0}],PULL_COST,undefined,{free:true,now:noon('2026-10-02')});
 expect(next.festival.owned).toEqual({hachimaki:1,uchiwa:1});
});

it('the featured song is chosen once a day and kept while songs are installed or added',async()=>{
 // The very first start: only one song installed so far.
 expect(await featuredToday(['himawari-demo'],noon('2026-10-01'))).toBe('himawari-demo');
 expect(await featuredToday(['himawari-demo','b-song','c-song','d-song'],noon('2026-10-01'))).toBe('himawari-demo');
 // Deleted: chosen again, then kept.
 const again=await featuredToday(['b-song','c-song'],noon('2026-10-01'));
 expect(['b-song','c-song']).toContain(again);
 expect(await featuredToday(['b-song','c-song','d-song'],noon('2026-10-01'))).toBe(again);
 // It stays through the login claim and today's missions.
 await claimLogin(noon('2026-10-01'));
 await awardBones('r1',10,[],{slot:['bone','drum','flower'],xp:1,now:noon('2026-10-01'),run:facts()});
 expect((await loadFestival()).daily?.featured).toBe(again);
 // A new day: a new choice from all the songs.
 const ids=['b-song','c-song','d-song'];
 expect(await featuredToday(ids,noon('2026-10-02'))).toBe(featuredSong('2026-10-02',ids));
 expect(await featuredToday([],noon('2026-10-03'))).toBe(null);
 expect(validFestival(await loadFestival())).toBe(true);
});
