// Remembers the bytes behind Blobs built in memory (ZIP import), so saving
// does not read them back: a Blob read is one more load in WebKit, and loads
// that start while a page unloads are refused. It also skips a copy.
const known=new WeakMap<Blob,ArrayBuffer>();

export function blobWithBytes(bytes:ArrayBuffer,type:string){
 const blob=new Blob([bytes],{type});known.set(blob,bytes);return blob;
}

export function blobBytes(blob:Blob):Promise<ArrayBuffer>{
 const bytes=known.get(blob);return bytes?Promise.resolve(bytes):blob.arrayBuffer();
}
