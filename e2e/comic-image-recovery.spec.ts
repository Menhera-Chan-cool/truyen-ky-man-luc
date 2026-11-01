import {test, expect} from "@playwright/test";

for (const zoom of [50, 10]) {
  test(`failed image and retry preserve page geometry at ${zoom}% zoom`, async ({page, isMobile}, testInfo) => {
    test.skip(isMobile && zoom === 10, "Mobile uses its existing full-width reader.");
    const errors: string[] = [];page.on("pageerror", e => errors.push(e.message));
    await page.goto("/vi");
    await page.evaluate(async zoom => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("tkml-comic-local-preview", 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("chapters", {keyPath: "id"});
          request.result.createObjectStore("preferences");
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result, tx = db.transaction("preferences", "readwrite");
          tx.objectStore("preferences").put({mode: "vertical", zoom, stretch: true}, "settings:comix-v2");
          tx.oncomplete = () => {db.close();resolve();};
          tx.onerror = () => {db.close();reject(tx.error);};
        };
      });
    }, zoom);
    let release!: () => void, requests = 0;
    const blocked = new Promise<void>(resolve => {release = resolve;});
    await page.route(/\/(?:api\/comic\/assets|comic-demo)\//, async route => {
      if (requests++ === 0) {await blocked;await route.abort("failed");}
      else await route.continue();
    });
    await page.goto("/vi/comic/chapter-1", {waitUntil: "domcontentloaded"});
    await expect(page.locator(".comic-reader")).toHaveAttribute("data-ready", "true");
    const figure = page.locator(".cc-page").first();
    await expect(figure.locator("img")).toBeAttached();
    const before = await figure.evaluate(el => el.getBoundingClientRect().height);
    release();
    const error = figure.getByRole("alert");await expect(error).toBeAttached();
    const failed = await figure.evaluate(el => el.getBoundingClientRect().height);
    console.log(JSON.stringify({zoom, isMobile, before, failed, delta: failed - before}));
    expect(Math.abs(failed - before)).toBeLessThan(2);
    await error.screenshot({path: testInfo.outputPath("image-error.png")});
    await error.getByRole("button", {name: "Thử lại", exact: true}).click();
    await expect.poll(() => figure.locator("img").evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0), {timeout: 20000}).toBe(true);
    const restored = await figure.evaluate(el => el.getBoundingClientRect().height);
    expect(Math.abs(restored - before)).toBeLessThan(2);
    expect(errors).toEqual([]);
  });
}
