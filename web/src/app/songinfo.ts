import type {Chart,Manifest} from '../../../contracts/public-types';

// Presentation helpers for songs and charts. Pure.

/** Bundled original songs, in the order they appear in the song list. */
export const BUNDLED_ORDER=['himawari-demo','chachamaru-ondo','yuuyake-shippo','hanabi-rush'];
const THEMES:Record<string,string>={'himawari-demo':'#e9772e','chachamaru-ondo':'#3f9a55','yuuyake-shippo':'#d9577f','hanabi-rush':'#3d5fd1'};

/** Stable theme colour: fixed for bundled songs, derived from the id otherwise. */
export function songColor(packId:string){
 if(THEMES[packId])return THEMES[packId];
 let h=0;for(const ch of packId)h=(h*31+ch.charCodeAt(0))>>>0;
 return `hsl(${h%360} 58% 46%)`;
}

/**
 * Chart level 1..10 from note density: the average taps per second across the
 * played span and the busiest two-second window. An estimate for choosing,
 * not an official rating.
 */
export function chartLevel(chart:Chart):number{
 const taps=chart.notes.filter(n=>n.kind==='tap').map(n=>n.timeMs).sort((a,b)=>a-b);
 if(taps.length<2)return 1;
 const span=Math.max(1,(taps[taps.length-1]-taps[0])/1000);
 const avg=taps.length/span;
 let peak=0;
 for(let i=0,j=0;i<taps.length;i++){while(taps[i]-taps[j]>2000)j++;peak=Math.max(peak,i-j+1);}
 const rolls=chart.notes.filter(n=>n.kind==='roll').length;
 const raw=avg*1.1+peak/2*.45+Math.min(rolls,3)*.15;
 return Math.max(1,Math.min(10,Math.round(raw)));
}

export function bpmOf(m:Manifest){
 const b=m.beatTimesMs;if(b.length<3)return null;
 const gaps=b.slice(1).map((t,i)=>t-b[i]).sort((x,y)=>x-y);
 const mid=gaps[Math.floor(gaps.length/2)];
 return mid>0?Math.round(60000/mid):null;
}
