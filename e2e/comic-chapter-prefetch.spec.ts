import {test, expect} from "@playwright/test";

test("chapter intent prepares the route before navigation without another server round trip", async ({page}, testInfo) => {
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.addInitScript(()=>{
    const w=window as any,nativeFetch=window.fetch.bind(window);w.chapterPayloadReady=false;w.chapterPayloadBytes=0;
    window.fetch=async(input,init)=>{
      const response=await nativeFetch(input,init),url=new URL(input instanceof Request?input.url:String(input),location.href);
      if(url.pathname==="/vi/comic/preface"&&new Headers(init?.headers??(input instanceof Request?input.headers:undefined)).get("rsc")==="1"){
        void(async()=>{
          const reader=response.clone().body?.getReader();if(!reader)return;
          const decoder=new TextDecoder();let text="";
          try{while(text.length<2_000_000){const part=await reader.read();if(part.done)break;text+=decoder.decode(part.value,{stream:true});w.chapterPayloadBytes=text.length;if(text.includes('"chapterId":"preface"')&&text.includes('"summaries"')&&text.includes('"book"')){w.chapterPayloadReady=true;break;}}}
          finally{void reader.cancel().catch(()=>{});}
        })().catch(()=>{});
      }
      return response;
    };
  });
  let started = 0;
  const target = "/vi/comic/preface";
  page.on("request", request => {if (new URL(request.url()).pathname === target && request.headers().rsc === "1") started++;});
  await page.goto("/vi/comic/chapter-1");
  await expect(page.locator(".comic-reader")).toHaveAttribute("data-ready", "true");
  const boot = await page.evaluate(() => (window as any).__prefetchBoot = crypto.randomUUID());
  await page.getByLabel("Chương trước", {exact: true}).focus();
  await expect.poll(() => started, {timeout: 3000}).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>(window as any).chapterPayloadReady),{timeout:20000}).toBe(true);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.locator(".cc-chapter-widget").screenshot({path:testInfo.outputPath("chapter-controls.png")});
  let afterClickRequests = 0;
  await page.route("**/*", async route => {
    const request = route.request();
    if (new URL(request.url()).pathname === target && (request.headers().rsc === "1" || request.resourceType() === "document")) {
      afterClickRequests++;await route.abort();
    } else await route.continue();
  });
  const start = Date.now();
  await page.getByLabel("Chương trước", {exact: true}).click();
  await expect(page).toHaveURL(/\/comic\/preface$/, {timeout: 1500});
  await expect(page.locator(".comic-reader")).toHaveAttribute("data-ready", "true");
  expect(await page.evaluate(() => (window as any).__prefetchBoot)).toBe(boot);
  expect(afterClickRequests).toBe(0);
  expect(errors).toEqual([]);
  console.log(JSON.stringify({prefetchRequests: started, afterClickRequests, navigationMs: Date.now() - start}));
});

test("chapter warming respects Data Saver and 2G, and repeated intent stays deduplicated",async({page})=>{
  await page.addInitScript(()=>{const n=Object.assign(new EventTarget(),{saveData:true,effectiveType:"4g",downlink:10});Object.defineProperty(navigator,"connection",{configurable:true,value:n});});
  const api:string[]=[],routes=new Set<string>();
  await page.route("**/api/comic?**",async route=>{api.push(new URL(route.request().url()).searchParams.get("chapter")!);await route.fulfill({json:{firstPage:null}});});
  page.on("request",r=>{if(r.headers().rsc==="1")routes.add(new URL(r.url()).pathname);});
  await page.goto("/vi/comic/chapter-1");await expect(page.locator(".comic-reader")).toHaveAttribute("data-ready","true");
  const previous=page.getByLabel("Chương trước",{exact:true}),next=page.getByLabel("Chương sau",{exact:true});
  await previous.focus();await page.waitForTimeout(300);expect(api).toEqual([]);expect(routes.size).toBe(0);
  await page.evaluate(()=>{const n=(navigator as any).connection;n.saveData=false;n.effectiveType="2g";n.dispatchEvent(new Event("change"));});
  await previous.evaluate(el=>(el as HTMLElement).blur());await previous.focus();await page.waitForTimeout(300);expect(api).toEqual([]);expect(routes.size).toBe(0);
  await page.evaluate(()=>{const n=(navigator as any).connection;n.effectiveType="4g";n.dispatchEvent(new Event("change"));});
  await previous.evaluate(el=>(el as HTMLElement).blur());await previous.focus();await expect.poll(()=>api.length).toBe(1);
  await next.focus();await expect.poll(()=>api.length).toBe(2);
  for(let n=0;n<3;n++){await previous.focus();await next.focus();}
  expect(new Set(api).size).toBe(2);expect(api.length).toBe(2);
});

test("disabled chapter control stays out of Tab order and never navigates on Enter",async({page})=>{
  await page.goto("/vi/comic/preface");await expect(page.locator(".comic-reader")).toHaveAttribute("data-ready","true");
  const previous=page.getByLabel("Chương trước",{exact:true});await expect(previous).toHaveAttribute("aria-disabled","true");await expect(previous).toHaveAttribute("tabindex","-1");
  const history=await page.evaluate(()=>window.history.length);await previous.focus();await page.keyboard.press("Enter");await expect(page).toHaveURL(/\/comic\/preface$/);expect(await page.evaluate(()=>window.history.length)).toBe(history);
});
