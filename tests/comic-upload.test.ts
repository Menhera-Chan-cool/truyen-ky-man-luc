import {beforeEach,it,expect,vi} from "vitest";
import {saveSharedComic,publishSharedComic,readSharedComic} from "../src/lib/comic-remote";
import type {ComicDraft,ComicPage} from "../src/lib/comic";
const m=vi.hoisted(()=>({upload:vi.fn(),request:vi.fn(),checkpoints:new Map<string,unknown>()}));
vi.mock("../src/lib/supabase",()=>({browserClient:()=>({auth:{getUser:async()=>({data:{user:{id:"11111111-1111-4111-8111-111111111111"}},error:null})},storage:{from:()=>({upload:m.upload})}}),adminRequest:m.request}));
vi.mock("../src/lib/comic-recovery",()=>({readUploadCheckpoint:async(_s:unknown,p:ComicPage)=>m.checkpoints.get(p.id),writeUploadCheckpoint:async(_s:unknown,p:ComicPage,v:unknown)=>{m.checkpoints.set(p.id,v);}}));
const pages=Array.from({length:4},(_,n)=>({id:"p"+n,name:n+".png",width:1,height:1,bytes:8,hash:String(n).repeat(64),blob:new Blob([new Uint8Array([137,80,78,71,13,10,26,10])])}));
const draft:ComicDraft={id:"chapter-1",title:"One",revision:0,updatedAt:0,direction:"ltr",pages};
beforeEach(()=>{m.upload.mockReset();m.request.mockReset();m.checkpoints.clear();});
it("uses at most two uploads and commits page order after both workers finish",async()=>{
 let active=0,peak=0;
 m.upload.mockImplementation(async()=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,10));active--;return {error:null};});
 m.request.mockImplementation(async(name,body)=>name==="comic"?{draft:body.draft}:({path:"/api/comic/assets/"+body.path,...pages[Number(m.upload.mock.calls.findIndex(c=>c[0]===body.path))],blob:undefined}));
 const result=await saveSharedComic(draft,"vi",new Map(),()=>{});
 expect(peak).toBe(2);expect(result.draft?.pages.map(p=>p.id)).toEqual(pages.map(p=>p.id));expect(active).toBe(0);
});
it("reuses uploaded objects after a registration failure, even with a fresh memory cache",async()=>{
 m.upload.mockResolvedValue({error:null});let fail=true;
 m.request.mockImplementation(async(name,body)=>{if(name==="comic")return {draft:body.draft};if(fail)throw Error("registration unavailable");return {...pages[0],blob:undefined,path:"/api/comic/assets/"+body.path};});
 await expect(saveSharedComic({...draft,pages:[pages[0]]},"vi",new Map(),()=>{})).rejects.toThrow("registration unavailable");
 expect([...m.checkpoints.values()][0]).toMatchObject({phase:"uploaded"});fail=false;
 await saveSharedComic({...draft,pages:[pages[0]]},"vi",new Map(),()=>{});
 expect(m.upload).toHaveBeenCalledTimes(1);
});
it("waits for the other worker on error and never commits a partial draft",async()=>{
 let finished=false;
 m.upload.mockImplementation(async(path:string)=>{if(m.upload.mock.calls.length===1)throw Error("offline");await new Promise(r=>setTimeout(r,20));finished=true;return {error:null};});
 m.request.mockResolvedValue({...pages[1],blob:undefined,path:"/api/comic/assets/ok"});
 await expect(saveSharedComic(draft,"en",new Map(),()=>{})).rejects.toThrow("offline");
 expect(finished).toBe(true);expect(m.upload).toHaveBeenCalledTimes(2);expect(m.request.mock.calls.some(c=>c[0]==="comic")).toBe(false);
});
it("rechecks an upload whose response was lost, but never saves a mismatched image",async()=>{
 const path="11111111-1111-4111-8111-111111111111/comics/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png";
 m.checkpoints.set(pages[0].id,{path,hash:pages[0].hash,phase:"uploading"});
 m.upload.mockResolvedValue({error:{statusCode:"409",message:"Duplicate"}});
 m.request.mockImplementation(async(name,body)=>name==="comic"?{draft:body.draft}:{...pages[0],blob:undefined,path:"/api/comic/assets/"+path});
 await saveSharedComic({...draft,pages:[pages[0]]},"vi",new Map(),()=>{});
 expect(m.upload).not.toHaveBeenCalled();expect(m.request.mock.calls[0][1]).toEqual({path});
 m.request.mockReset().mockResolvedValue({...pages[0],blob:undefined,hash:"f".repeat(64),path:"/api/comic/assets/"+path});m.checkpoints.set(pages[0].id,{path,hash:pages[0].hash,phase:"uploaded"});
 await expect(saveSharedComic({...draft,pages:[pages[0]]},"vi",new Map(),()=>{})).rejects.toThrow("does not match");
 expect(m.request.mock.calls.some(c=>c[0]==="comic")).toBe(false);
});

it("reconciles a save committed before its response was lost without retrying the write",async()=>{
 const page={...pages[0],blob:undefined,path:"/api/comic/assets/test"},saved={...draft,pages:[page],revision:1};
 m.request.mockImplementation(async(_name,body)=>{if(body)throw new TypeError("Failed to fetch");return {draft:saved,revision:1,publishedRevision:null};});
 expect((await saveSharedComic({...draft,pages:[page]},"vi",new Map(),()=>{})).revision).toBe(1);expect(m.request.mock.calls.filter(c=>c[1]).length).toBe(1);
});
it("confirms lost publication responses using the published revision, never retries publishing",async()=>{
 let committed=false;m.request.mockImplementation(async(_name,body)=>{if(body){committed=true;throw new TypeError("Failed to fetch");}return {draft:null,draftRevision:4,revision:committed?5:4,publishedRevision:committed?4:3};});
 expect((await publishSharedComic("chapter-1","en",4)).publishedRevision).toBe(4);expect(m.request.mock.calls.filter(c=>c[1]).length).toBe(1);
});
it("ends a hung draft read with a useful timeout",async()=>{
 vi.useFakeTimers();m.request.mockImplementation(()=>new Promise(()=>{}));
 const pending=expect(readSharedComic("chapter-1","vi")).rejects.toThrow(/timed out|hết thời gian/i);await vi.advanceTimersByTimeAsync(16000);await pending;vi.useRealTimers();
});

it("keeps checkpoints and ends an upload that never responds",async()=>{
 vi.useFakeTimers();try{m.upload.mockImplementation(()=>new Promise(()=>{}));const pending=expect(saveSharedComic({...draft,pages:[pages[0]]},"vi",new Map(),()=>{})).rejects.toThrow(/timed out/);await vi.advanceTimersByTimeAsync(121000);await pending;expect(m.request).not.toHaveBeenCalled();expect([...m.checkpoints.values()][0]).toMatchObject({phase:"uploading"});}finally{vi.useRealTimers();}
});
it("retains an uncertain write when the head differs instead of claiming it saved",async()=>{
 let committed=false;m.request.mockImplementation(async(_name,body)=>{if(body){committed=true;throw new TypeError("Failed to fetch");}return {draft:null,draftRevision:4,revision:committed?8:4,publishedRevision:committed?8:3};});
 await expect(publishSharedComic("chapter-1","vi",4)).rejects.toThrow(/outcome unknown/);expect(m.request.mock.calls.filter(c=>c[1]).length).toBe(1);
});

it("confirms a publication whose JSON response was truncated",async()=>{
 let committed=false;m.request.mockImplementation(async(_name,body)=>{if(body){committed=true;throw new SyntaxError("Unexpected end of JSON input");}return {draft:null,draftRevision:4,revision:committed?5:4,publishedRevision:committed?4:3};});
 expect((await publishSharedComic("chapter-1","vi",4)).publishedRevision).toBe(4);expect(m.request.mock.calls.filter(c=>c[1]).length).toBe(1);
});
