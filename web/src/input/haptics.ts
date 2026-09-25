import type {Color} from '../../../contracts/public-types';

// A small vibration when a drum pad is tapped. Best effort: does nothing
// where the device offers no way to do it.
//  - Android and others with the Vibration API: vibrate on touch-down, don
//    longer than ka (tapHaptic).
//  - iPhone: Safari has no Vibration API. A WebKit switch
//    (<input type="checkbox" switch>) plays the system tick haptic when the
//    user toggles it. Since iOS 26.5 only a direct tap counts (toggling it
//    from script no longer vibrates), so an invisible switch is laid over
//    each pad and the finger itself toggles it (hapticSwitch). The switch
//    changes on release, so the tick comes as the finger lifts, and it is one
//    fixed light tick for both don and ka.

export function isAppleTouch(){
 return /iPhone|iPad|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
}

/** Vibration API devices: call on touch-down. */
export function tapHaptic(color:Color){
 if(typeof navigator.vibrate!=='function'||isAppleTouch())return;
 try{navigator.vibrate(color==='don'?14:7);}catch{/* not allowed here */}
}

/** iPhone: markup of the invisible switch laid over a pad or button. */
export function hapticSwitch(){
 return isAppleTouch()?'<input type="checkbox" switch class="haptic-switch" tabindex="-1" aria-hidden="true">':'';
}

/** Whether a pointer event landed on an overlay switch (it must get its click). */
export function onHapticSwitch(target:EventTarget|null){
 return target instanceof HTMLInputElement&&target.classList.contains('haptic-switch');
}
