import {escape,boneSvg} from './ui';
import {uiAudio} from './context';
import {claimLogin,type LoginClaim} from '../storage/festival';
import {LOGIN_REWARDS,nextStreakGoal} from '../game/daily';

// The login bonus: on the first visit of a day (title screen, song list or
// the daily page) the stamp card pops up, a paw stamp lands on today's cell
// and the bones are counted in. It never blocks the page: taps go through,
// it closes by itself after a few seconds or when the screen changes.

/** A red paw print (肉球), used as the stamp. */
export function pawSvg(color='#d8262b'){
 return `<svg class="paw" viewBox="0 0 40 40" aria-hidden="true"><g fill="${color}"><ellipse cx="20" cy="26" rx="10" ry="8.5"/><ellipse cx="9" cy="16" rx="4.2" ry="5.2" transform="rotate(-18 9 16)"/><ellipse cx="16" cy="9.5" rx="4.2" ry="5.4" transform="rotate(-6 16 9.5)"/><ellipse cx="24" cy="9.5" rx="4.2" ry="5.4" transform="rotate(6 24 9.5)"/><ellipse cx="31" cy="16" rx="4.2" ry="5.2" transform="rotate(18 31 16)"/></g></svg>`;
}

/** The 7 cells of the card: stamped days, today (its stamp can animate in), days to come. */
export function stampCard(card:number,animate=false){
 return `<ol class="stamp-card" aria-label="ログインボーナスのスタンプカード（${card}日目まで）">${LOGIN_REWARDS.map((bones,i)=>{
  const day=i+1,state=day<card?'done':day===card?'today':'';
  // Day, a round slot where the paw stamp lands, and the reward under it.
  return `<li class="${state} ${day===LOGIN_REWARDS.length?'big':''}"><small>${day}日目</small><span class="stamp-slot">${day<card||(day===card&&!animate)?pawSvg():''}${day===card&&animate?`<span class="stamp-drop">${pawSvg()}</span>`:''}</span><b>＋${bones}</b></li>`;
 }).join('')}</ol>`;
}

let open:HTMLElement|null=null;
/** Claims today's login bonus (once a day) and shows it. Resolves to the claim, or null. */
export async function showLoginBonus():Promise<LoginClaim|null>{
 const claim=await claimLogin().catch(()=>null);
 if(!claim)return null;
 open?.remove();
 const {login,items,total,titles}=claim,big=login.card===LOGIN_REWARDS.length;
 const goal=nextStreakGoal(login.streak);
 const el=document.createElement('div');
 el.className=`login-bonus ${big?'big':''}`;el.setAttribute('role','status');el.setAttribute('aria-live','polite');
 el.innerHTML=`<div class="lb-card">
  <h3><span class="lb-kicker">${big?'7日目の大当たり！':'ログインボーナス'}</span>${login.card}日目</h3>
  ${stampCard(login.card,true)}
  <p class="lb-total">${boneSvg()}<span>ほねっこ ＋<b>${total.toLocaleString()}</b></span></p>
  ${items.length>1||titles.length?`<ul class="lb-extras">${items.slice(1).map(i=>`<li>${escape(i.label)} ＋${i.bones}</li>`).join('')}</ul>`:''}
  <p class="lb-streak">れんぞくログイン <b>${login.streak}</b>日${goal?` <small>（あと${goal.left}日で ＋${goal.bones}）</small>`:''}</p>
 </div>`;
 document.body.append(el);open=el;
 // The stamp lands a moment after the card appears.
 window.setTimeout(()=>{if(open===el)uiAudio.effect(big?'gachaRare':'gachaOpen');},520);
 const close=()=>{if(open!==el)return;open=null;el.classList.add('closing');window.setTimeout(()=>el.remove(),320);window.removeEventListener('hashchange',close);};
 window.addEventListener('hashchange',close);
 window.setTimeout(close,big?4600:3600);
 return claim;
}
