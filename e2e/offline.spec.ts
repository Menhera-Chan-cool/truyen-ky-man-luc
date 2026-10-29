import { test, expect } from "@playwright/test";
test("downloads only public resources, reads VI/EN after offline reload and removes only the book cache", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.getByRole("button", { name: "Tiện ích đọc", exact: true }).click();
  await page
    .getByRole("button", { name: "Tải VI/EN để đọc ngoại tuyến", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Đọc bản đã tải", exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await page.route("**/api/book", async (route) => {
    const response = await route.fetch();
    const book = await response.json();
    book.meta.vi.frontCover = "/api/assets/test-missing.png";
    await route.fulfill({ response, json: book });
  });
  await page
    .getByRole("button", { name: "Cập nhật bản tải", exact: true })
    .click();
  await expect(
    page.locator(".offline-download").getByRole("alert"),
  ).toContainText("Chưa tải hoàn tất");
  await expect(
    page.getByRole("link", { name: "Đọc bản đã tải", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/book");
  const keys = await page.evaluate(async () => {
    const names = await caches.keys(),
      urls: string[] = [];
    for (const name of names)
      for (const r of await (await caches.open(name)).keys())
        urls.push(new URL(r.url).pathname);
    return urls;
  });
  expect(
    keys.some(
      (k) =>
        k.startsWith("/api/admin") ||
        k.startsWith("/admin") ||
        k.startsWith("/auth"),
    ),
  ).toBe(false);
  const rejected = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const c = new MessageChannel();
        c.port1.onmessage = (e) => {
          resolve(!!e.data.error);
          c.port1.close();
        };
        navigator.serviceWorker.controller!.postMessage(
          {
            type: "prepare-offline",
            cacheName: "tkml-offline-data-11111111-1111-4111-8111-111111111111",
            urls: ["/api/admin/state"],
          },
          [c.port2],
        );
      }),
  );
  expect(rejected).toBe(true);
  await context.setOffline(true);
  await page.goto("/offline?locale=vi&chapter=chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator(".prose")).toContainText("Hồ Tông Thốc");
  await page.getByRole("button", { name: "Chương sau", exact: true }).click();
  await expect(page).toHaveURL(/chapter=chapter-2/);
  await expect(page.locator(".prose")).toContainText("Từ Đạt");
  await page.getByRole("button", { name: "Tiện ích đọc", exact: true }).click();
  await page
    .getByRole("button", { name: "Đọc đối chiếu VI–EN", exact: true })
    .click();
  await expect(page.locator('.parallel-edition[lang="en"]')).toContainText(
    "Tu Dat",
  );
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.goto("/offline?locale=en&chapter=chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator(".prose")).toContainText("Ho Tong Thoc");
  await page.reload();
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await context.setOffline(false);
  await page
    .getByRole("button", { name: "Reading tools", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove download", exact: true })
    .click();
  await expect(
    page.getByText("No downloaded book is available on this device.", {
      exact: true,
    }),
  ).toBeVisible();
});
