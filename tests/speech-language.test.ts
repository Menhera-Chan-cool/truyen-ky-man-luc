// @vitest-environment jsdom
import React,{act,useRef} from "react";
import {createRoot,type Root} from "react-dom/client";
import {beforeEach,afterEach,it,expect,vi} from "vitest";
import {useSpeech} from "../src/components/useSpeech";
let root:Root,host:HTMLElement,api:ReturnType<typeof useSpeech>,voices:any[],spoken:any[],locale:"vi"|"en",voiceName:string;
const error=vi.fn(),complete=vi.fn();
function Harness(){const ref=useRef<HTMLElement|null>(null);api=useSpeech(ref,locale,1,voiceName,error,()=>{},true,undefined,{onComplete:complete});return React.createElement("article",{ref},React.createElement("p",null,"Xin chào. Nguyễn Dữ."));}
beforeEach(async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});voices=[];spoken=[];locale="vi";voiceName="";error.mockReset();complete.mockReset();
 Object.defineProperty(window,"SpeechSynthesisUtterance",{configurable:true,value:class{constructor(public text:string){}}});
 Object.defineProperty(window,"speechSynthesis",{configurable:true,value:Object.assign(new EventTarget(),{getVoices:()=>voices,cancel(){},speak(u:any){spoken.push(u);u.onstart?.({});},paused:false,resume(){}})});
 host=document.createElement("div");document.body.append(host);root=createRoot(host);await act(async()=>root.render(React.createElement(Harness)));
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it.each([{list:[]},{list:[{name:"English default",lang:"en-US",default:true}]}])("never sends Vietnamese to an unlisted/default English voice (%j)",async({list})=>{
 voices=list;await act(async()=>api.speak());expect(spoken).toHaveLength(0);expect(api.playing).toBe(false);expect(error).toHaveBeenCalledWith(expect.stringMatching(/tiếng Việt/));expect(complete).not.toHaveBeenCalled();
});
it("selects a real late-loaded Vietnamese voice and ignores a saved English choice",async()=>{
 voices=[{name:"English default",lang:"en-US",default:true},{name:"Google Việt",lang:"vi_VN",voiceURI:"vi"}];voiceName="English default";
 await act(async()=>{root.render(React.createElement(Harness));speechSynthesis.dispatchEvent(new Event("voiceschanged"));});await act(async()=>api.speak());expect(spoken[0].voice).toBe(voices[1]);expect(spoken[0].lang).toBe("vi-VN");
});
it("checks language again on resume if the Vietnamese voice disappears",async()=>{
 voices=[{name:"Google Việt",lang:"vi-VN"}];await act(async()=>api.speak());await act(async()=>api.pause());voices=[{name:"English default",lang:"en-US"}];await act(async()=>api.resume());expect(spoken).toHaveLength(1);expect(api.playing).toBe(false);expect(complete).not.toHaveBeenCalled();
});
it("does not accept a similarly prefixed invalid language tag",async()=>{
 voices=[{name:"Bad tag",lang:"vietnamese"}];await act(async()=>api.speak());expect(spoken).toHaveLength(0);
});
it("uses the selected English region and stops the old language on switching",async()=>{
 voices=[{name:"Việt",lang:"vi-VN"},{name:"British",lang:"en-GB"}];await act(async()=>api.speak());locale="en";voiceName="British";await act(async()=>root.render(React.createElement(Harness)));expect(api.playing).toBe(false);await act(async()=>api.speak());expect(spoken.at(-1).voice).toBe(voices[1]);expect(spoken.at(-1).lang).toBe("en-GB");
});
