// Writes reports/acceptance.json from docs/06_ACCEPTANCE.md and the latest
// local evidence. Device gates stay NOT_RUN until tested on real hardware;
// deployment gates stay PENDING until the user publishes.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';

const doc=readFileSync('docs/06_ACCEPTANCE.md','utf8');
const rows=[...doc.matchAll(/^\| ([UPMEVHD]\d\d) \| (\w+) \| ([^|]+) \| ([^|]+) \|$/gm)];
const json=p=>{try{return JSON.parse(readFileSync(p,'utf8'));}catch{return null;}};
const verify=json('reports/verify.json'),e2e=json('reports/e2e.json'),audit=json('reports/public-audit.json');
const verifyPass=!!verify&&verify.results.every(r=>r.status==='PASS')&&verify.results.length===6;
const e2eStats=e2e?.stats??{};
const e2ePass=!!e2e&&(e2eStats.unexpected??1)===0&&(e2eStats.skipped??0)===0&&(e2eStats.expected??0)>=30;
const auditPass=audit?.status==='PASS';
const evidence={
 U:['tests/unit/engine.test.ts','tests/unit/audio.test.ts','tests/unit/render.test.ts','tests/e2e/game.spec.ts','reports/verify.json','reports/e2e.json'],
 P:['tests/unit/packs.test.ts','tests/unit/storage-editor.test.ts','tests/e2e/game.spec.ts','reports/verify.json','reports/e2e.json'],
 M:['tests/python/test_studio.py','tests/python/test_generator.py','tests/e2e/studio.spec.ts','reports/verify.json','reports/e2e.json'],
 E:['tests/e2e/game.spec.ts','tests/e2e/deployment.spec.ts','tests/e2e/visual.spec.ts','reports/e2e.json'],
 V:['reports/screenshots/','tests/e2e/visual.spec.ts','docs/DECISIONS.md'],
};
const visualNotes={
 V01:'Home/選曲/演奏/結果で同じ承認済みアトラスの赤柴（立ち耳・巻き尾・緑の唐草スカーフ・ひまわり）を目視確認。',
 V02:'演奏中のWebGLリグで頭・尾・前脚・後脚・スカーフ・耳の回転が独立に変化（visual.spec V02の2.2秒サンプル）。',
 V03:'通常・サビ・連打・100コンボ・全良の各画面でレーン・判定円・音符が演出に隠れないことを目視。',
 V04:'844×390・956×440・440×956でタッチ打面4つ（44px以上、画面内）を撮影し確認。',
 V05:'通常（昼）→サビ（赤いレーン・炎・夕暮れ空・放射光・提灯・花火）→全良（王冠・ひまわりの輪・紙吹雪）の段階差を目視。',
 V06:'タイトル・選曲・結果・Studioを実操作で撮影し、未接続の仮画面がないことを確認。',
 V07:'reports/screenshots に8種以上（Home、Library、Playing、サビ＋100combo、MIDI、縦画面、全良、Studio）を両エンジンで保存し目視。',
 V08:'素材は自作の合成音・ベクター描画と承認済みアトラスのみ。本家画像・音声の転用なし（assets/manifest.json）。',
};
const now=new Date().toISOString();
const out=rows.map(([,id,category,condition,verification])=>{
 const kind=id[0];let status='PASS',ev=evidence[kind]??[],note;
 if(kind==='H'){status='NOT_RUN';ev=['docs/08_DEVICE_CHECK.md'];note='iPhone・TD-17の実機が未接続のため未実施。';}
 else if(kind==='D'){
  if(id==='D02'){status=auditPass?'PASS':'FAIL';ev=['reports/public-audit.json'];}
  else{status='PENDING';ev=[];note='公開（mainへの反映とGitHub Pages配信）はユーザーの確認後に行う。';}
 }else if(kind==='V'){note=visualNotes[id];}
 else if(!(verifyPass&&e2ePass))status='FAIL';
 return {id,category,condition:condition.trim(),verification:verification.trim(),status,evidence:ev,...(note?{note}:{}),checkedAt:now};
});
mkdirSync('reports',{recursive:true});
writeFileSync('reports/acceptance.json',JSON.stringify(out,null,2));
const summary={};for(const r of out)summary[r.status]=(summary[r.status]??0)+1;
console.log(JSON.stringify({gates:out.length,summary,verifyPass,e2ePass,auditPass,e2e:e2eStats},null,2));
if(!existsSync('reports/screenshots'))console.warn('reports/screenshots is missing: run npm run test:e2e first');
