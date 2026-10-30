import {configured,publicClient,requireEditor,serviceClient} from "../../../../../src/lib/server";
import {comicAssetPath} from "../../../../../src/lib/comic-publication";
export async function GET(request:Request,{params}:{params:Promise<{path:string[]}>}) {
  const path=(await params).path.join("/");
  if(!configured()||!comicAssetPath(path)) return new Response("Not found",{status:404});
  const {data:published,error}=await publicClient().rpc("can_read_comic_asset",{p_path:path});
  if(error) return new Response("Unavailable",{status:503});
  if(!published) {
    try {await requireEditor(request);}catch{return new Response("Not found",{status:404});}
    const {data:registered}=await serviceClient().from("comic_assets").select("path").eq("path",path).maybeSingle();
    if(!registered) return new Response("Not found",{status:404});
  }
  const {data,error:signError}=await serviceClient().storage.from("comic-assets").createSignedUrl(path,60);
  if(signError||!data) return new Response("Not found",{status:404});
  return new Response(null,{status:307,headers:{Location:data.signedUrl,"Cache-Control":"private, no-store"}});
}
