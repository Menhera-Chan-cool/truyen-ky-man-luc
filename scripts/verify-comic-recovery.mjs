import {build} from "esbuild";
import {chromium,webkit} from "@playwright/test";
import assert from "node:assert/strict";
const bundle=await build({stdin:{contents:`export * from "./src/lib/comic-recovery";
import {createElement} from "react";import {createRoot} from "react-dom/client";import {useComicUrls} from "./src/lib/comic-db";
export async function emptyUrls(){let renders=0;const element=document.createElement("div");document.body.append(element);const root=createRoot(element);function Probe(){useComicUrls([]);renders++;return null;}root.render(createElement(Probe));await new Promise(r=>setTimeout(r,250));root.unmount();element.remove();return renders;}
`,resolveDir:process.cwd()},bundle:true,write:false,format:"iife",globalName:"Recovery",platform:"browser",define:{"process.env.NODE_ENV":'"production"'}});
for(const engine of [chromium,webkit]){
 const browser=await engine.launch();
 try{
  const page=await browser.newPage();await page.route("http://recovery.test/**",r=>r.fulfill({body:"<!doctype html><html><body>Recovery check</body></html>",contentType:"text/html"}));
  await page.goto("http://recovery.test");await page.addScriptTag({content:bundle.outputFiles[0].text});
  assert.ok(await page.evaluate(()=>window.Recovery.emptyUrls())<10,"An empty chapter must not cause a render loop");
  const result=await page.evaluate(async()=>{
   const r=window.Recovery,s={accountId:"11111111-1111-4111-8111-111111111111",chapterId:"chapter-1",locale:"vi"},en={...s,locale:"en"};
   const b=new Uint8Array([137,80,78,71,13,10,26,10]),p={id:"p1",name:"one.png",width:1,height:1,bytes:8,hash:"a".repeat(64),blob:new Blob([b],{type:"image/png"})},d={id:"chapter-1",title:"Recovered VI",revision:3,direction:"ltr",updatedAt:0,pages:[p]};
   await r.writeRecovery(s,"tab-a",1,d);await r.writeRecovery(s,"tab-a",3,{...d,title:"Newer"});
   await r.writeRecovery(s,"tab-a",2,{...d,title:"Late stale write"});
   const key=r.recoveryKey(s,"tab-a"),restored=await r.readRecovery(s,key),images=new Uint8Array(await restored.pages[0].blob.arrayBuffer());
   const isolated=(await r.listRecoveries(en)).length===0&&(await r.listRecoveries({...s,accountId:"22222222-2222-4222-8222-222222222222"})).length===0;
   let denied=false;try{await r.readRecovery(en,key);}catch{denied=true;}
   await r.writeRecovery(s,"tab-b",1,{...d,title:"Other tab"});
   const staleDiscard=await r.discardRecovery(s,key,2,2);
   await r.discardRecovery(s,key,4);await r.writeRecovery(s,"tab-a",3,d);
   const candidates=await r.listRecoveries(s),other=await r.readRecovery(s,r.recoveryKey(s,"tab-b"));
   await r.writeUploadCheckpoint(s,p,{path:s.accountId+"/comics/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png",hash:p.hash,phase:"uploaded"});
   const checkpoint=await r.readUploadCheckpoint(s,p),otherCheckpoint=await r.readUploadCheckpoint(en,p);
   await r.writeRecovery(en,"blank-title",1,{...d,title:""});const blankTitle=(await r.readRecovery(en,r.recoveryKey(en,"blank-title"))).title;
   return {title:restored.title,bytes:[...images],revision:restored.revision,isolated,denied,staleDiscard,candidates:candidates.map(c=>c.title),otherBytes:other.pages[0].blob.size,checkpoint:checkpoint?.phase,otherCheckpoint,blankTitle};
  });
  assert.deepEqual(result,{title:"Newer",bytes:[137,80,78,71,13,10,26,10],revision:3,isolated:true,denied:true,staleDiscard:false,candidates:["Other tab"],otherBytes:8,checkpoint:"uploaded",otherCheckpoint:undefined,blankTitle:""});
  console.log(engine.name()+": real IndexedDB recovery, image roundtrip, account/locale isolation, stale writes, discard tombstone, independent tabs and upload checkpoint passed");
 }finally{await browser.close();}
}
