import {test,expect} from '@playwright/test';
import fixture from '../tests/fixtures/poetry-screenshots.json' with {type:'json'};
test.skip(process.env.CONTEXTUAL_PREVIEW!=='1','Requires generated poetry artifacts');
for(const id of ['screenshot-01','screenshot-06','screenshot-08','screenshot-10','screenshot-13']){
 const c=fixture.cases.find(c=>c.id===id)!;
 test('keeps the screenshot poetry selection inside its actual counterpart: '+id,async({page})=>{
  await page.goto('/en/read/'+c.chapterId);await expect(page.locator('.reader-shell')).toHaveAttribute('data-ready','true');
  await page.locator('.chapter-content').evaluate((root,source)=>{
   const text=root.textContent!;if(text.slice(source.start,source.end)!==source.text)throw Error('Screenshot source no longer matches this edition');
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),range=document.createRange();let node:Node|null,at=0,found=false;
   while((node=walker.nextNode())){const size=node.textContent?.length??0;if(!found&&source.start<at+size){range.setStart(node,source.start-at);found=true;}if(found&&source.end<=at+size){range.setEnd(node,source.end-at);break;}at+=size;}
   range.startContainer.parentElement?.scrollIntoView({block:'center'});const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));
  },c.source);
  const before=await page.locator('.reading-scroll').evaluate(el=>el.scrollTop);
  const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/novel-lookup'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Look up VI↔EN',exact:true}).click();
  const response=await pending;expect(response.ok()).toBe(true);const result=await response.json();
  expect(['match','uncertain','context-only']).toContain(result.status);expect(result.passages.length).toBeGreaterThan(0);
  for(const p of result.passages)expect(c.allowedTargetPoems.some(scope=>p.target.start>=scope.start&&p.target.end<=scope.end)).toBe(true);
  await expect(page.locator('.lookup-passage').first()).toBeVisible();
  if(result.status==='context-only')expect(result.passages.flatMap((p:any)=>p.highlights)).toEqual([]);
  await page.getByRole('button',{name:'Close',exact:true}).click();expect(await page.locator('.reading-scroll').evaluate(el=>el.scrollTop)).toBe(before);
 });
}
