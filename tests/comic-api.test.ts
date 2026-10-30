import {beforeEach,it,expect,vi} from "vitest";
import {publicationDraft,comicAssetPath} from "../src/lib/comic-publication";
import {GET,POST} from "../app/api/admin/comic/route";
import {POST as register} from "../app/api/admin/comic/assets/route";
import {comicHead} from "../src/lib/comic-server";
const guard=vi.hoisted(()=>vi.fn());
vi.mock("../src/lib/comic-server",()=>({comicHead:vi.fn()}));
vi.mock("../src/lib/server",()=>({requireEditor:guard,jsonBody:async(r:Request)=>JSON.parse(await r.text()),serviceClient:vi.fn(),HttpError:class extends Error{},apiError:(e:unknown)=>Response.json({error:(e as Error).message},{status:403})}));
beforeEach(()=>{guard.mockReset().mockRejectedValue(Error("Forbidden"));});
it("checks membership before parsing input or registering uploaded images",async()=>{
  for(const handler of [POST,register]) {
    const r=await handler(new Request("https://book.test/api/admin/comic",{method:"POST",body:"not json"}));
    expect(r.status).toBe(403);expect(await r.json()).toEqual({error:"Forbidden"});
  }
  expect((await GET(new Request("https://book.test/api/admin/comic?chapter=chapter-1"))).status).toBe(403);
  expect(guard).toHaveBeenCalledTimes(3);
});
it("accepts only registered canonical page URLs and strips extra payload fields",()=>{
  const path="11111111-1111-4111-8111-111111111111/comics/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png";
  expect(comicAssetPath(path)).toBe(true);expect(comicAssetPath("../"+path)).toBe(false);
  const d={id:"chapter-1",title:" One ",direction:"ltr" as const,revision:0,updatedAt:0,pages:[{id:"p1",name:"one.png",path:"/api/comic/assets/"+path,width:1,height:2,bytes:8,hash:"a".repeat(64),unexpected:"<script>"}]};
  const clean=publicationDraft(d);expect(clean.title).toBe("One");expect(clean.pages[0]).not.toHaveProperty("unexpected");
  expect(()=>publicationDraft({...d,revision:-1})).toThrow(/revision/);
  expect(()=>publicationDraft({...d,pages:[{...d.pages[0],path:"https://evil.test/a.png"}]})).toThrow();
  expect(()=>publicationDraft({...d,pages:[{...d.pages[0],blob:new Blob(["bad"])}]})).toThrow(/Upload/);
});
it("requires an explicit write locale and passes the chosen locale to protected RPCs",async()=>{
  const rpc=vi.fn().mockResolvedValue({error:null}),client={rpc};guard.mockResolvedValue({client});
  vi.mocked(comicHead).mockResolvedValue({draft:null,revision:1,publishedRevision:null});
  const request=(body:unknown)=>new Request("https://book.test/api/admin/comic",{method:"POST",body:JSON.stringify(body)});
  const missing=await POST(request({action:"publish",id:"chapter-1",revision:0}));
  expect((await missing.json()).error).toContain("Select VI/EN");expect(rpc).not.toHaveBeenCalled();
  await POST(request({action:"publish",id:"chapter-1",revision:0,locale:"en"}));
  expect(rpc).toHaveBeenCalledWith("publish_comic",{p_id:"chapter-1",p_expected_revision:0,p_withdraw:false,p_locale:"en"});
  expect(comicHead).toHaveBeenCalledWith(client,"chapter-1","en");
});
