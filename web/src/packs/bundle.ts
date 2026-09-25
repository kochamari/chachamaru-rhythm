import {unzipSync,strFromU8} from 'fflate';
import {sha256} from './validators';

// A song collection ZIP (made by the Mac Studio to send several songs to the
// iPhone at once): bundle.json at the root, and each song as its own normal
// pack ZIP under songs/. Every song still goes through the single-pack checks.

const MiB=1024*1024;
export const BUNDLE_MAX=400*MiB;
const LIST='bundle.json';

export interface BundleSong{packId:string;revision:number;title:string;artist:string;path:string;sha256:string}

/** Whether the ZIP is a song collection. Reads only the ZIP's directory. */
export function isBundle(zip:Uint8Array){
 try{return !!unzipSync(zip,{filter:f=>f.name===LIST&&f.originalSize<=MiB})[LIST];}catch{return false;}
}

export function readBundle(zip:Uint8Array):BundleSong[]{
 if(zip.byteLength>BUNDLE_MAX)throw Error('まとめZIPは400MiBまでです');
 const raw=unzipSync(zip,{filter:f=>f.name===LIST&&f.originalSize<=MiB})[LIST];
 if(!raw)throw Error('まとめZIPの曲リスト（bundle.json）がありません');
 let list:unknown;
 try{list=JSON.parse(strFromU8(raw));}catch{throw Error('まとめZIPの曲リストが読めません');}
 const b=list as {kind?:unknown;schemaVersion?:unknown;songs?:unknown};
 if(b.kind!=='chachamaru-bundle'||b.schemaVersion!==1||!Array.isArray(b.songs)||!b.songs.length||b.songs.length>200)throw Error('まとめZIPの形式に対応していません');
 const seen=new Set<string>();
 return b.songs.map((s:Partial<BundleSong>)=>{
  const ok=typeof s.path==='string'&&/^songs\/[A-Za-z0-9_-]{1,100}\.zip$/.test(s.path)&&!seen.has(s.path)
   &&typeof s.sha256==='string'&&/^[a-f0-9]{64}$/.test(s.sha256)
   &&typeof s.packId==='string'&&typeof s.title==='string'&&typeof s.artist==='string'&&Number.isInteger(s.revision);
  if(!ok)throw Error('まとめZIPの曲リストが不正です');
  seen.add(s.path!);
  return {packId:s.packId!,revision:s.revision!,title:s.title!.slice(0,200),artist:s.artist!.slice(0,200),path:s.path!,sha256:s.sha256!};
 });
}

/** One song's pack ZIP from the collection, checked against its SHA-256. */
export async function bundleSong(zip:Uint8Array,song:BundleSong):Promise<ArrayBuffer>{
 const file=unzipSync(zip,{filter:f=>f.name===song.path&&f.originalSize<=96*MiB})[song.path];
 if(!file)throw Error('まとめZIPの中に曲が見つかりません');
 const bytes=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength) as ArrayBuffer;
 if(await sha256(bytes)!==song.sha256)throw Error('ファイルが壊れています（SHA-256が一致しません）');
 return bytes;
}
