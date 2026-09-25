// 音ズレ合わせ: measuring how late the sound reaches the player. Pure: no DOM,
// no audio.
//
// A steady beat plays through the same output as the songs (for example
// Bluetooth to a TD-17) and the player hits along with what they hear. Each
// hit is passed as milliseconds since the first beat on the game's own audio
// clock, the clock the play screen uses. The typical offset is then exactly
// what the game should take off (Settings.audioDelayMs): the output's delay
// plus the player's own habit of hitting a little early or late.

export const SYNC_PERIOD_MS=700;
export const SYNC_BEATS=20;
/** The first beats are for finding the pulse and are not measured. */
export const SYNC_WARMUP=4;
/**
 * Offsets are read in [SYNC_MIN_MS, SYNC_MIN_MS + period): Bluetooth only
 * adds delay (up to about half a second), players hit at most a little early.
 */
export const SYNC_MIN_MS=-150;
export const SYNC_MIN_HITS=8;

export interface DelayEstimate {delayMs:number;spreadMs:number;count:number}

const median=(values:number[])=>{const a=[...values].sort((x,y)=>x-y),m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2;};

/** Offset of a hit from its beat, read in the expected range, and that beat's number. */
export function beatOffset(ms:number,periodMs=SYNC_PERIOD_MS,minMs=SYNC_MIN_MS){
 const offset=((ms-minMs)%periodMs+periodMs)%periodMs+minMs;
 return {beat:Math.round((ms-offset)/periodMs),offset};
}

/**
 * The delay from hits along a steady beat. The first hit of each measured
 * beat counts (a double hit adds nothing); stray hits far from the rest are
 * left out. Null when too few beats were hit.
 */
export function estimateDelay(hits:number[],{periodMs=SYNC_PERIOD_MS,beats=SYNC_BEATS,warmup=SYNC_WARMUP,minMs=SYNC_MIN_MS,minHits=SYNC_MIN_HITS}={}):DelayEstimate|null{
 const byBeat=new Map<number,number>();
 for(const ms of hits){
  if(!Number.isFinite(ms))continue;
  const {beat,offset}=beatOffset(ms,periodMs,minMs);
  if(beat<warmup||beat>=beats||byBeat.has(beat))continue;
  byBeat.set(beat,offset);
 }
 const all=[...byBeat.values()];
 if(all.length<minHits)return null;
 const first=median(all);
 const limit=Math.max(30,3*1.4826*median(all.map(v=>Math.abs(v-first))));
 const kept=all.filter(v=>Math.abs(v-first)<=limit);
 if(kept.length<minHits)return null;
 const delay=median(kept);
 return {delayMs:Math.round(delay),spreadMs:Math.round(median(kept.map(v=>Math.abs(v-delay)))),count:kept.length};
}

/** Signed distance (ms) from a time to the nearest beat of a grid starting at 0. */
export function nearestBeat(ms:number,periodMs=SYNC_PERIOD_MS){return ms-Math.round(ms/periodMs)*periodMs;}
