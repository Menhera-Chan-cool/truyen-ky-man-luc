import {requireEditor,apiError,jsonBody,HttpError} from "../../../../src/lib/server";
import {comicHead} from "../../../../src/lib/comic-server";
import {publicationDraft} from "../../../../src/lib/comic-publication";
const validId=(v:unknown): v is string=>typeof v==="string"&&/^[a-z0-9-]{1,80}$/.test(v);
export async function GET(request:Request) {
  try {
    const {client}=await requireEditor(request), id=new URL(request.url).searchParams.get("chapter");
    if(!validId(id)) throw new HttpError("Invalid chapter");
    return Response.json(await comicHead(client,id),{headers:{"Cache-Control":"no-store"}});
  }catch(e){return apiError(e);}
}
export async function POST(request:Request) {
  try {
    const {client}=await requireEditor(request),body=await jsonBody(request);
    if(body.action==="save") {
      const draft=publicationDraft(body.draft);
      const {error}=await client.rpc("save_comic",{p_id:draft.id,p_title:draft.title,p_direction:draft.direction,p_pages:draft.pages,p_expected_revision:draft.revision});
      if(error) throw Error(error.message);
      return Response.json(await comicHead(client,draft.id),{headers:{"Cache-Control":"no-store"}});
    }
    if(!["publish","withdraw"].includes(body.action)||!validId(body.id)||!Number.isSafeInteger(body.revision)||body.revision<0) throw new HttpError("Invalid publication");
    const {error}=await client.rpc("publish_comic",{p_id:body.id,p_expected_revision:body.revision,p_withdraw:body.action==="withdraw"});
    if(error) throw Error(error.message);
    return Response.json(await comicHead(client,body.id),{headers:{"Cache-Control":"no-store"}});
  }catch(e){return apiError(e);}
}
