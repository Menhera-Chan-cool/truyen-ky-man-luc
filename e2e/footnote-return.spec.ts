import {test,expect,type Page} from "@playwright/test";

async function settle(page:Page){
 await expect(page.locator('.reader-shell')).toHaveAttribute('data-ready','true');
 await page.evaluate(async()=>{await document.fonts.ready;await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));});
 await expect(page.locator('.reader-document[data-flipping]')).toHaveCount(0);
}
async function position(page:Page,index:number){
 return page.locator('.footnote-ref').nth(index).evaluate(el=>{
  const s=document.querySelector('.reading-scroll')!,r=el.getBoundingClientRect();
  return {top:s.scrollTop,left:s.scrollLeft,x:r.x,y:r.y,transform:getComputedStyle(document.querySelector('.prose')!).transform};
 });
}
for(const locale of ['vi','en'])for(const layout of ['scroll','paged','book']){
 test(`returns to the exact line and scroll after a footnote (${locale}, ${layout})`,async({page,isMobile},testInfo)=>{
  test.skip(isMobile,'Touch notes stay in their popup without navigating');
  const L=(vi:string,en:string)=>locale==='vi'?vi:en;
  await page.goto(`/${locale}/read/chapter-1`);await settle(page);
  if(layout!=='scroll'){
   await page.getByRole('button',{name:L('Cài đặt trình đọc','Reader settings'),exact:true}).click();
   await page.getByRole('button',{name:layout==='book'?L('Sách','Book'):L('Trang đơn','Single page'),exact:true}).click();
   await page.getByRole('button',{name:L('Đóng','Close'),exact:true}).click();await settle(page);
  }
  const index=2,ref=page.locator('.footnote-ref').nth(index);
  await ref.focus();await page.keyboard.press('Escape');
  if(layout==='scroll')await ref.evaluate(el=>{const s=document.querySelector('.reading-scroll')!;s.scrollTop+=el.getBoundingClientRect().top-s.getBoundingClientRect().top-137.25;});
  const before=await position(page,index),url=page.url();
  await ref.click();await expect(page).toHaveURL(/#reader-footnote-/);
  const back=page.getByRole('button',{name:L('Quay lại chỗ đang đọc','Back to reading'),exact:true});
  await expect(back).toBeVisible();
  if(locale==='vi'&&layout==='scroll'){
   await back.hover();
   expect(await back.evaluate(el=>{const c=document.createElement('canvas'),ctx=c.getContext('2d')!;c.width=c.height=1;ctx.fillStyle=getComputedStyle(el).backgroundColor;ctx.fillRect(0,0,1,1);return ctx.getImageData(0,0,1,1).data[3];})).toBe(255);
   await page.screenshot({path:testInfo.outputPath('return-button.png')});
  }
  await back.click();await expect(page).toHaveURL(url);
  await expect.poll(()=>position(page,index)).toEqual(before);await expect(back).toHaveCount(0);
  await ref.click();await expect(back).toBeVisible();await page.goBack();await expect(page).toHaveURL(url);
  await expect.poll(()=>position(page,index)).toEqual(before);
  await page.goForward();await expect(back).toBeVisible();await back.click();
  await expect.poll(()=>position(page,index)).toEqual(before);
  if(layout==='scroll'){
   await ref.evaluate(el=>history.replaceState(history.state,'',el.getAttribute('href')!));
   await ref.click();await expect(back).toBeVisible();await back.click();
   await expect.poll(()=>position(page,index)).toEqual(before);await expect(back).toHaveCount(0);
  }
 });
}
test('touch footnote popup keeps the exact scroll and needs no jump-back button',async({page,isMobile})=>{
 test.skip(!isMobile,'Touch only');
 await page.goto('/vi/read/chapter-1');await settle(page);
 const index=2,ref=page.locator('.footnote-ref').nth(index);await ref.scrollIntoViewIfNeeded();
 const before=await position(page,index);await ref.tap();
 const popup=page.getByRole('dialog',{name:'Chú thích',exact:true});await expect(popup).toBeVisible();
 await popup.getByRole('button',{name:'Đóng chú thích',exact:true}).tap();
 expect(await position(page,index)).toEqual(before);
 await expect(page.getByRole('button',{name:'Quay lại chỗ đang đọc',exact:true})).toHaveCount(0);
});

test('a font change at the note returns the original text line to its old screen position',async({page,isMobile})=>{
 test.skip(isMobile,'Touch notes do not jump');
 await page.goto('/vi/read/chapter-1');await settle(page);
 const ref=page.locator('.footnote-ref').nth(2);await ref.scrollIntoViewIfNeeded();
 const marker=await page.locator('.prose').evaluate(root=>{
  const v=document.querySelector('.reading-scroll')!.getBoundingClientRect(),walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null,total=0;
  while((node=walk.nextNode())){
   const range=document.createRange();
   for(let i=0;i<(node.textContent?.length??0);i++){
    range.setStart(node,i);range.setEnd(node,i+1);const rect=range.getBoundingClientRect();
    if(rect.width>0&&rect.height>0&&rect.bottom>v.top&&rect.top<v.bottom)return {offset:total+i,y:rect.top-v.top};
   }
   total+=node.textContent?.length??0;
  }
  throw Error('No visible text');
 });
 await ref.click();
 await page.getByRole('button',{name:'Cài đặt trình đọc',exact:true}).click();
 await page.getByRole('slider',{name:'Cỡ chữ',exact:true}).fill('26');
 await page.getByRole('button',{name:'Đóng',exact:true}).click();await settle(page);
 await page.getByRole('button',{name:'Quay lại chỗ đang đọc',exact:true}).click();
 await expect.poll(()=>page.locator('.prose').evaluate((root,at)=>{
  const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null,total=0;
  while((node=walk.nextNode())){const size=node.textContent?.length??0;if(total+size>at){const range=document.createRange();range.setStart(node,at-total);range.setEnd(node,at-total+1);return range.getBoundingClientRect().top-document.querySelector('.reading-scroll')!.getBoundingClientRect().top;}total+=size;}
  return NaN;
 },marker.offset)).toBeCloseTo(marker.y,0);
});

test('comparison columns return independently to their exact scroll',async({page,isMobile})=>{
 test.skip(isMobile,'Comparison is a desktop reading flow');
 await page.goto('/vi/read/chapter-1');await settle(page);
 await page.getByRole('button',{name:'Tiện ích đọc',exact:true}).click();
 await page.getByRole('button',{name:'Đọc đối chiếu VI–EN',exact:true}).click();
 await expect(page.locator('.parallel-edition')).toHaveCount(2);
 for(const locale of ['vi','en']){
  const column=page.locator(`.parallel-edition[lang=${locale}]`),ref=column.locator('.footnote-ref').nth(2);
  await ref.scrollIntoViewIfNeeded();
  await ref.evaluate(el=>{const s=el.closest('.parallel-scroll')!;s.scrollTop+=el.getBoundingClientRect().top-s.getBoundingClientRect().top-112.25;});
  const measure=()=>ref.evaluate(el=>({top:el.closest('.parallel-scroll')!.scrollTop,y:el.getBoundingClientRect().y}));
  const before=await measure();await ref.click();
  await column.getByRole('button',{name:locale==='vi'?'Quay lại chỗ đang đọc':'Back to reading',exact:true}).click();
  expect(await measure()).toEqual(before);
 }
});

test('the downloaded-book route restores the same reading scroll',async({page,isMobile})=>{
 test.skip(isMobile,'Touch notes do not navigate');
 await page.goto('/vi/read/chapter-1');await settle(page);
 await page.evaluate(async()=>{
  const book=await (await fetch('/api/book')).json();
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('truyen-ky-man-luc',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('preferences','readwrite');tx.objectStore('preferences').put({book,downloadedAt:new Date().toISOString(),cacheName:'tkml-offline-data-11111111-1111-4111-8111-111111111111'},'offline-book:v1');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
 });
 await page.goto('/offline?locale=vi&chapter=chapter-1');await settle(page);
 const ref=page.locator('.footnote-ref').nth(2);await ref.scrollIntoViewIfNeeded();const before=await position(page,2);
 await ref.click();await page.getByRole('button',{name:'Quay lại chỗ đang đọc',exact:true}).click();
 await expect(page).toHaveURL(/offline\?locale=vi&chapter=chapter-1$/);
 await expect.poll(()=>position(page,2)).toEqual(before);
});
