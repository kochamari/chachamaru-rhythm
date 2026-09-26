// しばガチャ: spending ほねっこ on festival outfits. Pure (the random source
// is passed in). Only for fun: nothing here changes play or scores.
import {COSTUMES,SERIES,COMPLETE_BONUS,type Rarity,type Series} from '../render/costumes';

export const PULL_COST=100;
export const TEN_PULLS=10;
export const RARITIES:Rarity[]=['N','R','SR','SSR'];
export const RATES:Record<Rarity,number>={N:.58,R:.3,SR:.1,SSR:.02};
/** Bones back when an outfit is drawn again. */
export const DUPLICATE_BONES:Record<Rarity,number>={N:10,R:20,SR:50,SSR:100};
/** 天井: this many draws in a row without ウルトラレア make the last one ウルトラレア. */
export const PITY=80;

/** `pity` marks an ウルトラレア that came from the 天井. */
export interface Pull {id:string;rarity:Rarity;isNew:boolean;refund:number;pity?:boolean}

export function rarityFor(u:number):Rarity{
 let acc=0;
 for(const r of RARITIES){acc+=RATES[r];if(u<acc)return r;}
 return 'SSR';
}

/**
 * Draws `count` outfits. In a ten-draw the tenth is SR or better when none
 * of the first nine was. With `pity`, draws since the last ウルトラレア are
 * counted there and the PITY-th one is ウルトラレア. `owned` is not changed.
 */
export function drawOutfits(count:number,random:()=>number,owned:Readonly<Record<string,number>>,pity?:{since:number}):Pull[]{
 const seen={...owned},pulls:Pull[]=[];
 for(let i=0;i<count;i++){
  let rarity=rarityFor(random()),forced=false;
  if(count===TEN_PULLS&&i===TEN_PULLS-1&&!pulls.some(p=>p.rarity==='SR'||p.rarity==='SSR'))rarity=random()<RATES.SR/(RATES.SR+RATES.SSR)?'SR':'SSR';
  if(pity&&rarity!=='SSR'&&pity.since>=PITY-1){rarity='SSR';forced=true;}
  if(pity)pity.since=rarity==='SSR'?0:pity.since+1;
  const pool=COSTUMES.filter(c=>c.rarity===rarity);
  const item=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
  const isNew=!seen[item.id];
  seen[item.id]=(seen[item.id]??0)+1;
  pulls.push({id:item.id,rarity,isNew,refund:isNew?0:DUPLICATE_BONES[rarity],...(forced?{pity:true}:{})});
 }
 return pulls;
}

/** How much of each series is owned. */
export function seriesProgress(owned:Readonly<Record<string,number>>){
 return SERIES.map(s=>{const items=COSTUMES.filter(c=>c.series===s.id);const have=items.filter(c=>owned[c.id]).length;return {series:s,have,all:items.length,done:have===items.length};});
}
/**
 * Series (and the whole book) completed since they were last paid: returns
 * the bonuses to pay and the updated record of what has been paid.
 */
export function settleCollection(owned:Readonly<Record<string,number>>,paid:readonly string[],complete:boolean):{bonuses:{label:string;bones:number;series?:Series}[];paid:string[];complete:boolean}{
 const bonuses:{label:string;bones:number;series?:Series}[]=[],next=[...paid];
 for(const p of seriesProgress(owned))if(p.done&&!next.includes(p.series.id)){next.push(p.series.id);bonuses.push({label:`${p.series.name} コンプ`,bones:p.series.bonus,series:p.series});}
 let all=complete;
 if(!all&&COSTUMES.every(c=>owned[c.id])){all=true;bonuses.push({label:'しばずかん コンプリート',bones:COMPLETE_BONUS});}
 return {bonuses,paid:next,complete:all};
}

/** Collection progress: distinct outfits owned out of all. */
export function collected(owned:Readonly<Record<string,number>>){return {have:COSTUMES.filter(c=>owned[c.id]).length,all:COSTUMES.length};}

/** A random source from the browser's cryptographic generator. */
export function cryptoRandom(){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/2**32;}
