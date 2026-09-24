import type {Note} from '../../../contracts/public-types';

// Syllables shown on the strip under the lane, in the spirit of drum
// mnemonics: isolated notes read ドン / カッ, quick runs read ド・コ・カ and
// the last note of a run gets its full sound. Pure and deterministic.

export function localBeatMs(beats:readonly number[],timeMs:number){
 if(beats.length<2)return 500;
 let lo=0,hi=beats.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(beats[mid]<timeMs)lo=mid+1;else hi=mid;}
 const i=Math.min(Math.max(1,lo),beats.length-1);
 const gap=beats[i]-beats[i-1];
 return gap>0?gap:500;
}

export function noteSyllables(notes:readonly Note[],beats:readonly number[]):Map<string,string>{
 const out=new Map<string,string>();
 let runIndex=0;
 for(let i=0;i<notes.length;i++){
  const n=notes[i];
  if(n.kind==='roll'){out.set(n.id,'連打');runIndex=0;continue;}
  const next=notes[i+1];
  const beat=localBeatMs(beats,n.timeMs);
  const fast=next!==undefined&&next.kind==='tap'&&next.timeMs-n.timeMs<beat*.4;
  const large=n.size==='large';
  if(!fast){
   out.set(n.id,large?(n.color==='don'?'ドン(大)':'カッ(大)'):(n.color==='don'?'ドン':'カッ'));
   runIndex=0;continue;
  }
  if(n.color==='ka')out.set(n.id,'カ');
  else out.set(n.id,runIndex%2===0?'ド':'コ');
  runIndex++;
 }
 return out;
}
