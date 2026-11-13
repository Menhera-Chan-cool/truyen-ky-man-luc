import {test,expect,type Page} from '@playwright/test';
test.skip(process.env.CONTEXTUAL_PREVIEW!=='1','Requires locally generated contextual alignment artifacts');
test.setTimeout(60000);
async function lookup(page:Page,locale:'vi'|'en',chapter:number,quote:string,after=''){
 await page.goto(`/${locale}/read/chapter-${chapter}`);await expect(page.locator('.reader-shell')).toHaveAttribute('data-ready','true');
 await page.locator('.chapter-content').evaluate((root,{quote,after})=>{
  const text=root.textContent!,from=after?text.indexOf(after):0,start=text.indexOf(quote,from);if(from<0||start<0)throw Error('Expected occurrence absent');
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),range=document.createRange();let node:Node|null,at=0,found=false;
  while((node=walker.nextNode())){const size=node.textContent?.length??0;if(!found&&start<at+size){range.setStart(node,start-at);found=true;}if(found&&start+quote.length<=at+size){range.setEnd(node,start+quote.length-at);break;}at+=size;}
  range.startContainer.parentElement?.scrollIntoView({block:'center'});const selection=getSelection()!;selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));
 },{quote,after});
 const before=await page.locator('.reading-scroll').evaluate(el=>el.scrollTop);
 await page.getByRole('button',{name:locale==='vi'?'Tra VI↔EN':'Look up VI↔EN',exact:true}).click();
 await expect(page.locator('.lookup-passage').first()).toBeVisible();return before;
}
test('keeps a complete dialogue counterpart and the original reading position',async({page,context})=>{
 const before=await lookup(page,'vi',1,'Tôi vâng chỉ của đức vua tôi, mời ngài đến chơi nói chuyện.');
 const quote='By command of my sovereign, I have come to invite you for a visit and a conversation.';
 await expect(page.locator('.lookup-passage')).toContainText(quote);await expect(page.locator('.lookup-passage mark')).toHaveCount(1);await expect(page.locator('.lookup-passage mark')).toContainText(quote);
 expect(context.pages()).toHaveLength(1);await page.getByRole('button',{name:'Đóng',exact:true}).click();expect(await page.locator('.reading-scroll').evaluate(el=>el.scrollTop)).toBe(before);
});
test('matches critique headings through structural roles',async({page})=>{
 await lookup(page,'en',2,'Critique');await expect(page.locator('.lookup-passage')).toHaveText(/lời bình/iu);
});
test('shows the full paired note instead of inventing a missing caption counterpart',async({page})=>{
 await lookup(page,'en',2,'Gu Yaya','Gu Yaya:');
 await expect(page.locator('.novel-lookup')).toContainText('No direct word counterpart was found.');await expect(page.locator('.lookup-passage')).toContainText('Cổ áp Nha');await expect(page.locator('.lookup-passage mark')).toHaveCount(0);
});
test('matches the note by content despite different VI and EN note numbers',async({page})=>{
 await lookup(page,'vi',3,'Hàn Dũ','Hàn Dũ là một');await expect(page.locator('.lookup-passage mark')).toHaveText('Han Yu');
});
