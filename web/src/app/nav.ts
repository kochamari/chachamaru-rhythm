// Drum navigation for menus: カッ moves, ドン decides. Works with the keys
// (D/K, F/J, arrows, Enter), the touch drum and a registered MIDI drum, so a
// TD-17 player can pick songs without touching the screen.
import type {Input} from '../input/InputRouter';
import {isTyping} from '../input/InputRouter';

export interface NavHandlers {
 /** Return true when the screen handled the move itself. */
 move?:(dir:-1|1)=>boolean;
 /** Return true when the screen handled the decision itself. */
 decide?:()=>boolean;
 back?:()=>void;
}

export class MenuNav {
 handlers:NavHandlers={};
 private abort=new AbortController();
 onSound:(kind:'move'|'select'|'back')=>void=()=>{};
 constructor(private root:HTMLElement){
  window.addEventListener('keydown',e=>{
   if(e.defaultPrevented||isTyping(e.target)||e.metaKey||e.ctrlKey||e.altKey)return;
   if(!this.active())return;
   if(e.code==='ArrowDown'||e.code==='ArrowRight'){if(this.move(1))e.preventDefault();}
   else if(e.code==='ArrowUp'||e.code==='ArrowLeft'){if(this.move(-1))e.preventDefault();}
   else if(e.code==='Escape'&&this.handlers.back){e.preventDefault();this.onSound('back');this.handlers.back();}
  },{signal:this.abort.signal});
 }
 private active(){return !document.querySelector('.game-scene,.dialog-backdrop');}
 /** Inputs from the drum router while a menu is shown. */
 input(i:Input){
  if(!this.active())return;
  if(i.color==='don')this.decide();
  else this.move(i.side==='left'?-1:1);
 }
 items(){return [...this.root.querySelectorAll<HTMLElement>('[data-nav]')].filter(el=>el.offsetParent!==null&&!(el as HTMLButtonElement).disabled);}
 move(dir:-1|1){
  if(this.handlers.move?.(dir)){this.onSound('move');return true;}
  const items=this.items();if(!items.length)return false;
  const i=items.indexOf(document.activeElement as HTMLElement);
  const next=items[i<0?0:(i+dir+items.length)%items.length];
  next.focus({preventScroll:false});next.scrollIntoView?.({block:'nearest'});
  this.onSound('move');return true;
 }
 decide(){
  if(this.handlers.decide?.()){this.onSound('select');return;}
  const el=document.activeElement as HTMLElement|null;
  const items=this.items();
  const target=el&&items.includes(el)?el:items[0];
  if(target){this.onSound('select');target.click();}
 }
 reset(){this.handlers={};}
 dispose(){this.abort.abort();}
}
