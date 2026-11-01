import {test,expect,type Page} from "@playwright/test";
const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const list:string[]=[];errors.set(page,list);page.on("pageerror",e=>list.push(e.message.replace(/https?:\/\/\S+/g,"[url]")));});
test.afterEach(({page})=>{expect(errors.get(page)).toEqual([]);});
async function open(page:Page){await page.goto("/en/read/chapter-1");await expect(page.locator(".reader-shell")).toHaveAttribute("data-ready","true");await page.getByRole("button",{name:"Reader settings",exact:true}).click();await page.getByRole("button",{name:"Book",exact:true}).click();await page.getByRole("button",{name:"Close",exact:true}).click();await expect(page.locator(".reader-document")).toHaveAttribute("data-flip-ready","true");}
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
