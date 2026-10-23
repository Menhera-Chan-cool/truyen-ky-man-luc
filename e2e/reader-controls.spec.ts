import { test, expect } from "@playwright/test";

test("shows a shared smooth tooltip without the browser title popup", async ({
  page,
}, info) => {
  test.skip(
    info.project.name === "mobile",
    "Hover tooltip is a desktop interaction",
  );
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const scroll = page.getByRole("button", { name: "Tự cuộn", exact: true });
  await expect(scroll).not.toHaveAttribute("title");
  await scroll.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Tự cuộn");
  await page
    .getByRole("button", { name: "Âm thanh môi trường", exact: true })
    .hover();
  await expect(page.getByRole("tooltip")).toHaveText("Âm thanh môi trường", {
    timeout: 250,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).not.toBeVisible();
});

test("shows compact dark custom colors with live hexadecimal values", async ({
  page,
}) => {
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Cài đặt trình đọc", exact: true })
    .click();
  await page.getByRole("button", { name: "Tùy biến", exact: true }).click();
  const colors = page.locator(".custom-colors");
  expect(
    await colors.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(24, 27, 44)");
  for (const [label, value] of [
    ["Màu nền", "#1e1e2e"],
    ["Màu chữ", "#cdd6f4"],
    ["Điểm nhấn", "#89b4fa"],
  ]) {
    const input = page.getByLabel(label, { exact: true });
    await input.fill(value);
    await expect(
      colors.getByText(value.toUpperCase(), { exact: true }),
    ).toBeVisible();
    expect((await input.boundingBox())!.width).toBeLessThanOrEqual(30);
  }
  await expect(page.locator(".reader-shell")).toHaveCSS("color-scheme", "dark");
  await page.reload();
  await page
    .getByRole("button", { name: "Cài đặt trình đọc", exact: true })
    .click();
  await expect(page.getByLabel("Màu nền", { exact: true })).toHaveValue(
    "#1e1e2e",
  );
});

test("loads additional fonts and retains the selected font after reload", async ({
  page,
}) => {
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Cài đặt trình đọc", exact: true })
    .click();
  const font = page.getByRole("combobox", { name: "Phông chữ", exact: true });
  for (const name of [
    "Lora",
    "Merriweather",
    "Inter",
    "Roboto",
    "OpenDyslexic",
    "JetBrains Mono",
  ])
    await expect(font.locator('option[value="' + name + '"]')).toHaveCount(1);
  await font.selectOption("Lora");
  await expect(page.locator(".prose")).toHaveCSS("font-family", /Lora/);
  expect(
    await page.evaluate(
      async () =>
        (await document.fonts.load('20px "Lora Variable"', "Truyền kỳ mạn lục"))
          .length,
    ),
  ).toBeGreaterThan(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Cài đặt trình đọc", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Phông chữ", exact: true }),
  ).toHaveValue("Lora");
});
