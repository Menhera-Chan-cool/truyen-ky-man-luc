import { expect, test, type Page } from "@playwright/test";
const ready = (page: Page) =>
  expect(page.locator(".reader-shell")).toHaveAttribute("data-ready", "true");
test("keeps footnote links, return links and browser history in the paged reader state", async ({
  page,
}) => {
  await page.goto("/vi/read/chapter-1");
  await ready(page);
  await page
    .getByRole("button", { name: "Cài đặt trình đọc", exact: true })
    .click();
  await page.getByRole("button", { name: "Trang đơn", exact: true }).click();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.locator(".prose").evaluate((root) => {
    root.firstElementChild!.innerHTML =
      '<p id="audit-source"><a href="#audit-note">Open footnote</a></p>' +
      Array.from(
        { length: 45 },
        (_, i) =>
          "<p>Paragraph " +
          i +
          " " +
          "A long passage for linked footnotes. ".repeat(5) +
          "</p>",
      ).join("") +
      '<p id="audit-note">The footnote. <a href="#audit-source">Return to passage</a></p>';
  });
  await page
    .getByRole("button", { name: "Cài đặt trình đọc", exact: true })
    .click();
  await page.getByRole("slider", { name: "Cỡ chữ", exact: true }).fill("21");
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await ready(page);
  const currentPage = async () =>
    Number(
      (await page.locator(".page-controls span").textContent())!.split("/")[0],
    );
  await page.getByRole("link", { name: "Open footnote", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect.poll(currentPage, { timeout: 1500 }).toBeGreaterThan(1);
  expect(
    await page.locator(".reading-window").evaluate((el) => el.scrollLeft),
  ).toBe(0);
  await page.keyboard.press("Shift+Tab");
  await expect.poll(currentPage).toBe(1);
  await page.getByRole("link", { name: "Open footnote", exact: true }).click();
  await expect.poll(currentPage, { timeout: 2000 }).toBeGreaterThan(1);
  expect(
    await page.locator(".reading-window").evaluate((el) => el.scrollLeft),
  ).toBe(0);
  const target = await currentPage();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<number>((resolve, reject) => {
            const request = indexedDB.open("truyen-ky-man-luc");
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result,
                read = db
                  .transaction("progress")
                  .objectStore("progress")
                  .get("vi:chapter-1");
              read.onsuccess = () => {
                resolve(read.result?.page);
                db.close();
              };
              read.onerror = () => {
                reject(read.error);
                db.close();
              };
            };
          }),
      ),
    )
    .toBe(target - 1);
  await expect(page).toHaveURL(/#audit-note$/);
  await page
    .getByRole("link", { name: "Return to passage", exact: true })
    .click();
  await expect.poll(currentPage).toBe(1);
  await page.goBack();
  await expect.poll(currentPage).toBe(target);
  expect(
    await page.locator(".reading-window").evaluate((el) => el.scrollLeft),
  ).toBe(0);
  await page.goForward();
  await expect.poll(currentPage).toBe(1);
  await page.goBack();
  await expect.poll(currentPage).toBe(target);
  await page.goBack();
  await expect.poll(currentPage).toBe(1);
  expect(new URL(page.url()).hash).toBe("");
});
test("keeps a draft note while interacting inside the popup and dismisses it outside", async ({
  page,
}) => {
  await page.goto("/vi/read/chapter-1");
  await ready(page);
  await page.locator(".prose").evaluate((root) => {
    const p = [...root.querySelectorAll("p")].find(
        (p) => (p.textContent?.length ?? 0) > 80,
      )!,
      walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT),
      n = walk.nextNode()!,
      r = document.createRange();
    r.setStart(n, 2);
    let end = 35,
      node = n;
    while (end > (node.textContent?.length ?? 0)) {
      end -= node.textContent?.length ?? 0;
      node = walk.nextNode()!;
    }
    r.setEnd(node, end);
    if (r.toString() !== p.textContent!.slice(2, 35))
      throw Error(
        "Selection must retain its exact passage across inline nodes",
      );
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(r);
    document.dispatchEvent(new Event("selectionchange"));
  });
  const popup = page.locator(".selection-toolbar"),
    input = page.getByRole("textbox", {
      name: "Ghi chú cho đoạn chọn",
      exact: true,
    });
  await expect(popup).toBeVisible();
  await input.fill("Keep my draft note");
  await input.click();
  await expect(input).toHaveValue("Keep my draft note");
  await page.waitForTimeout(220);
  await expect(popup).toBeVisible();
  await page.locator(".chapter-title").click();
  await expect(popup).not.toBeVisible({ timeout: 2000 });
});
