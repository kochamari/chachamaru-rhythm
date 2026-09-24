import {getSong} from '../storage/Database';
import {Session} from '../game/Session';
import {InputRouter} from '../input/InputRouter';
import {state} from '../app/store';
import type {InputMode} from '../../../contracts/public-types';

// Development-only fixed scenes for screenshots. Never records results and is
// not a substitute for real play tests (see docs/06_ACCEPTANCE.md).
const SCENES:Record<string,{time:number;combo:number;mode:InputMode}>={
 normal:{time:11000,combo:0,mode:'keyboard'},
 chorus:{time:51000,combo:100,mode:'keyboard'},
 midi:{time:51000,combo:100,mode:'midi'},
 touch:{time:30000,combo:60,mode:'touch'},
 portrait:{time:30000,combo:60,mode:'touch'},
};
export async function showcaseScreen(root:HTMLElement,scene:string){
 const pack=await getSong('himawari-demo');if(!pack)throw Error('デモがありません');
 const config=SCENES[scene]??SCENES.normal;
 const previous=state.settings.inputMode;state.settings.inputMode=config.mode;
 const input=new InputRouter(root);
 const chart=pack.charts.find(c=>c.difficulty==='normal')??pack.charts[0];
 const s=new Session(root,pack,chart,input,{practice:true,autoplay:true});
 await s.init();
 s.showcaseSnapshot(config.time,config.combo);
 const toolbar=document.createElement('div');toolbar.className='showcase-controls';
 toolbar.innerHTML=`<details><summary>合成場面 · 記録しません</summary><nav>${Object.keys(SCENES).map(v=>`<a class="button" href="#/showcase?scene=${v}">${v}</a>`).join('')}</nav></details>`;
 root.append(toolbar);
 return ()=>{s.dispose();input.dispose();state.settings.inputMode=previous;};
}
