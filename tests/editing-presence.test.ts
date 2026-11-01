// @vitest-environment jsdom
import * as React from "react";
import {act,createElement} from "react";
import {createRoot} from "react-dom/client";
import {it,expect,vi,afterEach} from "vitest";
import {EditingPresence} from "../src/components/AdminTools";
const m=vi.hoisted(()=>({request:vi.fn()}));vi.mock("../src/lib/supabase",()=>({adminRequest:m.request}));
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it("does not start requests during unmount or after a stale heartbeat completes",async()=>{
 vi.stubGlobal("React",React);Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.spyOn(document,"hasFocus").mockReturnValue(true);
 let finish!:(value:unknown)=>void;m.request.mockReset().mockImplementation((path,body)=>body?new Promise(resolve=>{finish=resolve;}):Promise.resolve([]));
 const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
 await act(async()=>{root.render(createElement(EditingPresence,{locale:"vi",editionLocale:"vi",chapterId:"chapter-1",userId:"one"}));});expect(m.request).toHaveBeenCalledTimes(1);
 await act(async()=>{root.unmount();finish({ok:true});});host.remove();expect(m.request).toHaveBeenCalledTimes(1);
});
