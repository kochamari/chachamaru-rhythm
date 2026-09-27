import {header,escape,toast,boneSvg} from '../app/ui';
import {nav,memory,uiAudio} from '../app/context';
import {loadFestival,setTitle,type FestivalData} from '../storage/festival';
import {db,listSongs} from '../storage/Database';
import {dayKey} from '../game/festival';
import {todayDaily,featuredSong,nextStreakGoal,runStats,festivalStats,tierFor,unlockedTitles,titleName,MISSION_BY_ID,ALL_MISSIONS_BONES,ACHIEVEMENTS,TIER_NAMES,TIER_BONES,FEATURED_MULT,type LifeStats} from '../game/daily';
import {showLoginBonus,stampCard} from '../app/loginBonus';
import type {Manifest,RunResult} from '../../../contracts/public-types';

// きょうのおまつり: everything that is new each day on one page (the login
// stamp card, today's missions, the featured song, the free draw) and the
// long goals (やりこみ, with titles to choose from).

export async function dailyScreen(root:HTMLElement,backParam:string|null):Promise<()=>void>{
 const back=backParam&&/^#\/(?!daily)[\w/?=&%.-]*$/.test(backParam)?backParam:'#/';
 await showLoginBonus();
 const today=dayKey();
 const [songs,runs]=await Promise.all([listSongs().catch(()=>[] as Manifest[]),db().then(d=>d.getAll('runs') as Promise<RunResult[]>).catch(()=>[] as RunResult[])]);
 const featuredId=featuredSong(today,songs.map(m=>m.packId)),featured=songs.find(m=>m.packId===featuredId);
 const played=runStats(runs);
 let f:FestivalData=await loadFestival();

 function missionsHtml(){
  const d=todayDaily(f.daily,today);
  const rows=d.ids.map(id=>{
   const m=MISSION_BY_ID.get(id);if(!m)return '';
   const p=Math.min(m.target,d.progress[id]??0),done=d.paid.includes(id);
   return `<li class="${done?'done':''}"><span class="m-name">${escape(m.name)}</span><span class="m-bar" aria-hidden="true"><i style="width:${p/m.target*100}%"></i></span><span class="m-count">${p.toLocaleString()} / ${m.target.toLocaleString()}</span><span class="m-reward">${boneSvg()}＋${m.bones}</span>${done?'<span class="m-stamp">達成</span>':''}</li>`;
  }).join('');
  const doneCount=d.ids.filter(id=>d.paid.includes(id)).length;
  return `<ul class="mission-list">${rows}</ul><p class="all-clear ${d.allPaid?'done':''}"><span>3つぜんぶ達成で</span><b>${boneSvg()}＋${ALL_MISSIONS_BONES}</b><span class="all-count">${doneCount} / 3</span></p>`;
 }
 function yarikomiHtml(){
  const achieved=f.achieved??{},stats:LifeStats={...played,...festivalStats(f)};
  const titles=unlockedTitles(achieved);
  const cards=ACHIEVEMENTS.map(a=>{
   const value=stats[a.stat]??0,tier=Math.min(achieved[a.id]??0,a.tiers.length),reached=tierFor(a,value);
   const next=a.tiers[tier],prev=tier?a.tiers[tier-1]:0;
   const part=next===undefined?1:Math.max(0,Math.min(1,(value-prev)/(next-prev)));
   return `<li class="ach ${tier>=3?'gold':''}"><span class="ach-medals" aria-label="${tier}段階達成">${TIER_NAMES.map((n,i)=>`<i class="t${i+1} ${i<tier?'on':''}" title="${n}">${n}</i>`).join('')}</span><b class="ach-name">${escape(a.name)}</b><span class="ach-value">${value.toLocaleString()}${escape(a.unit)}${next!==undefined?` <small>／ 次は ${next.toLocaleString()}${escape(a.unit)}（＋${TIER_BONES[tier]}）</small>`:' <small>／ ぜんぶ達成！</small>'}</span><span class="ach-bar"><i style="width:${part*100}%"></i></span>${reached>tier?'<span class="ach-ready">次の演奏で受け取り</span>':''}</li>`;
  }).join('');
  const current=titleName(f.title,achieved);
  return `<p class="title-now">いまの称号 <b>${escape(current)}</b></p>
   ${titles.length?`<div class="title-picks" role="group" aria-label="称号をえらぶ">${titles.map(t=>`<button class="title-pick t${t.tier} ${t.key===f.title?'on':''}" data-title="${escape(t.key)}" aria-pressed="${t.key===f.title}">${escape(t.name)}</button>`).join('')}</div>`:'<p class="daily-note">やりこみを達成すると、称号がもらえます。えらんだ称号は、曲をえらぶ画面に出ます。</p>'}
   <ul class="ach-grid">${cards}</ul>`;
 }
 function render(){
  const login=f.login,goal=login?nextStreakGoal(login.streak):null,free=f.freeDay!==today;
  const counted=ACHIEVEMENTS.reduce((a,x)=>a+Math.min(f.achieved?.[x.id]??0,x.tiers.length),0);
  root.innerHTML=`${header()}<section class="page daily-page"><div class="page-heading"><div><span class="eyebrow">毎日ちょっとずつ、お祭りを大きく</span><h1>きょうのおまつり</h1><p>ログインボーナス・ミッション・おすすめ曲は、毎日0時に新しくなります。</p></div><a class="button" id="daily-back" href="${escape(back)}" data-nav>もどる</a></div>
   <div class="daily-grid">
    <section class="paper daily-login"><h2>ログインボーナス</h2>
     ${stampCard(login?.card??0)}
     <p class="streak-line">れんぞくログイン <b>${login?.streak??0}</b>日 <small>（さいこう ${login?.best??0}日・ログインした日 ${login?.count??0}日）</small></p>
     ${goal?`<p class="daily-note">あと <b>${goal.left}</b>日つづけると ${boneSvg()}＋${goal.bones}。1日休むと、れんぞくは1日目からに戻ります（ほかは何もなくなりません）。</p>`:''}
    </section>
    <section class="paper daily-missions"><h2>きょうのミッション</h2>${missionsHtml()}<p class="daily-note">ミッションは、ふつうに遊んだ演奏で進みます（AUTO・練習は数えません）。</p></section>
    <section class="paper daily-fun"><h2>きょうのおたのしみ</h2>
     ${featured?`<div class="featured-song"><span class="fs-kicker">きょうのおすすめ曲</span><strong>${escape(featured.title)}</strong><small>${escape(featured.artist)}</small><span class="fs-mult">${boneSvg()} ほねっこ ×${FEATURED_MULT}</span><button class="primary" id="play-featured" data-nav>この曲であそぶ</button></div>`:''}
     <div class="free-gacha ${free?'ready':''}"><span>きょうの無料ガチャ</span>${free?`<a class="button" href="#/gacha?back=${encodeURIComponent('#/daily')}" data-nav id="go-free-gacha">1回 無料でひく</a>`:'<small>あした、また1回ひけます</small>'}</div>
    </section>
    <section class="paper yarikomi"><h2>やりこみ <span class="ach-count">${counted} / ${ACHIEVEMENTS.length*3}</span></h2><div id="yarikomi">${yarikomiHtml()}</div></section>
   </div></section>`;
  bind();
 }
 function bind(){
  const play=root.querySelector<HTMLElement>('#play-featured');
  if(play)play.onclick=()=>{if(featuredId){memory.selected=featuredId;uiAudio.effect('select');location.hash='/songs';}};
  root.querySelectorAll<HTMLElement>('[data-title]').forEach(b=>b.onclick=async()=>{
   const key=b.dataset.title!,next=key===f.title?null:key;
   try{await setTitle(next);f=await loadFestival();uiAudio.effect('select');toast(next?`称号を「${titleName(next,f.achieved??{})}」にしました`:'称号をはずしました');root.querySelector('#yarikomi')!.innerHTML=yarikomiHtml();bind();}
   catch(e){toast(e instanceof Error?e.message:'称号を変えられませんでした');}
  });
 }
 render();
 nav.handlers={back:()=>{location.hash=back.slice(1);}};
 return ()=>{nav.reset();};
}
