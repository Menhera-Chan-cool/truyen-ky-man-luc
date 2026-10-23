import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as unknown as {
      speechQueue: SpeechSynthesisUtterance[];
    };
    state.speechQueue = [];
    const voices = ["A", "B"].map((name) => ({
      name: "Continuity " + name,
      lang: "vi-VN",
      voiceURI: name,
    }));
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        text: string;
        rate = 1;
        voice = null;
        constructor(text: string) {
          this.text = text;
        }
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        getVoices: () => voices,
        cancel() {},
        speak(u: SpeechSynthesisUtterance) {
          state.speechQueue.push(u);
          u.onstart?.({} as SpeechSynthesisEvent);
        },
      }),
    });
  });
});
for (const locale of ["vi", "en"])
  test(`shortens punctuation pauses without moving the resume offset (${locale})`, async ({
    page,
  }) => {
    const vi = locale === "vi";
    await page.goto(`/${locale}/read/chapter-1`);
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    const original = "First sentence. Next: wait... then go.";
    await page.locator(".prose").evaluate((root, text) => {
      root.replaceChildren(
        Object.assign(document.createElement("p"), { textContent: text }),
      );
    }, original);
    await page
      .getByRole("button", {
        name: vi ? "Giọng đọc & tốc độ" : "Voice & speed",
        exact: true,
      })
      .click();
    const shorter = page.getByRole("checkbox", {
      name: vi ? "Ngắt nghỉ ngắn" : "Shorter punctuation pauses",
      exact: true,
    });
    await expect(shorter).toBeChecked();
    await page
      .getByRole("button", {
        name: vi ? "Đọc chương này" : "Read this chapter",
        exact: true,
      })
      .click();
    const spoken = () =>
      page.evaluate(
        () =>
          (
            window as unknown as { speechQueue: SpeechSynthesisUtterance[] }
          ).speechQueue.at(-1)?.text,
      );
    await expect.poll(spoken).toBe("First sentence, Next, wait,   then go,");
    await expect(page.locator(".prose")).toHaveText(original);
    await page.evaluate(
      (offset) =>
        (
          window as unknown as { speechQueue: SpeechSynthesisUtterance[] }
        ).speechQueue
          .at(-1)!
          .onboundary?.({ charIndex: offset } as SpeechSynthesisEvent),
      original.indexOf("then"),
    );
    await shorter.uncheck();
    await expect.poll(spoken).toBe("then go.");
    await expect(page.locator(".prose")).toHaveText(original);
    await page.reload();
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await page
      .getByRole("button", {
        name: vi ? "Giọng đọc & tốc độ" : "Voice & speed",
        exact: true,
      })
      .click();
    await expect(shorter).not.toBeChecked();
  });
test("continues the current spoken segment when changing rate and voice", async ({
  page,
}) => {
  await page.goto("/vi/read/chapter-1");
  await expect(page.locator(".reader-shell")).toHaveAttribute(
    "data-ready",
    "true",
  );
  await page
    .getByRole("button", { name: "Đọc giọng nói", exact: true })
    .click();
  const current = await page.evaluate(async () => {
    const s = window as unknown as { speechQueue: SpeechSynthesisUtterance[] };
    for (let i = 0; i < 5; i++) {
      s.speechQueue.at(-1)!.onend?.({} as SpeechSynthesisEvent);
      await new Promise((r) => setTimeout(r, 10));
    }
    const u = s.speechQueue.at(-1)!;
    u.onboundary?.({ charIndex: 3 } as SpeechSynthesisEvent);
    return u.text.slice(3);
  });
  await page
    .getByRole("button", { name: "Giọng đọc & tốc độ", exact: true })
    .click();
  await page
    .getByRole("slider", { name: "Tốc độ đọc", exact: true })
    .fill("1.8");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const u = (
          window as unknown as { speechQueue: SpeechSynthesisUtterance[] }
        ).speechQueue.at(-1)!;
        return { text: u.text, rate: u.rate };
      }),
    )
    .toEqual({ text: current, rate: 1.8 });
  await page
    .getByRole("combobox", { name: "Chọn giọng đọc", exact: true })
    .selectOption("Continuity B");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const u = (
          window as unknown as { speechQueue: SpeechSynthesisUtterance[] }
        ).speechQueue.at(-1)!;
        return { text: u.text, voice: u.voice?.name };
      }),
    )
    .toEqual({ text: current, voice: "Continuity B" });
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Dừng đọc", exact: true }),
  ).toBeVisible();
});
test("moves the paged reader through its page state while speech advances", async ({
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
  await page.getByRole("button", { name: "Trang đơn", exact: true }).click();
  await page.getByRole("button", { name: "Đóng", exact: true }).click();
  await page
    .getByRole("button", { name: "Đọc giọng nói", exact: true })
    .click();
  await page.evaluate(async () => {
    const s = window as unknown as { speechQueue: SpeechSynthesisUtterance[] };
    for (let i = 0; i < 25; i++) {
      s.speechQueue.at(-1)!.onend?.({} as SpeechSynthesisEvent);
      await new Promise((r) => setTimeout(r, 10));
    }
  });
  await expect
    .poll(async () =>
      Number(
        (await page.locator(".page-controls span").textContent())!.split(
          "/",
        )[0],
      ),
    )
    .toBeGreaterThan(1);
  expect(
    await page.locator(".reading-window").evaluate((n) => n.scrollLeft),
  ).toBe(0);
});
