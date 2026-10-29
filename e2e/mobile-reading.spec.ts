import { test, expect, type Page } from "@playwright/test";
async function book(page: Page, locale = "en") {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
  await page.goto(`/${locale}/read/chapter-1`);
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
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
  await expect(page.locator(".reader-document")).toHaveAttribute(
    "data-flip-ready",
    "true",
  );
}
async function swipe(page: Page, direction: number, distance = 110) {
  await page.locator(".reading-scroll").evaluate(
    (el, { direction, distance }) => {
      const b = document
        .querySelector(".reader-document")!
        .getBoundingClientRect();
      const p = {
        bubbles: true,
        pointerId: 15,
        pointerType: "touch",
        isPrimary: true,
        clientX: direction > 0 ? b.right - 10 : b.left + 10,
        clientY: b.top + b.height * 0.7,
      };
      el.dispatchEvent(new PointerEvent("pointerdown", p));
      el.dispatchEvent(
        new PointerEvent("pointermove", {
          ...p,
          clientX: p.clientX - direction * distance,
        }),
      );
      el.dispatchEvent(
        new PointerEvent("pointerup", {
          ...p,
          clientX: p.clientX - direction * distance,
        }),
      );
    },
    { direction, distance },
  );
}
test("rapid touch releases commit exactly once each before the previous fold settles", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Phone touch behavior");
  await book(page);
  await swipe(page, 1);
  await expect(page.locator(".book-folio span").first()).toHaveText("2", {
    timeout: 120,
  });
  for (const dir of [1, 1, -1, 1]) {
    await swipe(page, dir);
    await page.waitForTimeout(15);
  }
  await expect(page.locator(".book-folio span").first()).toHaveText("4");
  await expect(page.locator(".book-flip-layer")).toHaveCount(0);
  await page.waitForTimeout(350);
  await expect(page.locator(".book-folio span").first()).toHaveText("4");
});
test("single-page folded reverse uses the next leaf, not a second copy of the front", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Single-leaf phone renderer");
  await book(page);
  const b = (await page.locator(".reader-document").boundingBox())!;
  const p = {
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    clientX: b.x + b.width - 8,
    clientY: b.y + b.height * 0.7,
  };
  p.clientX = b.x + b.width - 8;
  const surface = page.locator(".reading-scroll");
  await surface.dispatchEvent("pointerdown", p);
  await surface.dispatchEvent("pointermove", {
    ...p,
    clientX: p.clientX - 160,
  });
  await expect
    .poll(() =>
      page
        .locator("[data-book-animation] iframe")
        .evaluate((el) =>
          [
            ...(
              el as HTMLIFrameElement
            ).contentDocument!.querySelectorAll<HTMLElement>(".stf__item"),
          ]
            .filter((el) => el.style.clipPath.startsWith("polygon("))
            .map((el) => el.querySelector(".book-folio")?.textContent?.trim()),
        ),
    )
    .toEqual(["2", "2"]);
  await surface.dispatchEvent("pointercancel", p);
  await expect(page.locator(".book-folio span").first()).toHaveText("1");
});
for (const locale of ["vi", "en"])
  test(`touch footnote opens a pinned card without navigating in scroll and Book (${locale})`, async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Touch preview");
    const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
    await page.goto(`/${locale}/read/chapter-1`);
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    for (const mode of ["ebook", "book"]) {
      if (mode === "book") {
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
      }
      const ref = page.locator(".footnote-ref").first(),
        before = await page
          .locator(".reading-scroll")
          .evaluate((el) => el.scrollTop);
      const expected = await ref.getAttribute("data-tooltip");
      await ref.tap();
      const card = page.getByRole("dialog", {
        name: L("Chú thích", "Footnote"),
        exact: true,
      });
      await expect(card).toContainText(expected!);
      await expect(page).toHaveURL(new RegExp(`/${locale}/read/chapter-1$`));
      expect(
        await page.locator(".reading-scroll").evaluate((el) => el.scrollTop),
      ).toBe(before);
      await page.waitForTimeout(250);
      await expect(card).toBeVisible();
      await card.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(card).toBeVisible();
      await card
        .getByRole("button", {
          name: L("Đóng chú thích", "Close footnote"),
          exact: true,
        })
        .tap();
      await expect(card).toHaveCount(0);
      await ref.tap();
      await expect(card).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(card).toHaveCount(0);
      const rect = (await ref.boundingBox())!;
      const touch = {
        pointerType: "touch",
        pointerId: 21,
        isPrimary: true,
        clientX: rect.x + rect.width / 2,
        clientY: rect.y + rect.height / 2,
      };
      await ref.dispatchEvent("pointerdown", touch);
      await ref.dispatchEvent("pointerup", touch);
      await expect(card).toBeVisible();
      await page.touchscreen.tap(4, 100);
      await expect(card).toHaveCount(0);
      await expect(page).not.toHaveURL(/#reader-footnote/);
    }
  });

test("touch bursts keep sequence through a chapter boundary and a cold animation context", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Phone sequence");
  await book(page);
  await page
    .getByRole("button", { name: "Last page of chapter", exact: true })
    .click();
  await expect(page.locator(".reader-document")).toHaveAttribute(
    "data-flip-ready",
    "true",
  );
  // Two releases in one event-loop task cover the window before the new chapter restores.
  await page.locator(".reading-scroll").evaluate((el) => {
    const b = document
      .querySelector(".reader-document")!
      .getBoundingClientRect();
    for (let i = 0; i < 2; i++) {
      const p = {
        bubbles: true,
        pointerId: 20 + i,
        pointerType: "touch",
        isPrimary: true,
        clientX: b.right - 8,
        clientY: b.top + b.height * 0.7,
      };
      for (const type of ["pointerdown", "pointermove", "pointerup"])
        el.dispatchEvent(
          new PointerEvent(type, {
            ...p,
            clientX: p.clientX - (type === "pointerdown" ? 0 : 110),
          }),
        );
    }
  });
  await expect(page).toHaveURL(/chapter-2$/);
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator(".book-folio span").first()).toHaveText("2");
  await page.route("**/vendor/page-flip-2.0.7.js", async (route) => {
    await new Promise((r) => setTimeout(r, 400));
    await route.continue();
  });
  await page.evaluate(() => {
    document.dispatchEvent(new Event("freeze"));
    window.dispatchEvent(new Event("pageshow"));
  });
  for (const dir of [1, 1, -1]) await swipe(page, dir);
  await expect(page.locator(".book-folio span").first()).toHaveText("3");
  await page.waitForTimeout(600);
  await expect(page.locator(".book-folio span").first()).toHaveText("3");
});

test("native fast flicks alternate cleanly and cancelled or vertical contacts do not turn", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Native Chromium touch");
  await book(page);
  const cdp = await page.context().newCDPSession(page);
  const native = async (dir: number, cancel = false, vertical = false) => {
    const b = (await page.locator(".reader-document").boundingBox())!;
    const x = b.x + b.width * 0.75,
      y = b.y + b.height * 0.55;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x - (vertical ? 4 : dir * 45), y: y + (vertical ? 100 : 2) },
      ],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: cancel ? "touchCancel" : "touchEnd",
      touchPoints: [],
    });
  };
  for (const dir of [1, 1, -1, 1, -1, 1]) {
    await native(dir);
  }
  await expect(page.locator(".book-folio span").first()).toHaveText("3");
  await native(1, true);
  await native(1, false, true);
  await expect(page.locator(".book-folio span").first()).toHaveText("3");
  await page.waitForTimeout(400);
  await expect(page.locator(".book-folio span").first()).toHaveText("3");
  await expect(page.locator(".prose")).toHaveCount(1);
  await expect(page.locator("[data-book-animation] iframe")).toHaveCount(1);
  // Disabling visual motion during a valid contact must not drop its release.
  const b = (await page.locator(".reader-document").boundingBox())!;
  const surface = page.locator(".reading-scroll"),
    p = {
      pointerType: "touch",
      pointerId: 30,
      isPrimary: true,
      clientX: b.x + b.width - 8,
      clientY: b.y + b.height * 0.7,
    };
  await surface.dispatchEvent("pointerdown", p);
  await surface.dispatchEvent("pointermove", {
    ...p,
    clientX: p.clientX - 100,
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".book-flip-layer")).toHaveCount(0);
  await surface.dispatchEvent("pointerup", { ...p, clientX: p.clientX - 100 });
  await expect(page.locator(".book-folio span").first()).toHaveText("4");
  await cdp.detach();
});
