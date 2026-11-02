import {test,expect,type Page} from "@playwright/test";
const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const list:string[]=[];errors.set(page,list);page.on("pageerror",e=>list.push(e.message.replace(/https?:\/\/\S+/g,"[url]")));});
test.afterEach(({page})=>{expect(errors.get(page)).toEqual([]);});
async function open(page:Page){await page.goto("/en/read/chapter-1");await expect(page.locator(".reader-shell")).toHaveAttribute("data-ready","true");await page.getByRole("button",{name:"Reader settings",exact:true}).click();await page.getByRole("button",{name:"Book",exact:true}).click();await page.getByRole("button",{name:"Close",exact:true}).click();await expect(page.locator(".reader-document")).toHaveAttribute("data-flip-ready","true");}
test("rapid phone taps preserve the running sheet and coalesce the following turns",async({page,isMobile},testInfo)=>{
 test.skip(!isMobile,"Touch serialization is a phone path");await open(page);
 const result=await page.evaluate(async()=>{
  const surface=document.querySelector(".reading-scroll")!,paper=document.querySelector(".reader-document")!,r=paper.getBoundingClientRect();
  const event=(type:string,id:number)=>surface.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:"touch",isPrimary:true,clientX:r.right-6,clientY:r.top+r.height*.6}));
  event("pointerdown",101);event("pointerup",101);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const before=paper.hasAttribute("data-flipping"),frame=paper.querySelector("iframe") as HTMLIFrameElement,stage=frame.contentDocument!.querySelector(".book-animation-stage");
  event("pointerdown",102);const held=paper.hasAttribute("data-flipping"),sameSheet=!!stage?.isConnected;event("pointerup",102);
  for(const id of [103,104]){event("pointerdown",id);event("pointerup",id);}
  return {before,held,sameSheet,folio:paper.querySelector(".book-folio span")?.textContent};
 });
 expect(result.before).toBe(true);expect(result.held).toBe(true);expect(result.sameSheet).toBe(true);expect(result.folio).toBe("2");
 await page.locator(".reader-document").screenshot({path:testInfo.outputPath("rapid-sheet.png")});
 await expect(page.locator(".book-folio span").first()).toHaveText("5");await expect(page.locator(".book-flip-layer")).toHaveCount(0,{timeout:3000});
});

test("phone chapter request waits for the active fold and preserves the following tap",async({page,isMobile})=>{
 test.skip(!isMobile,"Touch serialization is a phone path");await open(page);
 const result=await page.evaluate(async()=>{
  const surface=document.querySelector(".reading-scroll")!,paper=document.querySelector(".reader-document")!,r=paper.getBoundingClientRect();
  const tap=(id:number)=>{for(const type of ["pointerdown","pointerup"])surface.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:"touch",isPrimary:true,clientX:r.right-6,clientY:r.top+r.height*.6}));};
  tap(201);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const active=paper.hasAttribute("data-flipping"),before=location.pathname;
  (document.querySelector('.reader-toolbar [aria-label="Next chapter"]') as HTMLButtonElement).click();
  const immediate=location.pathname;tap(202);return {active,before,immediate};
 });
 expect(result.active).toBe(true);expect(result.immediate).toBe(result.before);
 await expect.poll(()=>page.evaluate(()=>[location.pathname,document.querySelector(".reader-shell")?.getAttribute("data-ready"),document.querySelector(".book-folio span")?.textContent,document.querySelectorAll(".book-flip-layer").length])).toEqual(["/en/read/chapter-2","true","2",0]);
 await page.goBack();await expect.poll(()=>page.evaluate(()=>[location.pathname,document.querySelector(".reader-shell")?.getAttribute("data-ready"),document.querySelector(".book-folio span")?.textContent,document.querySelectorAll(".book-flip-layer").length])).toEqual(["/en/read/chapter-1","true","2",0]);
});

test("opposite queued phone taps do not leave an unchanged page under a stale overlay",async({page,isMobile})=>{
 test.skip(!isMobile,"Touch serialization is a phone path");await open(page);
 await page.evaluate(async()=>{
  const surface=document.querySelector(".reading-scroll")!,paper=document.querySelector(".reader-document")!,r=paper.getBoundingClientRect();
  const tap=(id:number,right:boolean)=>{for(const type of ["pointerdown","pointerup"])surface.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:"touch",isPrimary:true,clientX:right?r.right-6:r.left+6,clientY:r.top+r.height*.6}));};
  tap(301,true);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));tap(302,true);tap(303,false);
 });
 await expect(page.locator(".book-folio span").first()).toHaveText("2");await expect(page.locator(".book-flip-layer")).toHaveCount(0,{timeout:1000});
});

test("phone edge taps tolerate finger wobble without losing or doubling a turn",async({page,isMobile})=>{
 test.skip(!isMobile,"Touch tolerance is a phone path");await open(page);
 for(const [n,dx,dy,right,target] of [[0,-10,0,true,2],[1,0,13,true,3],[2,-14,0,true,4],[3,10,0,false,3]] as const){
  await page.evaluate(({id,dx,dy,right})=>{
   const surface=document.querySelector(".reading-scroll")!,r=document.querySelector(".reader-document")!.getBoundingClientRect(),x=right?r.right-6:r.left+6,y=r.top+r.height*.6;
   const event=(type:string,moved:boolean)=>surface.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:"touch",isPrimary:true,clientX:x+(moved?dx:0),clientY:y+(moved?dy:0)}));
   event("pointerdown",false);event("pointermove",true);event("pointerup",true);
  },{id:401+n,dx,dy,right});
  await expect(page.locator(".book-folio span").first()).toHaveText(String(target));
 }
 await expect(page.locator(".book-flip-layer")).toHaveCount(0,{timeout:3000});await expect(page.locator(".book-folio span").first()).toHaveText("3");
});

test("ordinary consecutive turns animate even when animation frame startup is delayed",async({page,isMobile})=>{
 let loads=0;await page.route("**/vendor/page-flip-2.0.7.js",async route=>{if(loads++>0)await new Promise(r=>setTimeout(r,180));await route.continue().catch(()=>{});});await open(page);
 const paper=page.locator(".reader-document");
 for(let n=0;n<3;n++){
  if(isMobile){const b=(await paper.boundingBox())!;await page.touchscreen.tap(b.x+b.width-12,b.y+b.height*.6);}else await page.keyboard.press("ArrowRight");
  await expect(paper).toHaveAttribute("data-flipping","true");await expect(page.locator(".book-flip-layer")).toHaveCount(0,{timeout:3000});
 }
});
test("a coalesced touch swipe still animates when no drag preview was rendered",async({page})=>{
 await open(page);const paper=page.locator(".reader-document"),b=(await paper.boundingBox())!,surface=page.locator(".reading-scroll"),props={pointerId:7,pointerType:"touch",isPrimary:true,clientX:b.x+b.width*.75,clientY:b.y+b.height*.6};
 await surface.dispatchEvent("pointerdown",props);await surface.dispatchEvent("pointerup",{...props,clientX:props.clientX-45});await expect(paper).toHaveAttribute("data-flipping","true");await expect(page.locator(".book-flip-layer")).toHaveCount(0,{timeout:3000});
});

test("chapter toolbar buttons also animate between adjacent text chapters",async({page})=>{
 await open(page);await page.locator(".reader-toolbar").getByRole("button",{name:"Next chapter",exact:true}).click();await expect(page.locator(".reader-document")).toHaveAttribute("data-flipping","true");await expect(page).toHaveURL(/chapter-2$/);await expect(page.locator(".book-flip-layer")).toHaveCount(0,{timeout:3000});await page.locator(".reader-toolbar").getByRole("button",{name:"Previous chapter",exact:true}).click();await expect(page.locator(".reader-document")).toHaveAttribute("data-flipping","true");await expect(page).toHaveURL(/chapter-1$/);
});

test("jumping to the visible page or spread is a no-op, while another page still animates",async({page})=>{
 await open(page);const paper=page.locator(".reader-document"),double=await page.locator(".reader-shell").getAttribute("data-book-double")==="true";
 await paper.evaluate(el=>{(window as any).samePageFlips=0;new MutationObserver(records=>{for(const record of records)if(record.attributeName==="data-flipping"&&el.getAttribute("data-flipping")==="true")(window as any).samePageFlips++;}).observe(el,{attributes:true,attributeFilter:["data-flipping"]});});
 const jump=async(value:string)=>{await page.getByRole("button",{name:"Reading tools",exact:true}).click();await page.locator(".page-jump input").fill(value);await page.locator(".page-jump").getByRole("button",{name:"Go to page",exact:true}).click();};
 for(const value of double?["1","2"]:["1"]){await jump(value);await page.waitForTimeout(100);expect(await page.evaluate(()=>(window as any).samePageFlips)).toBe(0);await expect(page.locator(".book-flip-layer")).toHaveCount(0);}
 await jump(double?"3":"2");await expect(paper).toHaveAttribute("data-flipping","true");await expect(page.locator(".book-folio span").first()).toHaveText(double?"3":"2");await expect(page.locator(".book-flip-layer")).toHaveCount(0,{timeout:3000});
});
