import {boneSvg} from './ui';
import {loadFestival} from '../storage/festival';
import {levelFor,dayKey,fortuneFor,type Fortune} from '../game/festival';

// Small progress chips for menus: 太鼓レベル (with a thin bar), ほねっこ (a
// link to the draw) and, until the first finished run of the day, a reminder
// that it pays a bonus.

export async function progressChips(back:string){
 const f=await loadFestival().catch(()=>null);
 if(!f)return '';
 const lv=levelFor(f.xp??0),daily=f.lastDay!==dayKey();
 return `<div class="progress-chips">
  <span class="lv-chip" title="太鼓レベル（遊ぶと経験値がたまります）">太鼓Lv.<b>${lv.level}</b><i style="--p:${(lv.into/lv.need).toFixed(3)}"></i></span>
  <a class="bone-chip" href="#/gacha?back=${encodeURIComponent(back)}" data-nav aria-label="ほねっこ ${f.bones}本（しばガチャへ）">${boneSvg()}<b>${f.bones.toLocaleString()}</b></a>
  ${daily?'<span class="daily-hint">きょうの初プレイ <b>＋50</b></span>':''}
 </div>`;
}

/** Whether today's first-run bonus is still waiting. */
export async function dailyWaiting(){
 const f=await loadFestival().catch(()=>null);
 return !!f&&f.lastDay!==dayKey();
}

const FORTUNE_CLASS:Record<Fortune,string>={大吉:'daikichi',中吉:'chukichi',小吉:'shokichi',吉:'kichi',末吉:'suekichi'};
/** The best おみくじ earned on a chart (from its best score), as a small stamp. */
export function miniFortune(score:number,cleared:boolean){
 const f=fortuneFor(score,cleared);
 return f?`<span class="mini-fortune ${FORTUNE_CLASS[f]}" aria-label="ベストのおみくじ ${f}">${f}</span>`:'';
}
