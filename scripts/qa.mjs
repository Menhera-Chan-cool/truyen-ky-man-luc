import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL??'http://127.0.0.1:3001';
const out=process.env.QA_OUT??'.impeccable/review';await mkdir(out,{recursive:true});
const browser=await chromium.launch();const results=[];
for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
 const page=await browser.newPage({viewport,reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const locale of ['vi','en']){
  await page.goto(`${base}/${locale}`,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);assert.equal(await page.locator('html').getAttribute('lang'),locale);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  if(locale==='vi'||name==='desktop')await page.screenshot({path:`${out}/book-${locale}-${name}.png`,fullPage:true,animations:'disabled'});
 }
 await page.goto(`${base}/vi/read/chapter-1`,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('.reader-shell')?.dataset.ready==='true');await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`${out}/reader-${name}.png`,animations:'disabled'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const toolbarOutside=await page.locator('.reader-toolbar button,.reader-toolbar a').evaluateAll(elements=>elements.filter(el=>{const r=el.getBoundingClientRect();return r.x<0||r.right>innerWidth+1}).length);assert.equal(toolbarOutside,0);
 await page.getByRole('button',{name:'Cài đặt trình đọc',exact:true}).click();await page.screenshot({path:`${out}/settings-${name}.png`,animations:'disabled'});
 await page.getByText('Dữ liệu đọc trên thiết bị',{exact:true}).click();
 await page.getByLabel('File bản sao dữ liệu đọc').setInputFiles({name:'reader.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'truyen-ky-man-luc-reader-backup',version:1,bookId:'truyen-ky-man-luc',exportedAt:'2026-10-23T00:00:00.000Z',settings:null,progress:[],annotations:[]}))});
 await page.getByRole('button',{name:'Khôi phục bản sao',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:`${out}/backup-preview-${name}.png`,animations:'disabled'});
 assert.equal(await page.locator('.reader-panel').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
 await page.getByRole('button',{name:'Tối',exact:true}).click();await page.getByRole('button',{name:'Đóng',exact:true}).click();await page.screenshot({path:`${out}/reader-dark-${name}.png`,animations:'disabled'});
 if(name==='desktop'){await page.goto(`${base}/admin`);await page.screenshot({path:`${out}/admin-locked-desktop.png`,fullPage:true,animations:'disabled'});}
 assert.deepEqual(errors,[]);results.push({viewport:name,noHorizontalOverflow:true,toolbarVisible:true,pageErrors:errors});await page.close();
}
await browser.close();await writeFile(`${out}/qa.json`,JSON.stringify({base,results},null,2));console.log(JSON.stringify({base,results}));
