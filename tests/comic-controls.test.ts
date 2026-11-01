// @vitest-environment jsdom
import {act,createElement} from "react";
import {createRoot,type Root} from "react-dom/client";
import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {useComicControls} from "../src/components/useComicControls";
let root:Root,host:HTMLDivElement,controls:ReturnType<typeof useComicControls>;
function Probe({panel=false}:{panel?:boolean}){controls=useComicControls(panel);return null;}
beforeEach(()=>{vi.useFakeTimers();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});Object.defineProperty(document,"hidden",{configurable:true,value:false});sessionStorage.clear();host=document.createElement("div");document.body.append(host);root=createRoot(host);act(()=>root.render(createElement(Probe)));act(()=>controls.show());});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.useRealTimers();});
it("hides at 10 seconds and activity/focus never reveals hidden controls",()=>{
 act(()=>vi.advanceTimersByTime(9999));expect(controls.visible).toBe(true);act(()=>vi.advanceTimersByTime(1));expect(controls.visible).toBe(false);
 act(()=>{controls.activity();window.dispatchEvent(new Event("focus"));});expect(controls.visible).toBe(false);
 act(()=>controls.toggle());expect(controls.visible).toBe(true);act(()=>controls.toggle());expect(controls.visible).toBe(false);
});
it("restores hidden state on remount even if device storage fails",()=>{
 vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw Error("blocked");});vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw Error("blocked");});
 act(()=>controls.toggle());act(()=>root.unmount());root=createRoot(host);act(()=>root.render(createElement(Probe)));expect(controls.ready).toBe(true);expect(controls.visible).toBe(false);
});
it("pauses while a dialog is open without opening hidden chrome",()=>{
 act(()=>root.render(createElement(Probe,{panel:true})));act(()=>vi.advanceTimersByTime(30000));expect(controls.visible).toBe(true);
 act(()=>root.render(createElement(Probe,{panel:false})));act(()=>vi.advanceTimersByTime(10000));expect(controls.visible).toBe(false);
 act(()=>root.render(createElement(Probe,{panel:true})));act(()=>root.render(createElement(Probe,{panel:false})));expect(controls.visible).toBe(false);
});
it("does not grant a fresh timeout when returning from a background tab",()=>{
 act(()=>vi.advanceTimersByTime(5000));Object.defineProperty(document,"hidden",{configurable:true,value:true});act(()=>document.dispatchEvent(new Event("visibilitychange")));act(()=>vi.advanceTimersByTime(20000));
 Object.defineProperty(document,"hidden",{configurable:true,value:false});act(()=>document.dispatchEvent(new Event("visibilitychange")));expect(controls.visible).toBe(false);
});
