import { test, expect, type Page } from "@playwright/test";
const ready = (page: Page, timeout = 10000) =>
  expect(page.locator(".reader-shell")).toHaveAttribute("data-ready", "true", {
    timeout,
  });
async function single(page: Page, locale: string) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
  await page
    .getByRole("button", {
      name: L("Cài đặt trình đọc", "Reader settings"),
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: L("Trang đơn", "Single page"), exact: true })
    .click();
  await page
    .getByRole("button", { name: L("Đóng", "Close"), exact: true })
    .click();
  await ready(page);
  await expect
    .poll(async () =>
      Number(
        (await page.locator(".page-controls span").textContent())!.split(
          "/",
        )[1],
      ),
    )
    .toBeGreaterThan(1);
}
async function capture(page: Page) {
  return page.locator(".prose").evaluate((root) => {
    const viewport = (document.querySelector(".reading-window.paged") ??
        document.querySelector(".reading-scroll"))!.getBoundingClientRect(),
      walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n: Node | null,
      total = 0;
    const visible = (r: DOMRect) =>
      r.width > 0 &&
      r.height > 0 &&
      r.right > viewport.left + 2 &&
      r.left < viewport.right - 2 &&
      r.bottom > viewport.top + 2 &&
      r.top < viewport.bottom - 2;
    while ((n = walk.nextNode())) {
      const text = n.textContent ?? "",
        range = document.createRange();
      range.selectNodeContents(n);
      if (text.trim() && [...range.getClientRects()].some(visible))
        for (let i = 0; i < text.length; i++) {
          range.setStart(n, i);
          range.setEnd(n, i + 1);
          if (visible(range.getBoundingClientRect())) return total + i;
        }
      total += text.length;
    }
    throw Error("No visible text");
  });
}
const contains = (page: Page, offset: number) =>
  page.locator(".prose").evaluate((root, offset) => {
    const v = (document.querySelector(".reading-window.paged") ??
        document.querySelector(".reading-scroll"))!.getBoundingClientRect(),
      walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n: Node | null,
      at = 0;
    while ((n = walk.nextNode())) {
      const length = n.textContent?.length ?? 0;
      if (offset < at + length) {
        const r = document.createRange();
        r.setStart(n, offset - at);
        r.setEnd(n, offset - at + 1);
        const b = r.getBoundingClientRect();
        return (
          b.width > 0 &&
          b.right > v.left &&
          b.left < v.right &&
          b.bottom > v.top &&
          b.top < v.bottom
        );
      }
      at += length;
    }
    return false;
  }, offset);
for (const locale of ["vi", "en"]) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
  test(`keeps the latest reading position while a font is delayed (${locale})`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/read/chapter-1`);
    await ready(page);
    await single(page, locale);
    for (let i = 0; i < 2; i++)
      await page
        .getByRole("button", { name: L("Trang sau", "Next page"), exact: true })
        .click();
    const old = await capture(page);
    let release!: () => void,
      requests = 0;
    const gate = new Promise<void>((r) => (release = r));
    const pattern = /\.woff2(?:\?|$)/;
    await page.route(pattern, async (route) => {
      requests++;
      await gate;
      await route.continue();
    });
    try {
      await page
        .getByRole("button", {
          name: L("Cài đặt trình đọc", "Reader settings"),
          exact: true,
        })
        .click();
      await page
        .getByRole("combobox", {
          name: L("Phông chữ", "Font family"),
          exact: true,
        })
        .selectOption("Lora");
      await page
        .getByRole("button", { name: L("Đóng", "Close"), exact: true })
        .click();
      await expect.poll(() => requests).toBeGreaterThan(0);
      await ready(page, 2000);
      expect(await page.evaluate(() => document.fonts.status)).toBe("loading");
      for (let i = 0; i < 5; i++)
        await page
          .getByRole("button", {
            name: L("Trang sau", "Next page"),
            exact: true,
          })
          .click();
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const latest = await capture(page);
      expect(latest).toBeGreaterThan(old + 500);
      release();
      await expect
        .poll(() => page.evaluate(() => document.fonts.status), {
          timeout: 15000,
        })
        .toBe("loaded");
      await ready(page);
      await expect.poll(() => contains(page, latest)).toBe(true);
      await page.reload();
      await ready(page);
      await expect.poll(() => contains(page, latest)).toBe(true);
    } finally {
      release();
      await page.unrouteAll({ behavior: "wait" });
    }
  });
  test(`leaves browser modifiers alone and keeps plain page arrows (${locale})`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/read/chapter-2`);
    await ready(page);
    const title2 = await page.locator(".chapter-title").textContent();
    await page
      .getByRole("button", {
        name: L("Chương trước", "Previous chapter"),
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/chapter-1$/);
    await ready(page);
    await single(page, locale);
    await page.evaluate(() =>
      document.fonts.ready.then(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
          ),
      ),
    );
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".page-controls span")).toHaveText(/^2\s*\//);
    await page.evaluate(() => {
      (window as any).modifiedKeys = [];
      document.addEventListener("keydown", (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.isComposing)
          (window as any).modifiedKeys.push({
            key: e.key,
            prevented: e.defaultPrevented,
          });
      });
    });
    for (const flags of [
      { altKey: true },
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { isComposing: true },
    ]) {
      await page.locator("body").dispatchEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
        ...flags,
      });
      await expect(page.locator(".page-controls span")).toHaveText(/^2\s*\//);
    }
    expect(
      await page.evaluate(() =>
        (window as any).modifiedKeys.some((e: any) => e.prevented),
      ),
    ).toBe(false);
    await page.keyboard.press("Alt+ArrowLeft");
    expect(
      await page.evaluate(() =>
        (window as any).modifiedKeys.some((e: any) => e.prevented),
      ),
    ).toBe(false);
    // Headless Chrome does not run browser chrome accelerators; test history separately.
    if (page.url().endsWith("/chapter-1")) await page.goBack();
    await expect(page).toHaveURL(/chapter-2$/);
    await expect(page.locator(".chapter-title")).toHaveText(title2!);
    await ready(page);
    await page.keyboard.press("Alt+ArrowRight");
    if (page.url().endsWith("/chapter-2")) await page.goForward();
    await expect(page).toHaveURL(/chapter-1$/);
    await ready(page);
    await page.evaluate(() =>
      document.fonts.ready.then(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
          ),
      ),
    );
    const currentPage = Number(
      (await page.locator(".page-controls span").textContent())!.split("/")[0],
    );
    await page.keyboard.press("ArrowLeft");
    await expect
      .poll(async () =>
        Number(
          (await page.locator(".page-controls span").textContent())!.split(
            "/",
          )[0],
        ),
      )
      .toBe(Math.max(1, currentPage - 1));
  });
}
test("late fonts preserve manual scroll position", async ({ page }) => {
  await page.goto("/en/read/chapter-1");
  await ready(page);
  let release!: () => void,
    requests = 0;
  const gate = new Promise<void>((r) => (release = r));
  await page.route(/\.woff2(?:\?|$)/, async (route) => {
    requests++;
    await gate;
    await route.continue();
  });
  try {
    await page
      .getByRole("button", { name: "Reader settings", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Font family", exact: true })
      .selectOption("Lora");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect.poll(() => requests).toBeGreaterThan(0);
    await ready(page, 2000);
    await page
      .locator(".reading-scroll")
      .evaluate((el) => (el.scrollTop = 2600));
    await page.waitForTimeout(180);
    const latest = await capture(page);
    expect(latest).toBeGreaterThan(200);
    release();
    await expect
      .poll(() => page.evaluate(() => document.fonts.status))
      .toBe("loaded");
    await expect.poll(() => contains(page, latest)).toBe(true);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});
test("obsolete font callbacks do not restore the previous chapter", async ({
  page,
}) => {
  await page.goto("/en/read/chapter-1");
  await ready(page);
  await single(page, "en");
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route(/\.woff2(?:\?|$)/, async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page
      .getByRole("button", { name: "Reader settings", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Font family", exact: true })
      .selectOption("Lora");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await ready(page, 2000);
    await page
      .getByRole("button", { name: "Next chapter", exact: true })
      .click();
    await expect(page).toHaveURL(/chapter-2$/);
    await ready(page, 2000);
    for (let i = 0; i < 3; i++)
      await page
        .getByRole("button", { name: "Next page", exact: true })
        .click();
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const latest = await capture(page);
    release();
    await expect
      .poll(() => page.evaluate(() => document.fonts.status))
      .toBe("loaded");
    await expect.poll(() => contains(page, latest)).toBe(true);
    await expect(page).toHaveURL(/chapter-2$/);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});
test("failed font requests leave a usable fallback reader", async ({
  page,
}) => {
  await page.goto("/en/read/chapter-1");
  await ready(page);
  await single(page, "en");
  await page.route(/\.woff2(?:\?|$)/, (route) => route.abort());
  await page
    .getByRole("button", { name: "Reader settings", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Font family", exact: true })
    .selectOption("Merriweather");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await ready(page, 2000);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".page-controls span")).toHaveText(/^2\s*\//);
});
