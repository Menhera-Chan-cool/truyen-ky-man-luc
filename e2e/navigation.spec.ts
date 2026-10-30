import { test, expect } from "@playwright/test";

test("changes chapters without waiting for the network and preserves browser history", async ({
  page,
}) => {
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const requests: string[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.startsWith("/vi/read/") &&
      (request.url().includes("_rsc=") || request.resourceType() === "document")
    )
      requests.push(request.url());
  });
  await page.route("**/*", (route) => route.abort());
  await page.getByRole("button", { name: "Chương sau", exact: true }).click();
  await expect(page.locator(".chapter-title")).toContainText(/Chương\s*2:/, {
    timeout: 1500,
  });
  await expect(page.locator(".prose")).toContainText("Từ Đạt");
  await expect(page).toHaveURL(/\/vi\/read\/chapter-2$/);
  await page.getByRole("button", { name: "Chương sau", exact: true }).click();
  await expect(page.locator(".chapter-title")).toContainText(/Chương\s*3:/);
  await page.getByRole("button", { name: "Chương trước", exact: true }).click();
  await expect(page.locator(".chapter-title")).toContainText(/Chương\s*2:/);
  await page.goBack();
  await expect(page.locator(".chapter-title")).toContainText(/Chương\s*3:/);
  await page.goForward();
  await expect(page.locator(".chapter-title")).toContainText(/Chương\s*2:/);
  expect(requests).toEqual([]);
  await page.unroute("**/*");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("menuitem", { name: "Novel", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/read\/chapter-2$/);
  await expect(page.locator(".prose")).toContainText("Tu Dat");
});

test("uses the same fast navigation for chapter-end links and the table of contents", async ({
  page,
}, info) => {
  await page.goto("/en/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.route("**/*", (route) => route.abort());
  await page.locator('.chapter-end a[href="/en/read/chapter-2"]').click();
  await expect(page.locator(".chapter-title")).toContainText("Chapter 2:", {
    timeout: 1500,
  });
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Open contents", exact: true })
      .click();
  await page.locator('.sidebar-list a[href="/en/read/chapter-16"]').click();
  await expect(page.locator(".chapter-title")).toContainText("Chapter 16:");
  await expect(page.locator(".prose")).not.toBeEmpty();
  await page.unroute("**/*");
  await page.reload();
  await expect(page.locator(".chapter-title")).toContainText("Chapter 16:");
});

test("restores each chapter's scroll position during next, previous and browser Back", async ({
  page,
}) => {
  await page.goto("/vi/read/chapter-1");
  const ready = () =>
    expect(page.locator(".reader-shell")).toHaveAttribute("data-ready", "true");
  const ratio = () =>
    page
      .locator(".reading-scroll")
      .evaluate(
        (el) => el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight),
      );
  async function scrollTo(value: number) {
    await page.locator(".reading-scroll").evaluate((el, value) => {
      el.scrollTop = value * (el.scrollHeight - el.clientHeight);
    }, value);
    await expect.poll(ratio).toBeCloseTo(value, 1);
    await page.waitForTimeout(100);
  }
  await ready();
  await scrollTo(0.45);
  await page.getByRole("button", { name: "Chương sau", exact: true }).click();
  await expect(page.locator(".chapter-title")).toContainText(/Chương\s*2:/);
  await ready();
  await expect.poll(ratio).toBeCloseTo(0, 1);
  await scrollTo(0.65);
  await page.getByRole("button", { name: "Chương trước", exact: true }).click();
  await expect(page.locator(".chapter-title")).toContainText(/Chương\s*1:/);
  await ready();
  await expect.poll(ratio).toBeCloseTo(0.45, 1);
  await page.goBack();
  await expect(page.locator(".chapter-title")).toContainText(/Chương\s*2:/);
  await ready();
  await expect.poll(ratio).toBeCloseTo(0.65, 1);
});
