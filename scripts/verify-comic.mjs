import {createRequire} from "node:module";
import {randomUUID,randomBytes,createHash} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";
const root=fileURLToPath(new URL("../",import.meta.url)),require=createRequire(new URL("../package.json",import.meta.url));
require("@next/env").loadEnvConfig(root,false,{info(){},error(){}});
const {createClient}=require("@supabase/supabase-js"),{chromium,webkit,expect:rawExpect}=require("@playwright/test"),sharp=require("sharp"),expect=rawExpect.configure({timeout:30000});
const config={auth:{persistSession:false,autoRefreshToken:false}},url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,config),anon=createClient(url,key,config);
const base=process.env.BASE_URL??"http://localhost:3003",isLocal=["localhost","127.0.0.1"].includes(new URL(base).hostname),tag="verify-comic-"+randomUUID().slice(0,8),ids=[tag+"-chrome",tag+"-webkit"];
const report={base,checks:[],cleanup:[],pageErrors:0,authResponses:[],failedRequests:[]},actors=[],secrets=[process.env.SUPABASE_SERVICE_ROLE_KEY],screens=root+".impeccable/review/comic-publication/"+(isLocal?"local":"live");
let browser,currentPage,publicProbe,phase="setup",passed=false;
const ok=r=>{if(r.error)throw Error("Supabase request failed "+(r.error.code??r.error.status??""));return r.data;};
const check=s=>{report.checks.push(s);console.log(s);};
const pageError=e=>{report.pageErrors++;let message=e.message;for(const secret of secrets.filter(Boolean))message=message.replaceAll(secret,"[redacted]");(report.pageErrorDetails??=[]).push({phase,message:message.replace(/\?[^\s)]+/g,"?[redacted]").slice(0,700)});};
async function api(actor,path,body,method="POST") {
  if(path.startsWith("comic?")&&!path.includes("locale="))path+="&locale=vi";
  if(path==="comic"&&body&&!body.locale)body={...body,locale:"vi"};
  const r=await fetch(base+"/api/admin/"+path,{method,headers:{"Content-Type":"application/json",...(actor?{Authorization:"Bearer "+actor.token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:r.status,body:await r.json()};
}
const bookHash=async()=>{
  let result=await anon.rpc("get_public_book");
  if(result.error&&(result.status===0||result.status>=500))result=await anon.rpc("get_public_book");
  return createHash("sha256").update(JSON.stringify(ok(result))).digest("hex");
};
async function loseMutationResponse(page,action){
 let lost=false;
 await page.route("**/api/admin/comic",async route=>{
  if(!lost&&route.request().postDataJSON()?.action===action){const response=await route.fetch();if(response.ok()){lost=true;await route.abort();return;}await route.fulfill({response});return;}
  await route.continue();
 });
 return async()=>{await page.unroute("**/api/admin/comic");assert(lost,"Expected a committed response to be lost");};
}
async function login(page,id) {
  await page.goto(base+"/admin/comic?chapter="+id);
  await page.locator('input[name="email"],.comic-editor').first().waitFor({state:"visible",timeout:30000});
  if(await page.locator('input[name="email"]').count()) {
    await page.locator('input[name="email"]').fill(actors[0].email);
    await page.locator('input[name="password"]').fill(actors[0].password);
    await page.getByRole("button",{name:"Đăng nhập",exact:true}).click();
  }
  try {await expect(page.locator(".comic-editor")).toHaveAttribute("data-ready","true",{timeout:30000});}
  catch(e){report.loginDiagnostics={headings:await page.locator("h1,h2").allTextContents(),alerts:await page.locator('[role="alert"]').allTextContents(),text:(await page.locator("body").innerText()).slice(0,600)};throw e;}
}
async function cleanup(label,fn) {try{ok(await fn());report.cleanup.push({label,ok:true});}catch{report.cleanup.push({label,ok:false});}}
let before;
try {
  await mkdir(screens,{recursive:true});before=await bookHash();
  for(let n=0;n<2;n++) {
    const email=`${tag}-${n}@example.test`,password=randomBytes(24).toString("base64url")+"aA1!";
    const uid=ok(await service.auth.admin.createUser({email,password,email_confirm:true})).user.id;
    actors.push({uid,email,password});secrets.push(password);
    ok(await service.from("members").insert({user_id:uid,email,role:"editor",active:true}));
    const client=createClient(url,key,config),session=ok(await client.auth.signInWithPassword({email,password})).session;
    Object.assign(actors[n],{client,token:session.access_token});secrets.push(session.access_token);
  }
  ok(await service.from("chapters").insert(ids.map((id,n)=>({id,sort_order:9000+n}))));
  const a=await sharp({create:{width:256,height:384,channels:3,background:"#8d342b"}}).png().toBuffer(),
    b=await sharp({create:{width:256,height:384,channels:3,background:"#30484d"}}).png().toBuffer();
  for(const [n,engine] of [[0,chromium],[1,webkit]].filter(([n])=>!process.env.COMIC_ENGINE||(process.env.COMIC_ENGINE==="webkit"?n===1:n===0))) {
    const name=n?"webkit":"chromium",id=ids[n];phase=name+" upload";
    browser=await engine.launch();
    const context=await browser.newContext(n?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:960}}),
      page=await context.newPage();
    currentPage=page;
    page.on("requestfailed",r=>report.failedRequests.push({path:new URL(r.url()).pathname,reason:r.failure()?.errorText}));
    page.on("response",r=>{if(new URL(r.url()).pathname==="/auth/v1/token")report.authResponses.push({engine:name,status:r.status()});});
    page.on("response",async r=>{if(!r.ok()&&new URL(r.url()).pathname.startsWith("/api/admin/")){try{const data=await r.json();console.log(JSON.stringify({status:r.status(),path:new URL(r.url()).pathname,error:data.error}));}catch{}}});
    let acceptDialogs=true;
    page.on("pageerror",pageError);page.on("dialog",d=>acceptDialogs?d.accept():d.dismiss());
    const guest=await browser.newContext(n?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1440,height:960}}),publicPage=await guest.newPage();
    publicProbe=publicPage;
    publicPage.on("pageerror",pageError);
    await publicPage.goto(base+"/admin/comic?chapter="+id);
    await expect(publicPage.getByRole("heading",{name:"Đăng nhập",exact:true})).toBeVisible();
    assert.equal(await publicPage.locator(".comic-editor").count(),0);check(name+": guest editor gate");
    await login(page,id);
    await page.getByLabel("Thêm ảnh hoặc ZIP",{exact:true}).setInputFiles([{name:"page10.png",mimeType:"image/png",buffer:a},{name:"page2.png",mimeType:"image/png",buffer:b}]);
    await expect(page.locator(".comic-editor")).toHaveAttribute("data-pages","2");
    assert.deepEqual(await page.locator(".ce-card-info strong").allTextContents(),["page2.png","page10.png"]);
    await page.getByLabel("Tiêu đề chương",{exact:true}).fill("TT fixture "+name);
    await page.getByRole("button",{name:"Đưa trang 1 xuống",exact:true}).click();
    await expect(page.locator(".ce-recovery-state")).toContainText("Đã giữ bản khôi phục");
    await page.reload();await expect(page.locator(".comic-editor")).toHaveAttribute("data-ready","true");
    await expect(page.locator(".ce-recoveries")).toContainText("TT fixture "+name);
    assert.equal(await page.getByLabel("Tiêu đề chương",{exact:true}).inputValue(),id);
    await page.getByRole("button",{name:"Khôi phục thay đổi",exact:true}).first().click();
    await expect(page.getByLabel("Tiêu đề chương",{exact:true})).toHaveValue("TT fixture "+name);
    await expect(page.locator(".comic-editor")).toHaveAttribute("data-pages","2");
    check(name+": unsaved shared draft and images recover explicitly after reload");
    let uploads=0,failRegistration=true;
    page.on("request",r=>{if(r.method()==="POST"&&new URL(r.url()).pathname.includes("/storage/v1/object/comic-assets/"))uploads++;});
    await page.route("**/api/admin/comic/assets",async route=>{if(failRegistration){failRegistration=false;await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Simulated registration interruption"})});}else await route.continue();});
    await page.getByRole("button",{name:"Lưu nháp chung",exact:true}).click();
    await expect(page.locator(".ce-error")).toContainText("Simulated registration interruption");
    await expect(page.locator(".ce-recovery-state")).toContainText("Đã giữ bản khôi phục");
    const uploadedBeforeRetry=uploads;assert.equal(uploadedBeforeRetry,2);
    assert.equal((await api(actors[0],"comic?chapter="+id,undefined,"GET")).body.revision,0);
    await page.reload();await expect(page.locator(".comic-editor")).toHaveAttribute("data-ready","true");
    await page.getByRole("button",{name:"Khôi phục thay đổi",exact:true}).first().click();
    const confirmedSave=await loseMutationResponse(page,"save");
    await page.getByRole("button",{name:"Lưu nháp chung",exact:true}).click();
    await expect(page.locator(".ce-status")).toContainText("Đã lưu nháp chung",{timeout:30000});
    assert.equal(uploads,uploadedBeforeRetry);await page.unroute("**/api/admin/comic/assets");
    await confirmedSave();check(name+": committed save confirmed after lost response without resubmitting");
    check(name+": failed registration resumes after reload without re-uploading or partial server save");
    let head=(await api(actors[0],"comic?chapter="+id,undefined,"GET")).body;
    assert.equal(head.revision,1);assert.deepEqual(head.draft.pages.map(p=>p.name),["page10.png","page2.png"]);
    assert.equal(ok(await anon.rpc("get_public_comic",{p_id:id})),null);
    const imagePath=head.draft.pages[0].path;
    assert.equal((await fetch(base+imagePath,{redirect:"manual"})).status,404);
    assert.equal((await fetch(base+imagePath+"?view=thumb",{redirect:"manual"})).status,404);
    assert.equal((await fetch(base+imagePath+"?view=read",{redirect:"manual"})).status,404);
    const thumbnail=await fetch(base+imagePath+"?view=thumb",{redirect:"manual",headers:{Authorization:"Bearer "+actors[0].token}});
    assert.equal(thumbnail.status,307);
    const small=Buffer.from(await (await fetch(thumbnail.headers.get("location"))).arrayBuffer()),smallMeta=await sharp(small).metadata();
    assert.equal(smallMeta.format,"webp");assert(smallMeta.width<=320&&smallMeta.height<=640);
    assert.equal(head.draft.pages[0].hash,createHash("sha256").update(a).digest("hex"));
    check(name+": protected small thumbnail and unchanged original checksum");
    assert.equal((await fetch(url+"/storage/v1/object/public/comic-assets/"+imagePath.split("/assets/")[1])).ok,false);
    assert.equal((await api(null,"comic?chapter="+id,undefined,"GET")).status,401);
    check(name+": natural order, reorder, private direct upload/save and anonymous asset denial");
    phase=name+" private preview";
    await page.getByRole("link",{name:"Xem bản đọc",exact:true}).click();
    await expect(page.locator(".comic-reader")).toHaveAttribute("data-pages","2");
    await expect(page.locator(".cc-local")).toHaveText("Bản nháp riêng tư");
    await publicPage.goto(base+`/vi/comic/${id}?preview=draft`);
    await expect(publicPage.getByRole("heading",{name:"Đăng nhập",exact:true})).toBeVisible();
    check(name+": private preview requires verified editor");
    await login(page,id);
    phase=name+" stale save";
    const changed={...head.draft,title:"Other editor "+name};
    assert.equal((await api(actors[1],"comic",{action:"save",draft:changed})).status,200);
    await page.getByLabel("Tiêu đề chương",{exact:true}).fill("Stale title");
    await page.getByRole("button",{name:"Lưu nháp chung",exact:true}).click();
    await expect(page.locator(".ce-error")).toContainText("chưa bị ghi đè",{timeout:15000});
    head=(await api(actors[0],"comic?chapter="+id,undefined,"GET")).body;
    assert.equal(head.draft.title,"Other editor "+name);assert.equal(head.revision,2);
    await page.getByRole("button",{name:"Tải lại bản đã lưu",exact:true}).click();
    await expect(page.getByLabel("Tiêu đề chương",{exact:true})).toHaveValue("Other editor "+name);
    check(name+": concurrent editor conflict preserves saved draft");
    phase=name+" publish";
    const confirmedPublication=await loseMutationResponse(page,"publish");
    await page.getByRole("button",{name:"Xuất bản TT",exact:true}).click();
    await expect(page.locator(".ce-status")).toContainText("Đã xuất bản TT");
    await confirmedPublication();check(name+": committed publication confirmed after lost response without resubmitting");
    phase=name+" public first load";
    await publicPage.goto(base+"/vi/comic/"+id);
    await expect(publicPage.locator(".comic-reader")).toHaveAttribute("data-pages","2");
    await expect.poll(()=>publicPage.locator(".cc-page img").evaluateAll(images=>images.filter(i=>i.complete&&i.naturalWidth>0).length)).toBeGreaterThan(0);
    const boot=await publicPage.evaluate(()=>window.__comicBoot=crypto.randomUUID());
    await publicPage.evaluate(()=>window.dispatchEvent(new Event("focus")));
    await publicPage.getByLabel("Chương trước",{exact:true}).click();
    await expect(publicPage).not.toHaveURL(new RegExp(id));
    assert.equal(await publicPage.evaluate(()=>window.__comicBoot),boot,"Chapter navigation must preserve the document");
    await publicPage.goBack();await expect(publicPage.locator(".comic-reader")).toHaveAttribute("data-pages","2");
    assert.equal(await publicPage.evaluate(()=>window.__comicBoot),boot);
    check(name+": internal chapter navigation and Back preserve the document");
    await publicPage.evaluate(async(id)=>{await new Promise((resolve,reject)=>{const r=indexedDB.open("tkml-comic-local-preview",1);r.onsuccess=()=>{const tx=r.result.transaction("chapters","readwrite");tx.objectStore("chapters").put({id,title:"PRIVATE DEVICE DRAFT",pages:[],revision:999});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);};});},id);
    phase=name+" public device draft isolation";
    await publicPage.reload();await expect(publicPage.locator(".comic-reader")).toHaveAttribute("data-pages","2");
    assert.equal((await publicPage.content()).includes("PRIVATE DEVICE DRAFT"),false);
    phase=name+" reader lifecycle";
    await publicPage.mouse.move(200,300);
    await expect(publicPage.locator(".comic-reader")).toHaveAttribute("data-chrome","false",{timeout:12000});
    await publicPage.evaluate(()=>window.dispatchEvent(new Event("focus")));
    await expect(publicPage.locator(".comic-reader")).toHaveAttribute("data-chrome","false");
    await publicPage.locator(".cc-stage").dblclick({position:{x:180,y:300}});
    await expect(publicPage.locator(".comic-reader")).toHaveAttribute("data-chrome","true");
    await publicPage.getByRole("button",{name:"Bắt đầu tự cuộn",exact:true}).click();
    await expect(publicPage.locator(".comic-reader")).toHaveAttribute("data-auto","true");
    await expect.poll(()=>publicPage.locator(".cc-stage").evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
    await publicPage.getByRole("button",{name:"English",exact:true}).click();
    await expect(publicPage.locator(".comic-reader")).toHaveAttribute("data-auto","false",{timeout:2000});
    await expect(publicPage.getByRole("menu")).toBeVisible();
    await publicPage.keyboard.press("Escape");
    await publicPage.evaluate(()=>window.dispatchEvent(new Event("blur")));
    await expect(publicPage.locator(".comic-reader")).toHaveAttribute("data-auto","false");
    await publicPage.evaluate(()=>window.dispatchEvent(new Event("focus")));
    check(name+": tab-return tools and background auto-scroll stop");
    for(const image of await page.locator(".ce-thumb img").all()){await image.scrollIntoViewIfNeeded();await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);}
    await page.screenshot({path:`${screens}/${name}-editor-vi.png`});
    phase=name+" language-specific missing edition";
    await publicPage.getByRole("button",{name:"English",exact:true}).click();
    await expect(publicPage.getByRole("menuitem",{name:"Novel",exact:true})).toHaveAttribute("href",`/en/read/${id}`);
    await publicPage.getByRole("menuitem",{name:"Comic",exact:true}).click();
    await expect(publicPage.locator(".comic-reader")).toHaveAttribute("data-pages","0");
    await expect(publicPage.locator(".cc-empty")).toContainText("English comic pages");
    check(name+": EN missing edition never displays VI pages");
    phase=name+" editor edition switch";
    await page.getByLabel("Tiêu đề chương",{exact:true}).fill("Unsaved VI");
    await page.getByRole("button",{name:"English",exact:true}).click();
    await page.getByRole("button",{name:"English",exact:true}).press("ArrowDown");
    acceptDialogs=false;
    phase=name+" cancel editor edition switch";
    await page.getByRole("menuitem",{name:"Comic",exact:true}).click();
    await expect(page).not.toHaveURL(/lang=en/);
    await expect(page.getByLabel("Tiêu đề chương",{exact:true})).toHaveValue("Unsaved VI");
    acceptDialogs=true;
    phase=name+" confirm editor edition switch";
    await page.getByRole("button",{name:"English",exact:true}).click();
    await page.getByRole("button",{name:"English",exact:true}).press("ArrowDown");
    await page.getByRole("menuitem",{name:"Comic",exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`chapter=${id}.*lang=en|lang=en.*chapter=${id}`));
    await expect(page.locator(".comic-editor")).toHaveAttribute("data-pages","0");
    await page.getByLabel("Add images or ZIP",{exact:true}).setInputFiles([{name:"english.png",mimeType:"image/png",buffer:b}]);
    await page.getByLabel("Chapter title",{exact:true}).fill("English comic "+name);
    await page.getByRole("button",{name:"Save shared draft",exact:true}).click();
    await expect(page.locator(".ce-status")).toContainText("Shared draft saved");
    assert.equal((await api(actors[0],`comic?chapter=${id}&locale=en`,undefined,"GET")).body.revision,1);
    assert.equal((await api(actors[0],`comic?chapter=${id}`,undefined,"GET")).body.revision,3);
    await page.getByRole("button",{name:"Publish comic",exact:true}).click();
    await expect(page.locator(".ce-status")).toContainText("Comic published");
    await publicPage.reload();await expect(publicPage.locator(".comic-reader")).toHaveAttribute("data-pages","1");
    assert.equal(ok(await anon.rpc("get_public_comic",{p_id:id,p_locale:"vi"})).pages.length,2);
    assert.equal(ok(await anon.rpc("get_public_comic",{p_id:id,p_locale:"en"})).pages.length,1);
    await publicPage.screenshot({path:`${screens}/${name}-reader-en.png`});
    await expect(page.locator(".comic-editor")).toHaveAttribute("data-ready","true");
    for(const image of await page.locator(".ce-thumb img").all()){await image.scrollIntoViewIfNeeded();await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);}
    await page.screenshot({path:`${screens}/${name}-editor-en.png`});
    check(name+": unsaved switch guard and independent VI/EN drafts, revisions, images and publication");
    phase=name+" failure retention";
    const draft=(await api(actors[0],"comic?chapter="+id,undefined,"GET")).body.draft;
    const bogus=structuredClone(draft);bogus.pages[0].width++;
    assert.equal((await api(actors[0],"comic",{action:"save",draft:bogus})).status,400);
    assert.equal(ok(await anon.rpc("get_public_comic",{p_id:id})).title,"Other editor "+name);
    const unsafe=`${actors[0].uid}/comics/${randomUUID()}.png`;
    ok(await actors[0].client.storage.from("comic-assets").upload(unsafe,Buffer.from('<svg onload="alert(1)"/>'),{contentType:"image/png",upsert:false}));
    assert.equal((await api(actors[0],"comic/assets",{path:unsafe})).status,400);
    const overwrite=await actors[0].client.storage.from("comic-assets").upload(imagePath.split("/assets/")[1],b,{contentType:"image/png",upsert:true});
    assert(overwrite.error,"Published objects must not be overwritten");
    const remove=await actors[0].client.storage.from("comic-assets").remove([imagePath.split("/assets/")[1]]);
    assert(remove.error||remove.data.length===0,"Published objects must not be deleted");
    assert.equal((await api(actors[0],"members",{email:"forbidden@example.test"})).status,403);
    check(name+": invalid save/upload, overwrite/delete and editor role-management denied; public retained");
    await page.goto(base+"/admin/comic?chapter="+id);await expect(page.locator(".comic-editor")).toHaveAttribute("data-ready","true");
    await page.getByRole("button",{name:"Thu hồi TT",exact:true}).click();
    await expect(page.locator(".ce-status")).toContainText("Đã thu hồi TT");
    assert.equal(ok(await anon.rpc("get_public_comic",{p_id:id})),null);
    assert.equal((await fetch(base+imagePath,{redirect:"manual"})).status,404);
    assert.equal((await fetch(base+imagePath+"?view=thumb",{redirect:"manual"})).status,404);
    assert.equal((await fetch(base+imagePath+"?view=read",{redirect:"manual"})).status,404);
    assert.equal(ok(await anon.rpc("get_public_comic",{p_id:id,p_locale:"en"})).pages.length,1);
    assert.equal((await api(actors[0],"comic",{action:"withdraw",id,revision:2,locale:"en"})).status,200);
    assert.equal(ok(await anon.rpc("get_public_comic",{p_id:id,p_locale:"en"})),null);
    check(name+": withdrawal removes public metadata and new image access");
    await browser.close();browser=undefined;
  }
  phase="revocation";
  ok(await service.from("members").update({active:false}).eq("user_id",actors[1].uid));
  assert.equal((await api(actors[1],"comic",{action:"publish",id:ids[0],revision:4})).status,403);
  assert((await actors[1].client.rpc("save_comic",{p_id:ids[0],p_title:"Revoked",p_direction:"ltr",p_pages:[],p_expected_revision:4})).error);
  assert.equal((await actors[1].client.from("comic_versions").select("id")).data.length,0);
  check("revoked editor denied through API, RPC and RLS");
  assert.equal(await bookHash(),before);assert.equal(report.pageErrors,0);passed=true;
} catch(e) {
  if(currentPage&&!currentPage.isClosed())report.uiErrors=await currentPage.locator('[role="alert"]').allTextContents();
  if(publicProbe&&!publicProbe.isClosed())report.publicDiagnostics={path:new URL(publicProbe.url()).pathname,text:(await publicProbe.locator("body").innerText()).slice(0,600)};
  let message=e instanceof Error?e.message:String(e);
  for(const secret of secrets.filter(Boolean))message=message.replaceAll(secret,"[redacted]");
  report.failure={phase,message:message.slice(0,1800)};
} finally {
  await browser?.close();
  await cleanup("comic heads",()=>service.from("comic_editions").delete().in("chapter_id",ids));
  await cleanup("comic versions",()=>service.from("comic_versions").delete().in("chapter_id",ids));
  for(const actor of actors) {
    const listed=await service.storage.from("comic-assets").list(actor.uid+"/comics",{limit:1000});
    if(listed.data?.length)await cleanup("image objects",()=>service.storage.from("comic-assets").remove(listed.data.map(x=>actor.uid+"/comics/"+x.name)));
    await cleanup("asset registry",()=>service.from("comic_assets").delete().eq("created_by",actor.uid));
    await cleanup("audit fixtures",()=>service.from("admin_audit").delete().eq("actor_id",actor.uid));
  }
  await cleanup("chapter fixtures",()=>service.from("chapters").delete().in("id",ids));
  for(const actor of actors) {
    await cleanup("member fixture",()=>service.from("members").delete().eq("user_id",actor.uid));
    await cleanup("auth fixture",()=>service.auth.admin.deleteUser(actor.uid));
  }
  try{report.publicBookUnchanged=!!before&&before===await bookHash();}catch{report.publicBookUnchanged=false;}
  report.passed=passed&&report.cleanup.every(x=>x.ok)&&report.publicBookUnchanged;
  report.checkedAt=new Date().toISOString();
  const output=root+"verification/comic-shared-"+(isLocal?"local":"live")+".json";
  await writeFile(output,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}
