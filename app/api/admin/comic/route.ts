import {requireEditor,apiError,jsonBody,HttpError} from "../../../../src/lib/server";
import {comicHead} from "../../../../src/lib/comic-server";
import {publicationDraft} from "../../../../src/lib/comic-publication";
import {isLocale} from "../../../../src/lib/types";
const validId=(v:unknown): v is string=>typeof v==="string"&&/^[a-z0-9-]{1,80}$/.test(v);
export async function GET(request:Request) {
  try {
    const {client}=await requireEditor(request), params=new URL(request.url).searchParams,id=params.get("chapter"),locale=params.get("locale");
    if(!validId(id)||!locale||!isLocale(locale)) throw new HttpError("Select a valid chapter and VI/EN edition");
    return Response.json(await comicHead(client,id,locale),{headers:{"Cache-Control":"no-store"}});
  }catch(e){return apiError(e);}
}
export async function POST(request:Request) {
  try {
    const {client}=await requireEditor(request),body=await jsonBody(request);
    if(typeof body.locale!=="string"||!isLocale(body.locale))throw new HttpError("Select VI/EN before saving. Reload the editor.");
    if(body.action==="save") {
      const draft=publicationDraft(body.draft);
      const {error}=await client.rpc("save_comic",{p_id:draft.id,p_title:draft.title,p_direction:draft.direction,p_pages:draft.pages,p_expected_revision:draft.revision,p_locale:body.locale});
      if(error) throw Error(error.message);
      return Response.json(await comicHead(client,draft.id,body.locale),{headers:{"Cache-Control":"no-store"}});
    }
    if(!["publish","withdraw"].includes(body.action)||!validId(body.id)||!Number.isSafeInteger(body.revision)||body.revision<0) throw new HttpError("Invalid publication");
    const {error}=await client.rpc("publish_comic",{p_id:body.id,p_expected_revision:body.revision,p_withdraw:body.action==="withdraw",p_locale:body.locale});
    if(error) throw Error(error.message);
    return Response.json(await comicHead(client,body.id,body.locale),{headers:{"Cache-Control":"no-store"}});
  }catch(e){return apiError(e);}
}
