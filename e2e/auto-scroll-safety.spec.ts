import { test, expect, type Page } from "@playwright/test";
const ready = (page: Page) =>
  expect(page.locator(".reader-shell")).toHaveAttribute("data-ready", "true");
const active = (page: Page, locale: string) =>
  page.getByRole("button", {
    name: locale === "vi" ? "Tự cuộn" : "Auto-scroll",
    exact: true,
  });
const pos = (page: Page) =>
  page.locator(".reading-scroll").evaluate((el) => el.scrollTop);
async function start(page: Page, locale: string) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
  await active(page, locale).click();
  await page.locator(".reader-panel input[type=range]").fill("100");
  await page
    .getByRole("button", {
      name: L("Bắt đầu tự cuộn", "Start auto-scroll"),
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: L("Đóng", "Close"), exact: true })
    .click();
  await expect(active(page, locale)).toHaveAttribute("aria-pressed", "true");
}
for (const locale of ["vi", "en"]) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
  test(`names the auto-scroll speed and keeps keyboard adjustment (${locale})`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/read/chapter-1`);
    await ready(page);
    await active(page, locale).click();
    const slider = page.getByRole("slider", {
      name: L("Tốc độ cuộn", "Scroll speed"),
      exact: true,
    });
    await slider.fill("70");
    expect(
      await slider.evaluate((el) => (el as HTMLInputElement).labels?.length),
    ).toBe(1);
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveValue("71");
  });
  test(`stops for manual reading gestures but allows speed changes (${locale})`, async ({
    page,
    isMobile,
  }) => {
    await page.goto(`/${locale}/read/chapter-1`);
    await ready(page);
    await start(page, locale);
    await expect.poll(() => pos(page)).toBeGreaterThan(3);
    await active(page, locale).click();
    await page.locator(".reader-panel input[type=range]").fill("80");
    await expect(
      page.getByRole("button", {
        name: L("Dừng tự cuộn", "Stop auto-scroll"),
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: L("Đóng", "Close"), exact: true })
      .click();
    const box = (await page.locator(".reading-scroll").boundingBox())!,
      x = Math.round(box.x + box.width / 2),
      y = Math.round(box.y + box.height / 2);
    if (isMobile) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.synthesizeScrollGesture", {
        x,
        y,
        yDistance: 50,
        speed: 500,
        preventFling: true,
        gestureSourceType: "touch",
      });
    } else {
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, -50);
    }
    await expect(active(page, locale)).toHaveAttribute("aria-pressed", "false");
    await page.waitForTimeout(200);
    const stopped = await pos(page);
    await page.waitForTimeout(300);
    expect(Math.abs((await pos(page)) - stopped)).toBeLessThanOrEqual(2);
    await start(page, locale);
    await page.mouse.click(x, y);
    await expect(active(page, locale)).toHaveAttribute("aria-pressed", "false");
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
    await start(page, locale);
    const beforePage = Number(
      (await page.locator(".page-controls span").textContent())!.split("/")[0],
    );
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () =>
        Number(
          (await page.locator(".page-controls span").textContent())!.split(
            "/",
          )[0],
        ),
      )
      .toBe(beforePage + 1);
    await expect(active(page, locale)).toHaveAttribute("aria-pressed", "false");
  });
  for (const mode of ["scroll", "single"])
    test(`stops on freeze and stays stopped on resume (${locale}, ${mode})`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/read/chapter-1`);
      await ready(page);
      if (mode === "single") {
        await page
          .getByRole("button", {
            name: L("Cài đặt trình đọc", "Reader settings"),
            exact: true,
          })
          .click();
        await page
          .getByRole("button", {
            name: L("Trang đơn", "Single page"),
            exact: true,
          })
          .click();
        await page
          .getByRole("button", { name: L("Đóng", "Close"), exact: true })
          .click();
      }
      await start(page, locale);
      await page.waitForTimeout(300);
      const before =
        mode === "scroll"
          ? await pos(page)
          : await page.locator(".page-controls span").textContent();
      // Headless Chrome ignores native freezing while visible; exercise the DOM boundary explicitly.
      await page.evaluate(() => document.dispatchEvent(new Event("freeze")));
      await page.waitForTimeout(500);
      await page.evaluate(() => document.dispatchEvent(new Event("resume")));
      await expect(active(page, locale)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      if (mode === "scroll")
        expect(
          Math.abs((await pos(page)) - Number(before)),
        ).toBeLessThanOrEqual(8);
      else
        await expect(page.locator(".page-controls span")).toHaveText(
          String(before),
        );
      await page.waitForTimeout(200);
      await expect(active(page, locale)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });
}
test("stops after a long RAF gap even without a visibility event", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).frameOffset = 0;
    const raf = requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      raf((time) => callback(time + (window as any).frameOffset));
  });
  await page.goto("/en/read/chapter-1");
  await ready(page);
  await start(page, "en");
  await expect.poll(() => pos(page)).toBeGreaterThan(3);
  const before = await pos(page);
  await page.evaluate(() => {
    (window as any).frameOffset = 10000;
  });
  await expect(active(page, "en")).toHaveAttribute("aria-pressed", "false");
  expect((await pos(page)) - before).toBeLessThan(15);
});
test("keeps the position after hidden/pagehide and restarts only on request", async ({
  page,
}) => {
  await page.goto("/en/read/chapter-1");
  await ready(page);
  await start(page, "en");
  await expect.poll(() => pos(page)).toBeGreaterThan(3);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(active(page, "en")).toHaveAttribute("aria-pressed", "false");
  const before = await pos(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300);
  expect(await pos(page)).toBe(before);
  await start(page, "en");
  await expect.poll(() => pos(page)).toBeGreaterThan(before + 2);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(active(page, "en")).toHaveAttribute("aria-pressed", "false");
});
