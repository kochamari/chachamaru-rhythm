import {it,expect,vi} from 'vitest';
import {AudioEngine} from '../../web/src/audio/AudioEngine';
import {defaults} from '../../web/src/app/store';
class Source {buffer:unknown;onended:(()=>void)|null=null;stopped=false;connected=false;connect(){this.connected=true;}disconnect(){this.connected=false;}start=vi.fn();stop(){this.stopped=true;this.onended?.();}}
class Context {currentTime=0;state='suspended';sampleRate=44100;onstatechange:unknown;destination={};sources:Source[]=[];async resume(){this.state='running';}async close(){this.state='closed';}createGain(){return {gain:{setValueAtTime:vi.fn()},connect(){},disconnect(){}};}createBufferSource(){const s=new Source();this.sources.push(s);return s;}async decodeAudioData(){return {duration:10};}}
it('U22 U23 source lifecycle counts 20 retries, protects stale onended and schedules 2s count-in',async()=>{vi.stubGlobal('AudioContext',Context);const a=new AudioEngine(structuredClone(defaults));await a.load(new Blob(['test']));const ctx=a.context as unknown as Context;for(let i=0;i<20;i++){a.start(1000);expect(a.liveSources).toBe(1);expect(ctx.sources.at(-1)!.start).toHaveBeenCalledWith(2,1);const old=ctx.sources.at(-1)!.onended;a.stop();expect(a.liveSources).toBe(0);a.start(2000);old?.();expect(a.ended).toBe(false);expect(a.liveSources).toBe(1);a.stop();}expect(ctx.sources.every(s=>s.stopped&&!s.connected)).toBe(true);a.dispose();expect(a.buffer).toBe(null);expect(a.context).toBe(null);vi.unstubAllGlobals();});

it('a brief stop that recovers by itself does not pause; one that stays silent does',async()=>{
 vi.useFakeTimers();vi.stubGlobal('AudioContext',Context);
 const a=new AudioEngine(structuredClone(defaults));await a.load(new Blob(['test']));const ctx=a.context as unknown as Context&{onstatechange:()=>void};
 const paused=vi.fn();a.onSuspend(paused);a.start(0);
 ctx.state='interrupted';ctx.onstatechange();await Promise.resolve();
 expect(ctx.state).toBe('running');vi.advanceTimersByTime(1000);expect(paused).not.toHaveBeenCalled();
 ctx.resume=async()=>{};ctx.state='suspended';ctx.onstatechange();vi.advanceTimersByTime(AudioEngine.RECOVER_MS-1);expect(paused).not.toHaveBeenCalled();
 vi.advanceTimersByTime(2);expect(paused).toHaveBeenCalledTimes(1);
 a.stop();ctx.state='suspended';ctx.onstatechange();vi.advanceTimersByTime(1000);expect(paused).toHaveBeenCalledTimes(1);
 a.dispose();vi.unstubAllGlobals();vi.useRealTimers();
});
