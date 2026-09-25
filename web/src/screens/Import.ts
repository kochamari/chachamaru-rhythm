import {header,toast,escape} from '../app/ui';
import {flowerSvg} from '../render/Character';
import {importZip} from '../packs/zip';
import {validatePackage} from '../packs/validators';
import {isBundle,readBundle,bundleSong,BUNDLE_MAX} from '../packs/bundle';
import {saveSong,mergeSong} from '../storage/Database';
import {memory} from '../app/context';

type Outcome={title:string;result:'added'|'updated'|'same'|'error';note?:string;packId?:string};
const message=(e:unknown)=>e instanceof Error?e.message:String(e);

export function importScreen(root:HTMLElement):()=>void{
 const abort=new AbortController();
 root.innerHTML=`${header('import')}<section class="page"><div class="page-heading"><div><span class="eyebrow">自分だけのセットリストを</span><h1>曲を追加する</h1><p>譜面工房で作った曲パック（ZIP）を取り込みます。</p></div><a href="#/songs" class="button">曲一覧へ</a></div>
  <div class="import-box">${flowerSvg()}<h2>曲パックを、ここへ。</h2><p>ZIPファイルを選ぶか、この枠にドロップしてください。いくつでも選べます。<br>何曲かをまとめたZIPなら、まだ入っていない曲だけを追加します。</p>
   <input id="pack-file" type="file" accept=".zip,application/zip" multiple aria-label="曲パックを選ぶ">
   <div id="import-status" role="status"></div><button id="cancel-import" hidden>取込を取り消す</button></div>
  <p class="library-note" style="text-align:center">曲パックは自動では登録されません。ファイルアプリやiCloudに保存したZIPを、ここで選んでください。<br>音源から譜面を作るときは、Macで<a class="text-link" href="#/studio">譜面工房</a>を開きます。</p></section>`;
 const field=root.querySelector<HTMLInputElement>('#pack-file')!,status=root.querySelector<HTMLElement>('#import-status')!,cancel=root.querySelector<HTMLButtonElement>('#cancel-import')!;
 cancel.onclick=()=>abort.abort();

 /** One ordinary song pack: asks what to do with a different version. */
 async function single(file:File){
  field.disabled=true;cancel.hidden=false;status.textContent='音源・譜面・SHA-256を確認しています…';
  try{
   const pack=await importZip(file,abort.signal);
   await validatePackage(pack);
   if(abort.signal.aborted)return;
   let result=await saveSong(pack);
   if(result==='conflict'){
    status.innerHTML='同じ曲の別バージョンがあります。<div class="inline-actions" style="justify-content:center;margin-top:10px"><button id="replace">置換する</button><button id="copy">別曲として追加</button><button id="dismiss">取消</button></div>';
    const choice=await new Promise<'replace'|'copy'|null>(resolve=>{
     status.querySelector('#replace')!.addEventListener('click',()=>resolve('replace'));
     status.querySelector('#copy')!.addEventListener('click',()=>resolve('copy'));
     status.querySelector('#dismiss')!.addEventListener('click',()=>resolve(null));
     abort.signal.addEventListener('abort',()=>resolve(null),{once:true});
    });
    if(!choice){status.textContent='取り込みをやめました。';return;}
    result=await saveSong(pack,choice);
   }
   if(abort.signal.aborted)return;
   toast(result==='duplicate'?'この曲はすでに保存されています':'曲を追加しました');
   memory.selected=pack.manifest.packId;location.hash='/songs';
  }catch(e){
   status.textContent=abort.signal.aborted?'取り消しました。':message(e)+' 元のZIPを保管して、空き容量を確認してください。';
  }finally{field.disabled=false;cancel.hidden=true;}
 }

 /** Several files or a song collection: adds only what this device lacks. */
 async function many(files:File[],first?:Uint8Array){
  field.disabled=true;cancel.hidden=false;
  const outcomes:Outcome[]=[];
  try{
   const jobs:{title:string;load:()=>Promise<ArrayBuffer>}[]=[];
   for(const [i,file] of files.entries()){
    if(file.size>BUNDLE_MAX){outcomes.push({title:file.name,result:'error',note:'ZIPは400MiBまでです'});continue;}
    status.textContent=`${file.name} を開いています…`;
    const bytes=i===0&&first?first:new Uint8Array(await file.arrayBuffer());
    if(isBundle(bytes)){
     try{for(const song of readBundle(bytes))jobs.push({title:song.title,load:()=>bundleSong(bytes,song)});}
     catch(e){outcomes.push({title:file.name,result:'error',note:message(e)});}
    }else jobs.push({title:file.name.replace(/\.zip$/i,''),load:async()=>bytes.buffer as ArrayBuffer});
   }
   for(const [i,job] of jobs.entries()){
    if(abort.signal.aborted)break;
    status.textContent=`${i+1} / ${jobs.length} 曲目を確認しています：${job.title}`;
    try{
     const pack=await importZip(await job.load(),abort.signal);
     await validatePackage(pack);
     if(abort.signal.aborted)break;
     outcomes.push({title:pack.manifest.title,result:await mergeSong(pack),packId:pack.manifest.packId});
    }catch(e){
     if(abort.signal.aborted)break;
     outcomes.push({title:job.title,result:'error',note:message(e)});
    }
   }
  }catch(e){outcomes.push({title:'',result:'error',note:message(e)});}
  finally{field.disabled=false;cancel.hidden=true;}
  const count=(r:Outcome['result'])=>outcomes.filter(o=>o.result===r).length;
  const added=count('added'),updated=count('updated'),same=count('same'),failed=count('error');
  const parts=[added&&`追加 ${added}曲`,updated&&`更新 ${updated}曲`,same&&`すでにある ${same}曲`,failed&&`読めなかった ${failed}件`].filter(Boolean).join('・')||'取り込む曲がありませんでした';
  const label={added:'追加',updated:'新しい版に更新',same:'すでにある',error:'読めなかった'};
  status.innerHTML=`<div class="import-summary">${abort.signal.aborted?'<p>途中で取り消しました。ここまでの結果です。</p>':''}<strong>${escape(parts)}</strong><ul>${outcomes.map(o=>`<li class="${o.result}"><b>${label[o.result]}</b> ${escape(o.title)}${o.note?`<small>${escape(o.note)}</small>`:''}</li>`).join('')}</ul>${added+updated?'<a class="button primary" href="#/songs" id="to-songs">曲一覧へ</a>':''}</div>`;
  const fresh=outcomes.find(o=>o.result==='added'||o.result==='updated');
  if(fresh?.packId)memory.selected=fresh.packId;
  if(!abort.signal.aborted)toast(parts);
 }

 async function take(files:File[]){
  if(!files.length)return;
  if(files.length===1){
   if(files[0].size>BUNDLE_MAX){status.textContent='ZIPは400MiBまでです';return;}
   const bytes=new Uint8Array(await files[0].arrayBuffer());
   if(!isBundle(bytes)){await single(files[0]);return;}
   await many(files,bytes);return;
  }
  await many(files);
 }
 field.onchange=()=>{const files=[...field.files??[]];void take(files).finally(()=>{field.value='';});};
 const box=root.querySelector<HTMLElement>('.import-box')!;
 box.ondragover=e=>{e.preventDefault();box.classList.add('dragging');};
 box.ondragleave=()=>box.classList.remove('dragging');
 box.ondrop=e=>{e.preventDefault();box.classList.remove('dragging');void take([...e.dataTransfer?.files??[]]);};
 return ()=>abort.abort();
}
