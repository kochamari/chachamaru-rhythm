import {BRAND} from './brand';
import {flowerSvg} from '../render/Character';

export const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]!));

export function header(active=''){
 const link=(href:string,key:string,label:string,cls='')=>`<a ${cls?`class="${cls}"`:''} href="${href}" ${active===key?'aria-current="page"':''}>${label}</a>`;
 return `<header class="topbar"><a class="brand" href="#/" aria-label="${escape(BRAND.title)} タイトルへ">${flowerSvg()}<span>${BRAND.short}<small>太鼓の達人</small></span></a><nav aria-label="メインメニュー">${link('#/songs','songs','曲をえらぶ')}${link('#/import','import','曲を追加')}${link('#/studio','studio','譜面工房')}${link('#/settings','settings','設定')}${link('#/diagnostics','diagnostics','接続診断','connection')}</nav></header>`;
}

/** ほねっこ (a cartoon dog bone) as inline SVG: one outline around the whole shape. */
export function boneSvg(){
 const shape='<circle cx="-11" cy="-4.6" r="5.4"/><circle cx="-11" cy="4.6" r="5.4"/><circle cx="11" cy="-4.6" r="5.4"/><circle cx="11" cy="4.6" r="5.4"/><rect x="-11" y="-4.8" width="22" height="9.6" rx="3"/>';
 return `<svg class="bone-svg" viewBox="-19 -12.5 38 25" aria-hidden="true"><g fill="#1e1726" stroke="#1e1726" stroke-width="4.5">${shape}</g><g fill="#fff2ce">${shape}</g><rect x="-8" y="-2.4" width="12" height="2.2" rx="1" fill="#fff" opacity=".7"/></svg>`;
}

let toastTimer=0;
export function toast(message:string){
 const t=document.querySelector<HTMLElement>('#toast');if(!t)return;
 t.textContent=message;t.classList.add('visible');
 clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>t.classList.remove('visible'),4000);
}
export function download(blob:Blob,name:string){
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function duration(ms:number){return `${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;}
export function fail(root:HTMLElement,error:unknown){
 root.innerHTML=`${header()}<section class="error-screen"><span class="eyebrow">もう一度、ここから</span><h1>データを開けませんでした</h1><p>${escape(error instanceof Error?error.message:error)}</p><div class="inline-actions"><button class="primary" id="reload">再読み込み</button><a class="button" href="#/songs">曲一覧に戻る</a></div></section>`;
 root.querySelector('#reload')?.addEventListener('click',()=>location.reload());
}
/** A small in-page confirm dialog (window.confirm is blocked in some embedded browsers). */
export function confirmDialog(title:string,body:string,ok='はい',cancel='やめる'):Promise<boolean>{
 return new Promise(resolve=>{
  const wrap=document.createElement('div');wrap.className='dialog-backdrop';
  wrap.innerHTML=`<div class="play-dialog" role="dialog" aria-modal="true" aria-label="${escape(title)}"><h2>${escape(title)}</h2><p>${escape(body)}</p><div class="inline-actions" style="justify-content:center"><button class="primary" data-answer="yes">${escape(ok)}</button><button data-answer="no">${escape(cancel)}</button></div></div>`;
  const done=(v:boolean)=>{wrap.remove();document.removeEventListener('keydown',key,true);resolve(v);};
  const key=(e:KeyboardEvent)=>{if(e.code==='Escape'){e.stopPropagation();done(false);}};
  wrap.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-answer]');if(b)done(b.dataset.answer==='yes');else if(e.target===wrap)done(false);});
  document.addEventListener('keydown',key,true);
  document.body.append(wrap);wrap.querySelector<HTMLButtonElement>('[data-answer="no"]')?.focus();
 });
}
