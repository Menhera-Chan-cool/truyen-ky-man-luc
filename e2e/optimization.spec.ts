import { test, expect } from "@playwright/test";
test("keeps the production sign-in bundle below 400 KB compressed", async ({
  page,
}) => {
  test.skip(
    !process.env.BASE_URL?.startsWith("https://"),
    "Compressed transfer is measured on the hosted build",
  );
  await page.goto("/admin?lang=vi", { waitUntil: "networkidle" });
  const bytes = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter(
        (e) => (e as PerformanceResourceTiming).initiatorType === "script",
      )
      .reduce(
        (s, e) => s + (e as PerformanceResourceTiming).encodedBodySize,
        0,
      ),
  );
  expect(bytes).toBeGreaterThan(0);
  expect(bytes).toBeLessThan(400_000);
});
test("coalesces scroll writes and flushes exact progress on navigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { progressPuts: number }).progressPuts = 0;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "progress")
        (window as unknown as { progressPuts: number }).progressPuts++;
      return put.apply(this, args);
    };
  });
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const scroller = page.locator(".reading-scroll");
  const before = await page.evaluate(
    () => (window as unknown as { progressPuts: number }).progressPuts,
  );
  await scroller.evaluate(async (node) => {
    for (let i = 0; i < 90; i++) {
      await new Promise(requestAnimationFrame);
      node.scrollTop += 12;
    }
  });
  const ratio = await scroller.evaluate(
    (n) => n.scrollTop / (n.scrollHeight - n.clientHeight),
  );
  expect(
    (await page.evaluate(
      () => (window as unknown as { progressPuts: number }).progressPuts,
    )) - before,
  ).toBeLessThan(10);
  await page.getByRole("button", { name: "Chương sau", exact: true }).click();
  await expect(page.locator(".chapter-title")).toContainText("Chương 2");
  await page.getByRole("button", { name: "Chương trước", exact: true }).click();
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect
    .poll(() =>
      scroller.evaluate((n) => n.scrollTop / (n.scrollHeight - n.clientHeight)),
    )
    .toBeCloseTo(ratio, 2);
  await page.reload();
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect
    .poll(() =>
      scroller.evaluate((n) => n.scrollTop / (n.scrollHeight - n.clientHeight)),
    )
    .toBeCloseTo(ratio, 2);
});

test("flushes pending scroll progress when the page is leaving", async ({
  page,
}) => {
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const latest = await page.locator(".reading-scroll").evaluate((n) => {
    n.scrollTop = 940;
    return n.scrollTop / (n.scrollHeight - n.clientHeight);
  });
  await page.waitForTimeout(50);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const open = indexedDB.open("truyen-ky-man-luc");
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const db = open.result;
              const request = db
                .transaction("progress")
                .objectStore("progress")
                .get("vi:chapter-1");
              request.onsuccess = () => {
                resolve(request.result.ratio);
                db.close();
              };
              request.onerror = () => {
                reject(request.error);
                db.close();
              };
            };
          }),
      ),
    )
    .toBeCloseTo(latest, 4);
});
test("keeps desktop sidebar geometry before JavaScript runs", async ({
  browser,
}, info) => {
  test.skip(info.project.name !== "desktop", "Desktop sidebar geometry");
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("/vi/read/chapter-1");
  expect((await page.locator(".reader-main").boundingBox())!.x).toBe(310);
  await context.close();
});
test("retains dark appearance across book, locale and reader navigation", async ({
  page,
}) => {
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Cài đặt trình đọc", exact: true })
    .click();
  await page.getByRole("button", { name: "Tối", exact: true }).click();
  await expect
    .poll(async () =>
      (await page.context().cookies()).some((c) => c.name === "book-reader"),
    )
    .toBe(true);
  const response = await page.request.get("/vi");
  expect(await response.text()).toContain('class="book-site site-dark"');
  await page.goto("/vi");
  await expect(page.locator(".book-site")).toHaveClass(/site-dark/);
  await page.getByRole("link", { name: "English", exact: true }).click();
  await expect(page.locator(".book-site")).toHaveClass(/site-dark/);
  await page.goto("/en/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveCSS("color-scheme", "dark");
  await page.goto("/en");
  await page
    .getByRole("button", { name: "Toggle light / dark", exact: true })
    .click();
  await expect(page.locator(".book-site")).not.toHaveClass(/site-dark/);
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveCSS(
    "color-scheme",
    "light",
  );
});
