import {test,expect} from "@playwright/test";
test("VI/EN popovers stay compact and inside the phone viewport",async({page,isMobile},testInfo)=>{
  for(const size of isMobile?[{width:390,height:844},{width:844,height:390}]:[{width:1280,height:720}]){
    await page.setViewportSize(size);
    await page.goto("/vi/comic/chapter-1");await expect(page.locator(".comic-reader")).toHaveAttribute("data-ready","true");
    await page.addStyleTag({content:":where([popover]) { height: auto; }"});
    for(const name of ["Tiếng Việt","English"]){
      const button=page.getByRole("button",{name,exact:true});
      if(isMobile)await button.tap();else await button.hover();
      const menu=page.getByRole("menu");await expect(menu).toBeVisible();
      // Retained opposing popover insets must not stretch the grid to the viewport.
      await menu.evaluate(el=>{el.style.bottom="8px";});
      const bounds=await menu.boundingBox();expect(bounds).not.toBeNull();
      console.log(JSON.stringify({name,viewport:size,bounds}));
      expect(bounds!.height).toBeLessThan(160);expect(bounds!.width).toBeLessThan(230);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(size.width);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(size.height);
      const items=menu.getByRole("menuitem");await expect(items).toHaveCount(2);
      const a=await items.nth(0).boundingBox(),b=await items.nth(1).boundingBox();
      expect(b!.y-(a!.y+a!.height)).toBeLessThan(8);
      await menu.screenshot({path:testInfo.outputPath(`${size.width}-${name==="English"?"en":"vi"}.png`)});
      if(isMobile)await button.tap();else{await button.focus();await page.keyboard.press("Escape");}await expect(menu).toHaveCount(0);
    }
  }
});

test("VI/EN menus select one same-chapter edition and support keyboard and outside dismissal",async({page,isMobile})=>{
  await page.goto("/vi/read/chapter-2");
  const nav=page.getByRole("navigation",{name:"Phiên bản đọc",exact:true});
  await expect(nav.getByRole("button",{name:"Tiếng Việt",exact:true})).toBeVisible();
  await expect(nav.locator(":scope > a")).toHaveCount(0);
  const vi=nav.getByRole("button",{name:"Tiếng Việt",exact:true});
  if(isMobile)await vi.tap();else await vi.hover();
  await expect(page.getByRole("menuitem",{name:"Novel",exact:true})).toHaveAttribute("href","/vi/read/chapter-2");
  await page.getByRole("menuitem",{name:"TT",exact:true}).click();
  await expect(page).toHaveURL(/\/vi\/comic\/chapter-2$/);
  await expect(page.locator(".comic-reader")).toBeVisible();await expect(page.locator(".reader-shell")).toHaveCount(0);
  await expect(page.locator(".comic-reader")).toHaveAttribute("data-ready","true");
  if(await page.locator(".comic-reader").getAttribute("data-chrome")==="false"){const stage=page.locator(".cc-stage");if(isMobile){await stage.tap({position:{x:180,y:350}});await stage.tap({position:{x:180,y:350}});}else await stage.dblclick({position:{x:180,y:350}});}
  const en=page.getByRole("button",{name:"English",exact:true});
  await en.focus();await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem",{name:"Novel",exact:true})).toBeFocused();
  await page.locator(".cc-stage").evaluate(el=>el.dispatchEvent(new Event("scroll")));
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("ArrowDown");await expect(page.getByRole("menuitem",{name:"Comic",exact:true})).toBeFocused();
  await page.keyboard.press("Escape");await expect(en).toBeFocused();await expect(page.getByRole("menu")).toHaveCount(0);
  if(isMobile)await en.tap();else await en.hover();
  await page.getByRole("menuitem",{name:"Comic",exact:true}).click();
  await expect(page).toHaveURL(/\/en\/comic\/chapter-2$/);
  await expect(page.locator(".cc-chapter-label")).toHaveText("Chapter 2");await expect(page.locator(".comic-reader")).toHaveAttribute("data-ready","true");await expect(page.locator(".comic-reader")).toHaveAttribute("data-ui-ready","true");
  if(await page.locator(".comic-reader").getAttribute("data-chrome")==="false"){const stage=page.locator(".cc-stage");if(isMobile){await stage.tap({position:{x:180,y:350}});await stage.tap({position:{x:180,y:350}});}else await stage.dblclick({position:{x:180,y:350}});}
  await page.getByRole("button",{name:"English",exact:true}).click();
  await page.getByRole("menuitem",{name:"Novel",exact:true}).click();
  await expect(page).toHaveURL(/\/en\/read\/chapter-2$/);
  await page.getByRole("button",{name:"English",exact:true}).click();
  await page.locator(".reading-window").click({position:{x:10,y:200}});await expect(page.getByRole("menu")).toHaveCount(0);
});
