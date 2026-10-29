import { test, expect } from "@playwright/test";
for (const locale of ["vi", "en"]) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
  test(`previews and navigates footnotes in scroll and paged reading (${locale})`, async ({
    page,
    isMobile,
  }) => {
    await page.goto(`/${locale}/read/chapter-1`);
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    const ref = page.locator(".footnote-ref").first();
    await expect(ref).toHaveAttribute(
      "aria-label",
      L("Chú thích 1", "Footnote 1"),
    );
    const href = await ref.getAttribute("href");
    const target = page.locator(href!);
    const expected = await target.textContent();
    const style = await ref.evaluate((el) => ({
      size: parseFloat(getComputedStyle(el).fontSize),
      body: parseFloat(getComputedStyle(el.closest("p")!).fontSize),
      color: getComputedStyle(el).color,
      align: getComputedStyle(el).verticalAlign,
      hidden: [...el.querySelectorAll(".footnote-paren")].every(
        (e) => getComputedStyle(e).fontSize === "0px",
      ),
    }));
    expect(style.size).toBeLessThan(style.body);
    expect(style.align).toBe("super");
    expect(style.hidden).toBe(true);
    expect(style.color).toBe("rgb(51, 102, 204)");
    if (!isMobile) {
      await ref.hover();
      await expect(page.getByRole("tooltip")).toContainText(expected!);
      await page.getByRole("tooltip").hover();
      await expect(page.getByRole("tooltip")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("tooltip")).toHaveCount(0);
    }
    await ref.focus();
    await expect(page.getByRole("tooltip")).toContainText(expected!);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    if (isMobile) await ref.tap();
    else await ref.click();
    if (isMobile) {
      const card = page.getByRole("dialog", {
        name: L("Chú thích", "Footnote"),
        exact: true,
      });
      await expect(card).toContainText(expected!);
      await expect(page).toHaveURL(new RegExp(`/${locale}/read/chapter-1$`));
      await card
        .getByRole("button", {
          name: L("Đóng chú thích", "Close footnote"),
          exact: true,
        })
        .tap();
    } else {
      await expect(page).toHaveURL(/#reader-footnote-1$/);
      await expect(target).toBeFocused();
      expect(
        await target.evaluate((el) => {
          const b = el.getBoundingClientRect(),
            v = document
              .querySelector(".reading-scroll")!
              .getBoundingClientRect();
          return b.top < v.bottom && b.bottom > v.top;
        }),
      ).toBe(true);
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`/${locale}/read/chapter-1$`));
    }
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
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await ref.focus();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await ref.evaluate((el) => el.blur());
    await ref.focus();
    await ref.click();
    if (isMobile) {
      await expect(
        page.getByRole("dialog", {
          name: L("Chú thích", "Footnote"),
          exact: true,
        }),
      ).toContainText(expected!);
      await expect(page).not.toHaveURL(/#reader-footnote/);
    } else {
      await expect(target).toBeFocused();
      expect(
        await target.evaluate((el) => {
          const b = el.getBoundingClientRect(),
            v = document
              .querySelector(".reading-window")!
              .getBoundingClientRect();
          return (
            b.left < v.right &&
            b.right > v.left &&
            b.top < v.bottom &&
            b.bottom > v.top
          );
        }),
      ).toBe(true);
      expect(
        await page.locator(".reading-window").evaluate((e) => e.scrollLeft),
      ).toBe(0);
      await page.goBack();
      await expect(page).not.toHaveURL(/#reader-footnote/);
    }
  });
  test(`speech skips inline reference digits while retaining source offsets (${locale})`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as any).speechQueue = [];
      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        configurable: true,
        value: class {
          text: string;
          constructor(text: string) {
            this.text = text;
          }
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
    await page.goto(`/${locale}/read/chapter-1`);
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    const paragraph = await page.locator(".prose p").first().textContent();
    expect(paragraph).toContain("(1)");
    await page
      .getByRole("button", {
        name: L("Đọc giọng nói", "Read aloud"),
        exact: true,
      })
      .click();
    const utterance = await page.evaluate(
      () => (window as any).speechQueue[0].text,
    );
    expect(utterance).not.toContain("(1)");
    expect(utterance).toContain("   ");
    expect(
      utterance.startsWith(paragraph!.slice(0, paragraph!.indexOf("(1)"))),
    ).toBe(true);
    const index = paragraph!.indexOf("(1)") + 4;
    await page.evaluate((index) => {
      (window as any).speechQueue[0].onboundary?.({ charIndex: index });
    }, index);
    await page
      .getByRole("button", {
        name: L("Tạm dừng đọc", "Pause reading"),
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: L("Tiếp tục đọc", "Resume reading"),
        exact: true,
      })
      .click();
    const resumed = await page.evaluate(
      () => (window as any).speechQueue.at(-1).text,
    );
    expect(resumed.startsWith(paragraph!.slice(index, index + 8))).toBe(true);
  });
}
test("links alternate and legacy Vietnamese endnotes without rewriting the text", async ({
  page,
}) => {
  for (const [id, n, phrase] of [
    ["chapter-14", 1, "Thần Môn"],
    ["chapter-14", 43, "Xử sĩ"],
    // The published edition labels this Ban Cơ; the legacy continuation is covered by the unit fixture.
    ["chapter-3", 7, "Ban Cơ"],
    ["preface", 1, "Lời Tựa"],
  ] as const) {
    await page.goto(`/vi/read/${id}`);
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    const ref = page
      .locator(`.footnote-ref[aria-label="Chú thích ${n}"]`)
      .first();
    await expect(ref).toHaveAttribute("data-tooltip", new RegExp(phrase));
    const href = await ref.getAttribute("href");
    await expect(page.locator(href!)).toHaveCount(1);
  }
});
