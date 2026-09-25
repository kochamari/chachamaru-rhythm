import {it,expect} from 'vitest';
import {estimateDelay,beatOffset,nearestBeat,SYNC_PERIOD_MS as P,SYNC_BEATS} from '../../web/src/game/sync';
import {useOutput,setTiming,timingOf,outputNames,clampDelay,signedMs} from '../../web/src/app/output';
import {ClockBridge} from '../../web/src/audio/ClockBridge';
import {defaults,validSettings} from '../../web/src/app/store';

/** Hits `delay` ms after each beat (ms since the first beat). */
const along=(delay:number,beats=SYNC_BEATS,jitter=(_k:number)=>0)=>Array.from({length:beats},(_,k)=>k*P+delay+jitter(k));

it('音ズレ合わせ: the delay of the heard beat, from hits along it',()=>{
 for(const d of [0,35,150,240,420,-60])expect(estimateDelay(along(d))?.delayMs).toBe(d);
 const e=estimateDelay(along(180,SYNC_BEATS,k=>[-12,4,9,-3][k%4]))!;
 expect(e.delayMs).toBeGreaterThanOrEqual(178);expect(e.delayMs).toBeLessThanOrEqual(183);
 expect(e.spreadMs).toBeLessThanOrEqual(10);expect(e.count).toBe(16);
});

it('skips the warm-up beats, double hits and a stray hit, and needs enough beats',()=>{
 // Still finding the pulse on the first 4 beats.
 expect(estimateDelay([...along(330,4),...along(120).slice(4)])?.delayMs).toBe(120);
 // Two hits per beat (a flam): the first counts.
 expect(estimateDelay(along(120).flatMap(t=>[t,t+30]))?.delayMs).toBe(120);
 // One beat hit far off is left out.
 const stray=along(120);stray[12]+=280;
 expect(estimateDelay(stray)).toEqual({delayMs:120,spreadMs:0,count:15});
 // Fewer than 8 measured beats: not enough to say.
 expect(estimateDelay(along(120,11))).toBe(null);
 expect(estimateDelay(along(120,12))?.count).toBe(8);
});

it('reads offsets from −150 ms to just under 550 ms (Bluetooth adds delay, players hit a little early)',()=>{
 expect(beatOffset(10*P+120)).toEqual({beat:10,offset:120});
 expect(beatOffset(10*P-100)).toEqual({beat:10,offset:-100});
 expect(beatOffset(10*P+600)).toEqual({beat:11,offset:-100});
 expect(estimateDelay(along(540))?.delayMs).toBe(540);
 expect(estimateDelay(along(-140))?.delayMs).toBe(-140);
 expect(nearestBeat(5*P+20)).toBe(20);expect(nearestBeat(5*P-30)).toBe(-30);
});

it('the measured delay, used as audioDelayMs, puts hits along the heard beat on the notes',()=>{
 // Render-clock mode: audio time = performance time + 5 s.
 let now=1000;const clock=new ClockBridge({get currentTime(){return now/1000+5;}},()=>now);
 const t0=12,heardLate=210;
 // The player hears beat k heardLate ms after the browser plays it and hits then.
 const hitsAt=Array.from({length:SYNC_BEATS},(_,k)=>(t0-5)*1000+k*P+heardLate);
 const measured=estimateDelay(hitsAt.map(p=>{now=p;return 1000*(clock.audioAt(p)-t0);}))!;
 expect(measured.delayMs).toBe(heardLate);
 // In play, a note at song time k·P is heard at the same moment and judged on time.
 for(const [k,p] of hitsAt.entries()){now=p;expect(clock.songAt(p,t0,0,measured.delayMs)).toBeCloseTo(k*P,6);}
});

it('each sound output keeps its own timing; switching loads it',()=>{
 const s=structuredClone(defaults);
 expect(s.profile).toBe('phone-speaker');
 useOutput(s,'td17-bluetooth');setTiming(s,{audioDelayMs:180,inputLagMs:0});
 expect(s.calibrationProfiles['td17-bluetooth']).toEqual({audioDelayMs:180,inputLagMs:0,visualAdvanceMs:0});
 useOutput(s,'phone-speaker');expect([s.profile,s.audioDelayMs]).toEqual(['phone-speaker',0]);
 expect(timingOf(s,'td17-bluetooth').audioDelayMs).toBe(180);
 useOutput(s,'td17-bluetooth');expect(s.audioDelayMs).toBe(180);
 expect(validSettings(s)).toBe(true);
 s.calibrationProfiles['スタジオ']={audioDelayMs:40,inputLagMs:0,visualAdvanceMs:0};
 expect(outputNames(s).map(([k])=>k)).toEqual(['phone-speaker','td17-bluetooth','td17-wired','custom','スタジオ']);
 expect([clampDelay(620),clampDelay(-130),clampDelay(149.6)]).toEqual([500,-100,150]);
 expect([signedMs(150),signedMs(0),signedMs(-20)]).toEqual(['＋150ms','±0ms','−20ms']);
});
