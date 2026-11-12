import {readPreference} from './db';
import {OFFLINE_KEY,type OfflineBook} from './offline-book';
import {validateAlignmentArtifact,type AlignmentArtifact} from './novel-lookup';
import type {Book} from './types';
export function offlineAlignmentKey(hash:string){
 if(!/^[a-f0-9]{64}$/.test(hash))throw Error('Invalid alignment checksum');return 'offline-novel-alignment:v1:'+hash;
}
function pairMatches(artifact:AlignmentArtifact,book:Book,id:string){
 const chapter=book.chapters.find(c=>c.id===id);
 return artifact.chapterId===id&&chapter?.vi?.revision===artifact.editions.vi.revision&&chapter?.en?.revision===artifact.editions.en.revision;
}
export async function verifyOfflineAlignment(bytes:ArrayBuffer,hash:string,book:Book,id:string){
 if(bytes.byteLength>16777216)throw Error('Alignment download is too large');
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
 if(digest!==hash)throw Error('Alignment checksum mismatch');
 const artifact=validateAlignmentArtifact(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
 if(!pairMatches(artifact,book,id))throw Error('Published editions changed during download');return artifact;
}
export async function downloadOfflineAlignments(book:Book,signal:AbortSignal,progress:(done:number,total:number,bytes:number)=>void,budget:number){
 const chapters=book.chapters.filter(c=>c.vi?.kind==='text'&&c.en?.kind==='text');
 const keys:Record<string,string>={},artifacts:Record<string,AlignmentArtifact>={};let bytes=0;
 for(let i=0;i<chapters.length;i++){
  signal.throwIfAborted();const c=chapters[i];
  const response=await fetch(`/api/novel-alignment/${c.id}?vi=${c.vi!.revision}&en=${c.en!.revision}`,{signal,cache:'no-store',credentials:'omit'});
  if(!response.ok)throw Error('Unable to download alignment data');const metadata=await response.json();
  if(metadata.state==='pending'){progress(i+1,chapters.length,bytes);continue;}
  if(metadata.state!=='ready')throw Error('Published editions changed during download');
  if(!Number.isSafeInteger(metadata.bytes)||metadata.bytes<1||metadata.bytes>16777216||bytes+metadata.bytes>budget)throw Error('Offline download exceeds 200 MB');
  const key=offlineAlignmentKey(metadata.sha256),cached=await readPreference(key);
  if(cached){
   try{
    const artifact=validateAlignmentArtifact(cached);
    if(pairMatches(artifact,book,c.id)){
     artifacts[key]=artifact;keys[c.id]=key;bytes+=metadata.bytes;progress(i+1,chapters.length,bytes);continue;
    }
   }catch{/* A damaged local copy is downloaded and verified again. */}
  }
  const url=new URL(metadata.url,location.origin),supabase=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const local=url.origin===location.origin&&url.pathname===`/api/novel-alignment/${c.id}`;
  const storage=supabase&&url.origin===new URL(supabase).origin&&url.pathname.startsWith('/storage/v1/object/sign/novel-alignments/');
  if(!local&&!storage)throw Error('Unexpected alignment download URL');
  const download=await fetch(url,{signal,credentials:'omit',cache:'no-store'});if(!download.ok)throw Error('Unable to download alignment data');
  const raw=await download.arrayBuffer();if(raw.byteLength!==metadata.bytes)throw Error('Alignment size mismatch');
  const artifact=await verifyOfflineAlignment(raw,metadata.sha256,book,c.id);
  artifacts[key]=artifact;keys[c.id]=key;bytes+=raw.byteLength;progress(i+1,chapters.length,bytes);
 }
 return {keys,artifacts,bytes};
}
export async function readDownloadedAlignment(book:Book,id:string){
 const saved=await readPreference<OfflineBook>(OFFLINE_KEY),key=saved?.alignmentKeys?.[id];
 if(!key||!/^offline-novel-alignment:v1:[a-f0-9]{64}$/.test(key))return;
 const value=await readPreference(key);if(!value)return;
 const artifact=validateAlignmentArtifact(value);if(pairMatches(artifact,book,id))return artifact;
}
