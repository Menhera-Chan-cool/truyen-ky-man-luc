import { test, expect, type Page } from "@playwright/test";
async function settings(page: Page) {
  await page
    .getByRole("button", { name: "Reader settings", exact: true })
    .click();
  await page.getByText("Reading data on this device", { exact: true }).click();
}
const sample = (note = "Imported local note") => ({
  format: "truyen-ky-man-luc-reader-backup",
  version: 1,
  bookId: "truyen-ky-man-luc",
  exportedAt: "2026-10-23T00:00:00.000Z",
  settings: null,
  progress: [
    {
      key: "en:chapter-1",
      value: { chapterId: "chapter-1", revision: 1, ratio: 0.4, page: 0 },
    },
  ],
  annotations: [
    {
      id: "backup-test",
      chapterId: "chapter-1",
      locale: "en",
      revision: 1,
      start: 0,
      end: 5,
      text: "Hello",
      color: "#f3dd83",
      note,
      createdAt: 1,
    },
  ],
});
async function file(page: Page, value: unknown) {
  await page.getByLabel("Reading data backup file").setInputFiles({
    name: "reader.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(value)),
  });
}
test("exports and restores notes, settings and current progress on a fresh device", async ({
  page,
  browser,
}) => {
  await page.goto("/en/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.locator(".prose").evaluate((root) => {
    const p = [...root.querySelectorAll("p")].find(
        (p) => (p.textContent?.length ?? 0) > 80,
      )!,
      n = document.createTreeWalker(p, NodeFilter.SHOW_TEXT).nextNode()!,
      r = document.createRange();
    r.setStart(n, 0);
    r.setEnd(n, 35);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(r);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await page
    .getByRole("textbox", { name: "Note for this passage" })
    .fill("Portable device note");
  await page
    .getByRole("button", { name: "Highlight #f3dd83", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reader settings", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Font family", exact: true })
    .selectOption("Lora");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.locator(".reading-scroll").evaluate((n) => (n.scrollTop = 1600));
  await page.waitForTimeout(100);
  await settings(page);
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export JSON backup", exact: true })
    .click();
  const download = await downloading;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks);
  const saved = JSON.parse(raw.toString());
  expect(saved.annotations).toHaveLength(1);
  expect(saved.settings.font).toBe("Lora");
  expect(
    saved.progress.find((p: { key: string }) => p.key === "en:chapter-1").value
      .ratio,
  ).toBeGreaterThan(0);
  const context = await browser.newContext({ viewport: page.viewportSize()! });
  const target = await context.newPage();
  try {
    await target.goto("/en/read/chapter-1");
    await expect(target.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await settings(target);
    await target.getByLabel("Reading data backup file").setInputFiles({
      name: "reader.json",
      mimeType: "application/json",
      buffer: raw,
    });
    await expect(
      target.getByText(/Backup preview: 1 notes\/bookmarks/),
    ).toBeVisible();
    await target
      .getByRole("button", { name: "Restore backup", exact: true })
      .click();
    await expect(
      target.getByRole("status").filter({ hasText: "Restored backup" }),
    ).toBeVisible();
    await expect(target.locator(".prose")).toHaveCSS("font-family", /Lora/);
    await target.getByRole("button", { name: "Close", exact: true }).click();
    await expect
      .poll(() =>
        target.locator(".reading-scroll").evaluate((n) => n.scrollTop),
      )
      .toBeGreaterThan(1000);
    if (
      !(await target
        .getByRole("button", { name: "Bookmarks", exact: true })
        .isVisible())
    )
      await target
        .getByRole("button", { name: "Open contents", exact: true })
        .click();
    await target
      .getByRole("button", { name: "Bookmarks", exact: true })
      .click();
    await expect(
      target.getByText("Portable device note", { exact: true }),
    ).toBeVisible();
    await settings(target);
    await file(target, saved);
    await target
      .getByRole("button", { name: "Restore backup", exact: true })
      .click();
    await expect(
      target.getByRole("status").filter({ hasText: "added 0 notes" }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
test("rejects invalid files and atomically rolls back an interrupted restore", async ({
  page,
}) => {
  await page.goto("/en/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await settings(page);
  await file(page, { ...sample(), bookId: "another-book" });
  await expect(page.locator(".device-backup").getByRole("alert")).toContainText(
    "Invalid file",
  );
  await expect(
    page.getByRole("button", { name: "Restore backup", exact: true }),
  ).toHaveCount(0);
  await file(page, sample());
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as unknown as { savedPut: typeof original }).savedPut = original;
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<typeof original>
    ) {
      if (this.name === "progress")
        throw new DOMException("Simulated quota failure", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await expect(page.locator(".device-backup").getByRole("alert")).toContainText(
    "Unable to restore",
  );
  const count = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const r = indexedDB.open("truyen-ky-man-luc");
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result,
            q = db
              .transaction("annotations")
              .objectStore("annotations")
              .count();
          q.onsuccess = () => {
            resolve(q.result);
            db.close();
          };
        };
      }),
  );
  expect(count).toBe(0);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = (
      window as unknown as { savedPut: typeof IDBObjectStore.prototype.put }
    ).savedPut;
  });
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "added 1 notes" }),
  ).toBeVisible();
});
