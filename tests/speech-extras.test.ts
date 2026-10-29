// @vitest-environment jsdom
import React,{act,useRef} from 'react';import {createRoot} from 'react-dom/client';import {it,expect,vi} from 'vitest';
import {useSpeech} from '../src/components/useSpeech';
it('pronunciation changes preserve source boundaries/resume and completion only follows full text',async()=>{
 (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;const utterances:any[]=[];
 Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{constructor(public text:string){}}});
 Object.defineProperty(window,'speechSynthesis',{configurable:true,value:Object.assign(new EventTarget(),{getVoices:()=>[],cancel(){},speak(u:any){utterances.push(u);u.onstart?.({});},paused:false,resume(){}})});
 let api!:ReturnType<typeof useSpeech>;const checkpoint=vi.fn(),complete=vi.fn(),rules=[{from:'Nguyễn Dữ',to:'nguyễn dữ tác giả'}],text='Tôi gặp Nguyễn Dữ rồi.';
 function Harness(){const ref=useRef<HTMLElement|null>(null);api=useSpeech(ref,'vi',1,'',vi.fn(),vi.fn(),true,checkpoint,{pronunciations:rules,onComplete:complete});return React.createElement('article',{ref},React.createElement('p',null,text));}
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);await act(async()=>root.render(React.createElement(Harness)));
 await act(async()=>api.speak());expect(utterances[0].text).toContain('tác giả');
 await act(async()=>utterances[0].onboundary({charIndex:utterances[0].text.indexOf('rồi')}));
 expect(checkpoint).toHaveBeenLastCalledWith(text.indexOf('rồi'),false,false);
 await act(async()=>api.pause());await act(async()=>api.resume());expect(utterances.at(-1).text).toMatch(/^rồi/);
 await act(async()=>{utterances.at(-1).onend();await new Promise(r=>setTimeout(r,5));});expect(complete).toHaveBeenCalledTimes(1);
 await act(async()=>api.speak('Nguyễn Dữ',text.indexOf('Nguyễn')));await act(async()=>{utterances.at(-1).onend();await new Promise(r=>setTimeout(r,5));});expect(complete).toHaveBeenCalledTimes(1);
 expect(host.textContent).toBe(text);await act(async()=>root.unmount());host.remove();
});
