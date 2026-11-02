import {test,expect} from "@playwright/test";

test("decorative headings keep both i glyphs in Critique visually separated",async({page},testInfo)=>{
 await page.goto("/en/read/chapter-2");await expect(page.locator(".reader-shell")).toHaveAttribute("data-ready","true");
 const result=await page.evaluate(async()=>{
  const root=document.querySelector<HTMLElement>('[data-heading-font]')!,id=root.dataset.headingFont!;
  const heading=document.createElement("h3");heading.textContent="Critique";heading.style.cssText="font-size:20px;font-weight:400;position:fixed;left:24px;top:120px;z-index:10000;background:var(--reader-bg);padding:16px";heading.id="critique-probe";root.append(heading);
  const family=getComputedStyle(heading).fontFamily;await document.fonts.load(`400 20px ${family}`,"Critique");
  const node=heading.firstChild!,range=document.createRange();range.setStart(node,3);range.setEnd(node,4);const t=range.getBoundingClientRect();range.setStart(node,4);range.setEnd(node,5);const i=range.getBoundingClientRect();
  const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d")!;ctx.font=`400 20px ${family}`;
  return {id,family,text:heading.textContent,spacing:getComputedStyle(heading).letterSpacing,inkGap:i.x-ctx.measureText("i").actualBoundingBoxLeft-t.x-ctx.measureText("t").actualBoundingBoxRight};
 });
 test.skip(result.id==="default","No decorative font selected");console.log(JSON.stringify(result));
 expect(result.family).toContain(result.id);expect(result.text).toBe("Critique");expect(result.text.match(/i/g)).toHaveLength(2);
 expect(parseFloat(result.spacing)).toBeGreaterThan(0);
 if(result.id==="6d80f149-7e5f-4a6d-bf3c-b62b68bb80fc")expect(result.inkGap).toBeGreaterThan(.5);
 await page.locator("#critique-probe").screenshot({path:testInfo.outputPath("critique.png")});
});

test("old bold-only and merged section labels use the selected heading face in VI and EN",async({page})=>{
 for(const [locale,chapter,label]of[["en","chapter-3","Critique"],["en","chapter-4","Critique"],["vi","chapter-1","Lời bình:"]] as const){
  await page.goto(`/${locale}/read/${chapter}`);await expect(page.locator(".reader-shell")).toHaveAttribute("data-ready","true");
  const heading=page.locator(".chapter-content h3").filter({hasText:new RegExp(`^\\s*${label}\\s*$`)});await expect(heading).toHaveCount(1);
  const id=await page.locator(".reader-document").getAttribute("data-heading-font");
  const family=await heading.evaluate(el=>getComputedStyle(el).fontFamily);if(id!=="default")expect(family).toContain(id!);
  const bodyFamily=await page.locator(".chapter-content p").first().evaluate(el=>getComputedStyle(el).fontFamily);if(id!=="default")expect(bodyFamily).not.toContain(id!);
 }
});
