import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {adminRequest} from "../src/lib/supabase";
const m=vi.hoisted(()=>({session:vi.fn(),fetch:vi.fn()}));
vi.mock("@supabase/ssr",()=>({createBrowserClient:()=>({auth:{getSession:m.session}})}));
beforeEach(()=>{vi.useFakeTimers();vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://book.test");vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY","public");m.session.mockReset().mockResolvedValue({data:{session:{access_token:"test"}}});m.fetch.mockReset();vi.stubGlobal("fetch",m.fetch);});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();});
it.each(["auth","fetch","body"])("ends a hung %s without sending a late write",async phase=>{
 if(phase==="auth")m.session.mockImplementation(()=>new Promise(()=>{}));
 else if(phase==="fetch")m.fetch.mockImplementation(()=>new Promise(()=>{}));
 else m.fetch.mockResolvedValue({ok:true,json:()=>new Promise(()=>{})});
 const pending=expect(adminRequest("chapters",{id:"one"})).rejects.toThrow(/timed out|hết thời gian/i);await vi.advanceTimersByTimeAsync(16000);await pending;if(phase==="auth")expect(m.fetch).not.toHaveBeenCalled();
});
it("honors caller cancellation even during auth lookup",async()=>{
 m.session.mockImplementation(()=>new Promise(()=>{}));const c=new AbortController();const pending=expect(adminRequest("state",undefined,"GET",c.signal)).rejects.toThrow();c.abort();await pending;expect(m.fetch).not.toHaveBeenCalled();
});

it("does not send a write if auth resolves after timeout",async()=>{
 let finish!:(value:unknown)=>void;m.session.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const result=expect(adminRequest("chapters",{})).rejects.toThrow(/timed out/);await vi.advanceTimersByTimeAsync(16000);await result;finish({data:{session:{access_token:"test"}}});await vi.advanceTimersByTimeAsync(1);expect(m.fetch).not.toHaveBeenCalled();
});

it("keeps only tiny presence requests alive across document navigation",async()=>{
 m.fetch.mockResolvedValue({ok:true,json:async()=>({ok:true})});await adminRequest("presence",{lease:"one",leave:false});expect(m.fetch.mock.calls[0][1]).toMatchObject({keepalive:true});expect(m.fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
 await adminRequest("chapters",{});expect(m.fetch.mock.calls[1][1].keepalive).not.toBe(true);
});
