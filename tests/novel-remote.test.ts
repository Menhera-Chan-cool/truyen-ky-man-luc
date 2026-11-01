import {beforeEach,it,expect,vi} from "vitest";
import {novelRequest} from "../src/lib/novel-remote";
const m=vi.hoisted(()=>({request:vi.fn()}));vi.mock("../src/lib/supabase",()=>({adminRequest:m.request}));
const item={id:"chapter-1",locale:"vi",title:"Title",html:"<p>Nguyễn Dữ</p>",kind:"text",pdfPath:null,expectedRevision:2};
const head={chapter_id:item.id,locale:"vi",draft_id:"new-version",published_id:"old-version",revision:3};
const version={...item,chapter_id:item.id,pdf_path:null,revision:3};
beforeEach(()=>{m.request.mockReset();});
it("confirms a saved chapter after lost response without resending",async()=>{
 m.request.mockImplementation(async(path,body)=>{if(body)throw new TypeError("offline");return path==="state"?{editions:[head]}:version;});
 await expect(novelRequest("chapters",item)).resolves.toMatchObject({reconciled:true});expect(m.request.mock.calls.filter(c=>c[1]).length).toBe(1);
});
it("confirms every imported chapter and refuses partial/mismatched results",async()=>{
 m.request.mockImplementation(async(path,body)=>{if(body)throw new TypeError("offline");return path==="state"?{editions:[head,{...head,chapter_id:"chapter-2"}]}:version;});
 await expect(novelRequest("chapters",{action:"import",items:[item,{...item,id:"chapter-2"}]})).rejects.toThrow(/chưa xác nhận|outcome unknown/i);
});
it("never reports another editor's different content as saved",async()=>{
 m.request.mockImplementation(async(path,body)=>{if(body)throw new TypeError("offline");return path==="state"?{editions:[head]}:{...version,html:"<p>Other editor</p>"};});
 await expect(novelRequest("chapters",item)).rejects.toThrow(/outcome unknown/i);expect(m.request.mock.calls.filter(c=>c[1]).length).toBe(1);
});
it("checks exact pre-write draft IDs; Novel publication does not increment revision",async()=>{
 let committed=false;m.request.mockImplementation(async(path,body)=>{if(body){committed=true;throw new TypeError("offline");}return {editions:[{...head,revision:2,draft_id:"target",published_id:committed?"target":"older"}]};});
 await expect(novelRequest("chapters",{action:"publish",id:item.id,locale:"vi",expectedRevision:2})).resolves.toMatchObject({reconciled:true});expect(m.request.mock.calls.filter(c=>c[1]).length).toBe(1);
});
it("confirms metadata by exact revision and both localized values despite JSON key order",async()=>{
 const meta={vi:{title:"VI",summary:"S"},en:{title:"EN",summary:"T"}};
 m.request.mockImplementation(async(path,body)=>{if(body)throw new SyntaxError("JSON truncated");return {book:{revision:6,draft:{en:{summary:"T",title:"EN"},vi:{summary:"S",title:"VI"}},published:meta}};});
 await expect(novelRequest("book",{meta,publish:true,expectedRevision:5})).resolves.toMatchObject({reconciled:true});
});
it("keeps known validation/conflict errors and never retries them",async()=>{
 m.request.mockRejectedValue(Object.assign(Error("Conflict"),{status:409}));await expect(novelRequest("chapters",item)).rejects.toThrow("Conflict");expect(m.request).toHaveBeenCalledTimes(1);
});

it("confirms a complete bilingual import only when every saved version matches",async()=>{
 const items=[item,{...item,id:"chapter-2",locale:"en"}];
 m.request.mockImplementation(async(path,body)=>{if(body)throw new TypeError("offline");if(path==="state")return {editions:items.map(i=>({...head,chapter_id:i.id,locale:i.locale}))};const id=new URL("https://book.test/"+path).searchParams.get("id");const i=items.find(i=>i.id===id)!;return {...i,chapter_id:i.id,pdf_path:null,revision:3};});
 await expect(novelRequest("chapters",{action:"import",items})).resolves.toMatchObject({reconciled:true});expect(m.request.mock.calls.filter(c=>c[1]).length).toBe(1);
});
it("confirms withdrawal at the same Novel revision",async()=>{
 let done=false;m.request.mockImplementation(async(path,body)=>{if(body){done=true;throw new TypeError("offline");}return {editions:[{...head,revision:2,published_id:done?null:"old-version"}]};});
 await expect(novelRequest("chapters",{action:"withdraw",id:item.id,locale:"vi",expectedRevision:2})).resolves.toMatchObject({reconciled:true});
});
it("refuses publication if the actual published version is different",async()=>{
 m.request.mockImplementation(async(path,body)=>{if(body)throw new TypeError("offline");return {editions:[{...head,revision:2}]};});await expect(novelRequest("chapters",{action:"publish",id:item.id,locale:"vi",expectedRevision:2})).rejects.toThrow(/outcome unknown/i);
});

it("confirms order only at the next book revision with the complete exact sequence",async()=>{
 m.request.mockImplementation(async(path,body)=>{if(body)throw new TypeError("offline");return {book:{revision:6},chapters:[{id:"b"},{id:"a"}]};});
 await expect(novelRequest("chapters",{action:"reorder",ids:["b","a"],expectedRevision:5})).resolves.toMatchObject({reconciled:true});
 await expect(novelRequest("chapters",{action:"reorder",ids:["a","b"],expectedRevision:5})).rejects.toThrow(/outcome unknown/i);
});
it("confirms archiving only if the chapter has left the active list",async()=>{
 m.request.mockImplementation(async(path,body)=>{if(body)throw new TypeError("offline");return {chapters:[{id:"other"}]};});
 await expect(novelRequest("chapters",{action:"archive",id:item.id})).resolves.toMatchObject({reconciled:true});
 await expect(novelRequest("chapters",{action:"archive",id:"other"})).rejects.toThrow(/outcome unknown/i);
});
it("confirms every publication target in a batch without changing Novel revisions",async()=>{
 let done=false;const items=[item,{...item,id:"chapter-2",locale:"en"}];m.request.mockImplementation(async(path,body)=>{if(body){done=true;throw new TypeError("offline");}return {editions:items.map(i=>({...head,chapter_id:i.id,locale:i.locale,revision:2,draft_id:i.id,published_id:done?i.id:"old"}))};});
 await expect(novelRequest("chapters",{action:"publish-batch",items})).resolves.toMatchObject({reconciled:true});expect(m.request.mock.calls.filter(c=>c[1]).length).toBe(1);
});
