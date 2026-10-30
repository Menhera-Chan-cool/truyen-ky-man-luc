import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
// An isolated older Playwright package can reproduce older iOS layout engines.
const { webkit, devices } = require(process.argv[2] ?? "@playwright/test");
const base = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const browser = await webkit.launch();
const report = {
  base,
  checkedAt: new Date().toISOString(),
  engine: browser.version(),
  scope: "Automated WebKit phone/desktop VI/EN, not a physical iPhone run",
  cases: [],
  errors: [],
};
try {
  for (const mobile of [true, false])
    for (const locale of ["vi", "en"]) {
      const page = await browser.newPage(
        mobile
          ? { ...devices["iPhone 13"], viewport: { width: 393, height: 750 } }
          : { viewport: { width: 1440, height: 900 } },
      );
      page.on("pageerror", (e) => report.errors.push(e.message));
      const L = (vi, en) => (locale === "vi" ? vi : en);
      await page.goto(`${base}/${locale}/read/chapter-1`);
      await page.waitForFunction(
        () => document.querySelector(".reader-shell")?.dataset.ready === "true",
      );
      await page
        .getByRole("button", {
          name: L("Cài đặt trình đọc", "Reader settings"),
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: L("Sách", "Book"), exact: true })
        .click();
      await page
        .getByRole("button", { name: L("Đóng", "Close"), exact: true })
        .click();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise(requestAnimationFrame);
      });
      const measure = () =>
        page.locator(".prose.paginated").evaluate((el) => ({
          width: el.clientWidth,
          height: el.clientHeight,
          scrollWidth: el.scrollWidth,
          scrollHeight: el.scrollHeight,
          total: Number(
            document
              .querySelector(".page-controls > span")
              ?.textContent.split("/")
              .at(-1),
          ),
          folio: document.querySelector(".book-folio span")?.textContent,
          text: el.textContent,
        }));
      const settle = () =>
        page.waitForFunction(() => {
          const el = document.querySelector(".prose.paginated");
          if (!el) return false;
          const width = el.getBoundingClientRect().width;
          const double =
            document
              .querySelector(".reader-shell")
              ?.getAttribute("data-book-double") === "true";
          const column = double ? (width - 48) / 2 : width;
          const total = Number(
            document
              .querySelector(".page-controls > span")
              ?.textContent.split("/")
              .at(-1),
          );
          return (
            total === Math.ceil((el.scrollWidth + 47) / (column + 48)) &&
            total > 2 &&
            el.scrollHeight <= el.clientHeight + 2
          );
        });
      const first = await measure();
      assert(
        first.scrollWidth > first.width + 48,
        `Expected horizontal pages, got ${JSON.stringify({ ...first, text: undefined })}`,
      );
      assert(
        first.scrollHeight <= first.height + 2,
        "Chapter must fragment horizontally instead of being clipped vertically",
      );
      assert(first.total > 2, "Long chapter must not be counted as 1/1");
      await page
        .getByRole("button", { name: L("Trang sau", "Next page"), exact: true })
        .click();
      await page.waitForFunction(
        () =>
          Number(document.querySelector(".book-folio span")?.textContent) > 1,
      );
      assert(
        new URL(page.url()).pathname.endsWith("/chapter-1"),
        "Next page must stay in the chapter",
      );
      const second = await measure();
      assert.equal(second.text, first.text);
      assert.equal(second.folio, mobile ? "2" : "3");
      await page
        .getByRole("button", {
          name: L("Trang trước", "Previous page"),
          exact: true,
        })
        .click();
      await page.waitForFunction(
        () => document.querySelector(".book-folio span")?.textContent === "1",
      );
      await page
        .getByRole("button", {
          name: L("Cuối chương", "Last page of chapter"),
          exact: true,
        })
        .click();
      await page.waitForFunction(() => {
        const total = Number(
          document
            .querySelector(".page-controls > span")
            ?.textContent.split("/")
            .at(-1),
        );
        const at = Number(
          document.querySelector(".book-folio span")?.textContent,
        );
        return total - at >= 0 && total - at <= 1;
      });
      assert(
        await page.locator(".chapter-content").evaluate((el) => {
          const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let node, last;
          while ((node = walk.nextNode()))
            if (node.textContent.trim()) last = node;
          if (!last) return false;
          const range = document.createRange(),
            at = last.textContent.trimEnd().length - 1;
          range.setStart(last, at);
          range.setEnd(last, at + 1);
          const rect = range.getBoundingClientRect(),
            view = document
              .querySelector(".reading-window")
              .getBoundingClientRect();
          const visible =
            rect.left >= view.left - 2 &&
            rect.right <= view.right + 2 &&
            rect.top >= view.top - 2 &&
            rect.bottom <= view.bottom + 2;
          if (!visible)
            throw Error(
              JSON.stringify({
                rect: rect.toJSON(),
                view: view.toJSON(),
                footer: document.querySelector(".page-controls > span")
                  ?.textContent,
                proseWidth: document
                  .querySelector(".prose")
                  .getBoundingClientRect().width,
                scroll: document.querySelector(".prose").scrollWidth,
              }),
            );
          return visible;
        }),
        "The final character of the chapter must be reachable on the final page",
      );
      await page
        .getByRole("button", { name: L("Trang sau", "Next page"), exact: true })
        .click();
      await page.waitForURL(`**/${locale}/read/chapter-2`);
      await page.waitForFunction(
        () => document.querySelector(".book-folio span")?.textContent === "1",
      );
      await page
        .getByRole("button", {
          name: L("Trang trước", "Previous page"),
          exact: true,
        })
        .click();
      await page.waitForURL(`**/${locale}/read/chapter-1`);
      await page
        .getByRole("button", {
          name: L("Đầu chương", "First page of chapter"),
          exact: true,
        })
        .click();
      await page.waitForFunction(
        () => document.querySelector(".book-folio span")?.textContent === "1",
      );
      await page.setViewportSize(
        mobile ? { width: 430, height: 640 } : { width: 1280, height: 760 },
      );
      await settle();
      const resized = await measure();
      await page
        .getByRole("button", {
          name: L("Chuyển sang Ebook", "Switch to Ebook"),
          exact: true,
        })
        .click();
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
      await settle();
      const ebook = await measure();
      assert(ebook.total > 2);
      assert.equal(ebook.text, first.text);
      report.cases.push({
        locale,
        device: mobile ? "phone" : "desktop",
        first: { ...first, text: undefined },
        nextFolio: second.folio,
        finalTextReachable: true,
        chapterEdges: true,
        resized: { ...resized, text: undefined },
        ebook: { ...ebook, text: undefined },
      });
      await page.close();
    }
  assert.deepEqual(report.errors, []);
  report.success = true;
} catch (error) {
  report.success = false;
  report.failure = String(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await mkdir(new URL("../verification", import.meta.url), { recursive: true });
  await writeFile(
    new URL(
      `../verification/ios-webkit-${process.argv[2] ? "legacy" : "current"}.json`,
      import.meta.url,
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
