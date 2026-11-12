import {test,expect,type Page} from '@playwright/test';
async function select(page:Page,source:string){
 await page.locator('.chapter-content').evaluate((root,quote)=>{
  const start=root.textContent!.indexOf(quote);if(start<0)throw Error('Selection missing');
  const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),range=document.createRange();let node:Node|null,offset=0,started=false;
  while((node=walk.nextNode())){const size=node.textContent?.length??0;if(!started&&start<offset+size){range.setStart(node,start-offset);started=true;}if(started&&start+quote.length<=offset+size){range.setEnd(node,start+quote.length-offset);break;}offset+=size;}
  const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));
 },source);
}

for(const [locale,source,target]of [['vi','Trung Quốc','China'],['en','China','Trung Quốc']]){
 test(`looks up existing Novel text in place (${locale})`,async({page,context})=>{
  await page.goto(`/${locale}/read/chapter-1`);await expect(page.locator('.reader-shell')).toHaveAttribute('data-ready','true');
  await select(page,source);
  const before=await page.locator('.reading-scroll').evaluate(el=>el.scrollTop);
  await page.getByRole('button',{name:locale==='vi'?'Tra VI↔EN':'Look up VI↔EN',exact:true}).click();
  const panel=page.getByRole('region',{name:locale==='vi'?'Tra trong hai bản Novel':'Look up in both Novel editions',exact:true});
  await expect(panel.locator('mark')).toContainText(target);
  await page.screenshot({path:test.info().outputPath('lookup.png')});
  expect(context.pages()).toHaveLength(1);expect(await page.locator('.reading-scroll').evaluate(el=>el.scrollTop)).toBe(before);
  await panel.getByRole('button',{name:locale==='vi'?'Đóng':'Close',exact:true}).click();
  expect(await page.locator('.reading-scroll').evaluate(el=>el.scrollTop)).toBe(before);
 });
}
test('opens the aligned comparison without moving the original reading position',async({page})=>{
 await page.goto('/vi/read/chapter-1');await expect(page.locator('.reader-shell')).toHaveAttribute('data-ready','true');
 await select(page,'Trung Quốc');const before=await page.locator('.reading-scroll').evaluate(el=>el.scrollTop);
 await page.getByRole('button',{name:'Tra VI↔EN',exact:true}).click();await page.getByRole('button',{name:'Mở đối chiếu',exact:true}).click();
 for(const l of ['vi','en'])await expect(page.locator(`.parallel-edition[lang=${l}] .lookup-context`).first()).toBeVisible();
 await page.getByRole('button',{name:'Đóng',exact:true}).click();expect(await page.locator('.reading-scroll').evaluate(el=>el.scrollTop)).toBe(before);
});
test('ignores a late lookup after closing the panel and changing chapter',async({page})=>{
 let finish!:()=>void;const held=new Promise<void>(resolve=>{finish=resolve;});
 await page.route('**/api/novel-lookup',async route=>{await held;await route.fulfill({json:{status:'unavailable',targetLocale:'en',passages:[]}}).catch(()=>{});});
 await page.goto('/vi/read/chapter-1');await expect(page.locator('.reader-shell')).toHaveAttribute('data-ready','true');
 await select(page,'Trung Quốc');await page.getByRole('button',{name:'Tra VI↔EN',exact:true}).click();
 await expect(page.locator('.novel-lookup')).toContainText('Đang tìm phần tương ứng');
 await page.getByRole('button',{name:'Đóng',exact:true}).click();await page.getByRole('button',{name:'Chương sau',exact:true}).click();
 await expect(page).toHaveURL(/\/vi\/read\/chapter-2$/);finish();
 await expect(page.locator('.novel-lookup')).toHaveCount(0);
 await page.waitForTimeout(200);await expect(page.locator('.novel-lookup')).toHaveCount(0);
});
test('reports a missing counterpart and rejects malformed anonymous requests',async({page,request})=>{
 await page.goto('/vi/read/preface');await expect(page.locator('.reader-shell')).toHaveAttribute('data-ready','true');
 const word=await page.locator('.chapter-content').evaluate(el=>el.textContent!.match(/[\p{L}]{3,}/u)![0]);await select(page,word);
 await page.getByRole('button',{name:'Tra VI↔EN',exact:true}).click();await expect(page.getByRole('region',{name:'Tra trong hai bản Novel'})).toContainText('chưa có bản đối ứng');
 const invalid=await request.post('/api/novel-lookup',{data:{chapterId:'../private',locale:'vi',revision:1,start:0,end:1,text:'x'}});expect(invalid.status()).toBe(400);
 const denied=await request.post('/api/admin/novel-alignment',{data:{chapterId:'chapter-1'}});expect(denied.status()).toBe(401);
});
test('looks up in Book mode without turning a page',async({page})=>{
 await page.goto('/vi/read/chapter-1');await expect(page.locator('.reader-shell')).toHaveAttribute('data-ready','true');
 await page.getByRole('button',{name:'Cài đặt trình đọc',exact:true}).click();await page.getByRole('button',{name:'Sách',exact:true}).click();await page.getByRole('button',{name:'Đóng',exact:true}).click();
 await expect(page.locator('.reader-document')).toHaveAttribute('data-flip-ready','true');
 await select(page,'Trung Quốc');const before=await page.locator('.prose').evaluate(el=>getComputedStyle(el).transform);
 await page.getByRole('button',{name:'Tra VI↔EN',exact:true}).click();await expect(page.locator('.novel-lookup mark').first()).toContainText('China');
 await page.getByRole('button',{name:'Đóng',exact:true}).click();expect(await page.locator('.prose').evaluate(el=>getComputedStyle(el).transform)).toBe(before);
});
test('keeps downloaded lookup data after a failed update and resolves it with no network',async({page,context})=>{
 test.setTimeout(120000);await page.goto('/vi/read/chapter-1');await expect(page.locator('.reader-shell')).toHaveAttribute('data-ready','true');
 await page.evaluate(async()=>{
  performance.setResourceTimingBufferSize(0);
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('truyen-ky-man-luc',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['annotations','preferences','progress'],'readwrite');tx.objectStore('annotations').put({id:'lookup-keep-note',chapterId:'chapter-1',locale:'vi',revision:1,start:0,end:4,text:'Quan',color:'#f3dd83',note:'keep',createdAt:new Date().toISOString()});tx.objectStore('preferences').put('keep','lookup-guard');tx.objectStore('progress').put({chapterId:'chapter-18',revision:1,page:0,ratio:.25},'en:last');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
 });
 await page.getByRole('button',{name:'Tiện ích đọc',exact:true}).click();await page.getByRole('button',{name:'Tải VI/EN để đọc ngoại tuyến',exact:true}).click();
 await expect(page.getByRole('link',{name:'Đọc bản đã tải',exact:true})).toBeVisible({timeout:90000});
 await expect(page.locator('.offline-download')).toContainText('20 chương');
 await page.evaluate(()=>{(window as Window&{lookupTransfers?:number}).lookupTransfers=0;const original=window.fetch.bind(window);window.fetch=(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input),location.href);
  if(url.pathname.startsWith('/storage/v1/object/sign/novel-alignments/')){const tracked=window as Window&{lookupTransfers?:number};tracked.lookupTransfers=(tracked.lookupTransfers??0)+1;}
  return url.pathname==='/api/novel-alignment/chapter-2'?Promise.resolve(new Response('{"error":"temporary"}',{status:503,headers:{'Content-Type':'application/json'}})):original(input,init);
 };});
  await page.getByRole('button',{name:'Cập nhật bản tải',exact:true}).click();await expect(page.locator('.offline-download [role=alert]')).toContainText('Chưa tải hoàn tất',{timeout:60000});
 expect(await page.evaluate(()=>(window as Window&{lookupTransfers?:number}).lookupTransfers)).toBe(0);
 await context.setOffline(true);await page.goto('/offline?locale=vi&chapter=chapter-1');await expect(page.locator('.reader-shell')).toHaveAttribute('data-ready','true');
 await select(page,'Trung Quốc');await page.getByRole('button',{name:'Tra VI↔EN',exact:true}).click();await expect(page.locator('.novel-lookup mark').first()).toContainText('China');
 await expect(page.locator('.novel-lookup')).toContainText('đã tải trên thiết bị');
 await page.getByRole('button',{name:'Đóng',exact:true}).click();await context.setOffline(false);
 await page.getByRole('button',{name:'Tiện ích đọc',exact:true}).click();await page.getByRole('button',{name:'Xóa bản tải',exact:true}).click();
 const kept=await page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('truyen-ky-man-luc',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const tx=db.transaction(['annotations','preferences','progress']);
  const get=<T,>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const [note,guard,progress,keys]=await Promise.all([get(tx.objectStore('annotations').get('lookup-keep-note')),get(tx.objectStore('preferences').get('lookup-guard')),get(tx.objectStore('progress').get('en:last')),get(tx.objectStore('preferences').getAllKeys())]);db.close();return {note,guard,progress,keys};
 });
 expect(kept.note.note).toBe('keep');expect(kept.guard).toBe('keep');expect(kept.progress.ratio).toBe(.25);expect(kept.keys.filter(k=>String(k).startsWith('offline-novel-alignment:'))).toEqual([]);
});
