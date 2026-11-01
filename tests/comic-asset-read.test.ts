import {it,expect,vi,beforeEach} from "vitest";
import {GET} from "../app/api/comic/assets/[...path]/route";
const m=vi.hoisted(()=>({rpc:vi.fn(),sign:vi.fn(),guard:vi.fn(),lookup:vi.fn()}));
vi.mock("../src/lib/server",()=>({configured:()=>true,publicClient:()=>({rpc:m.rpc}),requireEditor:m.guard,serviceClient:()=>({storage:{from:()=>({createSignedUrl:m.sign})},from:()=>({select:()=>({eq:()=>({maybeSingle:m.lookup})})})})}));
const path="11111111-1111-4111-8111-111111111111/comics/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png";
const get=(query="")=>GET(new Request("https://book.test/api/comic/assets/"+path+query),{params:Promise.resolve({path:path.split("/")})});
beforeEach(()=>{m.rpc.mockReset().mockResolvedValue({data:true,error:null});m.sign.mockReset();m.guard.mockReset();m.lookup.mockReset();});
it("returns 503 for transient signing errors, never a false missing-image 404",async()=>{
 m.sign.mockResolvedValue({data:null,error:{status:503,message:"unavailable"}});
 expect((await get()).status).toBe(503);expect(m.sign).toHaveBeenCalledTimes(2);
});
it("does not retry a genuinely missing object",async()=>{
 m.sign.mockResolvedValue({data:null,error:{statusCode:"404",message:"Object not found"}});
 expect((await get()).status).toBe(404);expect(m.sign).toHaveBeenCalledTimes(1);
});
it("authorizes the original before signing its deterministic private thumbnail",async()=>{
 m.sign.mockResolvedValue({data:{signedUrl:"https://storage.test/signed"},error:null});
 expect((await get("?view=thumb")).status).toBe(307);
 expect(m.rpc).toHaveBeenCalledWith("can_read_comic_asset",{p_path:path});
 expect(m.sign).toHaveBeenCalledWith(path.replace(".png","-thumb.webp"),60);
 m.rpc.mockResolvedValue({data:false,error:null});m.guard.mockRejectedValue({status:401});m.sign.mockClear();
 expect((await get("?view=thumb")).status).toBe(404);expect(m.sign).not.toHaveBeenCalled();
});
it("preserves infrastructure failures during private authorization",async()=>{
 m.rpc.mockResolvedValue({data:false,error:null});m.guard.mockRejectedValue({status:503});
 expect((await get()).status).toBe(503);
});

it("uses a private reading variant but falls back only when it is genuinely absent",async()=>{
 m.sign.mockResolvedValueOnce({data:null,error:{statusCode:404,message:"Object not found"}}).mockResolvedValueOnce({data:{signedUrl:"https://storage.test/original"},error:null});
 const result=await get("?view=read");expect(result.status).toBe(307);expect(result.headers.get("Location")).toContain("original");expect(m.sign.mock.calls.map(c=>c[0])).toEqual([path.replace(".png","-read-v1.webp"),path]);
 m.sign.mockReset().mockResolvedValue({data:null,error:{status:503}});expect((await get("?view=read")).status).toBe(503);expect(m.sign.mock.calls.every(c=>c[0].endsWith("-read-v1.webp"))).toBe(true);
 m.rpc.mockResolvedValue({data:false,error:null});m.guard.mockRejectedValue({status:401});m.sign.mockClear();expect((await get("?view=read")).status).toBe(404);expect(m.sign).not.toHaveBeenCalled();
});
