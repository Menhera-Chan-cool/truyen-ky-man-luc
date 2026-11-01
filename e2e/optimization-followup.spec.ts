import {test,expect} from "@playwright/test";
test("book page does not download comic/editor, PDF or optional reading font CSS",async({page})=>{
 await page.goto("/vi");const links=await page.locator('link[rel="stylesheet"]').evaluateAll(nodes=>nodes.map(n=>(n as HTMLLinkElement).href));
 const css=(await Promise.all(links.map(async href=>(await page.request.get(href)).text()))).join("\n");
 expect(css.includes(".cc-tools"),"Unexpected stylesheet: .cc-tools").toBe(false);expect(css.includes(".ce-topbar"),"Unexpected stylesheet: .ce-topbar").toBe(false);expect(css.includes(".pdfViewer"),"Unexpected stylesheet: .pdfViewer").toBe(false);expect(css.includes("Inter Variable"),"Unexpected stylesheet: Inter Variable").toBe(false);
});
test("reader uses private full-resolution reading images",async({page})=>{
 await page.goto("/vi/comic/chapter-1");await expect(page.locator(".comic-reader")).toHaveAttribute("data-ready","true");await expect(page.locator(".cc-page img").first()).toHaveAttribute("src",/\?view=read$/);
 await expect.poll(()=>page.locator(".cc-page img").first().evaluate(i=>(i as HTMLImageElement).complete&&(i as HTMLImageElement).naturalWidth>0),{timeout:20000}).toBe(true);
});
