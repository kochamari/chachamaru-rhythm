// App-wide singletons shared by screens.
import {InputRouter,MidiAdapter} from '../input/InputRouter';
import {AudioEngine,sharedAudioContext} from '../audio/AudioEngine';
import {PreviewPlayer} from '../audio/Preview';
import {MenuNav} from './nav';
import {state} from './store';
import type {RunResult,Difficulty} from '../../../contracts/public-types';

export const app=document.querySelector<HTMLElement>('#app')!;
export const input=new InputRouter(app);
export const midi=new MidiAdapter(input,state.settings);
export const uiAudio=new AudioEngine(state.settings);
export const preview=new PreviewPlayer();
export const nav=new MenuNav(app);
nav.onSound=kind=>uiAudio.effect(kind==='move'?'move':kind==='select'?'select':'back');

/** Remembered across screens during one visit. */
export const memory:{selected:string|null;difficulty:Difficulty;lastResult:RunResult|null}={selected:null,difficulty:'normal',lastResult:null};

/**
 * Unlock audio on real gestures so menus and previews can make sound. Browsers
 * differ in which event counts (iOS wants touchend/click), so keep trying
 * until the shared context is running.
 */
export function armAudioUnlock(){
 const unlock=()=>{if(sharedAudioContext()?.state==='running'&&uiAudio.context)return;void uiAudio.unlock().catch(()=>{});};
 for(const type of ['pointerdown','keydown','touchend','click'])window.addEventListener(type,unlock,{capture:true,passive:true});
}
