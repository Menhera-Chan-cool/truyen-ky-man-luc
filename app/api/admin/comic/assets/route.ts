import sharp from "sharp";
import {createHash} from "node:crypto";
import {requireEditor,apiError,jsonBody,HttpError,serviceClient} from "../../../../../src/lib/server";
import {comicAssetPath} from "../../../../../src/lib/comic-publication";
import {comicMime} from "../../../../../src/lib/comic";
export async function POST(request:Request) {
  try {
    const {client,user}=await requireEditor(request),body=await jsonBody(request);
    if(!comicAssetPath(body.path)||!body.path.startsWith(user.id+"/")) throw new HttpError("Invalid comic asset path");
    const service=serviceClient();
    const {data:existing,error:lookupError}=await service.from("comic_assets").select("path,bytes,width,height,hash").eq("path",body.path).maybeSingle();
    if(lookupError) throw new HttpError("Cannot check the uploaded image",503);
    if(existing) return Response.json({...existing,path:"/api/comic/assets/"+existing.path});
    const {data:file,error}=await client.storage.from("comic-assets").download(body.path);
    if(error||!file) throw new HttpError("Upload the image before registering it");
    if(file.size<1||file.size>20*1024*1024) throw new HttpError("Image exceeds 20 MB");
    const bytes=Buffer.from(await file.arrayBuffer()),mime=comicMime(bytes);
    const ext=body.path.split(".").pop();
    if(!mime||mime!==`image/${ext==="jpg"?"jpeg":ext}`) throw new HttpError("Invalid image signature");
    const image=sharp(bytes,{limitInputPixels:40_000_000,failOn:"error"}),meta=await image.metadata();
    if(!meta.width||!meta.height||meta.width*meta.height>40_000_000||(meta.pages??1)>1) throw new HttpError("Unsupported image dimensions or animation");
    await image.resize(1,1).toBuffer();
    const asset={path:body.path,content_type:mime,bytes:bytes.length,width:meta.width,height:meta.height,hash:createHash("sha256").update(bytes).digest("hex"),created_by:user.id};
    const {error:insertError}=await service.from("comic_assets").insert(asset);
    if(insertError) throw new HttpError("Could not register the image. Retry saving.",503);
    return Response.json({path:"/api/comic/assets/"+asset.path,bytes:asset.bytes,width:asset.width,height:asset.height,hash:asset.hash});
  }catch(e){return apiError(e);}
}
