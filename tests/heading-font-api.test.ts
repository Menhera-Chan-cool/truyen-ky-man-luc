import {it,expect,vi,beforeEach} from "vitest";
import {GET,POST} from "../app/api/admin/heading-fonts/route";
import {GET as fontFile} from "../app/api/heading-fonts/[fontId]/route";
import {POST as saveBook} from "../app/api/admin/book/route";
const m=vi.hoisted(()=>({guard:vi.fn(),rpc:vi.fn(),sign:vi.fn(),record:vi.fn(),exists:vi.fn()}));
vi.mock("../src/lib/server",()=>({configured:()=>true,requireEditor:m.guard,publicClient:()=>({rpc:m.rpc}),serviceClient:()=>({from:()=>({select:()=>({eq:()=>({maybeSingle:m.record})})}),storage:{from:()=>({createSignedUrl:m.sign,exists:m.exists})}}),jsonBody:async(r:Request)=>r.json(),HttpError:class extends Error{constructor(message:string,public status=400){super(message);}},apiError:(e:any)=>Response.json({error:e.message},{status:e.status??500})}));
const id="22222222-2222-4222-8222-222222222222",request=(body:unknown)=>new Request("https://book.test/api/admin/heading-fonts",{method:"POST",body:JSON.stringify(body)});
beforeEach(()=>{m.guard.mockReset().mockRejectedValue({status:401,message:"Sign in"});m.rpc.mockReset();m.sign.mockReset();m.record.mockReset();});
it("checks membership before reading input or listing/uploading/removing shared fonts",async()=>{
 expect((await GET(new Request("https://book.test/api/admin/heading-fonts"))).status).toBe(401);
 expect((await POST(new Request("https://book.test/api/admin/heading-fonts",{method:"POST",body:"invalid JSON"}))).status).toBe(401);
 expect((await saveBook(request({}))).status).toBe(401);
});
it("rejects arbitrary heading font CSS or URLs before saving metadata",async()=>{
 const rpc=vi.fn();m.guard.mockResolvedValue({client:{rpc}});
 const meta={vi:{title:"VI",summary:"",frontCover:"/book/cover.jpg",headingFont:"url(https://evil)"},en:{title:"EN",summary:"",frontCover:"/book/cover.jpg"}};
 expect((await saveBook(request({meta,expectedRevision:0}))).status).toBe(400);expect(rpc).not.toHaveBeenCalled();
});
it("keeps fonts private unless published, and signs only a registered immutable path",async()=>{
 const get=()=>fontFile(new Request("https://book.test/api/heading-fonts/"+id),{params:Promise.resolve({fontId:id})});
 m.rpc.mockResolvedValue({data:false,error:null});expect((await get()).status).toBe(404);expect(m.sign).not.toHaveBeenCalled();
 m.rpc.mockResolvedValue({data:true,error:null});m.record.mockResolvedValue({data:{path:id+"/"+id+".ttf"},error:null});m.sign.mockResolvedValue({data:{signedUrl:"https://storage.test/signed"},error:null});
 const response=await get();expect(response.status).toBe(307);expect(response.headers.get("cache-control")).toContain("no-store");expect(m.sign).toHaveBeenCalledWith(id+"/"+id+".ttf",60);
});
it("uses revision-safe archive RPC and reports fonts still in use",async()=>{
 const rpc=vi.fn().mockResolvedValue({error:{message:"Font is in use"}});m.guard.mockResolvedValue({client:{rpc}});
 expect((await POST(request({action:"remove",id}))).status).toBe(409);expect(rpc).toHaveBeenCalledWith("archive_heading_font",{p_id:id});
});
it("keeps publication unchanged when a registered font file has disappeared",async()=>{
 const rpc=vi.fn().mockResolvedValue({data:4,error:null}),client={rpc,from:()=>({select:()=>({in:()=>({eq:async()=>({data:[{id,path:id+"/"+id+".ttf"}],error:null})})})})};m.guard.mockResolvedValue({client});m.exists.mockResolvedValue({data:false,error:null});
 const meta={vi:{title:"VI",summary:"",frontCover:"/book/cover.jpg",headingFont:id},en:{title:"EN",summary:"",frontCover:"/book/cover.jpg"}};
 expect((await saveBook(request({meta,expectedRevision:3,publish:true}))).status).toBe(400);expect(rpc).not.toHaveBeenCalled();
 m.exists.mockResolvedValue({data:true,error:null});expect((await saveBook(request({meta,expectedRevision:3,publish:true}))).status).toBe(200);expect(rpc).toHaveBeenCalledTimes(1);
});
