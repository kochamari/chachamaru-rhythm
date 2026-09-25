import {describe,it,expect} from 'vitest';
import {renderDon,renderKa,renderEffect,renderHit,bandpass,type EffectName,type HitSound} from '../../web/src/audio/synth';
import {validSettings,defaults} from '../../web/src/app/store';

const peak=(x:Float32Array)=>x.reduce((m,v)=>Math.max(m,Math.abs(v)),0);
const rms=(x:Float32Array,a=0,b=x.length)=>Math.sqrt(x.slice(a,b).reduce((s,v)=>s+v*v,0)/(b-a));
function bandEnergy(x:Float32Array,sr:number,lo:number,hi:number){
 // Energy after a band-pass: enough to compare spectral balance.
 const y=bandpass(Float32Array.from(x),sr,Math.sqrt(lo*hi),Math.sqrt(lo*hi)/(hi-lo));
 return y.reduce((s,v)=>s+v*v,0);
}

describe('synthesised drum sounds',()=>{
 for(const sr of [44100,48000]){
  it(`don and ka are finite, bounded and deterministic at ${sr} Hz`,()=>{
   const don=renderDon(sr),ka=renderKa(sr);
   for(const x of [don,ka]){expect(x.every(Number.isFinite)).toBe(true);expect(peak(x)).toBeLessThanOrEqual(1);expect(peak(x)).toBeGreaterThan(.5);}
   expect(renderDon(sr)).toEqual(don);expect(renderKa(sr)).toEqual(ka);
   expect(don.length/sr).toBeGreaterThan(.3);expect(ka.length/sr).toBeLessThan(.25);
  });
 }
 it('don is low and full-bodied, ka is bright and short',()=>{
  const sr=48000,don=renderDon(sr),ka=renderKa(sr);
  expect(bandEnergy(don,sr,60,300)).toBeGreaterThan(bandEnergy(don,sr,2000,6000));
  expect(bandEnergy(ka,sr,2000,6000)).toBeGreaterThan(bandEnergy(ka,sr,60,300));
  // Attack within the first 3 ms, mostly decayed after 120 ms.
  expect(rms(ka,0,Math.floor(sr*.003))).toBeGreaterThan(0);
  expect(rms(ka,Math.floor(sr*.12))).toBeLessThan(rms(ka,0,Math.floor(sr*.03))*.2);
  // Ends silently (no click at the end of the buffer).
  expect(Math.abs(don[don.length-1])).toBeLessThan(1e-3);expect(Math.abs(ka[ka.length-1])).toBeLessThan(1e-3);
 });
 it('every festival effect renders a bounded sound',()=>{
  for(const name of ['combo10','combo50','combo100','fullCombo','allGreat','clear','fail','chorus','select','move','back','tick','balloon','count','fever','fullHouse','gachaTurn','gachaOpen','gachaRare'] as EffectName[]){
   const x=renderEffect(name,44100);
   expect(x.length,name).toBeGreaterThan(1000);expect(x.every(Number.isFinite),name).toBe(true);expect(peak(x),name).toBeLessThanOrEqual(1);
  }
  expect(renderEffect('fullCombo',44100).length/44100).toBeGreaterThan(1.5);
 });
 it('each stroke sound set renders don and ka',()=>{
  for(const set of ['taiko','pop','wood'] as HitSound[])for(const color of ['don','ka'] as const){
   const x=renderHit(color,set,48000);
   expect(x.every(Number.isFinite),set+color).toBe(true);expect(peak(x)).toBeLessThanOrEqual(1);expect(peak(x)).toBeGreaterThan(.5);
   expect(Math.abs(x[x.length-1])).toBeLessThan(1e-3);
  }
  expect(renderHit('don','pop',44100)).not.toEqual(renderHit('don','taiko',44100));
 });
});

describe('settings with the new options',()=>{
 it('accepts older saves without scroll speed or sound set, rejects unknown values',()=>{
  const old:Partial<typeof defaults>=structuredClone(defaults);delete old.scrollSpeed;delete old.hitSound;delete old.haptics;
  expect(validSettings(old)).toBe(true);
  expect(validSettings({...defaults,scrollSpeed:1.5,hitSound:'wood'})).toBe(true);
  expect(validSettings({...defaults,scrollSpeed:3})).toBe(false);
  expect(validSettings({...defaults,hitSound:'bark' as never})).toBe(false);
  expect(defaults.haptics).toBe(true);
  expect(validSettings({...defaults,haptics:false})).toBe(true);
  expect(validSettings({...defaults,haptics:'yes' as never})).toBe(false);
 });
});
