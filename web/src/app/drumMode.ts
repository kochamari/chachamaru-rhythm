import {state} from './store';
import {toast} from './ui';
import {saveSettings} from '../storage/Database';

/**
 * The registered electronic drum was hit: play with it from now on. The
 * choice is saved, so the next song opens without the touch drum, and any
 * visible input-mode menu follows. Returns false when it was already on.
 */
export function adoptDrum(){
 if(state.settings.inputMode==='midi')return false;
 state.settings.inputMode='midi';
 void saveSettings(state.settings).catch(()=>{});
 for(const select of document.querySelectorAll<HTMLSelectElement>('#input-mode'))select.value='midi';
 toast('電子ドラムで遊びます（操作を「電子ドラム」に切り替えました）');
 return true;
}
