import {test,expect} from "@playwright/test";
test("scroll updates progress and persists position without per-frame React commits",async({page})=>{
 await page.addInitScript(()=>{const w=window as any;w.auditCommits=0;w.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,inject:()=>1,onCommitFiberRoot:()=>w.auditCommits++,onCommitFiberUnmount(){},checkDCE(){}};});
 await page.goto("/vi/comic/chapter-1");await expect(page.locator(".comic-reader")).toHaveAttribute("data-ready","true");await expect.poll(()=>page.locator(".cc-page img").first().evaluate(i=>(i as HTMLImageElement).complete&&(i as HTMLImageElement).naturalWidth>0),{timeout:20000}).toBe(true);
 const result=await page.evaluate(async()=>{const s=document.querySelector(".cc-stage")!;s.scrollTop=0;await new Promise(r=>setTimeout(r,150));(window as any).auditCommits=0;for(let i=0;i<90;i++){await new Promise(requestAnimationFrame);s.scrollTop+=1;}await new Promise(r=>setTimeout(r,300));return {top:s.scrollTop,commits:(window as any).auditCommits,progress:Number(document.querySelector('[role="progressbar"]')!.getAttribute("aria-valuenow"))};});
 console.log(JSON.stringify(result));
 expect(result.top).toBeGreaterThan(0);expect(result.progress).toBeGreaterThan(0);expect(result.commits).toBeLessThan(8);
 const before=await page.locator(".cc-stage").evaluate(e=>e.scrollTop);await page.reload();await expect(page.locator(".comic-reader")).toHaveAttribute("data-ready","true");await expect.poll(()=>page.locator(".cc-stage").evaluate((e,previous)=>Math.abs(e.scrollTop-previous),before)).toBeLessThan(8);
});

test("progress remains correct across single-page mode, hiding, placement and resizing",async({page})=>{
 await page.goto("/vi/comic/chapter-1");await expect(page.locator(".comic-reader")).toHaveAttribute("data-ready","true");
 const settings=page.getByRole("button",{name:"Cài đặt truyện tranh",exact:true});await settings.click();await page.getByRole("button",{name:"Trái → phải",exact:true}).click();await page.getByRole("button",{name:"Thanh tiến độ phía dưới",exact:true}).click();await page.keyboard.press("Escape");await page.keyboard.press("ArrowRight");await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow","100");
 await settings.click();await page.getByRole("button",{name:"Thanh tiến độ ẩn",exact:true}).click();await page.keyboard.press("Escape");await expect(page.getByRole("progressbar")).toHaveCount(0);
 await settings.click();await page.getByRole("button",{name:"Thanh tiến độ bên trái",exact:true}).click();await page.keyboard.press("Escape");await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow","100");
 const size=page.viewportSize()!;await page.setViewportSize({width:size.width,height:size.height-100});await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow","100");
});
