import type {Settings} from '../../../contracts/public-types';

// Where the sound comes out (音の出力). Each output keeps its own timing, so
// switching between the iPhone speaker and Bluetooth to the drum module is one
// choice instead of retyping the delay.

export const OUTPUTS:Record<string,string>={'phone-speaker':'iPhoneのスピーカー','td17-bluetooth':'TD-17 · Bluetooth','td17-wired':'TD-17 · 有線','custom':'カスタム'};
type Timing=Settings['calibrationProfiles'][string];
const ZERO:Timing={audioDelayMs:0,inputLagMs:0,visualAdvanceMs:0};

/** Built-in outputs first, then the player's own copies. */
export function outputNames(s:Settings):[string,string][]{
 return [...Object.entries(OUTPUTS),...Object.keys(s.calibrationProfiles).filter(k=>!(k in OUTPUTS)).map(k=>[k,k] as [string,string])];
}

export function timingOf(s:Settings,name:string):Timing{
 return name===s.profile?{audioDelayMs:s.audioDelayMs,inputLagMs:s.inputLagMs,visualAdvanceMs:s.visualAdvanceMs}:s.calibrationProfiles[name]??ZERO;
}

/** Keeps the current output's timing and loads another's. */
export function useOutput(s:Settings,name:string){
 s.calibrationProfiles[s.profile]=timingOf(s,s.profile);
 s.profile=name;
 Object.assign(s,s.calibrationProfiles[name]??ZERO);
}

/** Sets the current output's timing (kept with the output). */
export function setTiming(s:Settings,timing:Partial<Timing>){
 Object.assign(s,timing);
 s.calibrationProfiles[s.profile]=timingOf(s,s.profile);
}

export const clampDelay=(ms:number)=>Math.round(Math.max(-100,Math.min(500,ms)));
export const signedMs=(ms:number)=>`${ms>0?'＋':ms<0?'−':'±'}${Math.abs(ms)}ms`;

/** `<option>`s for an output menu, each with its delay. */
export function outputOptions(s:Settings,escape:(v:string)=>string){
 return outputNames(s).map(([k,v])=>`<option value="${escape(k)}"${k===s.profile?' selected':''}>${escape(v)}（${signedMs(timingOf(s,k).audioDelayMs)}）</option>`).join('');
}
