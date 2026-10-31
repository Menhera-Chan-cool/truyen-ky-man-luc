import {it,expect,vi} from "vitest";
import {GET} from "../app/api/comic/route";
const rpc=vi.hoisted(()=>vi.fn());
vi.mock("../src/lib/server",()=>({configured:()=>true,publicClient:()=>({rpc})}));
it("returns only a modest public first image and never draft metadata",async()=>{
 rpc.mockResolvedValue({data:{id:"chapter-1",title:"Public",revision:2,pages:[{path:"/api/comic/assets/public.png",bytes:2000},{path:"private",bytes:99}]},error:null});
 const response=await GET(new Request("https://book.test/api/comic?chapter=chapter-1&locale=en"));
 expect(await response.json()).toEqual({firstPage:{path:"/api/comic/assets/public.png",bytes:2000}});
 expect(rpc).toHaveBeenCalledWith("get_public_comic",{p_id:"chapter-1",p_locale:"en"});expect(response.headers.get("cache-control")).toBe("no-store");
 rpc.mockResolvedValue({data:null,error:null});expect(await (await GET(new Request("https://book.test/api/comic?chapter=chapter-1&locale=vi"))).json()).toEqual({firstPage:null});
});
it("rejects invalid context before a query",async()=>{
 rpc.mockClear();expect((await GET(new Request("https://book.test/api/comic?chapter=../source&locale=fr"))).status).toBe(400);expect(rpc).not.toHaveBeenCalled();
});
