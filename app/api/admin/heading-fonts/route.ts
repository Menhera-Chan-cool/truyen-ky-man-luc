import {createHash} from "node:crypto";
import {requireEditor,serviceClient,jsonBody,apiError,HttpError} from "../../../../src/lib/server";
import {fontFileInfo,validHeadingFontId} from "../../../../src/lib/heading-fonts";
import {publicRead,readFetch} from "../../../../src/lib/public-read";
export async function GET(request:Request){
 try{const {client}=await requireEditor(request);const {data,error}=await client.from("heading_fonts").select("id,label,path,format,bytes,hash,archived,created_at").eq("archived",false).order("created_at");if(error)throw new HttpError("Cannot load shared heading fonts",503);return Response.json(data,{headers:{"Cache-Control":"private, no-store"}});}catch(e){return apiError(e);}
}
export async function POST(request:Request){
 try{
  const {client,user}=await requireEditor(request),body=await jsonBody(request);
  if(!validHeadingFontId(body.id)||body.id==="default")throw new HttpError("Choose a custom font");
  if(body.action==="remove"){
   const {data,error}=await client.rpc("archive_heading_font",{p_id:body.id});if(error)throw new HttpError(error.message,/in use/i.test(error.message)?409:400);return Response.json({removed:data});
  }
  if(body.action!=="register"||typeof body.label!=="string"||!body.label.trim()||body.label.length>120||typeof body.path!=="string"||!new RegExp(`^${user.id}/${body.id}\\.(ttf|otf|woff|woff2)$`).test(body.path))throw new HttpError("Invalid heading font upload");
  const service=serviceClient(),{data:existing,error:lookupError}=await publicRead(signal=>serviceClient(readFetch(signal)).from("heading_fonts").select("*").eq("id",body.id).maybeSingle());
  if(lookupError)throw new HttpError("Cannot check the uploaded font",503);
  if(existing){if(existing.archived||existing.path!==body.path)throw new HttpError("Font already exists or was removed. Add it with a new upload.",409);return Response.json(existing);}
  const {data:file,error}=await publicRead(signal=>client.storage.from("heading-fonts").download(body.path,{}, {signal}));
  if(error||!file)throw new HttpError("Upload the font before registering it");
  if(file.size>3*1024*1024)throw new HttpError("Font must be at most 3 MB");
  const bytes=new Uint8Array(await file.arrayBuffer());let info;
  try{info=fontFileInfo(body.path,bytes);}catch(e){throw new HttpError(e instanceof Error?e.message:"Invalid font");}
  const font={id:body.id,label:body.label.replace(/[\x00-\x1f]/g,"").trim(),path:body.path,format:info.format,bytes:bytes.length,hash:createHash("sha256").update(bytes).digest("hex"),created_by:user.id};
  const {error:insertError}=await service.from("heading_fonts").insert(font);
  if(insertError&&insertError.code!=="23505")throw new HttpError("Could not register the font. Retry adding it.",503);
  return Response.json(font);
 }catch(e){return apiError(e);}
}
