import {configured,publicClient} from "../../../src/lib/server";
import {publicRead,readFetch} from "../../../src/lib/public-read";
import {isLocale} from "../../../src/lib/types";
export async function GET(request:Request){
  const p=new URL(request.url).searchParams,id=p.get("chapter")??"",locale=p.get("locale");
  const headers={"Cache-Control":"no-store"};
  if(!/^[a-z0-9-]{1,80}$/.test(id)||!isLocale(locale??""))return Response.json({error:"Invalid chapter or locale"},{status:400,headers});
  if(!configured())return Response.json({firstPage:null},{headers});
  try{
    const {data,error}=await publicRead(signal=>publicClient(readFetch(signal)).rpc("get_public_comic",{p_id:id,p_locale:locale}));
    if(error)throw error;
    const page=data?.pages?.[0];
    return Response.json({firstPage:page?.bytes>0&&page.bytes<=4*1024*1024&&page.path?.startsWith("/api/comic/assets/")?{path:page.path,bytes:page.bytes}:null},{headers});
  }catch{return Response.json({error:"Comic unavailable"},{status:503,headers});}
}
