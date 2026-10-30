import { test, expect } from "@playwright/test";
async function book(page: import("@playwright/test").Page) {
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Cài đặt trình đọc", exact: true })
    .click();
  await page.getByRole("button", { name: "Sách", exact: true }).click();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(page.locator(".reader-document")).toHaveAttribute(
    "data-flip-ready",
    "true",
  );
}
async function contact(
  page: import("@playwright/test").Page,
  dx: number,
  dy = 0,
  duration = 500,
  cancel = false,
) {
  await page.locator(".reading-scroll").evaluate(
    (el, { dx, dy, duration, cancel }) => {
      const b = document
        .querySelector(".reader-document")!
        .getBoundingClientRect();
      const p = {
        bubbles: true,
        pointerId: 51,
        pointerType: "touch",
        isPrimary: true,
        clientX: b.left + b.width * 0.65,
        clientY: b.top + b.height * 0.65,
      };
      const dispatch = (type: string, x: number, y: number, time: number) => {
        const event = new PointerEvent(type, { ...p, clientX: x, clientY: y });
        Object.defineProperty(event, "timeStamp", { value: time });
        el.dispatchEvent(event);
      };
      dispatch("pointerdown", p.clientX, p.clientY, 1000);
      dispatch("pointermove", p.clientX + dx, p.clientY + dy, 1000 + duration);
      dispatch(
        cancel ? "pointercancel" : "pointerup",
        p.clientX + dx,
        p.clientY + dy,
        1010 + duration,
      );
    },
    { dx, dy, duration, cancel },
  );
}
test("short relaxed touch swipes turn once, while vertical, tiny and cancelled contacts do not", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Phone touch gestures");
  await book(page);
  await contact(page, -30, 10);
  await expect(page.locator(".book-folio span").first()).toHaveText("2");
  await contact(page, 30, -10);
  await expect(page.locator(".book-folio span").first()).toHaveText("1");
  await contact(page, -16, 1, 30);
  await expect(page.locator(".book-folio span").first()).toHaveText("2");
  await contact(page, -10, 1);
  await contact(page, -12, 70);
  await contact(page, -40, 3, 50, true);
  await expect(page.locator(".book-folio span").first()).toHaveText("2");
});
test("48px paper edges tap forward/back exactly once without blocking footnotes or selection", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Phone touch targets");
  await book(page);
  const paper = (await page.locator(".reader-document").boundingBox())!;
  const source = await page.locator(".prose").textContent();
  await page.touchscreen.tap(
    paper.x + paper.width - 40,
    paper.y + paper.height * 0.5,
  );
  await expect(page.locator(".book-folio span").first()).toHaveText("2");
  await page.waitForTimeout(300);
  await expect(page.locator(".book-folio span").first()).toHaveText("2");
  await page.touchscreen.tap(paper.x + 40, paper.y + paper.height * 0.5);
  await expect(page.locator(".book-folio span").first()).toHaveText("1");
  await page.locator(".footnote-ref").first().tap();
  await expect(
    page.getByRole("dialog", { name: "Chú thích", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đóng chú thích", exact: true }).tap();
  await page
    .locator(".prose p")
    .first()
    .evaluate((el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      const s = getSelection()!;
      s.removeAllRanges();
      s.addRange(r);
    });
  await page.touchscreen.tap(
    paper.x + paper.width - 40,
    paper.y + paper.height * 0.5,
  );
  await expect(page.locator(".book-folio span").first()).toHaveText("1");
  expect(await page.locator(".prose").textContent()).toBe(source);
});
test("touch move bursts render at most one new fold per animation frame", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Phone touch rendering");
  await book(page);
  await page
    .locator("[data-book-animation] iframe")
    .evaluate((frame: HTMLIFrameElement) => {
      const win = frame.contentWindow as any;
      const get = win.St.PageFlip.prototype.getFlipController;
      win.__foldCalls = 0;
      win.St.PageFlip.prototype.getFlipController = function () {
        const controller = get.call(this);
        if (!controller.__counted) {
          controller.__counted = true;
          const fold = controller.fold;
          controller.fold = function (...args: unknown[]) {
            win.__foldCalls++;
            return fold.apply(this, args);
          };
        }
        return controller;
      };
    });
  const paper = (await page.locator(".reader-document").boundingBox())!;
  const p = {
    pointerType: "touch",
    pointerId: 73,
    isPrimary: true,
    clientX: paper.x + paper.width * 0.8,
    clientY: paper.y + paper.height * 0.6,
  };
  await page.locator(".reading-scroll").dispatchEvent("pointerdown", p);
  await page
    .locator(".reading-scroll")
    .dispatchEvent("pointermove", { ...p, clientX: p.clientX - 30 });
  await expect
    .poll(() =>
      page
        .locator("[data-book-animation] iframe")
        .evaluate(
          (f: HTMLIFrameElement) => (f.contentWindow as any).__foldCalls,
        ),
    )
    .toBeGreaterThan(0);
  const calls = await page.locator(".reading-scroll").evaluate((el, p) => {
    const win = (
      document.querySelector(
        "[data-book-animation] iframe",
      ) as HTMLIFrameElement
    ).contentWindow as any;
    win.__foldCalls = 0;
    for (let i = 0; i < 80; i++)
      el.dispatchEvent(
        new PointerEvent("pointermove", {
          ...p,
          bubbles: true,
          clientX: p.clientX - 30 - i / 4,
        }),
      );
    return win.__foldCalls;
  }, p);
  expect(calls).toBe(0);
  await expect
    .poll(() =>
      page
        .locator("[data-book-animation] iframe")
        .evaluate(
          (f: HTMLIFrameElement) => (f.contentWindow as any).__foldCalls,
        ),
    )
    .toBe(1);
  await page.locator(".reading-scroll").dispatchEvent("pointercancel", p);
  await expect(page.locator(".book-folio span").first()).toHaveText("1");
});
