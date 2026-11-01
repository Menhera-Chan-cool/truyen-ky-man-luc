import {test,expect} from "@playwright/test";
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
