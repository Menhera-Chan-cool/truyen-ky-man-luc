import {requireEditor,apiError,jsonBody,HttpError} from '../../../../src/lib/server';
async function chapter(request:Request){
 const id=request.method==='GET'?new URL(request.url).searchParams.get('chapterId'):(await jsonBody(request)).chapterId;
 if(typeof id!=='string'||!/^[a-z0-9-]{1,80}$/.test(id))throw new HttpError('Invalid chapter');return id;
}
export async function GET(request:Request){
 try{
  const {client}=await requireEditor(request),id=await chapter(request);
  const pair=await client.rpc('get_public_novel_alignment',{p_chapter:id});if(pair.error)throw Error('Alignment status unavailable');
  if(!pair.data?.vi||!pair.data?.en)return Response.json({state:'missing'},{headers:{'Cache-Control':'no-store'}});
  const jobs=await client.from('novel_alignment_jobs').select('algorithm,state,updated_at').eq('chapter_id',id).eq('vi_version',pair.data.vi.versionId).eq('en_version',pair.data.en.versionId).eq('codec','reader-dom-1').in('algorithm',['labse-context-mbert-1','e5-mbert-uts95-1']);
  if(jobs.error)throw Error('Alignment status unavailable');
  const job=jobs.data?.find(row=>row.algorithm==='labse-context-mbert-1')??jobs.data?.find(row=>row.algorithm==='e5-mbert-uts95-1');
  return Response.json({state:job?.state??'pending',available:!!pair.data.run,updatedAt:job?.updated_at},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return apiError(e);}
}
export async function POST(request:Request){
 try{const {client}=await requireEditor(request),id=await chapter(request);const {data,error}=await client.rpc('request_novel_alignment',{p_chapter:id});if(error)throw Error(error.message);return Response.json({queued:!!data},{headers:{'Cache-Control':'no-store'}});}catch(e){return apiError(e);}
}
