import { test, expect, type Page } from "@playwright/test";
async function layout(page: Page, locale: string, value: "book" | "ebook") {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
  await page
    .getByRole("button", {
      name: L("Cài đặt trình đọc", "Reader settings"),
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: value === "book" ? L("Sách", "Book") : "Ebook",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: L("Đóng", "Close"), exact: true })
    .click();
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
}
async function offset(page: Page, at?: number) {
  return page.locator(".prose").evaluate((root, at) => {
    const v = (document.querySelector(".reading-window.paged") ??
        document.querySelector(".reading-scroll"))!.getBoundingClientRect(),
      walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const seen = (r: DOMRect) =>
      r.width > 0 &&
      r.height > 0 &&
      r.right > v.left + 2 &&
      r.left < v.right - 2 &&
      r.bottom > v.top + 2 &&
      r.top < v.bottom - 2;
    let n: Node | null,
      total = 0;
    while ((n = walk.nextNode())) {
      const text = n.textContent ?? "",
        r = document.createRange();
      if (at !== null && at !== undefined) {
        if (at < total + text.length) {
          r.setStart(n, at - total);
          r.setEnd(n, at - total + 1);
          return seen(r.getBoundingClientRect()) ? at : -1;
        }
      } else if (text.trim()) {
        r.selectNodeContents(n);
        if ([...r.getClientRects()].some(seen))
          for (let i = 0; i < text.length; i++) {
            r.setStart(n, i);
            r.setEnd(n, i + 1);
            if (seen(r.getBoundingClientRect())) return total + i;
          }
      }
      total += text.length;
    }
    return -1;
  }, at ?? null);
}
for (const locale of ["vi", "en"]) {
  const L = (vi: string, en: string) => (locale === "vi" ? vi : en);
  test(`switches presentation without moving text and turns across fresh chapter pages (${locale})`, async ({
    page,
    isMobile,
  }) => {
    await page.goto(`/${locale}/read/chapter-2`);
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await page
      .locator(".reading-scroll")
      .evaluate((el) => (el.scrollTop = 1800));
    await expect
      .poll(() =>
        page.evaluate(
          (locale) =>
            new Promise<number>((resolve, reject) => {
              const request = indexedDB.open("truyen-ky-man-luc", 1);
              request.onerror = () => reject(request.error);
              request.onsuccess = () => {
                const db = request.result,
                  get = db
                    .transaction("progress")
                    .objectStore("progress")
                    .get(`${locale}:chapter-2`);
                get.onsuccess = () => {
                  resolve(get.result?.ratio ?? 0);
                  db.close();
                };
              };
            }),
          locale,
        ),
      )
      .toBeGreaterThan(0);
    await page.goto(`/${locale}/read/chapter-1`);
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    const original = await page.locator(".prose").textContent();
    await page
      .getByRole("button", {
        name: L("Cài đặt trình đọc", "Reader settings"),
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: L("Sách", "Book"), exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: L("Sách", "Book"), exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: L("Đóng", "Close"), exact: true })
      .click();
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-layout",
      "book",
    );
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    expect(await page.locator(".prose").textContent()).toBe(original);
    await expect(page.locator(".prose")).toHaveCSS(
      "column-count",
      isMobile ? "1" : "2",
    );
    await expect(page.locator(".book-chapter-heading")).toHaveAttribute(
      "data-title",
      new RegExp(L("Chương 1", "Chapter 1")),
    );
    await page
      .getByRole("button", {
        name: L("Cuối chương", "Last page of chapter"),
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: L("Trang sau", "Next page"), exact: true })
      .click();
    await expect(page).toHaveURL(/chapter-2$/);
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(page.locator(".book-chapter-heading")).toHaveCount(1);
    await expect(page.locator(".book-chapter-heading")).toHaveAttribute(
      "data-title",
      new RegExp(L("Chương 2", "Chapter 2")),
    );
    await expect(page.locator(".book-folio span").first()).toHaveText("1");
    await expect(page.locator(".book-chapter-heading")).toBeInViewport();
    await expect(page.locator(".prose p").first()).toContainText(
      L("Từ Đạt", "Tu Dat"),
    );
    await page
      .getByRole("button", {
        name: L("Trang trước", "Previous page"),
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/chapter-1$/);
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(
      page.getByRole("button", {
        name: L("Cuối chương", "Last page of chapter"),
        exact: true,
      }),
    ).toBeDisabled();
    await page
      .getByRole("button", {
        name: L("Đầu chương", "First page of chapter"),
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: L("Chương sau", "Next chapter"),
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/chapter-2$/);
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await page
      .getByRole("button", {
        name: L("Trang trước", "Previous page"),
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/chapter-1$/);
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(
      page.getByRole("button", {
        name: L("Cuối chương", "Last page of chapter"),
        exact: true,
      }),
    ).toBeDisabled();
    await page
      .getByRole("button", {
        name: L("Đầu chương", "First page of chapter"),
        exact: true,
      })
      .click();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".book-folio span").first()).toHaveText(
      isMobile ? "2" : "3",
    );
    await page.keyboard.press("ArrowLeft");
    await expect(page.locator(".book-folio span").first()).toHaveText("1");
    await page.reload();
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-layout",
      "book",
    );
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
    await page.getByRole("button", { name: "Ebook", exact: true }).click();
    await page
      .getByRole("button", { name: L("Đóng", "Close"), exact: true })
      .click();
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-layout",
      "ebook",
    );
    await expect(page.locator(".reading-window")).not.toHaveClass(/paged/);
    expect(await page.locator(".prose").textContent()).toBe(original);
  });
  test(`keeps the current passage through book resizing, fonts and Ebook (${locale})`, async ({
    page,
    isMobile,
  }) => {
    await page.goto(`/${locale}/read/chapter-1`);
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await layout(page, locale, "book");
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    await page.evaluate(() => document.fonts.ready);
    let latest = await offset(page);
    expect(latest).toBeGreaterThan(300);
    await layout(page, locale, "ebook");
    await expect.poll(() => offset(page, latest)).toBe(latest);
    await layout(page, locale, "book");
    await expect.poll(() => offset(page, latest)).toBe(latest);
    latest = await offset(page);
    const width = isMobile ? 440 : 850;
    await page.setViewportSize({ width, height: 780 });
    await expect(page.locator(".prose")).toHaveCSS("column-count", "1");
    await expect.poll(() => offset(page, latest)).toBe(latest);
    latest = await offset(page);
    await page
      .getByRole("button", {
        name: L("Cài đặt trình đọc", "Reader settings"),
        exact: true,
      })
      .click();
    await page
      .getByRole("combobox", {
        name: L("Phông chữ", "Font family"),
        exact: true,
      })
      .selectOption("Lora");
    await page
      .getByRole("button", { name: L("Đóng", "Close"), exact: true })
      .click();
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => offset(page, latest)).toBe(latest);
  });
  test(`keeps footnotes and speech usable in the book surface (${locale})`, async ({
    page,
    isMobile,
  }) => {
    await page.addInitScript(() => {
      (window as any).bookSpeech = [];
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
          getVoices: () => [ {name:"Test Vietnamese",lang:"vi-VN",voiceURI:"test-vi"}, {name:"Test English",lang:"en-US",voiceURI:"test-en"} ],
          cancel() {},
          speak(u: any) {
            (window as any).bookSpeech.push(u);
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
    await layout(page, locale, "book");
    const startOffset = await offset(page);
    const ref = page.locator(".footnote-ref").first(),
      href = await ref.getAttribute("href");
    await ref.focus();
    await page.keyboard.press("Escape");
    await ref.click();
    if (isMobile) {
      const card = page.getByRole("dialog", {
        name: L("Chú thích", "Footnote"),
        exact: true,
      });
      await expect(card).toContainText(
        (await ref.getAttribute("data-tooltip"))!,
      );
      await card
        .getByRole("button", {
          name: L("Đóng chú thích", "Close footnote"),
          exact: true,
        })
        .click();
    } else {
      await expect(page.locator(href!)).toBeFocused();
      await page.goBack();
    }
    await expect(page).toHaveURL(/chapter-1$/);
    await expect.poll(() => offset(page, startOffset)).toBe(startOffset);
    await page
      .getByRole("button", {
        name: L("Đọc giọng nói", "Read aloud"),
        exact: true,
      })
      .click();
    const spoken = await page.evaluate(
      () => (window as any).bookSpeech[0].text,
    );
    expect(spoken).not.toContain("(1)");
    expect(spoken).toContain("   ");
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
    await expect(
      page.getByRole("button", {
        name: L("Tạm dừng đọc", "Pause reading"),
        exact: true,
      }),
    ).toBeVisible();
  });
}
test("horizontal touch turns respect vertical movement, text selection and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await layout(page, "en", "book");
  const surface = page.locator(".reading-scroll"),
    folio = page.locator(".book-folio span").first(),
    first = await folio.textContent();
  const swipe = async (dx: number, dy: number) => {
    await surface.dispatchEvent("pointerdown", {
      pointerType: "touch",
      isPrimary: true,
      clientX: 200,
      clientY: 250,
    });
    await surface.dispatchEvent("pointerup", {
      pointerType: "touch",
      isPrimary: true,
      clientX: 200 + dx,
      clientY: 250 + dy,
    });
  };
  await swipe(-100, 5);
  await expect(folio).not.toHaveText(first!);
  await expect(page.locator(".book-turn")).not.toBeVisible();
  await swipe(100, 0);
  await expect(folio).toHaveText(first!);
  await swipe(-100, 120);
  await expect(folio).toHaveText(first!);
  await page
    .locator(".prose p")
    .first()
    .evaluate((p) => {
      const n = document.createTreeWalker(p, NodeFilter.SHOW_TEXT).nextNode()!,
        r = document.createRange();
      r.setStart(n, 0);
      r.setEnd(n, 5);
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(r);
    });
  await swipe(-100, 0);
  await expect(folio).toHaveText(first!);
});
test("turns real page faces without duplicating live text or keeping animation frames alive", async ({
  page,
}) => {
  await page.goto("/en/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await layout(page, "en", "book");
  const paper = page.locator(".reader-document");
  await expect(paper).toHaveAttribute("data-flip-ready", "true");
  const handle = await page
      .locator("[data-book-animation] iframe")
      .elementHandle(),
    frame = await handle!.contentFrame();
  await frame!.evaluate(() => {
    (window as any).frameTicks=0;const request=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>request(time=>{(window as any).frameTicks++;callback(time);});
    (window.parent as any).foldAudit = {
      fold: false,
      shadow: false,
      pages: false,
    };
    new MutationObserver(() => {
      const state = (window.parent as any).foldAudit;
      state.fold ||= [
        ...document.querySelectorAll<HTMLElement>(".stf__item"),
      ].some((el) => el.style.clipPath.startsWith("polygon("));
      state.shadow ||= !!document.querySelector(
        ".stf__outerShadow,.stf__innerShadow",
      );
      state.pages ||= [...document.querySelectorAll(".stf__item")].some((el) =>
        el.textContent?.includes("Ho Tong Thoc"),
      );
    }).observe(document.body, {
      subtree: true,
      attributes: true,
      childList: true,
    });
  });
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => page.evaluate(() => (window as any).foldAudit))
    .toEqual({ fold: true, shadow: true, pages: true });
  await expect(page.locator(".book-flip-layer")).toHaveCount(0, {
    timeout: 2500,
  });
  await expect(paper).toHaveAttribute("data-flip-ready", "true");
  expect(frame!.isDetached()).toBe(false);
  const ticks=await frame!.evaluate(()=>(window as any).frameTicks);await page.waitForTimeout(120);expect(await frame!.evaluate(()=>(window as any).frameTicks)).toBe(ticks);
  expect(await frame!.locator("body > *").count()).toBe(0);
  await expect(page.locator(".prose")).toHaveCount(1);
  await expect(page.locator("[data-book-animation] iframe")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".book-flip-layer")).toHaveCount(0);
});
test("uses the book contents as a drawer and returns to reading after chapter selection", async ({
  page,
}) => {
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await layout(page, "vi", "book");
  const paper = page.locator(".reader-document"),
    before = await paper.boundingBox();
  await page.getByRole("button", { name: "Mục lục sách", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Mục lục sách", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  const after = await paper.boundingBox();
  expect(after!.width).toBeCloseTo(before!.width, 0);
  await page
    .getByRole("textbox", { name: "Tìm chương", exact: true })
    .fill("20");
  await page.locator('.reader-sidebar a[href="/vi/read/chapter-20"]').click();
  await expect(page).toHaveURL(/chapter-20$/);
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator(".sidebar-backdrop")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Mục lục sách", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
});
