import { test, expect } from "@playwright/test";
test("stop invalidates pending preset playback and repeated starts", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = window as unknown as { ambientActive: number };
    state.ambientActive = 0;
    const resume = AudioContext.prototype.resume,
      create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.resume = async function () {
      await new Promise((r) => setTimeout(r, 180));
      return resume.call(this);
    };
    AudioContext.prototype.createBufferSource = function () {
      const s = create.call(this),
        start = s.start.bind(s),
        stop = s.stop.bind(s);
      let active = false;
      s.connect = ((target: AudioNode) =>
        target) as AudioBufferSourceNode["connect"];
      s.start = (...args: Parameters<AudioBufferSourceNode["start"]>) => {
        active = true;
        state.ambientActive++;
        start(...args);
      };
      s.stop = (...args: Parameters<AudioBufferSourceNode["stop"]>) => {
        if (active) {
          active = false;
          state.ambientActive--;
        }
        stop(...args);
      };
      return s;
    };
  });
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Âm thanh môi trường", exact: true })
    .click();
  await page.getByRole("button", { name: "Brown Cozy", exact: true }).click();
  await page.getByRole("button", { name: "Dừng tất cả", exact: true }).click();
  await page.waitForTimeout(650);
  expect(
    await page.evaluate(
      () => (window as unknown as { ambientActive: number }).ambientActive,
    ),
  ).toBe(0);
  await expect(
    page.locator(".sound-list button[aria-pressed=true]"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Pink Focus", exact: true }).click();
  await page.getByRole("button", { name: "Brown Cozy", exact: true }).click();
  await page.waitForTimeout(650);
  expect(
    await page.evaluate(
      () => (window as unknown as { ambientActive: number }).ambientActive,
    ),
  ).toBe(2);
  await page.getByRole("button", { name: "Dừng tất cả", exact: true }).click();
});
