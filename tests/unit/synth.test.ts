import {describe,it,expect} from 'vitest';
import {renderDon,renderKa,renderEffect,renderHit,bandpass,hitSoundOf,HIT_SOUNDS,type EffectName,type HitSound} from '../../web/src/audio/synth';
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
 it('ka knocks like a wooden rim instead of ringing like metal',()=>{
  const sr=48000,ka=renderKa(sr);
  const energy=(x:Float32Array,a=0)=>x.slice(a).reduce((s,v)=>s+v*v,0);
  // Over within about 40 ms (the first, ringing rim sound kept 28% of its sound after 40 ms).
  expect(energy(ka,Math.floor(sr*.04))).toBeLessThan(energy(ka)*.05);
  // Its bright partials die first (before: 36% of the 3 kHz band after 25 ms).
  const bright=bandpass(Float32Array.from(ka),sr,3000,1);
  expect(energy(bright,Math.floor(sr*.025))).toBeLessThan(energy(bright)*.05);
 });
 it('every festival effect renders a bounded sound',()=>{
  for(const name of ['combo10','combo50','combo100','fullCombo','allGreat','clear','fail','chorus','select','move','back','tick','balloon','count','fever','fullHouse','gachaTurn','gachaOpen','gachaRare','join','reel'] as EffectName[]){
   const x=renderEffect(name,44100);
   expect(x.length,name).toBeGreaterThan(1000);expect(x.every(Number.isFinite),name).toBe(true);expect(peak(x),name).toBeLessThanOrEqual(1);
  }
  expect(renderEffect('fullCombo',44100).length/44100).toBeGreaterThan(1.5);
 });
 it('each 和太鼓 voice renders don and ka, all different',()=>{
  const seen:Float32Array[]=[];
  for(const set of HIT_SOUNDS)for(const color of ['don','ka'] as const){
   const x=renderHit(color,set,48000);
   expect(x.every(Number.isFinite),set+color).toBe(true);expect(peak(x)).toBeLessThanOrEqual(1);expect(peak(x)).toBeGreaterThan(.5);
   expect(Math.abs(x[x.length-1])).toBeLessThan(1e-3);
   expect(renderHit(color,set,48000)).toEqual(x);
   for(const other of seen)expect(x).not.toEqual(other);
   seen.push(x);
  }
  expect(HIT_SOUNDS).toEqual(['taiko','shime','odaiko','hibiki']);
 });
 it('the voices differ as their names say',()=>{
  const sr=48000,hit=(c:'don'|'ka',set:HitSound)=>renderHit(c,set,sr);
  const energy=(x:Float32Array,a=0)=>x.slice(a).reduce((s,v)=>s+v*v,0);
  // かるい: the highest ka and a higher drum; おもい: the lowest ka and the deepest drum.
  const high=(x:Float32Array)=>bandEnergy(x,sr,2400,6000)/bandEnergy(x,sr,800,2000);
  expect(high(hit('ka','shime'))).toBeGreaterThan(high(hit('ka','taiko')));
  expect(high(hit('ka','taiko'))).toBeGreaterThan(high(hit('ka','odaiko')));
  const deep=(x:Float32Array)=>bandEnergy(x,sr,50,120)/bandEnergy(x,sr,140,400);
  expect(deep(hit('don','odaiko'))).toBeGreaterThan(deep(hit('don','taiko')));
  expect(deep(hit('don','taiko'))).toBeGreaterThan(deep(hit('don','shime')));
  // Every ka but the hall's is dry; the hall's rings on after the stroke.
  for(const set of ['taiko','shime','odaiko'] as HitSound[]){const x=hit('ka',set);expect(energy(x,Math.floor(sr*.04)),set).toBeLessThan(energy(x)*.05);}
  const hall=hit('ka','hibiki');expect(energy(hall,Math.floor(sr*.06))).toBeGreaterThan(energy(hall)*.01);
  expect(hall.length).toBeGreaterThan(hit('ka','taiko').length);
 });
 it('a choice saved by an earlier version plays the standard drum',()=>{
  expect(hitSoundOf('pop')).toBe('taiko');expect(hitSoundOf('wood')).toBe('taiko');expect(hitSoundOf(undefined)).toBe('taiko');
  expect(hitSoundOf('odaiko')).toBe('odaiko');
 });
});

describe('settings with the new options',()=>{
 it('accepts older saves without scroll speed or sound set, rejects unknown values',()=>{
  const old:Partial<typeof defaults>=structuredClone(defaults);delete old.scrollSpeed;delete old.hitSound;delete old.haptics;
  expect(validSettings(old)).toBe(true);
  expect(validSettings({...defaults,scrollSpeed:1.5,hitSound:'odaiko'})).toBe(true);
  // Saves and records from when 'pop' and 'wood' were offered still load (they play as the standard drum).
  expect(validSettings({...defaults,hitSound:'wood'})).toBe(true);expect(validSettings({...defaults,hitSound:'pop'})).toBe(true);
  expect(validSettings({...defaults,scrollSpeed:3})).toBe(false);
  expect(validSettings({...defaults,hitSound:'bark' as never})).toBe(false);
  // Tap vibration was removed; saves from when it existed still load.
  expect(defaults.haptics).toBeUndefined();
  expect(validSettings({...defaults,haptics:false})).toBe(true);
  expect(validSettings({...defaults,haptics:'yes' as never})).toBe(false);
 });
});
