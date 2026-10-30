import { test, expect } from "@playwright/test";
test("opens reader help, validates page jump and restores a recent passage", async ({
  page,
}) => {
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.getByRole("button", { name: "Tiện ích đọc", exact: true }).click();
  await page
    .getByRole("button", { name: "Hướng dẫn thao tác", exact: true })
    .click();
  await expect(
    page.getByText("Kéo mép giấy trên PC", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page
    .getByRole("button", { name: "Cài đặt trình đọc", exact: true })
    .click();
  await page.getByRole("button", { name: "Sách", exact: true }).click();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.getByRole("button", { name: "Tiện ích đọc", exact: true }).click();
  await page.getByLabel("Đến trang").fill("5");
  await page.getByRole("button", { name: "Đi đến trang", exact: true }).click();
  await expect(page.locator(".book-folio span").first()).not.toHaveText("1");
  await page.getByRole("button", { name: "Tiện ích đọc", exact: true }).click();
  await page
    .getByRole("button", { name: "Vị trí gần đây", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Chương 1.*0%/ })
    .first()
    .click();
  await expect(page.locator(".book-folio span").first()).toHaveText("1");
});
test("compares the same chapter in VI and EN without moving the main reader", async ({
  page,
}) => {
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.getByRole("button", { name: "Tiện ích đọc", exact: true }).click();
  await page
    .getByRole("button", { name: "Đọc đối chiếu VI–EN", exact: true })
    .click();
  await expect(page.locator('.parallel-edition[lang="vi"]')).toContainText(
    "Hồ Tông Thốc",
  );
  await expect(page.locator('.parallel-edition[lang="en"]')).toContainText(
    "Ho Tong Thoc",
  );
  expect(
    await page.locator(".comparison-picker select").evaluate(
      (el) => el.getBoundingClientRect().height,
    ),
  ).toBeGreaterThanOrEqual(44);
  await page
    .getByRole("button", { name: "Chương đối chiếu kế", exact: true })
    .click();
  await expect(page.locator(".parallel-reader")).toContainText("Từ Đạt");
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(page).toHaveURL(/chapter-1$/);
});
test("Ebook double-page jump uses the page number shown by its footer", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Ebook double-page mode is desktop only");
  await page.goto("/en/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Reader settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Double page", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Reading tools", exact: true })
    .click();
  await page.getByLabel("Go to page", { exact: true }).fill("5");
  await page.getByRole("button", { name: "Go to page", exact: true }).click();
  await expect(page.locator(".page-controls>span")).toHaveText(/^5\s*\//);
});
