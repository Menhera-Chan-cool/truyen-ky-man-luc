import { test, expect, type Page } from "@playwright/test";
test.beforeEach(async({request})=>{
  test.skip((await request.get("/api/admin/state")).status()!==503,"Local prototype contracts; shared publishing is verified by scripts/verify-comic.mjs.");
});
async function fixture(page: Page, color: string) {
  return page.evaluate((color) => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 384;
    const x = c.getContext("2d")!;
    x.fillStyle = color;
    x.fillRect(0, 0, 256, 384);
    return c.toDataURL("image/png").split(",")[1];
  }, color);
}
test("TT mode switches from the same text chapter and retains comic settings/page independently", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (r) => {
    if (
      !new URL(r.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/) &&
      !r.url().startsWith("blob:")
    )
      external.push(r.url());
  });
  await page.goto("/vi/read/chapter-1");
  await page.getByRole("link", { name: "Truyện tranh", exact: true }).click();
  await expect(page).toHaveURL(/\/vi\/comic\/chapter-1$/);
  await expect(page.locator(".comic-reader")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Cài đặt truyện tranh", exact: true })
    .click();
  await page.getByRole("button", { name: "Trái → phải", exact: true }).click();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".comic-reader")).toHaveAttribute("data-page", "2");
  await page.waitForTimeout(350);
  await page.reload();
  await expect(page.locator(".comic-reader")).toHaveAttribute("data-page", "2");
  await page.getByRole("link", { name: "Tiếng Việt", exact: true }).click();
  await expect(page).toHaveURL(/\/vi\/read\/chapter-1$/);
  expect(external).toEqual([]);
});
test("local editor imports, reorders and saves images for the real reader preview", async ({
  page,
}) => {
  await page.goto("/local/comic-editor?chapter=chapter-1");
  await expect(page.locator(".comic-editor")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const a = await fixture(page, "#8d342b"),
    b = await fixture(page, "#306080");
  await page.getByLabel("Thêm ảnh hoặc ZIP", { exact: true }).setInputFiles([
    {
      name: "page10.png",
      mimeType: "image/png",
      buffer: Buffer.from(a, "base64"),
    },
    {
      name: "page2.png",
      mimeType: "image/png",
      buffer: Buffer.from(b, "base64"),
    },
  ]);
  await expect(page.locator(".comic-editor")).toHaveAttribute(
    "data-pages",
    "4",
  );
  await expect(page.locator(".ce-page-card").nth(2)).toContainText("page2.png");
  await page
    .getByRole("button", { name: "Đưa trang 4 lên", exact: true })
    .click();
  await expect(page.locator(".ce-page-card").nth(2)).toContainText(
    "page10.png",
  );
  await page
    .getByRole("button", { name: "Lưu nháp trên máy", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Đã lưu");
  await page.getByRole("link", { name: "Xem bản đọc", exact: true }).click();
  await expect(page.locator(".comic-reader")).toHaveAttribute(
    "data-pages",
    "4",
  );
  await page.reload();
  await expect(page.locator(".comic-reader")).toHaveAttribute(
    "data-pages",
    "4",
  );
});
test("bad uploads and a second editor tab cannot overwrite a saved draft", async ({
  page,
  context,
}) => {
  await page.goto("/local/comic-editor?chapter=chapter-1");
  await expect(page.locator(".comic-editor")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const second = await context.newPage();
  await second.goto("/local/comic-editor?chapter=chapter-1");
  await expect(second.locator(".comic-editor")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByLabel("Tiêu đề chương", { exact: true })
    .fill("Bản lưu đầu tiên");
  await page
    .getByRole("button", { name: "Lưu nháp trên máy", exact: true })
    .click();
  await second
    .getByLabel("Tiêu đề chương", { exact: true })
    .fill("Bản từ cửa sổ cũ");
  await second
    .getByRole("button", { name: "Lưu nháp trên máy", exact: true })
    .click();
  await expect(
    second.locator(".comic-editor").getByRole("alert"),
  ).toContainText("cửa sổ khác");
  await page.getByLabel("Thêm ảnh hoặc ZIP", { exact: true }).setInputFiles({
    name: "evil.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(page.locator(".comic-editor").getByRole("alert")).toContainText(
    "PNG",
  );
  await expect(page.locator(".comic-editor")).toHaveAttribute(
    "data-pages",
    "2",
  );
  await second.close();
});
test("missing comic chapters stay honest and the chapter dialog preserves active selection", async ({
  page,
}) => {
  await page.goto("/vi/comic/chapter-2");
  await expect(
    page.getByText("Chương này chưa có trang truyện tranh.", { exact: true }),
  ).toBeVisible();
  await page.goto("/vi/comic/chapter-1");
  await expect(page.locator(".comic-reader")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Mục lục truyện tranh", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Mục lục", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('a[aria-current="page"]')).toContainText(
    "Chương 1",
  );
  await dialog.getByLabel("Tìm chương", { exact: true }).fill("cay gao");
  await expect(dialog.locator(".cc-chapter-list a")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
