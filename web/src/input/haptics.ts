import type {Color} from '../../../contracts/public-types';

// A small vibration when a drum pad is tapped. Best effort: does nothing
// where the device offers no way to do it.
//  - Android and others with the Vibration API: don is longer than ka.
//  - iPhone: Safari has no Vibration API, but iOS 18+ plays the system "tick"
//    haptic when a switch control changes, so a hidden
//    <input type="checkbox" switch> is toggled through its label. It is one
//    fixed light tick for both don and ka, and needs a real device to feel.

let iosSwitch:HTMLLabelElement|null=null;

export function isAppleTouch(){
 return /iPhone|iPad|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
}

export function tapHaptic(color:Color){
 if(typeof navigator.vibrate==='function'&&!isAppleTouch()){
  try{navigator.vibrate(color==='don'?14:7);}catch{/* not allowed here */}
  return;
 }
 if(!isAppleTouch())return;
 if(!iosSwitch?.isConnected){
  const label=document.createElement('label');
  label.setAttribute('aria-hidden','true');label.style.display='none';label.dataset.haptic='';
  const input=document.createElement('input');
  input.type='checkbox';input.setAttribute('switch','');input.tabIndex=-1;
  label.append(input);document.head.append(label);iosSwitch=label;
 }
 iosSwitch.click();
}
