import {configured,publicClient,requireEditor,serviceClient} from "../../../../../src/lib/server";
import {comicAssetPath,comicThumbnailPath,comicReadingPath} from "../../../../../src/lib/comic-publication";
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
  const view=new URL(request.url).searchParams.get("view"),object=view==="thumb"?comicThumbnailPath(path):view==="read"?comicReadingPath(path):path;
  let {data,error:signError}=await publicRead(signal=>serviceClient(readFetch(signal)).storage.from("comic-assets").createSignedUrl(object,60));
  if(view==="read"&&missingStorageObject(signError))({data,error:signError}=await publicRead(signal=>serviceClient(readFetch(signal)).storage.from("comic-assets").createSignedUrl(path,60)));
  if(signError||!data) return missingStorageObject(signError)?missing():unavailable();
  if(!published) return new Response(null,{status:307,headers:{Location:data.signedUrl,"Cache-Control":"private, no-store"}});
  // Published files are immutable (UUID paths), so serve the bytes through Vercel's CDN instead of a fresh uncacheable signed URL per view.
  const upstream=await fetch(data.signedUrl);
  if(!upstream.ok||!upstream.body) return unavailable();
  return new Response(upstream.body,{headers:{"Content-Type":upstream.headers.get("Content-Type")??"image/webp","Cache-Control":"public, max-age=604800, s-maxage=604800, immutable"}});
  }catch{return unavailable();}
}
