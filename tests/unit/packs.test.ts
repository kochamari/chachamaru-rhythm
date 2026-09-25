import {it,expect,describe} from 'vitest';
import {readFileSync} from 'node:fs';
import {zipSync,strToU8} from 'fflate';
import {unpack,readFiles,exportPack} from '../../web/src/packs/zip';
import {validateManifest,validateChart,sha256} from '../../web/src/packs/validators';
import {isBundle,readBundle,bundleSong} from '../../web/src/packs/bundle';
import type {SongPackage,Manifest,Chart} from '../../contracts/public-types';
const zip=new Uint8Array(readFileSync('web/public/original-demo/himawari.zip'));const files=unpack(zip);const manifest:Manifest=JSON.parse(new TextDecoder().decode(files['manifest.json']));const valid:Chart=JSON.parse(new TextDecoder().decode(files['charts/normal.json']));
describe('pack validation',()=>{
 it('P01 generated four-second diagnostic fixture passes schema semantic SHA',async()=>{const diagnostic=await readFiles(unpack(new Uint8Array(readFileSync('fixtures/diagnostic-pack.zip'))));expect(diagnostic.manifest.title).toBe('診断用リズム');expect(diagnostic.charts).toHaveLength(3);expect(Math.abs(diagnostic.manifest.durationMs-4000)).toBeLessThan(100);});
 it('P01 real composed demo passes schema semantic SHA and byte roundtrip',async()=>{const p=await readFiles(files);expect(p.manifest.title).toBe('ひまわり囃子');expect(p.charts).toHaveLength(3);const out=await exportPack(p);const p2=await readFiles(unpack(new Uint8Array(await out.arrayBuffer())));expect(p2.manifest.audio.sha256).toBe(await sha256(await p.audio.arrayBuffer()));});
 it.each([2,0,'1',NaN])('P02 unknown schema version %s rejected',v=>expect(()=>validateManifest({...manifest,schemaVersion:v})).toThrow());
 it.each(['negative','unknown','duplicate-id','order','same-time','empty','end','roll-conflict','roll-length','roll-color','nan','wrong-difficulty'])('P02 P03 %s is rejected',kind=>{const c=structuredClone(valid);if(kind==='negative')c.notes[0].timeMs=-1;if(kind==='unknown')Object.assign(c.notes[0],{kind:'balloon'});if(kind==='duplicate-id')c.notes[1].id=c.notes[0].id;if(kind==='order')c.notes.reverse();if(kind==='same-time')c.notes[1].timeMs=c.notes[0].timeMs;if(kind==='empty')c.notes=[];if(kind==='end')c.notes.at(-1)!.timeMs=999999;if(kind==='roll-conflict')c.notes.splice(1,0,{id:'badroll',kind:'roll',timeMs:c.notes[0].timeMs+1,endMs:c.notes[2].timeMs+100});if(kind==='roll-length')c.notes=[{id:'badroll',kind:'roll',timeMs:1,endMs:0},...c.notes];if(kind==='roll-color')Object.assign(c.notes.find(n=>n.kind==='roll')!,{color:'don'});if(kind==='nan')c.notes[0].timeMs=NaN;if(kind==='wrong-difficulty')c.difficulty='hard';expect(()=>validateChart(c,manifest)).toThrow();});
 it.each(['../../bad.js','/manifest.json','audio\\song.m4a','art/cover.svg','.secret','nested.zip','C:/bad','audio/söng.wav'])('P04 rejects unsafe path %s',name=>{const z=zipSync({...files,[name]:strToU8('bad')});expect(()=>unpack(z)).toThrow();});
 it.each(['symlink','encrypted','oversize','duplicate'])('P04 rejects ZIP %s metadata',kind=>{const b=new Uint8Array(zip),view=new DataView(b.buffer);let c=0;for(let i=0;i<b.length-46;i++)if(view.getUint32(i,true)===0x02014b50){c=i;break;}if(kind==='symlink')view.setUint32(c+38,0xa1ff<<16,true);if(kind==='encrypted')view.setUint16(c+8,1,true);if(kind==='oversize')view.setUint32(c+24,200*1024*1024,true);if(kind==='duplicate'){const needle=strToU8('charts/hard.json'),replacement=strToU8('charts/easy.json');for(let i=0;i<b.length-needle.length;i++)if(needle.every((v,j)=>b[i+j]===v))b.set(replacement,i);}expect(()=>unpack(b)).toThrow();});
 it('P05 corrupted audio/chart hashes fail before returning a package',async()=>{const bad={...files,'charts/easy.json':strToU8('{}')};await expect(readFiles(bad)).rejects.toThrow('SHA');const badAudio={...files,'audio/song.m4a':strToU8('not audio')};await expect(readFiles(badAudio)).rejects.toThrow('SHA');});
 it('excess entries and truncated input are rejected',()=>{expect(()=>unpack(zip.subarray(0,100))).toThrow();expect(()=>unpack(new Uint8Array(0))).toThrow();});
 it('E09 demo is 64s, contains rolls/large notes and >100 normal taps',async()=>{const p=await readFiles(files);expect(p.manifest.durationMs).toBe(64000);expect(p.charts[1].notes.filter(n=>n.kind==='tap').length).toBeGreaterThan(100);expect(p.charts.every(c=>c.notes.some(n=>n.kind==='roll'))).toBe(true);expect(p.charts[1].notes.some(n=>n.kind==='tap'&&n.size==='large')).toBe(true);});
});
export const getFixture=async():Promise<SongPackage>=>readFiles(files);

describe('song collection ZIP (several songs for the iPhone)',()=>{
 const other=new Uint8Array(readFileSync('web/public/original-demo/ondo.zip'));
 async function collection(songs:{path:string;data:Uint8Array;title:string}[],edit?:(list:Record<string,unknown>)=>void){
  const list:Record<string,unknown>={kind:'chachamaru-bundle',schemaVersion:1,songs:await Promise.all(songs.map(async s=>({packId:s.path.slice(6,-4),revision:1,title:s.title,artist:'ちゃちゃまる音楽隊',path:s.path,sha256:await sha256(s.data)})))};
  edit?.(list);
  return zipSync({'bundle.json':strToU8(JSON.stringify(list)),...Object.fromEntries(songs.map(s=>[s.path,[s.data,{level:0}]]))});
 }
 it('reads each song as an ordinary pack and checks its SHA-256',async()=>{
  const z=await collection([{path:'songs/himawari-demo.zip',data:zip,title:'ひまわり囃子'},{path:'songs/chachamaru-ondo.zip',data:other,title:'ちゃちゃまる音頭'}]);
  expect(isBundle(z)).toBe(true);expect(isBundle(zip)).toBe(false);
  const songs=readBundle(z);expect(songs.map(s=>s.title)).toEqual(['ひまわり囃子','ちゃちゃまる音頭']);
  const pack=await readFiles(unpack(new Uint8Array(await bundleSong(z,songs[1]))));
  expect(pack.manifest.packId).toBe('chachamaru-ondo');
 });
 it('rejects a tampered song, unsafe names and unknown formats',async()=>{
  const z=await collection([{path:'songs/himawari-demo.zip',data:zip,title:'ひまわり囃子'}]);
  const songs=readBundle(z);
  await expect(bundleSong(z,{...songs[0],sha256:'0'.repeat(64)})).rejects.toThrow('SHA-256');
  for(const bad of ['../x.zip','songs/../../x.zip','songs/a b.zip','songs/x.txt'])
   await expect(collection([{path:'songs/himawari-demo.zip',data:zip,title:'x'}],l=>{(l.songs as {path:string}[])[0].path=bad;}).then(readBundle)).rejects.toThrow('曲リスト');
  await expect(collection([{path:'songs/himawari-demo.zip',data:zip,title:'x'}],l=>{l.kind='other';}).then(readBundle)).rejects.toThrow('形式');
  await expect(collection([{path:'songs/himawari-demo.zip',data:zip,title:'x'}],l=>{l.songs=[];}).then(readBundle)).rejects.toThrow('形式');
  expect(()=>readBundle(zipSync({'bundle.json':strToU8('{not json')}))).toThrow('読めません');
 });
});
