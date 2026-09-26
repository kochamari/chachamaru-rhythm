// iPhone Safari zooms the page on a pinch (two fingers drumming can look like
// one), on a double tap, and on its own when a small select or text field is
// focused, and then stays zoomed. The play screen must never zoom: while it is
// shown the viewport is fixed at 1 (which also undoes a zoom already there),
// and Safari's pinch gestures and multi-finger moves are cancelled.

const BASE='width=device-width, initial-scale=1, viewport-fit=cover';
const FIXED=BASE+', maximum-scale=1, user-scalable=no';
const block=(e:Event)=>{if(e.cancelable)e.preventDefault();};
const multiTouch=(e:TouchEvent)=>{if(e.touches.length>1&&e.cancelable)e.preventDefault();};

/** Keeps the page at its normal size until the returned function is called. */
export function lockZoom(){
 const meta=document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
 if(meta)meta.content=FIXED;
 for(const type of ['gesturestart','gesturechange','gestureend','dblclick'])document.addEventListener(type,block,{passive:false});
 document.addEventListener('touchmove',multiTouch,{passive:false});
 return ()=>{
  if(meta)meta.content=BASE;
  for(const type of ['gesturestart','gesturechange','gestureend','dblclick'])document.removeEventListener(type,block);
  document.removeEventListener('touchmove',multiTouch);
 };
}
