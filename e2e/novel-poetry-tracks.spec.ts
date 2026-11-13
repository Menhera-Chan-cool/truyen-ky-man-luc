import {test,expect} from '@playwright/test';
test.skip(process.env.CONTEXTUAL_PREVIEW!=='1','Requires generated book-specific artifacts');
test('keeps the complete poetry couplet within one Vietnamese rendering',async({page})=>{
 await page.goto('/en/read/chapter-1');await expect(page.locator('.reader-shell')).toHaveAttribute('data-ready','true');
 await page.locator('.chapter-content').evaluate(root=>{
  const text=root.textContent!,start=text.indexOf('Five long years of toil and struggle'),last=text.indexOf('Duke of Lu',start),end=text.indexOf('Having finished the inscription',last);
  if(start<0||last<0||end<last)throw Error('Expected poem couplet absent');
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),range=document.createRange();let node:Node|null,at=0,found=false;
  while((node=walker.nextNode())){const size=node.textContent?.length??0;if(!found&&start<at+size){range.setStart(node,start-at);found=true;}if(found&&end<=at+size){range.setEnd(node,end-at);break;}at+=size;}
  range.startContainer.parentElement?.scrollIntoView({block:'center'});const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));
 });
 await page.getByRole('button',{name:'Look up VI↔EN',exact:true}).click();await expect(page.locator('.lookup-passage').first()).toBeVisible();
 const text=await page.locator('.lookup-passage').allTextContents(),combined=text.join('\n');
 const original=combined.includes('Kinh doanh ngũ tải'),modern=combined.includes('Năm năm lăn lộn');
 expect(original||modern).toBe(true);expect(original&&modern).toBe(false);
 expect(combined).toContain(original?'Tiêu đắc khu khu':'Còn được vùi');
});

test('shows comparison highlights while a font is still loading',async({page})=>{
 await page.goto('/vi/read/chapter-1');await expect(page.locator('.reader-shell')).toHaveAttribute('data-ready','true');
 await page.locator('.chapter-content').evaluate(root=>{
  const text=root.textContent!,start=text.indexOf('Trung Quốc'),end=start+'Trung Quốc'.length;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),range=document.createRange();let node:Node|null,at=0,found=false;
  while((node=walker.nextNode())){const size=node.textContent?.length??0;if(!found&&start<at+size){range.setStart(node,start-at);found=true;}if(found&&end<=at+size){range.setEnd(node,end-at);break;}at+=size;}
  const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));
 });
 await page.getByRole('button',{name:'Tra VI↔EN',exact:true}).click();await expect(page.locator('.novel-lookup mark').first()).toContainText('China');
 await page.evaluate(()=>Object.defineProperty(document.fonts,'ready',{configurable:true,get:()=>new Promise(()=>{})}));
 await page.getByRole('button',{name:'Mở đối chiếu',exact:true}).click();
 for(const l of ['vi','en'])await expect(page.locator(`.parallel-edition[lang=${l}] .lookup-context`).first()).toBeVisible();
});
