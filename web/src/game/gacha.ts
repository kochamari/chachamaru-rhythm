// しばガチャ: spending ほねっこ on festival outfits. Pure (the random source
// is passed in). Only for fun: nothing here changes play or scores.
import {COSTUMES,type Rarity} from '../render/costumes';

export const PULL_COST=100;
export const TEN_PULLS=10;
export const RARITIES:Rarity[]=['N','R','SR','SSR'];
export const RATES:Record<Rarity,number>={N:.58,R:.3,SR:.1,SSR:.02};
/** Bones back when an outfit is drawn again. */
export const DUPLICATE_BONES:Record<Rarity,number>={N:10,R:20,SR:50,SSR:100};

export interface Pull {id:string;rarity:Rarity;isNew:boolean;refund:number}

export function rarityFor(u:number):Rarity{
 let acc=0;
 for(const r of RARITIES){acc+=RATES[r];if(u<acc)return r;}
 return 'SSR';
}

/**
 * Draws `count` outfits. In a ten-draw the tenth is SR or better when none
 * of the first nine was. `owned` is not changed.
 */
export function drawOutfits(count:number,random:()=>number,owned:Readonly<Record<string,number>>):Pull[]{
 const seen={...owned},pulls:Pull[]=[];
 for(let i=0;i<count;i++){
  let rarity=rarityFor(random());
  if(count===TEN_PULLS&&i===TEN_PULLS-1&&!pulls.some(p=>p.rarity==='SR'||p.rarity==='SSR'))rarity=random()<RATES.SR/(RATES.SR+RATES.SSR)?'SR':'SSR';
  const pool=COSTUMES.filter(c=>c.rarity===rarity);
  const item=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
  const isNew=!seen[item.id];
  seen[item.id]=(seen[item.id]??0)+1;
  pulls.push({id:item.id,rarity,isNew,refund:isNew?0:DUPLICATE_BONES[rarity]});
 }
 return pulls;
}

/** Collection progress: distinct outfits owned out of all. */
export function collected(owned:Readonly<Record<string,number>>){return {have:COSTUMES.filter(c=>owned[c.id]).length,all:COSTUMES.length};}

/** A random source from the browser's cryptographic generator. */
export function cryptoRandom(){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/2**32;}
