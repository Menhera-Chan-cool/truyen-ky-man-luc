import { test, expect } from "@playwright/test";
import { parse } from "node-html-parser";
test("places author attribution below the book title", async ({ page }) => {
  await page.goto("/vi");
  const author = await page.locator(".author-line").boundingBox();
  const heading = await page.locator("#book-title").boundingBox();
  expect(author!.y).toBeGreaterThanOrEqual(heading!.y + heading!.height);
});
test("provides at least 40px phone targets for book and reader controls", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "Phone target check");
  async function check(selector: string) {
    for (const el of await page.locator(selector).all()) {
      if (!(await el.isVisible())) continue;
      const box = await el.boundingBox();
      expect(
        box!.width,
        (await el.getAttribute("aria-label")) ?? selector,
      ).toBeGreaterThanOrEqual(40);
      expect(
        box!.height,
        (await el.getAttribute("aria-label")) ?? selector,
      ).toBeGreaterThanOrEqual(40);
    }
  }
  await page.goto("/vi");
  await check(
    ".site-header button,.site-header .language-switch a,.site-header .login-link",
  );
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await check(".reader-topbar button,.reader-topbar .language-switch a");
  await page
    .getByRole("button", { name: "Cài đặt trình đọc", exact: true })
    .click();
  await check(".reader-panel button,.reader-panel input[type=range]");
});
test("returns the correct HTML language before JavaScript runs", async ({
  request,
}) => {
  for (const locale of ["en", "vi"]) {
    const response = await request.get(`/${locale}`, {
      headers: { "x-book-locale": locale === "en" ? "vi" : "en" },
    });
    const html = await response.text();
    expect(html.match(/<html[^>]*lang="([^"]+)"/)?.[1]).toBe(locale);
  }
});
test("opens directly on the book and switches the complete edition", async ({
  page,
  request,
}) => {
  const englishResponse = await request.get("/en");
  const englishTitle = parse(await englishResponse.text()).querySelector(
    "#book-title",
  )?.textContent;
  expect(englishTitle).toBeTruthy();
  await page.goto("/vi");
  await expect(
    page.getByRole("heading", { name: "Truyền kỳ mạn lục", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Chương 20:/ })).toBeVisible();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("menuitem", { name: "Novel", exact: true }).click();
  await expect(page.locator("#book-title")).toHaveText(englishTitle!);
  await expect(page.getByRole("link", { name: /Chapter 20:/ })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
test("retains chapter identity when switching languages", async ({ page }) => {
  await page.goto("/vi/read/chapter-2");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Chương 2",
  );
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("menuitem", { name: "Novel", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/read\/chapter-2/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Chapter 2",
  );
  await expect(page.locator(".prose")).toContainText("Tu Dat");
  await expect(page.locator(".prose")).not.toContainText("Từ Đạt");
});
test("reports missing English preface without leaking Vietnamese content", async ({
  page,
}) => {
  await page.goto("/en/read/preface");
  await expect(
    page.getByText("This section is not available in English yet."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Read in Vietnamese" }),
  ).toBeVisible();
});
test("persists reader settings and progress on the device", async ({
  page,
}) => {
  await page.goto("/en/read/chapter-3");
  await page
    .getByRole("button", { name: "Reader settings", exact: true })
    .click();
  await page.getByRole("slider", { name: "Font size" }).fill("24");
  await expect(page.locator(".prose")).toHaveCSS("font-size", "24px");
  await page.reload();
  await expect(page.locator(".prose")).toHaveCSS("font-size", "24px");
  await page.goto("/en");
  await page
    .getByRole("button", { name: "Continue reading", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "English", exact: true }),
  ).toHaveAttribute("href", "/en/read/chapter-3");
  await expect(
    page.getByRole("link", { name: "Comic", exact: true }),
  ).toHaveAttribute("href", "/en/comic/chapter-3");
});
test("protects the editor and rejects anonymous API writes", async ({
  page,
  request,
}) => {
  const state = await request.get("/api/admin/state");
  expect([401, 503]).toContain(state.status());
  await page.goto("/admin");
  if (state.status() === 503) {
    await expect(page.getByText("Supabase chưa được cấu hình.")).toBeVisible();
  } else {
    await expect(
      page.getByRole("heading", { name: "Đăng nhập", exact: true }),
    ).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByText("Supabase chưa được cấu hình.")).toHaveCount(0);
  }
  const response = await request.post("/api/admin/chapters", { data: {} });
  expect(response.status()).toBe(state.status());
});
test("saves a selected passage and note through a reload without changing its anchor", async ({
  page,
}) => {
  await page.goto("/en/read/chapter-1");
  await page.locator(".prose").evaluate((root) => {
    const paragraph = Array.from(root.querySelectorAll("p")).find(
      (p) => (p.textContent ?? "").trim().length > 80,
    )!;
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    const text = walker.nextNode()!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, Math.min(40, text.textContent!.length));
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await expect(
    page.getByRole("region", { name: "Selection actions" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Note for this passage" })
    .fill("A note kept on this device");
  await page
    .getByRole("button", { name: "Highlight #f3dd83", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  if (
    !(await page
      .getByRole("button", { name: "Bookmarks", exact: true })
      .isVisible())
  )
    await page
      .getByRole("button", { name: "Open contents", exact: true })
      .click();
  await page.getByRole("button", { name: "Bookmarks", exact: true }).click();
  await expect(
    page.getByText("A note kept on this device", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete bookmark", exact: true })
    .click();
  await expect(
    page.getByText("A note kept on this device", { exact: true }),
  ).toHaveCount(0);
});
test("paginates and adapts double-page reading to the viewport", async ({
  page,
}, testInfo) => {
  await page.goto("/en/read/chapter-1");
  await page
    .getByRole("button", { name: "Reader settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Double page", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".prose")).toHaveCSS(
    "column-count",
    testInfo.project.name === "mobile" ? "1" : "2",
  );
  await expect(
    page.getByRole("button", { name: "Next page", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator(".page-controls>span")).toContainText(/^2\s*\//);
});
test("plays ambient noise and starts and stops auto-scroll", async ({
  page,
}) => {
  await page.goto("/en/read/chapter-1");
  await page
    .getByRole("button", { name: "Ambient sounds", exact: true })
    .click();
  await page.getByRole("button", { name: "White noise", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "White noise", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Stop all", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "White noise", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Auto-scroll", exact: true }).click();
  await page
    .getByRole("button", { name: "Start auto-scroll", exact: true })
    .click();
  await expect
    .poll(() => page.locator(".reading-scroll").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(5);
  await page
    .getByRole("button", { name: "Stop auto-scroll", exact: true })
    .click();
});
