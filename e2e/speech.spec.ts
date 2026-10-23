import { test, expect } from "@playwright/test";

test("counts all twenty tales even when one locale is missing a translation", async ({
  page,
}) => {
  for (const [locale, label] of [
    ["vi", "20 câu chuyện"],
    ["en", "20 tales"],
  ]) {
    await page.goto("/" + locale);
    await expect(page.locator(".section-heading")).toContainText(label);
  }
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & {
      testVoices: SpeechSynthesisVoice[];
      testSpeech: { lang: string; rate: number; voice?: string } | null;
      testSpeechError: string;
    };
    state.testVoices = [];
    state.testSpeech = null;
    state.testSpeechError = "";
    const engine = Object.assign(new EventTarget(), {
      getVoices: () => state.testVoices,
      cancel: () => {},
      speak: (utterance: SpeechSynthesisUtterance) => {
        state.testSpeech = {
          lang: utterance.lang,
          rate: utterance.rate,
          voice: utterance.voice?.name,
        };
        if (state.testSpeechError)
          utterance.onerror?.({
            error: state.testSpeechError,
          } as SpeechSynthesisErrorEvent);
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: engine,
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        text: string;
        lang = "";
        rate = 1;
        voice = null;
        constructor(text: string) {
          this.text = text;
        }
      },
    });
  });
});

test("explains an empty voice list and refreshes late Android voices with the selected rate", async ({
  page,
}) => {
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Giọng đọc & tốc độ", exact: true })
    .click();
  const panel = page.locator(".reader-panel");
  await expect(
    panel.getByText(/chưa liệt kê giọng đọc tiếng Việt/),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as typeof window & { testSpeechError: string }).testSpeechError =
      "language-unavailable";
  });
  await panel
    .getByRole("button", { name: "Đọc chương này", exact: true })
    .click();
  await expect(
    page.getByText(/Thiết bị không có giọng đọc cho ngôn ngữ này/),
  ).toBeVisible();
  await panel.getByText("Cài giọng trên Android", { exact: true }).click();
  await expect(
    panel.getByRole("link", { name: "Hướng dẫn cài giọng trên Android" }),
  ).toHaveAttribute("href", /support\.google\.com/);
  await page.evaluate(() => {
    const state = window as typeof window & {
      testVoices: unknown[];
      testSpeechError: string;
    };
    state.testSpeechError = "";
    state.testVoices = [
      {
        name: "Android Vietnamese",
        lang: "vi_VN",
        voiceURI: "vi-test",
        default: true,
      },
      {
        name: "Android English",
        lang: "en-US",
        voiceURI: "en-test",
        default: false,
      },
    ];
  });
  await panel
    .getByRole("button", { name: "Làm mới giọng đọc", exact: true })
    .click();
  await expect(
    panel
      .getByRole("combobox", { name: "Chọn giọng đọc", exact: true })
      .locator("option"),
  ).toHaveCount(2);
  await expect(panel.getByText(/1 giọng đọc tiếng Việt/)).toBeVisible();
  await panel
    .getByRole("slider", { name: "Tốc độ đọc", exact: true })
    .fill("1.4");
  await panel
    .getByRole("button", { name: "Đọc chương này", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as typeof window & { testSpeech: unknown }).testSpeech,
      ),
    )
    .toEqual({ lang: "vi-VN", rate: 1.4, voice: "Android Vietnamese" });
});

test("updates a single English voice when the browser announces more voices", async ({
  page,
}) => {
  await page.goto("/en/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page.evaluate(() => {
    (window as typeof window & { testVoices: unknown[] }).testVoices = [
      {
        name: "Phone English",
        lang: "en-US",
        voiceURI: "en-one",
        default: true,
      },
    ];
    speechSynthesis.dispatchEvent(new Event("voiceschanged"));
  });
  await page
    .getByRole("button", { name: "Voice & speed", exact: true })
    .click();
  const panel = page.locator(".reader-panel");
  await expect(
    panel.getByText("1 voice available for English.", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as typeof window & { testVoices: unknown[] }).testVoices.push({
      name: "Another English",
      lang: "en-GB",
      voiceURI: "en-two",
      default: false,
    });
    speechSynthesis.dispatchEvent(new Event("voiceschanged"));
  });
  await expect(
    panel.getByText("2 voices available for English.", { exact: true }),
  ).toBeVisible();
  await panel
    .getByRole("textbox", { name: "Search voices", exact: true })
    .fill("no-match");
  await page.evaluate(() => {
    const state = window as typeof window & { testVoices: unknown[] };
    state.testVoices = state.testVoices.slice(0, 1);
    speechSynthesis.dispatchEvent(new Event("voiceschanged"));
  });
  await expect(
    panel
      .getByRole("combobox", { name: "Choose voice", exact: true })
      .locator("option"),
  ).toHaveCount(2);
});
