import { test, expect } from "@playwright/test";
const ready = (page: import("@playwright/test").Page) =>
  expect(page.locator(".reader-shell")).toHaveAttribute("data-ready", "true");
test("keeps the visible text anchor after font and mode reflow", async ({
  page,
}) => {
  await page.goto("/vi/read/chapter-1");
  await ready(page);
  await page
    .getByRole("button", { name: "Cài đặt trình đọc", exact: true })
    .click();
  await page.getByRole("button", { name: "Trang đơn", exact: true }).click();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Trang sau", exact: true }).click();
  const capture = () =>
    page.locator(".prose").evaluate((root) => {
      const v = document
        .querySelector(".reading-window")!
        .getBoundingClientRect();
      for (const y of [4, 12, 24, 36, 60]) {
        const caret = document.caretRangeFromPoint(v.left + 3, v.top + y);
        if (
          !caret ||
          !root.contains(caret.startContainer) ||
          caret.startContainer.nodeType !== Node.TEXT_NODE
        )
          continue;
        const node = caret.startContainer,
          at = Math.min(caret.startOffset, node.textContent!.length - 1),
          probe = document.createRange();
        probe.setStart(node, at);
        probe.setEnd(node, at + 1);
        const r = probe.getBoundingClientRect();
        if (
          r.right <= v.left ||
          r.left >= v.right ||
          r.bottom <= v.top ||
          r.top >= v.bottom
        )
          continue;
        const prefix = document.createRange();
        prefix.selectNodeContents(root);
        prefix.setEnd(node, at);
        return prefix.toString().length;
      }
      throw Error("No visible text caret");
    });
  let offset = await capture();
  const visible = () =>
    page.locator(".prose").evaluate((root, offset) => {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      let start = 0;
      while ((n = w.nextNode())) {
        const len = n.textContent!.length;
        if (offset < start + len) {
          const r = document.createRange();
          r.setStart(n, offset - start);
          r.setEnd(n, Math.min(len, offset - start + 1));
          const b = r.getBoundingClientRect(),
            v = document
              .querySelector(".reading-window")!
              .getBoundingClientRect();
          return (
            b.right > v.left &&
            b.left < v.right &&
            b.bottom > v.top &&
            b.top < v.bottom
          );
        }
        start += len;
      }
      return false;
    }, offset);
  await expect.poll(visible).toBe(true);
  for (const [name, value] of [
    ["Phông chữ", "Lora"],
    ["Giãn dòng", "2.4"],
    ["Chiều rộng nội dung", "720"],
  ]) {
    offset = await capture();
    await page
      .getByRole("button", { name: "Cài đặt trình đọc", exact: true })
      .click();
    if (name === "Phông chữ")
      await page
        .getByRole("combobox", { name, exact: true })
        .selectOption(value);
    else
      await page
        .getByRole("slider", { name: new RegExp("^" + name) })
        .fill(value);
    await page.getByRole("button", { name: "Đóng", exact: true }).click();
    await ready(page);
    await expect.poll(visible, { message: name }).toBe(true);
  }
  const viewport = page.viewportSize()!;
  offset = await capture();
  await page.setViewportSize({
    width: Math.round(viewport.width * 0.85),
    height: viewport.height,
  });
  await expect.poll(visible).toBe(true);
  offset = await capture();
  await page
    .getByRole("button", { name: "Cài đặt trình đọc", exact: true })
    .click();
  await page.getByRole("slider", { name: "Cỡ chữ", exact: true }).fill("32");
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect.poll(visible).toBe(true);
  offset = await capture();
  await page
    .getByRole("button", { name: "Cài đặt trình đọc", exact: true })
    .click();
  await page.getByRole("button", { name: "Cuộn", exact: true }).click();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect.poll(visible).toBe(true);
});
test("opens a bookmark in another chapter at its saved passage on the first click", async ({
  page,
}) => {
  await page.goto("/vi/read/chapter-1");
  await ready(page);
  const text = await page.locator(".prose").evaluate((root) => {
    const ps = [...root.querySelectorAll("p")].filter(
      (p) =>
        (document
          .createTreeWalker(p, NodeFilter.SHOW_TEXT)
          .nextNode()
          ?.textContent?.trim().length ?? 0) > 60,
    );
    const p = ps[Math.floor(ps.length * 0.75)];
    p.scrollIntoView({ block: "center" });
    const n = document.createTreeWalker(p, NodeFilter.SHOW_TEXT).nextNode()!;
    const r = document.createRange();
    r.setStart(n, 5);
    r.setEnd(n, 45);
    const text = r.toString();
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(r);
    document.dispatchEvent(new Event("selectionchange"));
    return text;
  });
  await page
    .getByRole("textbox", { name: "Ghi chú cho đoạn chọn", exact: true })
    .fill("Continuity bookmark");
  await page
    .getByRole("button", { name: "Đánh dấu #f3dd83", exact: true })
    .click();
  await page.locator(".selection-toolbar").waitFor({ state: "hidden" });
  await page.locator(".reading-scroll").evaluate((n) => (n.scrollTop = 0));
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "Chương sau", exact: true }).click();
  await ready(page);
  if (
    !(await page
      .getByRole("button", { name: "Đánh dấu", exact: true })
      .isVisible())
  )
    await page.getByRole("button", { name: "Mở mục lục", exact: true }).click();
  await page.getByRole("button", { name: "Đánh dấu", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Chỉ chương đang đọc", exact: true })
    .uncheck();
  await page.getByText("Continuity bookmark", { exact: true }).click();
  await ready(page);
  await expect
    .poll(() =>
      page.locator(".prose").evaluate((root, text) => {
        const p = [...root.querySelectorAll("p")].find((p) =>
            p.textContent!.includes(text),
          )!,
          r = p.getBoundingClientRect(),
          v = document
            .querySelector(".reading-scroll")!
            .getBoundingClientRect();
        return r.bottom > v.top && r.top < v.bottom;
      }, text),
    )
    .toBe(true);
});
