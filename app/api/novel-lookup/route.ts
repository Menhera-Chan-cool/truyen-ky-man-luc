import {validateLookupRequest} from "../../../src/lib/novel-lookup";
import {publishedNovelLookup} from "../../../src/lib/novel-lookup-server";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function POST(request:Request){
  let selection;
  try{
    const body=await request.text();if(body.length>16000)throw Error('Too large');
    selection=validateLookupRequest(JSON.parse(body));
  }catch{return Response.json({error:'invalid-selection'},{status:400,headers});}
  try{
    const result=await publishedNovelLookup(selection);
    if(Buffer.byteLength(JSON.stringify(result))>65536)return Response.json({error:'selection-too-long'},{status:400,headers});
    return Response.json(result,{status:result.status==='stale'?409:200,headers});
  }catch(error){return Response.json({error:error instanceof RangeError?'selection-too-long':'lookup-unavailable'},{status:error instanceof RangeError?400:503,headers});}
}
