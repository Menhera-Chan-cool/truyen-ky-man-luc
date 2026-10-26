import { test, expect, type Page } from "@playwright/test";
const ready = (page: Page) =>
  expect(page.locator(".reader-shell")).toHaveAttribute("data-ready", "true");
for (const locale of ["vi", "en"]) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
  test(`keeps phone panels and contents mutually accessible (${locale})`, async ({
    page,
    isMobile,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        configurable: true,
        value: class {
          constructor(public text: string) {}
        },
      });
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: Object.assign(new EventTarget(), {
          getVoices: () => [],
          cancel() {},
          speak(u: any) {
            u.onstart?.({});
          },
        }),
      });
    });
    await page.goto(`/${locale}/read/chapter-1`);
    await ready(page);
    if (!isMobile)
      await page
        .locator(".reader-sidebar")
        .getByRole("button", {
          name: L("Đóng mục lục", "Close contents"),
          exact: true,
        })
        .click();
    await page
      .getByRole("button", {
        name: L("Đọc giọng nói", "Read aloud"),
        exact: true,
      })
      .click();
    for (const panel of [
      L("Giọng đọc & tốc độ", "Voice & speed"),
      L("Cài đặt trình đọc", "Reader settings"),
      L("Tự cuộn", "Auto-scroll"),
      L("Âm thanh môi trường", "Ambient sounds"),
    ]) {
      await page.getByRole("button", { name: panel, exact: true }).click();
      await page
        .getByRole("button", {
          name: L("Mở mục lục", "Open contents"),
          exact: true,
        })
        .click();
      await expect(page.locator(".reader-shell")).toHaveClass(/sidebar-open/);
      if (isMobile) {
        await expect(page.locator(".reader-panel")).not.toBeVisible();
        await expect(
          page.getByRole("button", {
            name: L("Mở mục lục", "Open contents"),
            exact: true,
          }),
        ).toBeFocused();
      } else await expect(page.locator(".reader-panel")).toBeVisible();
      await page
        .getByRole("textbox", {
          name: L("Tìm chương", "Find a chapter"),
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: panel, exact: true }).click();
      if (isMobile)
        await expect(page.locator(".reader-shell")).not.toHaveClass(
          /sidebar-open/,
        );
      else {
        await expect(page.locator(".reader-shell")).toHaveClass(/sidebar-open/);
        await page.getByRole("button", { name: panel, exact: true }).click();
        await page
          .locator(".reader-sidebar")
          .getByRole("button", {
            name: L("Đóng mục lục", "Close contents"),
            exact: true,
          })
          .click();
      }
    }
    await expect(
      page.getByRole("button", {
        name: L("Tạm dừng đọc", "Pause reading"),
        exact: true,
      }),
    ).toBeVisible();
  });
  test(`yields on first search and reuses the prepared snapshot (${locale})`, async ({
    page,
    isMobile,
  }) => {
    await page.addInitScript(() => {
      (window as any).searchParses = 0;
      const parse = DOMParser.prototype.parseFromString;
      DOMParser.prototype.parseFromString = function (...args: any[]) {
        (window as any).searchParses++;
        return parse.apply(this, args as any);
      };
    });
    await page.goto(`/${locale}/read/chapter-1`);
    await ready(page);
    if (isMobile)
      await page
        .getByRole("button", {
          name: L("Mở mục lục", "Open contents"),
          exact: true,
        })
        .click();
    const atFirstPaint = await page.evaluate(
      async (label) => {
        (window as any).searchParses = 0;
        [
          ...document.querySelectorAll<HTMLButtonElement>(
            ".sidebar-tools button",
          ),
        ]
          .find((b) => b.textContent?.trim() === label)!
          .click();
        await new Promise(requestAnimationFrame);
        return (window as any).searchParses;
      },
      L("Tìm trong sách", "Search in book"),
    );
    await page
      .getByRole("textbox", {
        name: L("Tìm trong sách", "Search in book"),
        exact: true,
      })
      .fill(L("người", "the"));
    await expect(page.locator(".book-search-result").first()).toBeVisible();
    const complete = await page.evaluate(() => (window as any).searchParses);
    expect(atFirstPaint).toBeLessThan(complete);
    await page
      .getByRole("button", { name: L("Mục lục", "Contents"), exact: true })
      .click();
    await page
      .getByRole("button", {
        name: L("Tìm trong sách", "Search in book"),
        exact: true,
      })
      .click();
    await page
      .getByRole("textbox", {
        name: L("Tìm trong sách", "Search in book"),
        exact: true,
      })
      .fill(L("người", "the"));
    await expect(page.locator(".book-search-result").first()).toBeVisible();
    expect(await page.evaluate(() => (window as any).searchParses)).toBe(
      complete,
    );
  });
  test(`clears only obsolete search highlights when a query changes (${locale})`, async ({
    page,
    isMobile,
  }) => {
    await page.goto(`/${locale}/read/chapter-1`);
    await ready(page);
    if (isMobile)
      await page
        .getByRole("button", {
          name: L("Mở mục lục", "Open contents"),
          exact: true,
        })
        .click();
    await page
      .getByRole("button", {
        name: L("Tìm trong sách", "Search in book"),
        exact: true,
      })
      .click();
    const input = page.getByRole("textbox", {
      name: L("Tìm trong sách", "Search in book"),
      exact: true,
    });
    await input.fill(L("người", "the"));
    await page.locator(".book-search-result").first().click();
    await expect
      .poll(() =>
        page.evaluate(() => (CSS as any).highlights.has("search-result")),
      )
      .toBe(true);
    await page.evaluate(() => {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector(".prose p")!);
      (CSS as any).highlights.set(
        "note-keep",
        new (window as any).Highlight(range),
      );
    });
    if (isMobile)
      await page
        .getByRole("button", {
          name: L("Mở mục lục", "Open contents"),
          exact: true,
        })
        .click();
    await input.fill("zzzznoresultxyz");
    await expect(page.locator(".book-search-result")).toHaveCount(0);
    expect(
      await page.evaluate(() => (CSS as any).highlights.has("search-result")),
    ).toBe(false);
    expect(
      await page.evaluate(() => (CSS as any).highlights.has("note-keep")),
    ).toBe(true);
  });
}
test("recovers from a failed index build without leaving the reader", async ({
  page,
  isMobile,
}) => {
  await page.addInitScript(() => {
    let fail = true;
    const parse = DOMParser.prototype.parseFromString;
    DOMParser.prototype.parseFromString = function (...args: any[]) {
      if (fail) {
        fail = false;
        throw Error("Fixture preparation failure");
      }
      return parse.apply(this, args as any);
    };
  });
  await page.goto("/en/read/chapter-1");
  await ready(page);
  if (isMobile)
    await page
      .getByRole("button", { name: "Open contents", exact: true })
      .click();
  await page
    .getByRole("button", { name: "Search in book", exact: true })
    .click();
  await expect(
    page.getByText("Unable to prepare search.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search in book", exact: true })
    .fill("the");
  await page.getByRole("button", { name: "Retry search", exact: true }).click();
  await expect(page.locator(".book-search-result").first()).toBeVisible();
  await expect(page).toHaveURL(/\/en\/read\/chapter-1$/);
});
test("matches the 900px overlay boundary and handles resize", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Breakpoint checked in desktop context");
  await page.setViewportSize({ width: 901, height: 900 });
  await page.goto("/en/read/chapter-1");
  await ready(page);
  await page
    .getByRole("button", { name: "Open contents", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Voice & speed", exact: true })
    .click();
  await expect(page.locator(".reader-shell")).toHaveClass(/sidebar-open/);
  await expect(page.locator(".reader-panel")).toBeVisible();
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.locator(".reader-shell")).not.toHaveClass(/sidebar-open/);
  await page
    .getByRole("button", { name: "Open contents", exact: true })
    .click();
  await expect(page.locator(".reader-panel")).not.toBeVisible();
});
