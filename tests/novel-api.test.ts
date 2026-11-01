import {beforeEach,it,expect,vi} from "vitest";
import {POST as chapter} from "../app/api/admin/chapters/route";
import {POST as book} from "../app/api/admin/book/route";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("../src/lib/server",()=>({requireEditor:async()=>({client:{rpc:m.rpc}}),serviceClient:vi.fn(),jsonBody:(r:Request)=>r.json(),HttpError:class extends Error{constructor(message:string,public status=400){super(message);}},apiError:(e:any)=>Response.json({error:e.message},{status:e.status??(/conflict/i.test(e.message)?409:400)})}));
beforeEach(()=>{m.rpc.mockReset();});
const req=(body:unknown)=>new Request("https://book.test/api/admin/chapters",{method:"POST",body:JSON.stringify(body)});
it("keeps lost database responses distinct from invalid chapter input",async()=>{
 m.rpc.mockResolvedValue({data:null,error:{message:"Network unavailable"},status:0});expect((await chapter(req({id:"chapter-1",locale:"vi",title:"QA",html:"<p>QA</p>",kind:"text",expectedRevision:0}))).status).toBe(503);
});
it("reports uncertain metadata writes as 503 so the client can confirm the head",async()=>{
 m.rpc.mockResolvedValue({data:null,error:{message:"Network unavailable"},status:503});const meta={vi:{title:"VI",summary:"",frontCover:"/book/cover.jpg"},en:{title:"EN",summary:"",frontCover:"/book/cover.jpg"}};expect((await book(req({meta,expectedRevision:0,publish:false}))).status).toBe(503);
});
