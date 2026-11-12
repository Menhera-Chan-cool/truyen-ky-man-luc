import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {getBook,publicClient,serviceClient} from "./server";
import {publicRead,readFetch} from "./public-read";
import {lookupArtifact,validateAlignmentArtifact,type LookupRequest,type LookupResult,type AlignmentArtifact} from "./novel-lookup";

export type PublicAlignmentPair={chapterId:string;vi:{versionId:string;revision:number;kind:string}|null;en:{versionId:string;revision:number;kind:string}|null;run:{path:string;sha256:string;bytes:number;codec:string;algorithm:string}|null};
const cache=new Map<string,AlignmentArtifact>();
export const localAlignmentDirectory=()=>process.env.VERCEL?undefined:process.env.NOVEL_ALIGNMENT_DIR;
export async function getAlignmentPair(chapterId:string):Promise<PublicAlignmentPair|null>{
  if(localAlignmentDirectory()){
    const book=await getBook(false),c=book.chapters.find(c=>c.id===chapterId);
    if(!c)return null;
    return {chapterId,vi:c.vi?{versionId:'',revision:c.vi.revision,kind:c.vi.kind}:null,en:c.en?{versionId:'',revision:c.en.revision,kind:c.en.kind}:null,run:null};
  }
  const {data,error}=await publicRead(signal=>publicClient(readFetch(signal)).rpc('get_public_novel_alignment',{p_chapter:chapterId}));
  if(error)throw Error('Alignment metadata unavailable');return data as PublicAlignmentPair|null;
}
export async function readLocalAlignment(chapterId:string){
  const directory=localAlignmentDirectory();if(!directory)throw Error('Local alignment is disabled');
  if(!/^[a-z0-9-]{1,80}$/.test(chapterId))throw Error('Invalid chapter');
  const file=path.resolve(directory,chapterId+'.json');
  if(!file.startsWith(path.resolve(directory)+path.sep))throw Error('Invalid chapter');
  const info=await fs.stat(file);if(info.size>16*1024*1024)throw Error('Alignment artifact too large');
  const bytes=await fs.readFile(file),artifact=validateAlignmentArtifact(JSON.parse(bytes.toString('utf8')));
  return {bytes,artifact,sha256:createHash('sha256').update(bytes).digest('hex')};
}
async function loadArtifact(pair:PublicAlignmentPair){
  if(localAlignmentDirectory())return (await readLocalAlignment(pair.chapterId)).artifact;
  const run=pair.run;if(!run)return null;
  const cached=cache.get(run.sha256);if(cached)return cached;
  const {data,error}=await publicRead(signal=>serviceClient(readFetch(signal)).storage.from('novel-alignments').download(run.path));
  if(error||!data)throw Error('Alignment download unavailable');
  if(data.size!==run.bytes||data.size>16*1024*1024)throw Error('Invalid artifact size');
  const bytes=Buffer.from(await data.arrayBuffer());if(createHash('sha256').update(bytes).digest('hex')!==run.sha256)throw Error('Artifact checksum mismatch');
  const artifact=validateAlignmentArtifact(JSON.parse(bytes.toString('utf8')));
  if(artifact.chapterId!==pair.chapterId||artifact.codec!==run.codec||artifact.algorithm!==run.algorithm)throw Error('Invalid artifact metadata');
  cache.set(run.sha256,artifact);if(cache.size>4)cache.delete(cache.keys().next().value!);return artifact;
}
export async function alignmentDownload(pair:PublicAlignmentPair){
  if(localAlignmentDirectory()){
    const {artifact,sha256,bytes}=await readLocalAlignment(pair.chapterId);
    if(artifact.editions.vi.revision!==pair.vi?.revision||artifact.editions.en.revision!==pair.en?.revision)return null;
    return {sha256,bytes:bytes.length,url:`/api/novel-alignment/${pair.chapterId}?vi=${pair.vi.revision}&en=${pair.en.revision}&raw=1&sha=${sha256}`};
  }
  if(!pair.run)return null;
  const {data,error}=await serviceClient().storage.from('novel-alignments').createSignedUrl(pair.run.path,60);
  if(error||!data)throw Error('Alignment download unavailable');
  return {sha256:pair.run.sha256,bytes:pair.run.bytes,url:data.signedUrl};
}

export async function publishedNovelLookup(request:LookupRequest):Promise<LookupResult>{
  const targetLocale=request.locale==="vi"?"en":"vi";
  const empty=(status:LookupResult['status']):LookupResult=>({status,targetLocale,passages:[]});
  const pair=await getAlignmentPair(request.chapterId);
  if(!pair?.[request.locale]||!pair[targetLocale])return empty('missing');
  if(pair[request.locale]!.revision!==request.revision)return empty('stale');
  if(pair.vi?.kind!=="text"||pair.en?.kind!=="text")return empty('unavailable');
  try{
    const artifact=await loadArtifact(pair);if(!artifact)return empty('pending');
    if(artifact.chapterId!==pair.chapterId||artifact.editions.vi.revision!==pair.vi.revision||artifact.editions.en.revision!==pair.en.revision)return empty('stale');
    if(pair.run&&(artifact.codec!==pair.run.codec||artifact.algorithm!==pair.run.algorithm))throw Error('Artifact recipe mismatch');
    if(!localAlignmentDirectory()&&(artifact.editions.vi.versionId!==pair.vi.versionId||artifact.editions.en.versionId!==pair.en.versionId))return empty('stale');
    return lookupArtifact(artifact,request);
  }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return empty('pending');throw error;}
}
