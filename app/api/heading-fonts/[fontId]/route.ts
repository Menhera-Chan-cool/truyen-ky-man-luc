import {configured,publicClient,serviceClient,requireEditor} from "../../../../src/lib/server";
import {validHeadingFontId} from "../../../../src/lib/heading-fonts";
import {publicRead,readFetch,readStatus,missingStorageObject} from "../../../../src/lib/public-read";
export async function GET(request:Request,{params}:{params:Promise<{fontId:string}>}){
 const missing=()=>new Response("Not found",{status:404,headers:{"Cache-Control":"private, no-store"}}),unavailable=()=>new Response("Unavailable",{status:503,headers:{"Cache-Control":"no-store","Retry-After":"2"}});
 try{
  const {fontId}=await params;if(!configured()||!validHeadingFontId(fontId)||fontId==="default")return missing();
  const {data:published,error}=await publicRead(signal=>publicClient(readFetch(signal)).rpc("can_read_heading_font",{p_id:fontId}));if(error)return unavailable();
  if(!published)try{await requireEditor(request);}catch(e){return readStatus(e)>=500?unavailable():missing();}
  const {data:font,error:lookup}=await publicRead(signal=>serviceClient(readFetch(signal)).from("heading_fonts").select("path").eq("id",fontId).maybeSingle());if(lookup)return unavailable();if(!font)return missing();
  const {data,error:sign}=await publicRead(signal=>serviceClient(readFetch(signal)).storage.from("heading-fonts").createSignedUrl(font.path,60));
  if(sign||!data)return missingStorageObject(sign)?missing():unavailable();
  return new Response(null,{status:307,headers:{Location:data.signedUrl,"Cache-Control":"private, no-store"}});
 }catch{return unavailable();}
}
