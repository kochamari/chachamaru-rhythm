import {boneSvg,escape} from './ui';
import {loadFestival} from '../storage/festival';
import {levelFor,dayKey,fortuneFor,DAILY_BONES,type Fortune} from '../game/festival';
import {todayDaily,titleName} from '../game/daily';

// Small progress chips for menus: 太鼓レベル (with a thin bar and the chosen
// title), ほねっこ (a link to the draw), today's missions (a link to the daily
// page) and, until the first finished run of the day, a reminder that it pays
// a bonus.

export async function progressChips(back:string){
 const f=await loadFestival().catch(()=>null);
 if(!f)return '';
 const today=dayKey(),lv=levelFor(f.xp??0),daily=f.lastDay!==today;
 const d=todayDaily(f.daily,today),done=d.ids.filter(id=>d.paid.includes(id)).length;
 return `<div class="progress-chips">
  <span class="lv-chip" title="太鼓レベル（遊ぶと経験値がたまります）">太鼓Lv.<b>${lv.level}</b><i style="--p:${(lv.into/lv.need).toFixed(3)}"></i><em class="title-tag">${escape(titleName(f.title,f.achieved??{}))}</em></span>
  <a class="bone-chip" href="#/gacha?back=${encodeURIComponent(back)}" data-nav aria-label="ほねっこ ${f.bones}本（しばガチャへ）">${boneSvg()}<b>${f.bones.toLocaleString()}</b></a>
  <a class="mission-chip ${done>=d.ids.length?'done':''}" href="#/daily?back=${encodeURIComponent(back)}" data-nav aria-label="きょうのミッション ${done}/${d.ids.length}">ミッション <b>${done}/${d.ids.length}</b></a>
  ${daily?'<span class="daily-hint">きょうの初プレイ <b>＋'+DAILY_BONES+'</b></span>':''}
 </div>`;
}

/** Today's missions not done yet, and whether the free draw is still waiting. */
export async function dailyBadges(){
 const f=await loadFestival().catch(()=>null);
 if(!f)return {missionsLeft:0,freeDraw:false};
 const today=dayKey(),d=todayDaily(f.daily,today);
 return {missionsLeft:d.ids.filter(id=>!d.paid.includes(id)).length,freeDraw:f.freeDay!==today};
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
