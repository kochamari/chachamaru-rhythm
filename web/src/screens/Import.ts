import {header,toast} from '../app/ui';
import {flowerSvg} from '../render/Character';
import {importZip} from '../packs/zip';
import {validatePackage} from '../packs/validators';
import {saveSong} from '../storage/Database';
import {memory} from '../app/context';

export function importScreen(root:HTMLElement):()=>void{
 const abort=new AbortController();
 root.innerHTML=`${header('import')}<section class="page"><div class="page-heading"><div><span class="eyebrow">自分だけのセットリストを</span><h1>曲を追加する</h1><p>譜面工房で作った曲パック（ZIP）を取り込みます。</p></div><a href="#/songs" class="button">曲一覧へ</a></div>
  <div class="import-box">${flowerSvg()}<h2>曲パックを、ここへ。</h2><p>ZIPファイルを選ぶか、この枠にドロップしてください。<br>音源・譜面・SHA-256を確認してから、このブラウザに保存します。</p>
   <input id="pack-file" type="file" accept=".zip,application/zip" aria-label="曲パックを選ぶ">
   <div id="import-status" role="status"></div><button id="cancel-import" hidden>取込を取り消す</button></div>
  <p class="library-note" style="text-align:center">曲パックは自動では登録されません。ファイルアプリやiCloudに保存したZIPを、ここで選んでください。<br>音源から譜面を作るときは、Macで<a class="text-link" href="#/studio">譜面工房</a>を開きます。</p></section>`;
 const field=root.querySelector<HTMLInputElement>('#pack-file')!,status=root.querySelector<HTMLElement>('#import-status')!,cancel=root.querySelector<HTMLButtonElement>('#cancel-import')!;
 cancel.onclick=()=>abort.abort();
 async function process(file:File){
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
   status.textContent=abort.signal.aborted?'取り消しました。':(e instanceof Error?e.message:String(e))+' 元のZIPを保管して、空き容量を確認してください。';
  }finally{field.disabled=false;cancel.hidden=true;}
 }
 field.onchange=()=>{if(field.files?.[0])void process(field.files[0]);};
 const box=root.querySelector<HTMLElement>('.import-box')!;
 box.ondragover=e=>{e.preventDefault();box.classList.add('dragging');};
 box.ondragleave=()=>box.classList.remove('dragging');
 box.ondrop=e=>{e.preventDefault();box.classList.remove('dragging');if(e.dataTransfer?.files[0])void process(e.dataTransfer.files[0]);};
 return ()=>abort.abort();
}
