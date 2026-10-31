import {build} from "esbuild";
import {readFile} from "node:fs/promises";
import {chromium,webkit,expect} from "@playwright/test";
const result=await build({stdin:{contents:`import {createElement as h} from "react";import {createRoot} from "react-dom/client";import {LanguageLinks} from "./src/components/Ui";
createRoot(document.getElementById("root")).render(h("div",{className:"comic-editor"},h("header",{className:"ce-topbar"},"Editor"),h("div",{className:"ce-local-notice"},"Private draft"),h("main",{className:"ce-workspace"},h("div",{style:{height:700}}),h("div",{className:"ce-edition-tabs"},h(LanguageLinks,{locale:"vi",chapterId:"chapter-1",comic:true,admin:true,onNavigate:()=>{window.clicked=true;return false;}})),h("div",{style:{height:400}}),h("input",{"aria-label":"Title"}),h("div",{style:{height:900}}))));`,resolveDir:process.cwd()},bundle:true,write:false,format:"iife",platform:"browser",define:{"process.env.NODE_ENV":'"production"'}});
for(const engine of [chromium,webkit]){
 const browser=await engine.launch();try{
 const page=await browser.newPage({viewport:{width:1200,height:800}});
 await page.route("http://edition.test/**",route=>route.fulfill({contentType:"text/html",body:'<!doctype html><html><body style="margin:0"><div id="root"></div></body></html>'}));await page.goto("http://edition.test");
 for(const css of ["app/globals.css","app/comic-preview.css","app/edition-switch.css"])await page.addStyleTag({content:await readFile(css,"utf8")});await page.addScriptTag({content:result.outputFiles[0].text});
 await page.getByLabel("Title",{exact:true}).fill("Unsaved");
 const button=page.getByRole("button",{name:"English",exact:true});await button.click();await button.press("ArrowDown");
 await page.locator(".ce-workspace").evaluate(el=>el.dispatchEvent(new Event("scroll")));
 await expect(page.getByRole("menuitem",{name:"Comic",exact:true})).toBeVisible();await page.getByRole("menuitem",{name:"Comic",exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.clicked)).toBe(true);console.log(engine.name()+": edition menu stays selectable inside a scrolled editor");
 await page.locator(".ce-workspace").evaluate(el=>{el.scrollTop+=10;el.dispatchEvent(new Event("scroll"));});await expect(page.getByRole("menu")).toHaveCount(0);
 }finally{await browser.close();}
}
