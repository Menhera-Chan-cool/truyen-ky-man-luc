import {it,expect,vi} from "vitest";
import {publicComic} from "../src/lib/comic-server";
import {publicRead,readFetch} from "../src/lib/public-read";
vi.mock("server-only",()=>({}));
const rpc=vi.hoisted(()=>vi.fn());
vi.mock("../src/lib/server",()=>({publicClient:()=>({rpc}),HttpError:class extends Error{constructor(message:string,public status:number){super(message);}}}));
it("retries a transient comic read without retrying a successful companion query",async()=>{
  let reads=0;
  rpc.mockImplementation((name:string)=>{
    const value=name==="get_public_comic"&&reads++===0?{data:null,error:{message:"temporary"},status:503}:{data:name==="get_public_comic"?{title:"published"}:[],error:null,status:200};
    const p=Promise.resolve(value);return Object.assign(p,{abortSignal:()=>p});
  });
  await expect(publicComic("chapter-1","vi")).resolves.toMatchObject({edition:{title:"published"},summaries:[]});
  expect(rpc.mock.calls.filter(c=>c[0]==="get_public_comic")).toHaveLength(2);
  expect(rpc.mock.calls.filter(c=>c[0]==="get_public_comic_index")).toHaveLength(1);
});
it("bounds a stalled transport to two aborted reads and does not retry authorization failures",async()=>{
 vi.useFakeTimers();
 try{
   const stalled=vi.fn((signal:AbortSignal)=>new Promise<{error:unknown}>((_,reject)=>signal.addEventListener("abort",()=>reject(new DOMException("Timeout","AbortError")))));
   const pending=expect(publicRead(stalled)).rejects.toThrow("Timeout");
   await vi.advanceTimersByTimeAsync(16200);await pending;expect(stalled).toHaveBeenCalledTimes(2);
   const denied=vi.fn().mockResolvedValue({error:{message:"Denied"},status:403});
   await expect(publicRead(denied)).resolves.toMatchObject({status:403});expect(denied).toHaveBeenCalledTimes(1);
 }finally{vi.useRealTimers();}
});
it("forwards the deadline and retains an existing fetch cancellation signal",async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response("ok"));vi.stubGlobal("fetch",fetcher);
 try{const deadline=new AbortController(),caller=new AbortController();await readFetch(deadline.signal)("https://book.test",{signal:caller.signal});const signal=fetcher.mock.calls[0][1].signal;deadline.abort();expect(signal.aborted).toBe(true);}finally{vi.unstubAllGlobals();}
});
