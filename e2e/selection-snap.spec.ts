import {test,expect,type Page} from './no-egress';
// A mouse selection that starts or ends in the middle of a word takes the whole word when the button is released; while the button is held it stays as dragged.
// Viewport point of the middle of the character at `offset` of the chapter text (the page is scrolled so the quote is in view first).
async function points(page:Page,quote:string,offsets:number[],scroll:boolean){
 return page.locator('.chapter-content').evaluate((root,[quote,offsets,scroll])=>{
  const at=root.textContent!.indexOf(quote as string);if(at<0)throw Error('quote missing');
  const nodes:[Node,number][]=[];const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null,seen=0;
  while((node=walk.nextNode())){nodes.push([node,seen]);seen+=node.textContent!.length;}
  const range=(offset:number)=>{const [n,base]=[...nodes].reverse().find(([,b])=>b<=offset)!;const r=document.createRange();r.setStart(n,offset-base);r.setEnd(n,offset-base+1);return r;};
  if(scroll)range(at).startContainer.parentElement!.scrollIntoView({block:'center'});
  return (offsets as number[]).map(o=>{const r=range(at+o).getBoundingClientRect();return {x:Math.round((r.left+r.right)/2),y:Math.round((r.top+r.bottom)/2)};});
 },[quote,offsets,scroll] as [string,number[],boolean]);
}
test('widens a mouse selection that cuts a word in half to whole words at release',async({page,isMobile})=>{
 test.skip(isMobile,'mouse drag selection');
 await page.goto('/vi/read/chapter-1');await expect(page.locator('.reader-shell')).toHaveAttribute('data-ready','true');
 const quote='Trung Quốc';
 // the fonts shift the text once they load: measure after they have, and after the scroll has finished
 await page.evaluate(()=>document.fonts.ready);
 // the first press on the page settles the layout (it closes the side panel of the table of contents when it is open), so press once on an empty margin before measuring
 await page.mouse.click(1200,400);await page.waitForTimeout(400);
 await points(page,quote,[0],true);await page.waitForTimeout(500);
 // the middle of "u" in "Trung" and of "ố" in "Quốc"
 const [from,to]=await points(page,quote,[2,8],false);
 await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});
 // still dragging: the selection is what the browser made of the drag, cut in the middle of words
 const held=await page.evaluate(()=>getSelection()!.toString());
 expect(held).not.toBe(quote);expect(held.length).toBeGreaterThan(3);
 await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>getSelection()!.toString()),{timeout:3000}).toBe(quote);
 await expect(page.getByRole('region',{name:/Thao tác với đoạn chọn/})).toBeVisible();
});
