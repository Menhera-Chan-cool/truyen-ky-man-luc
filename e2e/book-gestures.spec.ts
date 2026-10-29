import { test, expect, type Page } from "@playwright/test";
async function openBook(page: Page) {
  await page.goto("/en/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Reader settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Book", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".reader-document")).toHaveAttribute(
    "data-flip-ready",
    "true",
  );
}
const folio = (page: Page) => page.locator(".book-folio span").first();
async function fold(page: Page) {
  return page.locator("[data-book-animation] iframe").evaluate((el) => {
    const doc = (el as HTMLIFrameElement).contentDocument!;
    return [...doc.querySelectorAll<HTMLElement>(".stf__item")]
      .map((el) => el.style.clipPath)
      .filter((s) => s.startsWith("polygon("));
  });
}
test("mouse edge drag follows the held pointer, commits once, and can be cancelled", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Physical mouse on desktop");
  await openBook(page);
  const b = (await page.locator(".reader-document").boundingBox())!;
  const first = await folio(page).textContent();
  const x = b.x + b.width - 5,
    y = b.y + b.height * 0.7;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 70, y, { steps: 5 });
  await expect.poll(() => fold(page)).not.toEqual([]);
  const partial = await fold(page);
  await page.waitForTimeout(800); // Holding must not finish a page or time out.
  await expect(folio(page)).toHaveText(first!);
  await page.mouse.move(x - 220, y - 20, { steps: 6 });
  await expect.poll(() => fold(page)).not.toEqual(partial);
  await page.mouse.up();
  await expect(folio(page)).toHaveText("3");
  await expect(page.locator(".book-flip-layer")).toHaveCount(0);
  await expect(page.locator(".reader-document")).toHaveAttribute(
    "data-flip-ready",
    "true",
  );
  // A short pull returns to the same leaf; a left-edge drag then goes back.
  await page.mouse.move(b.x + 5, y);
  await page.mouse.down();
  await page.mouse.move(b.x + 25, y, { steps: 3 });
  await page.mouse.up();
  await expect(page.locator(".book-flip-layer")).toHaveCount(0);
  await expect(folio(page)).toHaveText("3");
  await page.mouse.move(b.x + 5, y);
  await page.mouse.down();
  await page.mouse.move(b.x + 200, y, { steps: 8 });
  await page.mouse.up();
  await expect(folio(page)).toHaveText(first!);
  await expect(page.locator(".prose")).toHaveCount(1);
});
test("mobile controls hide without reflow and wake from blank paper or bottom edge", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Phone chrome behavior");
  await page.setViewportSize({ width: 390, height: 844 });
  await openBook(page);
  const footer = page.locator(".reading-progress"),
    paper = page.locator(".reader-document");
  const before = await paper.boundingBox();
  await expect(footer).toHaveAttribute("inert", "", { timeout: 6500 });
  expect(await paper.boundingBox()).toEqual(before);
  const textPoint = await page
    .locator(".prose p")
    .first()
    .evaluate((p) => {
      const range = document.createRange();
      range.selectNodeContents(p.firstChild!);
      const rect = range.getClientRects()[0];
      return { x: rect.left + 12, y: rect.top + rect.height / 2 };
    });
  await page.touchscreen.tap(textPoint.x, textPoint.y);
  await expect(footer).toHaveAttribute("inert", "");
  await page
    .getByRole("button", { name: "Show reading controls", exact: true })
    .dispatchEvent("pointerup", { pointerType: "touch", isPrimary: true });
  await expect(footer).not.toHaveAttribute("inert", "");
  expect(await paper.boundingBox()).toEqual(before);
  await footer.getByRole("button", { name: "Next page", exact: true }).tap();
  await expect(folio(page)).toHaveText("2");
  await expect(footer).toHaveAttribute("inert", "", { timeout: 6500 });
  const b = (await paper.boundingBox())!;
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height - 12);
  await expect(footer).not.toHaveAttribute("inert", "");
  expect(await paper.boundingBox()).toEqual(before);
  // Keyboard focus keeps the bottom controls reachable.
  await footer.getByRole("button", { name: "Next page", exact: true }).focus();
  await page.waitForTimeout(4000);
  await expect(footer).not.toHaveAttribute("inert", "");
  await page.setViewportSize({ width: 360, height: 740 });
  await page
    .getByRole("button", { name: "Reader settings", exact: true })
    .focus();
  await expect(footer).toHaveAttribute("inert", "", { timeout: 6500 });
  await page
    .getByRole("button", { name: "Show reading controls", exact: true })
    .focus();
  await expect(
    footer.locator(".page-controls button:enabled").first(),
  ).toBeFocused();
});
test("horizontal touch previews a page, cancellation restores it, and vertical input stays native", async ({
  page,
}) => {
  await openBook(page);
  const surface = page.locator(".reading-scroll");
  const b = (await page.locator(".reader-document").boundingBox())!;
  const x = b.x + b.width * 0.8,
    y = b.y + b.height * 0.65;
  const pointer = (type: string, dx = 0, dy = 0) =>
    surface.dispatchEvent(type, {
      pointerId: 7,
      pointerType: "touch",
      isPrimary: true,
      clientX: x + dx,
      clientY: y + dy,
    });
  const first = await folio(page).textContent();
  await pointer("pointerdown");
  await pointer("pointermove", -100, 2);
  await expect.poll(() => fold(page)).not.toEqual([]);
  await expect(folio(page)).toHaveText(first!);
  await pointer("pointercancel", -100, 2);
  await expect(page.locator(".book-flip-layer")).toHaveCount(0);
  await expect(folio(page)).toHaveText(first!);
  await pointer("pointerdown");
  await pointer("pointermove", 10, 120);
  await pointer("pointerup", 10, 120);
  await expect(folio(page)).toHaveText(first!);
});

test("drag crosses chapter edges on fresh paper and Escape aborts a held fold", async ({
  page,
  isMobile,
}) => {
  await openBook(page);
  await page
    .getByRole("button", { name: "Last page of chapter", exact: true })
    .click();
  await expect(page.locator(".reader-document")).toHaveAttribute(
    "data-flip-ready",
    "true",
  );
  const surface = page.locator(".reading-scroll");
  const drag = async (direction: number, release = true) => {
    const b = (await page.locator(".reader-document").boundingBox())!;
    const x = direction > 0 ? b.x + b.width - 5 : b.x + 5,
      y = b.y + b.height * 0.7;
    const props = {
      pointerId: 8,
      pointerType: isMobile ? "touch" : "mouse",
      button: 0,
      isPrimary: true,
      clientX: x,
      clientY: y,
    };
    await surface.dispatchEvent("pointerdown", props);
    await surface.dispatchEvent("pointermove", {
      ...props,
      clientX: x - direction * 140,
    });
    await expect.poll(() => fold(page)).not.toEqual([]);
    await expect(page).toHaveURL(/chapter-1$/);
    if (release)
      await surface.dispatchEvent("pointerup", {
        ...props,
        clientX: x - direction * 140,
      });
  };
  await drag(1, false);
  await page.keyboard.press("Escape");
  await expect(page.locator(".book-flip-layer")).toHaveCount(0);
  await expect(page).toHaveURL(/chapter-1$/);
  await expect(page.locator(".reader-document")).toHaveAttribute(
    "data-flip-ready",
    "true",
  );
  await drag(1);
  await expect(page).toHaveURL(/chapter-2$/);
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(folio(page)).toHaveText("1");
  await expect(page.locator(".reader-document")).toHaveAttribute(
    "data-flip-ready",
    "true",
  );
  const b = (await page.locator(".reader-document").boundingBox())!;
  const props = {
    pointerId: 9,
    pointerType: "touch",
    isPrimary: true,
    clientX: b.x + 5,
    clientY: b.y + b.height * 0.7,
  };
  await surface.dispatchEvent("pointerdown", props);
  await surface.dispatchEvent("pointermove", {
    ...props,
    clientX: props.clientX + 150,
  });
  await surface.dispatchEvent("pointerup", {
    ...props,
    clientX: props.clientX + 150,
  });
  await expect(page).toHaveURL(/chapter-1$/);
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Last page of chapter", exact: true }),
  ).toBeDisabled();
});

test("native phone swipe previews and turns one page without waking hidden controls", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Chromium touch input");
  await openBook(page);
  await expect(page.locator(".reading-progress")).toHaveAttribute("inert", "", {
    timeout: 6500,
  });
  const b = (await page.locator(".reader-document").boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = b.x + b.width * 0.8,
    y = b.y + b.height * 0.65;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 6; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x - i * 20, y }],
    });
    await page.waitForTimeout(20);
  }
  await expect.poll(() => fold(page)).not.toEqual([]);
  await expect(folio(page)).toHaveText("1");
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(folio(page)).toHaveText("2");
  await expect(page.locator(".reading-progress")).toHaveAttribute("inert", "");
  await expect(page.locator(".book-flip-layer")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Show reading controls", exact: true })
    .tap();
  await expect(page.locator(".reading-progress")).not.toHaveAttribute(
    "inert",
    "",
  );
  expect(await page.locator(".reader-document").boundingBox()).toEqual(b);
  await cdp.detach();
});

test("central mouse selection, a second finger and reduced motion do not cause accidental turns", async ({
  page,
}) => {
  await openBook(page);
  const surface = page.locator(".reading-scroll"),
    paper = page.locator(".reader-document");
  const b = (await paper.boundingBox())!;
  const props = {
    pointerId: 6,
    pointerType: "mouse",
    button: 0,
    isPrimary: true,
    clientX: b.x + b.width / 2,
    clientY: b.y + b.height / 2,
  };
  await surface.dispatchEvent("pointerdown", props);
  await surface.dispatchEvent("pointermove", {
    ...props,
    clientX: props.clientX - 150,
  });
  await surface.dispatchEvent("pointerup", {
    ...props,
    clientX: props.clientX - 150,
  });
  await expect(folio(page)).toHaveText("1");
  const touch = { ...props, pointerType: "touch" };
  await surface.dispatchEvent("pointerdown", touch);
  await surface.dispatchEvent("pointermove", {
    ...touch,
    clientX: touch.clientX - 100,
  });
  await expect.poll(() => fold(page)).not.toEqual([]);
  await surface.dispatchEvent("pointerdown", {
    ...touch,
    pointerId: 7,
    isPrimary: false,
  });
  await surface.dispatchEvent("pointerup", {
    ...touch,
    clientX: touch.clientX - 150,
  });
  await expect(page.locator(".book-flip-layer")).toHaveCount(0);
  await expect(folio(page)).toHaveText("1");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await surface.dispatchEvent("pointerdown", touch);
  await surface.dispatchEvent("pointermove", {
    ...touch,
    clientX: touch.clientX - 100,
  });
  await surface.dispatchEvent("pointerup", {
    ...touch,
    clientX: touch.clientX - 100,
  });
  await expect(folio(page)).not.toHaveText("1");
  await expect(page.locator(".book-flip-layer")).toHaveCount(0);
});
