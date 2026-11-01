import {test, expect} from "@playwright/test";

test("unchanged network information preserves pending preloads; Data Saver still updates policy", async ({page}) => {
  await page.addInitScript(() => {
    const w = window as any;
    w.auditCommits = 0;w.preloadAudit = {created: 0, cancelled: 0};
    w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {supportsFiber: true, inject: () => 1, onCommitFiberRoot: () => w.auditCommits++, onCommitFiberUnmount() {}, checkDCE() {}};
    const NativeImage = window.Image;
    // Hold speculative image completion so cancellation/recreation is observable, without changing the displayed image.
    w.Image = function () {
      const image = new NativeImage(), remove = image.removeAttribute.bind(image);
      w.preloadAudit.created++;
      Object.defineProperty(image, "src", {configurable: true, get: () => "", set() {}});
      image.removeAttribute = name => {if (name === "src") w.preloadAudit.cancelled++;remove(name);};
      return image;
    };
  });
  await page.goto("/vi");
  test.skip(!await page.evaluate(() => !!(navigator as any).connection), "This browser has no Network Information API.");
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("tkml-comic-local-preview", 1);
      request.onupgradeneeded = () => {request.result.createObjectStore("chapters", {keyPath: "id"});request.result.createObjectStore("preferences");};
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction("preferences", "readwrite");
        tx.objectStore("preferences").put({mode: "single", preload: "some"}, "settings:comix-v2");
        tx.oncomplete = () => {db.close();resolve();};tx.onerror = () => {db.close();reject(tx.error);};
      };
    });
  });
  await page.goto("/vi/comic/chapter-1");
  await expect(page.locator(".comic-reader")).toHaveAttribute("data-ready", "true");
  await expect.poll(() => page.evaluate(() => (window as any).preloadAudit.created)).toBeGreaterThan(0);
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(async () => {
    const w = window as any, network = (navigator as any).connection;
    await new Promise(r => setTimeout(r, 150));
    const before = {...w.preloadAudit};w.auditCommits = 0;
    for (let n = 0; n < 6; n++) {network.dispatchEvent(new Event("change"));await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));}
    return {before, after: {...w.preloadAudit}, commits: w.auditCommits};
  });
  console.log(JSON.stringify(result));
  expect(result.after).toEqual(result.before);
  expect(result.commits).toBe(0);
  await page.evaluate(() => {const n = (navigator as any).connection;Object.defineProperty(n, "saveData", {configurable: true, value: true});n.dispatchEvent(new Event("change"));});
  await expect.poll(() => page.evaluate(() => (window as any).preloadAudit.cancelled)).toBeGreaterThan(result.after.cancelled);
  await page.evaluate(() => {const n = (navigator as any).connection;Object.defineProperty(n, "saveData", {configurable: true, value: false});n.dispatchEvent(new Event("change"));});
  await expect.poll(() => page.evaluate(() => (window as any).preloadAudit.created)).toBeGreaterThan(result.after.created);
});
