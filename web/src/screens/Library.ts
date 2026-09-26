import type {Manifest,Difficulty,InputMode,SongPackage} from '../../../contracts/public-types';
import {header,escape,toast,download,duration,confirmDialog} from '../app/ui';
import {state,difficultyNames} from '../app/store';
import {listSongEntries,getSong,deleteSong,saveSettings} from '../storage/Database';
import {exportPack} from '../packs/zip';
import {characterSvg,flowerSvg} from '../render/Character';
import {bestsFor,crownSvg,type ChartBest} from '../app/records';
import {nav,preview,memory} from '../app/context';
import {BUNDLED_ORDER,songColor,chartLevel,bpmOf} from '../app/songinfo';
import {outputOptions,useOutput} from '../app/output';
import {closeShutter} from '../app/shutter';

const DIFFS:Difficulty[]=['easy','normal','hard'];
const kindOf=(m:Manifest,source?:string)=>m.packId==='himawari-demo'||source==='demo'||m.generator?.startsWith('original-composition')?'demo':source==='studio'?'studio':'mine';
const kindLabel={demo:'オリジナル曲',mine:'マイソング',studio:'譜面工房'};

function previewStart(m:Manifest){const chorus=m.sections.find(s=>s.kind==='chorus');return chorus?chorus.startMs:Math.round(m.durationMs*.3);}

export async function libraryScreen(root:HTMLElement,isCurrent:()=>boolean):Promise<()=>void>{
 const entries=await listSongEntries();
 const all=entries.map(e=>e.manifest);
 const sources=new Map<string,string|undefined>(entries.map(e=>[e.manifest.packId,e.source]));
 if(!isCurrent())return ()=>{};
 // My songs first (newest import first), then the bundled originals in their set order.
 const order={mine:0,studio:1,demo:2};
 const imported=new Map(entries.map(e=>[e.manifest.packId,e.importedAt??'']));
 const bundledRank=(id:string)=>{const i=BUNDLED_ORDER.indexOf(id);return i<0?99:i;};
 all.sort((a,b)=>order[kindOf(a,sources.get(a.packId))]-order[kindOf(b,sources.get(b.packId))]||bundledRank(a.packId)-bundledRank(b.packId)||(imported.get(b.packId)??'').localeCompare(imported.get(a.packId)??'')||a.title.localeCompare(b.title,'ja'));
 if(!all.some(m=>m.packId===memory.selected))memory.selected=all[0]?.packId??null;
 let zone:'list'|'detail'='list';
 let query='';
 let pack:SongPackage|null=null;
 let bests:Partial<Record<Difficulty,ChartBest>>={};
 let previewTimer=0;let alive=true;
 const allBests=new Map<string,Partial<Record<Difficulty,ChartBest>>>();
 await Promise.all(all.map(async m=>allBests.set(m.packId,await bestsFor(m))));
 if(!isCurrent())return ()=>{};

 root.innerHTML=`${header('songs')}<section class="library">
  <div class="library-head"><h1>曲をえらぶ</h1><input class="search" type="search" placeholder="曲名・アーティストでさがす" aria-label="曲を検索"><a class="button" href="#/import">＋ 曲を追加</a></div>
  <div class="library-body">
   <div class="song-column"><ol class="song-bars" aria-label="曲の一覧"></ol><p class="library-note">カッ（D・K／↑↓）でえらぶ・ドン（F・J）で決定。自分の曲はこのブラウザに保存されます。元のZIPも大切に保管してください。</p></div>
   <div id="selection" class="song-detail" aria-live="polite"></div>
  </div></section>`;
 const list=root.querySelector<HTMLElement>('.song-bars')!;
 const detail=root.querySelector<HTMLElement>('#selection')!;
 const visible=()=>all.filter(m=>(m.title+' '+m.artist).toLowerCase().includes(query.toLowerCase()));

 function renderList(){
  const songs=visible();
  list.innerHTML=songs.map(m=>{
   const kind=kindOf(m,sources.get(m.packId)),b=allBests.get(m.packId)??{};
   const crowns=DIFFS.filter(d=>m.charts.some(c=>c.difficulty===d)).map(d=>`<i class="${b[d]?.crown??'none'}"></i>`).join('');
   return `<li><button class="song-bar ${memory.selected===m.packId?'selected':''}" data-song="${escape(m.packId)}" data-kind="${kind}" style="--genre:${songColor(m.packId)}"><span class="bar-icon" aria-hidden="true">${flowerSvg()}</span><span><strong>${escape(m.title)}</strong><small>${escape(m.artist)} · ${duration(m.durationMs)} · ${kindLabel[kind]}</small></span><span class="bar-crowns" aria-hidden="true">${crowns}</span></button></li>`;
  }).join('')||'<li class="empty">曲が見つかりませんでした</li>';
  list.querySelectorAll<HTMLElement>('[data-song]').forEach(b=>b.onclick=()=>{if(memory.selected===b.dataset.song){zone='detail';focusDetail();return;}select(b.dataset.song!);zone='list';});
 }
 function select(id:string){
  memory.selected=id;
  list.querySelectorAll<HTMLElement>('[data-song]').forEach(b=>b.classList.toggle('selected',b.dataset.song===id));
  const el=list.querySelector<HTMLElement>(`[data-song="${CSS.escape(id)}"]`);el?.scrollIntoView({block:'nearest'});
  if(zone==='list')el?.focus({preventScroll:true});
  void renderDetail();
 }
 async function renderDetail(){
  const m=all.find(x=>x.packId===memory.selected);
  if(!m){detail.innerHTML='<div class="detail-body"><p class="empty">曲を追加してください</p></div>';return;}
  const p=await getSong(m.packId);
  if(!alive||!p||memory.selected!==m.packId)return;
  pack=p;bests=allBests.get(m.packId)??{};
  if(!p.charts.some(c=>c.difficulty===memory.difficulty))memory.difficulty=p.charts[0].difficulty;
  const chart=p.charts.find(c=>c.difficulty===memory.difficulty)!;
  const taps=chart.notes.filter(n=>n.kind==='tap').length,rolls=chart.notes.filter(n=>n.kind==='roll').length;
  const bpm=bpmOf(m),kind=kindOf(m,p.source);
  const mode=state.settings.inputMode==='mixed'?'keyboard':state.settings.inputMode;
  detail.style.setProperty('--theme',songColor(m.packId));
  detail.innerHTML=`<div class="detail-art" ${p.cover?'data-cover':''}><div class="art-title"><span class="eyebrow">${kindLabel[kind]}</span><h2>${escape(m.title)}</h2><p>${escape(m.artist)} ／ ${duration(m.durationMs)}${bpm?` ／ BPM ${bpm}`:''}</p></div><div class="art-dog">${characterSvg()}</div></div>
   <div class="detail-body">
    <div class="difficulty-cards" role="group" aria-label="難易度">${DIFFS.filter(d=>p.charts.some(c=>c.difficulty===d)).map(d=>{const b=bests[d];return `<button data-difficulty="${d}" data-nav class="${memory.difficulty===d?'active':''}" aria-pressed="${memory.difficulty===d}">${b?crownSvg(b.crown):''}<span class="d-name">${difficultyNames[d]}</span><span class="d-stars" aria-label="レベル ${chartLevel(p.charts.find(c=>c.difficulty===d)!)}">★${chartLevel(p.charts.find(c=>c.difficulty===d)!)}</span><span class="d-best">${b?`ベスト ${b.score.toLocaleString()}`:'まだ遊んでいません'}</span></button>`;}).join('')}</div>
    <div class="chart-meta"><span>音符 <b>${taps}</b></span>${rolls?`<span>連打 <b>${rolls}</b></span>`:''}${m.sections.some(s=>s.kind==='chorus')?'<span>サビで夜祭り演出</span>':''}</div>
    <div class="play-choices"><label class="input-choice">操作 <select id="input-mode"><option value="touch">タッチ（画面の太鼓）</option><option value="keyboard">キーボード（D F J K）</option><option value="midi">電子ドラム（MIDI）</option></select></label>
     <div class="input-choice"><label for="output-profile">音の出力</label><select id="output-profile">${outputOptions(state.settings,escape)}</select><a class="button sync-mini" href="#/sync?back=%23%2Fsongs">ズレ合わせ</a></div></div>
    <div class="start-row"><button class="primary" id="play-song" data-nav>この曲であそぶ！</button><button class="auto" id="auto-song" data-nav>AUTO<small>お手本</small></button></div>
    <div class="small-actions"><button id="export-song">曲パックを保存</button><button id="delete-song">この曲を削除</button></div>
    <p class="detail-note">${m.generator?.startsWith('chacha-generator')?'自動下書きの譜面です。譜面工房でリズムを調整できます。':'大きい音符も1回叩けばOK（大音符アシスト）。'}</p>
   </div>`;
  if(p.cover){const url=URL.createObjectURL(p.cover);detail.querySelector<HTMLElement>('.detail-art')!.style.backgroundImage=`url("${url}")`;window.setTimeout(()=>URL.revokeObjectURL(url),60000);}
  detail.querySelectorAll<HTMLElement>('[data-difficulty]').forEach(b=>b.onclick=()=>{memory.difficulty=b.dataset.difficulty as Difficulty;zone='detail';void renderDetail().then(focusDetail);});
  const select=detail.querySelector<HTMLSelectElement>('#input-mode')!;select.value=mode;
  select.onchange=()=>{state.settings.inputMode=select.value as InputMode;void saveSettings(state.settings);};
  const output=detail.querySelector<HTMLSelectElement>('#output-profile')!;
  output.onchange=()=>{useOutput(state.settings,output.value);void saveSettings(state.settings);output.innerHTML=outputOptions(state.settings,escape);};
  detail.querySelector<HTMLElement>('#play-song')!.onclick=()=>play(false);
  detail.querySelector<HTMLElement>('#auto-song')!.onclick=()=>play(true);
  detail.querySelector<HTMLElement>('#export-song')!.onclick=async()=>{try{download(await exportPack(p),`${m.title}.zip`);}catch(e){toast((e as Error).message);}};
  detail.querySelector<HTMLElement>('#delete-song')!.onclick=async()=>{
   if(!await confirmDialog('この曲を削除しますか？',`「${m.title}」をこのブラウザから削除します。元のZIPは削除されません。`,'削除する'))return;
   await deleteSong(m.packId);preview.clear();memory.selected=null;location.reload();
  };
  schedulePreview(m,p);
 }
 function schedulePreview(m:Manifest,p:SongPackage){
  clearTimeout(previewTimer);preview.stop();
  previewTimer=window.setTimeout(()=>{if(alive&&memory.selected===m.packId)void preview.play(m.packId,p.audio,previewStart(m));},450);
 }
 function focusDetail(){detail.querySelector<HTMLElement>('[data-difficulty].active')?.focus({preventScroll:true});}
 function play(auto:boolean){
  if(!pack)return;
  const chart=pack.charts.find(c=>c.difficulty===memory.difficulty)??pack.charts[0];
  preview.stop(120);
  closeShutter();
  location.hash=`/play/${pack.manifest.packId}/${chart.chartId}${auto?'?auto=1':''}`;
 }

 root.querySelector<HTMLInputElement>('.search')!.oninput=e=>{query=(e.target as HTMLInputElement).value;renderList();};
 renderList();await renderDetail();
 list.querySelector<HTMLElement>('.song-bar.selected')?.focus({preventScroll:true});

 nav.handlers={
  move:dir=>{
   if(zone==='list'){
    const songs=visible();if(!songs.length)return false;
    const i=songs.findIndex(m=>m.packId===memory.selected);
    select(songs[(i+dir+songs.length)%songs.length].packId);return true;
   }
   if(!pack)return false;
   const ds=DIFFS.filter(d=>pack!.charts.some(c=>c.difficulty===d));
   memory.difficulty=ds[(ds.indexOf(memory.difficulty)+dir+ds.length)%ds.length];
   void renderDetail().then(focusDetail);return true;
  },
  decide:()=>{
   // With the drum, deciding in the detail panel always plays yourself: a
   // focus left on AUTO (or export/delete) must not start those by accident.
   if(zone==='list'){zone='detail';focusDetail();return true;}
   play(false);return true;
  },
  back:()=>{if(zone==='detail'){zone='list';list.querySelector<HTMLElement>('.song-bar.selected')?.focus();}else location.hash='/';},
 };
 const key=(e:KeyboardEvent)=>{if(e.code==='Enter'&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLButtonElement)&&!(e.target instanceof HTMLSelectElement)){e.preventDefault();play(false);}};
 window.addEventListener('keydown',key);
 return ()=>{alive=false;clearTimeout(previewTimer);preview.stop();nav.reset();window.removeEventListener('keydown',key);};
}
