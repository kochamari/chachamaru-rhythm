// The balance of ほねっこ and しばガチャ (2026-10-01): a draw is earned over a
// few songs, the daily rewards add about a draw a day with the free one, and
// スーパーレア / ウルトラレア always bring an outfit not yet owned while any are left.
import {it,expect} from 'vitest';
import {boneGain,feverLevel,finishBones,DAILY_BONES} from '../../web/src/game/festival';
import {LOGIN_REWARDS,MISSIONS,ALL_MISSIONS_BONES} from '../../web/src/game/daily';
import {drawOutfits,PULL_COST,TEN_PULLS,DUPLICATE_BONES,RATES} from '../../web/src/game/gacha';
import {COSTUMES} from '../../web/src/render/costumes';

function lcg(seed:number){return ()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};}
/** Bones from play of a run: `notes` notes, a share `great` of 良 and `ok` of 可 (the rest missed). */
function runBones(notes:number,great:number,ok:number,seed:number){
 const random=lcg(seed);let bones=0,combo=0,max=0;
 for(let i=0;i<notes;i++){
  const u=random(),kind=u<great?'great':u<great+ok?'ok':'miss',fever=feverLevel(combo);
  bones+=boneGain({kind,size:random()<.04?'large':'normal'} as never,fever);
  if(kind==='miss')combo=0;else{combo++;bones+=boneGain({kind:'combo',value:combo} as never,fever);}
  max=Math.max(max,combo);
 }
 return bones+finishBones({gauge:90,fullCombo:max===notes,allGreat:false}).reduce((a,b)=>a+b.bones,0);
}

it('a draw is earned over a few songs, not with every song',()=>{
 // A steady ふつう run (450 notes, 85% 良): two to five songs to a draw.
 const steady=runBones(450,.85,.12,7)/PULL_COST;
 expect(steady).toBeGreaterThan(.2);expect(steady).toBeLessThan(.5);
 // A strong むずかしい run (650 notes, 90% 良, long SUPER FEVER) still under one draw.
 expect(runBones(650,.9,.08,8)/PULL_COST).toBeLessThan(1);
 // Ten draws are a goal to save up for: about a week of play.
 expect(PULL_COST*TEN_PULLS/runBones(450,.85,.12,9)).toBeGreaterThan(20);
});

it('a day of login, missions and the first play pays less than a draw',()=>{
 const card=LOGIN_REWARDS.reduce((a,b)=>a+b,0)/LOGIN_REWARDS.length;
 const best=(tier:string)=>Math.max(...MISSIONS.filter(m=>m.tier===tier).map(m=>m.bones));
 const missions=best('easy')+best('mid')+best('fun')+ALL_MISSIONS_BONES;
 expect(card+missions+DAILY_BONES).toBeLessThan(PULL_COST);
 // A repeat pays back a little, an ウルトラレア repeat no more than half a draw.
 expect(DUPLICATE_BONES.N).toBeLessThan(DUPLICATE_BONES.R);expect(DUPLICATE_BONES.SSR).toBeLessThanOrEqual(PULL_COST/2);
});

it('スーパーレア and ウルトラレア bring an outfit not yet owned while any are left',()=>{
 for(const rarity of ['SR','SSR'] as const){
  const all=COSTUMES.filter(c=>c.rarity===rarity).map(c=>c.id),missing=all[all.length-1];
  const owned=Object.fromEntries(all.slice(0,-1).map(id=>[id,1]));
  // A random number that lands in this rarity's band, then any pick.
  const band=rarity==='SR'?RATES.N+RATES.R+.01:RATES.N+RATES.R+RATES.SR+.005;
  for(let k=0;k<20;k++){
   const picks=[band,(k+.5)/20];let i=0;
   const [p]=drawOutfits(1,()=>picks[i++%2],owned);
   expect(p).toEqual({id:missing,rarity,isNew:true,refund:0});
  }
  // With all owned, a repeat comes (and pays back).
  const full=Object.fromEntries(all.map(id=>[id,1]));
  const [again]=drawOutfits(1,(()=>{const picks=[band,.5];let i=0;return ()=>picks[i++%2];})(),full);
  expect(again).toMatchObject({rarity,isNew:false,refund:DUPLICATE_BONES[rarity]});
 }
 // ノーマル and レア may repeat while others are left.
 const normals=COSTUMES.filter(c=>c.rarity==='N').map(c=>c.id);
 const [n]=drawOutfits(1,(()=>{const picks=[.1,0];let i=0;return ()=>picks[i++%2];})(),{[normals[0]]:1});
 expect(n).toMatchObject({id:normals[0],isNew:false});
 // Within one ten-draw the same rare does not come twice while others are left.
 const tens=drawOutfits(10,lcg(3),{});
 const rares=tens.filter(p=>p.rarity==='SR'||p.rarity==='SSR').map(p=>p.id);
 expect(new Set(rares).size).toBe(rares.length);
});
