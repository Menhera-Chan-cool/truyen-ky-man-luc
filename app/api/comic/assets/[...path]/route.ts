import {configured,publicClient,requireEditor,serviceClient} from "../../../../../src/lib/server";
import {comicAssetPath,comicThumbnailPath} from "../../../../../src/lib/comic-publication";
import {publicRead,readFetch,readStatus,missingStorageObject} from "../../../../../src/lib/public-read";
export async function GET(request:Request,{params}:{params:Promise<{path:string[]}>}) {
  const unavailable=()=>new Response("Unavailable",{status:503,headers:{"Cache-Control":"no-store","Retry-After":"2"}});
  const missing=()=>new Response("Not found",{status:404,headers:{"Cache-Control":"private, no-store"}});
  try {
  const path=(await params).path.join("/");
  if(!configured()||!comicAssetPath(path)) return missing();
  const {data:published,error}=await publicRead(signal=>publicClient(readFetch(signal)).rpc("can_read_comic_asset",{p_path:path}));
  if(error) return unavailable();
  if(!published) {
    try {await requireEditor(request);}catch(e){return readStatus(e)>=500?unavailable():missing();}
    const {data:registered,error:lookupError}=await publicRead(signal=>serviceClient(readFetch(signal)).from("comic_assets").select("path").eq("path",path).maybeSingle());
    if(lookupError)return unavailable();
    if(!registered) return missing();
  }
  const object=new URL(request.url).searchParams.get("view")==="thumb"?comicThumbnailPath(path):path;
  const {data,error:signError}=await publicRead(signal=>serviceClient(readFetch(signal)).storage.from("comic-assets").createSignedUrl(object,60));
  if(signError||!data) return missingStorageObject(signError)?missing():unavailable();
  return new Response(null,{status:307,headers:{Location:data.signedUrl,"Cache-Control":"private, no-store"}});
  }catch{return unavailable();}
}
