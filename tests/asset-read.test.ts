import {it,expect,vi,beforeEach} from "vitest";
import {GET} from "../app/api/assets/[...path]/route";
const m=vi.hoisted(()=>({guard:vi.fn(),rpc:vi.fn(),record:vi.fn(),sign:vi.fn()}));
vi.mock("../src/lib/server",()=>({configured:()=>true,requireEditor:m.guard,publicClient:()=>({rpc:m.rpc}),serviceClient:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:m.record})})}),storage:{from:()=>({createSignedUrl:m.sign})}})}));
const get=(name:string)=>GET(new Request("https://book.test/api/assets/"+name),{params:Promise.resolve({path:name.split("/")})});
beforeEach(()=>{m.guard.mockReset().mockRejectedValue({status:401});m.rpc.mockReset();m.record.mockReset();m.sign.mockReset().mockResolvedValue({data:{signedUrl:"https://storage.test/signed"},error:null});});
it("serves a published image through the CDN with immutable caching instead of a signed URL per view",async()=>{
 m.rpc.mockResolvedValue({data:true,error:null});m.record.mockResolvedValue({data:{content_type:"image/jpeg"},error:null});
 const fetcher=vi.fn().mockResolvedValue(new Response("jpeg-bytes"));vi.stubGlobal("fetch",fetcher);
 try{
  const response=await get("user/cover.jpg");expect(response.status).toBe(200);expect(await response.text()).toBe("jpeg-bytes");
  expect(response.headers.get("content-type")).toBe("image/jpeg");expect(response.headers.get("cache-control")).toBe("public, max-age=604800, s-maxage=604800, immutable");
  fetcher.mockResolvedValue(new Response("gone",{status:404}));expect((await get("user/cover.jpg")).status).toBe(503);
 }finally{vi.unstubAllGlobals();}
});
it("keeps unpublished files and published PDFs on a private signed redirect and hides unknown or unauthorized ones",async()=>{
 m.rpc.mockResolvedValue({data:false,error:null});expect((await get("user/draft.jpg")).status).toBe(404);
 m.guard.mockResolvedValue({client:{}});m.record.mockResolvedValue({data:{content_type:"image/jpeg"},error:null});
 const draft=await get("user/draft.jpg");expect(draft.status).toBe(307);expect(draft.headers.get("cache-control")).toContain("no-store");
 m.rpc.mockResolvedValue({data:true,error:null});m.record.mockResolvedValue({data:{content_type:"application/pdf"},error:null});
 const pdf=await get("user/book.pdf");expect(pdf.status).toBe(307);expect(pdf.headers.get("location")).toBe("https://storage.test/signed");
 m.record.mockResolvedValue({data:null,error:null});expect((await get("user/none.jpg")).status).toBe(404);
});
