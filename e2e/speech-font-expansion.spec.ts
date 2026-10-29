import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("personal font imports locally, survives reload and reaches Book rendering", async ({
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
  await page.getByText("Phông chữ cá nhân", { exact: true }).click();
  const file = await readFile(
    "node_modules/@fontsource-variable/literata/files/literata-latin-wght-normal.woff2",
  );
  await page
    .getByLabel("Nạp phông", { exact: true })
    .setInputFiles({
      name: "Personal-" + "font-".repeat(20) + ".woff2",
      mimeType: "font/woff2",
      buffer: file,
    });
  await expect(page.locator(".prose")).toHaveCSS(
    "font-family",
    /ReaderPersonal/,
  );
  await page.getByRole("button", { name: "Sách", exact: true }).click();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(page.locator(".reader-document")).toHaveAttribute(
    "data-flip-ready",
    "true",
  );
  await page.reload();
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await expect(page.locator(".prose")).toHaveCSS(
    "font-family",
    /ReaderPersonal/,
  );
});
test("pronunciations stay out of source text and auto-next only follows natural full-chapter completion", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    (window as any).spoken = [];
    (window as any).finish = false;
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        constructor(public text: string) {}
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        getVoices: () => [],
        cancel() {},
        speak(u: any) {
          (window as any).spoken.push(u);
          u.onstart?.({});
          if (
            (window as any).finish &&
            location.pathname.endsWith("/chapter-1")
          )
            setTimeout(() => u.onend?.({}), 0);
        },
        paused: false,
        resume() {},
      }),
    });
  });
  await page.goto("/en/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const source = await page.locator(".prose").textContent();
  await page
    .getByRole("button", { name: "Voice & speed", exact: true })
    .click();
  const next = page.getByLabel("Continue to the next chapter", { exact: true });
  await expect(next).not.toBeChecked();
  await next.check();
  await page
    .getByText("Name pronunciation dictionary", { exact: true })
    .click();
  await page
    .getByLabel("Pronunciation rules", { exact: true })
    .fill("Ho Tong Thoc = Hoh Tong Tok");
  await page
    .getByRole("button", { name: "Save pronunciations", exact: true })
    .click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Read aloud", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).spoken[0]?.text))
    .toContain("Hoh Tong Tok");
  expect(await page.locator(".prose").textContent()).toBe(source);
  await page.evaluate(() => {
    (window as any).finish = true;
    (window as any).spoken.at(-1).onend?.({});
  });
  await expect(page).toHaveURL(/chapter-2$/, { timeout: 30000 });
  await expect(
    page.getByRole("button", { name: "Pause reading", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).spoken.at(-1)?.text))
    .toContain("Tu Dat");
  await page.reload();
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  expect(await page.evaluate(() => (window as any).spoken.length)).toBe(0);
});
