import {test,expect,type Page} from "@playwright/test";
async function open(page:Page,frozen=false){await page.clock.install({time:new Date("2026-11-01T00:00:00Z")});if(frozen)await page.clock.pauseAt(new Date("2026-11-01T00:00:01Z"));await page.goto("/vi/comic/chapter-1");await expect(page.locator(".comic-reader")).toHaveAttribute("data-ready","true");await page.mouse.move(200,450);}
test("ten second visibility, no motion/scroll/focus wake, double gesture and hidden chapter persistence",async({page,isMobile})=>{
 await open(page,true);const root=page.locator(".comic-reader");await page.clock.fastForward(9000);await expect(root).toHaveAttribute("data-chrome","true");await page.clock.fastForward(1100);await expect(root).toHaveAttribute("data-chrome","false");
 await page.mouse.move(220,400);await page.locator(".cc-stage").evaluate(el=>el.scrollTop+=30);await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect(root).toHaveAttribute("data-chrome","false");
 if(isMobile){const stage=page.locator(".cc-stage");await stage.tap({position:{x:180,y:350}});await stage.dispatchEvent("pointercancel");await stage.tap({position:{x:180,y:350}});await expect(root).toHaveAttribute("data-chrome","false");await stage.dispatchEvent("pointercancel");await stage.tap({position:{x:180,y:350}});await stage.tap({position:{x:180,y:350}});}else await page.locator(".cc-stage").dblclick({position:{x:200,y:350}});
 await expect(root).toHaveAttribute("data-chrome","true");await page.clock.fastForward(10100);await expect(root).toHaveAttribute("data-chrome","false");
 await page.locator(".cc-end").getByRole("link",{name:"Chương sau",exact:true}).click();await expect(page.locator(".cc-chapter-label")).toHaveText("Chương 2");await expect(root).toHaveAttribute("data-chrome","false");await page.goBack();await expect(page.locator(".cc-chapter-label")).toHaveText("Chương 1");await expect(root).toHaveAttribute("data-chrome","false");await page.reload();await expect(root).toHaveAttribute("data-ready","true");await expect(root).toHaveAttribute("data-chrome","false");
});
test("hidden desktop regions reveal independently and mobile has no zoom controls",async({page,isMobile})=>{
 await open(page);const root=page.locator(".comic-reader"),top=page.locator(".cc-chapter-widget"),tools=page.locator(".cc-tools"),zoom=page.locator(".cc-zoom"),left=page.locator(".cc-reading-progress");await page.clock.fastForward(10100);
 if(isMobile){await expect(zoom).toBeHidden();await page.mouse.move(370,100);await expect(root).toHaveAttribute("data-chrome","false");return;}
 await page.mouse.move(2,400);await expect(left).toHaveCSS("opacity","1");await expect(top).toHaveCSS("opacity","0");await expect(zoom).toHaveCSS("opacity","0");
 const box=await top.boundingBox();await page.mouse.move(box!.x+box!.width/2,box!.y+15);await expect(top).toHaveCSS("opacity","1");await expect(tools).toHaveCSS("opacity","1");await expect(zoom).toHaveCSS("opacity","0");
 const z=await zoom.boundingBox();await page.mouse.move(z!.x+10,z!.y+10);await expect(zoom).toHaveCSS("opacity","1");await expect(top).toHaveCSS("opacity","0");await expect(root).toHaveAttribute("data-chrome","false");
});


test("settings pause idle timer and double gestures never advance horizontal pages",async({page,isMobile})=>{
 await open(page);const root=page.locator(".comic-reader");
 await page.getByRole("button",{name:"Cài đặt truyện tranh",exact:true}).click();
 await page.clock.fastForward(20000);await expect(root).toHaveAttribute("data-chrome","true");
 await page.getByRole("button",{name:"Trái → phải",exact:true}).click();await page.keyboard.press("Escape");
 const before=await root.getAttribute("data-page"),image=page.locator(".cc-page img").first();
 const b=await image.boundingBox();const point={x:b!.width*.8,y:Math.min(350,b!.height/2)};
 if(isMobile){await image.tap({position:point});await image.tap({position:point});}else await image.dblclick({position:point});
 await page.clock.fastForward(600);await expect(root).toHaveAttribute("data-page",before!);await expect(root).toHaveAttribute("data-chrome","false");
});

test("keyboard reveals only focused controls while globally hidden",async({page,isMobile})=>{
 test.skip(isMobile,"Keyboard hover regions are desktop-only");await open(page);await page.clock.fastForward(10100);
 await page.getByRole("button",{name:"Chương sau",exact:true}).focus();
 await expect(page.locator(".cc-chapter-widget")).toHaveCSS("opacity","1");await expect(page.locator(".cc-tools")).toHaveCSS("opacity","1");await expect(page.locator(".cc-zoom")).toHaveCSS("opacity","0");await expect(page.locator(".comic-reader")).toHaveAttribute("data-chrome","false");
});


test("phone sizing preserves desktop zoom and stretch preferences",async({page,isMobile})=>{
 test.skip(isMobile,"Desktop resize preference regression");await open(page);
 await page.getByRole("button",{name:"Stretch: bật",exact:true}).click();const value=await page.locator(".cc-zoom-number").textContent();
 await page.setViewportSize({width:390,height:844});await expect(page.locator(".cc-zoom")).toBeHidden();
 await expect.poll(()=>page.locator(".cc-page img").first().evaluate(i=>Math.round(i.getBoundingClientRect().width)-i.closest(".cc-stage")!.clientWidth)).toBe(0);
 await page.setViewportSize({width:1440,height:900});await expect(page.locator(".cc-zoom-number")).toHaveText(value!);await expect(page.getByRole("button",{name:"Stretch: tắt",exact:true})).toBeVisible();
});
