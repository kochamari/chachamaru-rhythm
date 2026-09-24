import type {RunResult,Manifest,Difficulty} from '../../../contracts/public-types';
import {db,recordEligible} from '../storage/Database';

export type Crown='none'|'clear'|'fc'|'ag';
export interface ChartBest {score:number;crown:Crown;plays:number}
const rank:Record<Crown,number>={none:0,clear:1,fc:2,ag:3};

/** Crown earned by one finished run. */
export function crownOf(r:Pick<RunResult,'stats'>):Crown{
 const s=r.stats;
 if(s.allGreat)return 'ag';
 if(s.fullCombo)return 'fc';
 return s.gauge>=70?'clear':'none';
}

/**
 * Best normal-play score and crown per chart of the current song version.
 * Runs made for another audio/chart hash (an edited chart) are ignored.
 */
export async function bestsFor(m:Manifest):Promise<Partial<Record<Difficulty,ChartBest>>>{
 const d=await db();
 const runs=(await d.getAll('runs')) as RunResult[];
 const out:Partial<Record<Difficulty,ChartBest>>={};
 for(const ref of m.charts){
  const mine=runs.filter(r=>r.packId===m.packId&&r.chartId===ref.chartId&&r.audioHash===m.audio.sha256&&r.chartHash===ref.sha256&&recordEligible(r));
  if(!mine.length)continue;
  let crown:Crown='none';for(const r of mine){const c=crownOf(r);if(rank[c]>rank[crown])crown=c;}
  out[ref.difficulty]={score:Math.max(...mine.map(r=>r.stats.score)),crown,plays:mine.length};
 }
 return out;
}

/** Previous best score for the same record key before `run` was saved. */
export async function previousBest(run:RunResult):Promise<number|null>{
 const d=await db();
 const runs=(await d.getAll('runs')) as RunResult[];
 const same=runs.filter(r=>r.runId!==run.runId&&r.packId===run.packId&&r.chartId===run.chartId&&r.audioHash===run.audioHash&&r.chartHash===run.chartHash&&r.inputMode===run.inputMode&&recordEligible(r)&&r.date<run.date);
 return same.length?Math.max(...same.map(r=>r.stats.score)):null;
}

export function crownSvg(crown:Crown){
 if(crown==='none')return '';
 const fill=crown==='ag'?'url(#crown-rainbow)':crown==='fc'?'#ffd23f':'#dfe4ee';
 const label=crown==='ag'?'全良':crown==='fc'?'フルコンボ':'クリア';
 return `<svg class="crown" viewBox="0 0 40 34" role="img" aria-label="${label}"><defs><linearGradient id="crown-rainbow" x1="0" x2="1"><stop offset="0" stop-color="#ff7a7a"/><stop offset=".3" stop-color="#ffd86b"/><stop offset=".6" stop-color="#7ee08a"/><stop offset="1" stop-color="#6ecbff"/></linearGradient></defs><path d="M5 27 2 8 13 17 20 3 27 17 38 8 35 27Z" fill="${fill}" stroke="#1e1726" stroke-width="2.4" stroke-linejoin="round"/><rect x="5" y="27" width="30" height="5" rx="1.5" fill="${fill}" stroke="#1e1726" stroke-width="2.2"/></svg>`;
}
