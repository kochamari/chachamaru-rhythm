// Beat-phase helpers shared by the renderer and menus. Pure.

/** Continuous beat index at `time` using the song's own beat markers. */
export function beatPhase(beats:readonly number[],time:number,fallbackMs=500):number{
 if(beats.length<2)return time/fallbackMs;
 let lo=0,hi=beats.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(beats[mid]<=time)lo=mid+1;else hi=mid;}
 // lo is the first beat after time (or the last beat).
 const i=Math.max(1,lo);
 const a=beats[i-1],b=beats[i];
 const gap=b-a>0?b-a:fallbackMs;
 if(time>=beats[beats.length-1]){const last=beats.length-1,g=beats[last]-beats[last-1]||fallbackMs;return last+(time-beats[last])/g;}
 return i-1+(time-a)/gap;
}

/** Downbeat times from the manifest (bar lines). */
export function downbeatTimes(beats:readonly number[],downbeatIndices:readonly number[]):number[]{
 return downbeatIndices.filter(i=>i>=0&&i<beats.length).map(i=>beats[i]);
}

export function inSection(sections:readonly {kind:string;startMs:number;endMs:number}[],kind:string,time:number){
 return sections.some(s=>s.kind===kind&&time>=s.startMs&&time<s.endMs);
}

/** Friends that join the dance: one more at each festival-gauge step. */
export const FRIEND_STEPS=[30,50,70,100] as const;
export function friendsForGauge(gauge:number){return FRIEND_STEPS.filter(step=>gauge>=step).length;}
