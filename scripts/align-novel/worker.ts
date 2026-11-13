import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parseArgs} from 'node:util';
import nextEnv from '@next/env';
import {createClient} from '@supabase/supabase-js';
import {makeAlignmentInput,matchesAlignmentInput,algorithm} from './input';
import {makeContextInput} from './context-input';
import {validateAlignmentArtifact,alignmentCodec,type AlignmentArtifact} from '../../src/lib/novel-lookup';

nextEnv.loadEnvConfig(process.cwd(),false,{info(){},error(){}});
const {values}=parseArgs({options:{'first-job':{type:'string'},prepared:{type:'string'},python:{type:'string',default:'python'},cache:{type:'string',default:'.alignment-cache'},work:{type:'string',default:'.alignment-work'},max:{type:'string',default:'3'}}});
const max=Number(values.max);if(!Number.isInteger(max)||max<1||max>20)throw Error('Invalid job budget');
const url=process.env.NOVEL_ALIGNMENT_SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NOVEL_ALIGNMENT_SERVICE_ROLE_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('Alignment worker credentials are not configured');
const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(30000)})}});
async function rpc(name:string,params:Record<string,unknown>={}){
 const {data,error}=await client.rpc(name,params);if(error)throw Error(error.message);return data;
}
type Job={id:string;lease_id:string;chapterId:string;codec:string;algorithm:string;editions:Parameters<typeof makeAlignmentInput>[1]};
function validateJob(value:unknown):Job{
 const j=value as Job;if(!j||!/^[-a-f0-9]{36}$/i.test(j.id)||!/^[-a-f0-9]{36}$/i.test(j.lease_id)||j.codec!==alignmentCodec||j.algorithm!==algorithm)throw Error('Unsupported alignment job');
 return j;
}
async function python(args:string[]){
 const env={...process.env};delete env.SUPABASE_SERVICE_ROLE_KEY;delete env.NOVEL_ALIGNMENT_SERVICE_ROLE_KEY;delete env.VILAO_API_KEY;delete env.GEMINI_API_KEY;
 await new Promise<void>((resolve,reject)=>{
  const child=spawn(values.python!,args,{stdio:'inherit',env,windowsHide:true});
  const timer=setTimeout(()=>{child.kill();reject(Error('Alignment processing timed out'));},600000);
  child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Alignment processing failed'));});
 });
}
async function readArtifact(file:string){
 const info=await fs.stat(file);if(info.size>16777216)throw Error('Artifact too large');
 const bytes=await fs.readFile(file);return {artifact:validateAlignmentArtifact(JSON.parse(bytes.toString('utf8'))),bytes};
}
let modelsReady=false;
const first=values['first-job']?JSON.parse(await fs.readFile(values['first-job'],'utf8')):undefined;
for(let count=0;count<max;count++){
 const next=count===0&&first?first:await rpc('claim_novel_alignment_job');if(!next)break;
 const job=validateJob(next);
 try{
  const input=makeContextInput(makeAlignmentInput(job.chapterId,job.editions));
  const current=await rpc('get_public_novel_alignment',{p_chapter:job.chapterId});
  if(current?.vi?.versionId!==input.editions.vi.versionId||current?.en?.versionId!==input.editions.en.versionId){await rpc('finish_novel_alignment_job',{p_job:job.id,p_lease:job.lease_id,p_path:null,p_hash:null,p_bytes:null,p_error:'Published pair changed'});continue;}
  let prepared:{artifact:AlignmentArtifact;bytes:Buffer}|undefined;
  if(values.prepared){try{prepared=await readArtifact(path.join(values.prepared,job.chapterId+'.json'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
  if(prepared&&(!matchesAlignmentInput(prepared.artifact,input)||prepared.artifact.algorithm!==algorithm))prepared=undefined;
  if(!prepared){
   const directory=path.resolve(values.work!,job.id),source=path.join(directory,'input'),output=path.join(directory,'output');
   await fs.mkdir(source,{recursive:true});await fs.writeFile(path.join(source,job.chapterId+'.input.json'),JSON.stringify(input));
   if(!modelsReady){await python(['scripts/align-novel/download_models.py','--cache',values.cache!]);modelsReady=true;}
   await python(['scripts/align-novel/run.py','--cache',values.cache!,'--input',source,'--output',output]);
   prepared=await readArtifact(path.join(output,job.chapterId+'.json'));
  }
  if(!matchesAlignmentInput(prepared.artifact,input)||prepared.artifact.algorithm!==algorithm)throw Error('Artifact does not match the claimed published pair');
  const hash=createHash('sha256').update(prepared.bytes).digest('hex'),file=job.id+'/'+hash+'.json';
  const uploaded=await client.storage.from('novel-alignments').upload(file,prepared.bytes,{contentType:'application/json',upsert:false,cacheControl:'31536000'});
  if(uploaded.error){
   const prior=await client.storage.from('novel-alignments').download(file);
   if(prior.error||!prior.data||createHash('sha256').update(Buffer.from(await prior.data.arrayBuffer())).digest('hex')!==hash)throw Error('Artifact upload failed');
  }
  let result;
  try{result=await rpc('finish_novel_alignment_job',{p_job:job.id,p_lease:job.lease_id,p_path:file,p_hash:hash,p_bytes:prepared.bytes.length,p_error:null});}
  catch(error){
   const state=await client.from('novel_alignment_jobs').select('state').eq('id',job.id).single();
   const available=await rpc('get_public_novel_alignment',{p_chapter:job.chapterId});
   if(state.data?.state!=='ready'||available?.run?.sha256!==hash||available?.run?.path!==file)throw error;
   result={state:'ready',reconciled:true};
  }
  console.log(JSON.stringify({chapter:job.chapterId,state:result.state,bytes:prepared.bytes.length}));
 }catch(error){
  try{await rpc('finish_novel_alignment_job',{p_job:job.id,p_lease:job.lease_id,p_path:null,p_hash:null,p_bytes:null,p_error:error instanceof Error?error.message.slice(0,500):'Worker failed'});}catch{}
  throw error;
 }
}
