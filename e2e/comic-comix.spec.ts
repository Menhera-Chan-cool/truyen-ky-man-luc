import { test, expect } from "@playwright/test";
test("tools recover from idle and returning to a long-inactive tab", async ({
  page,
}) => {
  await page.goto("/vi/comic/chapter-1");
  await expect(page.locator(".comic-reader")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.mouse.move(100, 25);
  await page.mouse.move(300, 250);
  await expect(page.locator(".comic-reader")).toHaveAttribute(
    "data-chrome",
    "false",
    { timeout: 6000 },
  );
  await page.mouse.move(330, 270);
  await expect(page.locator(".comic-reader")).toHaveAttribute(
    "data-chrome",
    "true",
  );
  await expect
    .poll(() =>
      page.locator(".cc-tools").evaluate((el) => getComputedStyle(el).opacity),
    )
    .toBe("1");
  await expect(page.locator(".comic-reader")).toHaveAttribute(
    "data-chrome",
    "false",
    { timeout: 6000 },
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".comic-reader")).toHaveAttribute(
    "data-chrome",
    "true",
  );
  await expect
    .poll(() =>
      page.locator(".cc-tools").evaluate((el) => getComputedStyle(el).opacity),
    )
    .toBe("1");
});
test("Comix settings are centered, chapter label is one line and page-list furniture is absent", async ({
  page,
}) => {
  await page.goto("/vi/comic/chapter-1");
  await expect(page.locator(".comic-reader")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator(".cc-chapter-label")).toHaveText("Chương 1");
  await expect(
    page.getByRole("button", { name: "Danh sách trang", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".cc-page-counter")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Cài đặt truyện tranh", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Cài đặt", exact: true });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox(),
    viewport = page.viewportSize()!;
  expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(
    3,
  );
  await expect(
    page.getByLabel("Tốc độ tự cuộn", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
test("auto scroll stops on leaving the tab and stretch/filters persist", async ({
  page,
}) => {
  await page.goto("/vi/comic/chapter-1");
  await expect(page.locator(".comic-reader")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Bắt đầu tự cuộn", exact: true })
    .click();
  await expect(page.locator(".comic-reader")).toHaveAttribute(
    "data-auto",
    "true",
  );
  await expect
    .poll(() => page.locator(".cc-stage").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(15);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator(".comic-reader")).toHaveAttribute(
    "data-auto",
    "false",
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".comic-reader")).toHaveAttribute(
    "data-auto",
    "false",
  );
  await page
    .getByRole("button", { name: "Cài đặt truyện tranh", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ảnh thang xám", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Stretch: bật", exact: true }).click();
  await page.waitForTimeout(250);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Stretch: tắt", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".comic-reader")).toHaveAttribute(
    "data-grayscale",
    "true",
  );
});
