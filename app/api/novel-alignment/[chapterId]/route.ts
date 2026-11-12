import {getAlignmentPair,alignmentDownload,readLocalAlignment,localAlignmentDirectory} from '../../../../src/lib/novel-lookup-server';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request,{params}:{params:Promise<{chapterId:string}>}){
  const {chapterId}=await params,url=new URL(request.url);
  if(!/^[a-z0-9-]{1,80}$/.test(chapterId))return Response.json({error:'invalid-chapter'},{status:400,headers});
  try{
    const pair=await getAlignmentPair(chapterId);
    if(!pair?.vi||!pair.en)return Response.json({state:'missing'},{headers});
    if(pair.vi.kind!=='text'||pair.en.kind!=='text')return Response.json({state:'unavailable'},{headers});
    if(Number(url.searchParams.get('vi'))!==pair.vi.revision||Number(url.searchParams.get('en'))!==pair.en.revision)return Response.json({state:'stale'},{status:409,headers});
    const download=await alignmentDownload(pair);
    if(!download)return Response.json({state:'pending'},{headers});
    if(url.searchParams.get('raw')==='1'&&localAlignmentDirectory()){
      const raw=await readLocalAlignment(chapterId);
      if(url.searchParams.get('sha')!==raw.sha256)return Response.json({state:'stale'},{status:409,headers});
      return new Response(raw.bytes.toString('utf8'),{headers:{...headers,'Content-Type':'application/json'}});
    }
    return Response.json({state:'ready',...download},{headers});
  }catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return Response.json({state:'pending'},{headers});return Response.json({error:'download-unavailable'},{status:503,headers});}
}
