import { test, expect } from "@playwright/test";
const ready = async (page: import("@playwright/test").Page) =>
  expect(page.locator(".reader-shell")).toHaveAttribute("data-ready", "true");
test("reveals the active chapter and dismisses input layers with Escape", async ({
  page,
}) => {
  await page.goto("/vi/read/chapter-20");
  await ready(page);
  if (
    !(await page
      .locator(".reader-shell")
      .evaluate((el) => el.classList.contains("sidebar-open")))
  )
    await page.getByRole("button", { name: "Mở mục lục", exact: true }).click();
  await expect
    .poll(() =>
      page.locator('.sidebar-list a[aria-current="page"]').evaluate((el) => {
        const a = el.getBoundingClientRect(),
          r = el.closest(".sidebar-list")!.getBoundingClientRect();
        return a.top >= r.top - 1 && a.bottom <= r.bottom + 1;
      }),
    )
    .toBe(true);
  const input = page.getByRole("textbox", { name: "Tìm chương", exact: true });
  await input.fill("Chương");
  await input.dispatchEvent("keydown", { key: "Escape", isComposing: true });
  await expect(input).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".reader-shell")).not.toHaveClass(/sidebar-open/);
  await page.locator(".prose").evaluate((root) => {
    const n = document
        .createTreeWalker(root.querySelector("p")!, NodeFilter.SHOW_TEXT)
        .nextNode()!,
      r = document.createRange();
    r.setStart(n, 2);
    r.setEnd(n, 20);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(r);
    document.dispatchEvent(new Event("selectionchange"));
  });
  const note = page.getByRole("textbox", {
    name: "Ghi chú cho đoạn chọn",
    exact: true,
  });
  await note.fill("Draft");
  await page.keyboard.press("Escape");
  await expect(page.locator(".selection-toolbar")).not.toBeVisible();
});
test("updates a visible tooltip when its anchor label changes", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Hover tooltip is desktop only");
  await page.goto("/vi/read/chapter-1");
  await ready(page);
  const button = page.getByRole("button", {
    name: "Đọc giọng nói",
    exact: true,
  });
  await button.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Đọc giọng nói");
  await button.evaluate((el) => {
    el.setAttribute("data-tooltip", "Tạm dừng đọc");
    el.setAttribute("aria-label", "Tạm dừng đọc");
  });
  await expect(page.getByRole("tooltip")).toHaveText("Tạm dừng đọc");
});
for (const locale of ["vi", "en"])
  test(`finds and opens a passage in another chapter (${locale})`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/read/chapter-2`);
    await ready(page);
    const phrase = (await page.locator(".prose p").first().textContent())!
      .trim()
      .slice(0, 32);
    await page.goto(`/${locale}/read/chapter-1`);
    await ready(page);
    if (
      !(await page
        .locator(".reader-shell")
        .evaluate((el) => el.classList.contains("sidebar-open")))
    )
      await page
        .getByRole("button", {
          name: locale === "vi" ? "Mở mục lục" : "Open contents",
          exact: true,
        })
        .click();
    const label = locale === "vi" ? "Tìm trong sách" : "Search in book";
    await page.getByRole("button", { name: label, exact: true }).click();
    expect(
      await page
        .locator(".sidebar-tools")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await page
      .getByRole("textbox", { name: label, exact: true })
      .fill(
        phrase
          .normalize("NFD")
          .replace(/\p{M}/gu, "")
          .replace(/đ/gi, "d")
          .toUpperCase(),
      );
    await page
      .locator('.book-search-result[data-chapter="chapter-2"]')
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/read/chapter-2$`));
    await ready(page);
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean((CSS as any).highlights?.get("search-result")),
        ),
      )
      .toBe(true);
    expect(
      await page.locator(".reading-window").evaluate((el) => el.scrollLeft),
    ).toBe(0);
  });
for (const locale of ["vi", "en"])
  test(`resumes listening independently after reload and chapter changes (${locale})`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as any).speechQueue = [];
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
            (window as any).speechQueue.push(u);
            u.onstart?.({});
          },
        }),
      });
    });
    await page.goto(`/${locale}/read/chapter-2`);
    await ready(page);
    await page
      .getByRole("button", {
        name: locale === "vi" ? "Đọc giọng nói" : "Read aloud",
        exact: true,
      })
      .click();
    const spoken = await page.evaluate(() => {
      const u = (window as any).speechQueue.at(-1);
      u.onboundary?.({ charIndex: 5 });
      return u.text;
    });
    await page
      .getByRole("button", {
        name: locale === "vi" ? "Tạm dừng đọc" : "Pause reading",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: locale === "vi" ? "Chương trước" : "Previous chapter",
        exact: true,
      })
      .click();
    await ready(page);
    await page.reload();
    await ready(page);
    expect(await page.evaluate(() => (window as any).speechQueue.length)).toBe(
      0,
    );
    const state = await page.evaluate(
      (locale) =>
        new Promise<any>((resolve, reject) => {
          const r = indexedDB.open("truyen-ky-man-luc");
          r.onerror = () => reject(r.error);
          r.onsuccess = () => {
            const db = r.result,
              tx = db.transaction(["preferences", "progress"]),
              heard = tx.objectStore("preferences").get("listening:" + locale),
              read = tx.objectStore("progress").get(locale + ":last"),
              other = tx
                .objectStore("preferences")
                .get("listening:" + (locale === "vi" ? "en" : "vi"));
            tx.oncomplete = () => {
              resolve({
                heard: heard.result,
                read: read.result,
                other: other.result,
              });
              db.close();
            };
          };
        }),
      locale,
    );
    expect(state.heard).toMatchObject({
      locale,
      chapterId: "chapter-2",
      offset: 5,
      completed: false,
    });
    expect(state.read.chapterId).toBe("chapter-1");
    expect(state.other).toBeUndefined();
    await page
      .getByRole("button", {
        name: locale === "vi" ? "Giọng đọc & tốc độ" : "Voice & speed",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: locale === "vi" ? "Nghe tiếp" : "Continue listening",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/read/chapter-2$`));
    await ready(page);
    await expect
      .poll(() =>
        page.evaluate(
          (expected) =>
            (window as any).speechQueue.at(-1)?.text?.startsWith(expected),
          spoken.slice(5),
        ),
      )
      .toBe(true);
  });
test("refuses a saved position from a changed edition and never autoplays", async ({
  page,
}) => {
  await page.goto("/en/read/chapter-1");
  await ready(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open("truyen-ky-man-luc");
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const db = r.result,
            tx = db.transaction("preferences", "readwrite");
          tx.objectStore("preferences").put(
            {
              locale: "en",
              chapterId: "chapter-2",
              revision: 2147483647,
              offset: 10,
              completed: false,
            },
            "listening:en",
          );
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );
  await page.reload();
  await ready(page);
  await page
    .getByRole("button", { name: "Voice & speed", exact: true })
    .click();
  await expect(
    page.getByText(
      "This edition changed or is no longer published. Choose a new listening position.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue listening", exact: true }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Read this chapter", exact: true }),
  ).toBeVisible();
});
