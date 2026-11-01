import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as unknown as {
      speechQueue: SpeechSynthesisUtterance[];
    };
    state.speechQueue = [];
    const voices = ["vi-VN","en-US"].flatMap(lang=>["A", "B"].map((name) => ({
      name: "Continuity " + name,
      lang,
      voiceURI: lang+name,
    })));
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
test("ignores late callbacks from a completed chunk while the next chunk is playing", async ({
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
  await page.evaluate(() => {
    const s = window as unknown as {
      speechQueue: SpeechSynthesisUtterance[];
      completed?: SpeechSynthesisUtterance;
    };
    s.completed = s.speechQueue.at(-1)!;
    s.completed.onend?.({} as SpeechSynthesisEvent);
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { speechQueue: unknown[] }).speechQueue.length,
      ),
    )
    .toBe(2);
  await page.evaluate(() => {
    const u = (window as unknown as { completed: SpeechSynthesisUtterance })
      .completed;
    u.onerror?.({ error: "canceled" } as SpeechSynthesisErrorEvent);
    u.onend?.({} as SpeechSynthesisEvent);
  });
  await expect(
    page.getByRole("button", { name: "Tạm dừng đọc", exact: true }),
  ).toBeVisible({ timeout: 1500 });
  await page.waitForTimeout(100);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { speechQueue: unknown[] }).speechQueue.length,
    ),
  ).toBe(2);
});
for (const locale of ["vi", "en"])
  test(`pauses an interrupted session and resumes with current settings (${locale})`, async ({
    page,
  }) => {
    const vi = locale === "vi",
      pause = vi ? "Tạm dừng đọc" : "Pause reading",
      resume = vi ? "Tiếp tục đọc" : "Resume reading";
    await page.goto(`/${locale}/read/chapter-1`);
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await page
      .getByRole("button", {
        name: vi ? "Đọc giọng nói" : "Read aloud",
        exact: true,
      })
      .click();
    const expected = await page.evaluate(
      (error) => {
        const state = window as unknown as {
            speechQueue: SpeechSynthesisUtterance[];
            oldSpeech?: SpeechSynthesisUtterance;
          },
          u = state.speechQueue.at(-1)!;
        u.onboundary?.({ charIndex: 3 } as SpeechSynthesisEvent);
        state.oldSpeech = u;
        u.onerror?.({ error } as SpeechSynthesisErrorEvent);
        return u.text.slice(3);
      },
      vi ? "interrupted" : "canceled",
    );
    await expect(
      page.getByRole("button", { name: resume, exact: true }),
    ).toBeVisible({ timeout: 2000 });
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { speechQueue: unknown[] }).speechQueue.length,
      ),
    ).toBe(1);
    await page
      .getByRole("button", {
        name: vi ? "Giọng đọc & tốc độ" : "Voice & speed",
        exact: true,
      })
      .click();
    await page
      .getByRole("slider", {
        name: vi ? "Tốc độ đọc" : "Reading speed",
        exact: true,
      })
      .fill("1.6");
    if (vi)
      await page
        .getByRole("combobox", { name: "Chọn giọng đọc", exact: true })
        .selectOption("Continuity B");
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { speechQueue: unknown[] }).speechQueue.length,
      ),
    ).toBe(1);
    const panel = page.locator(".reader-panel");
    await panel.getByRole("button", { name: resume, exact: true }).click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const u = (
            window as unknown as { speechQueue: SpeechSynthesisUtterance[] }
          ).speechQueue.at(-1)!;
          return { text: u.text, rate: u.rate };
        }),
      )
      .toEqual({ text: expected, rate: 1.6 });
    if (vi)
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (
                window as unknown as { speechQueue: SpeechSynthesisUtterance[] }
              ).speechQueue.at(-1)?.voice?.name,
          ),
        )
        .toBe("Continuity B");
    await page.evaluate(() => {
      const old = (window as unknown as { oldSpeech: SpeechSynthesisUtterance })
        .oldSpeech;
      old.onend?.({} as SpeechSynthesisEvent);
      old.onerror?.({ error: "canceled" } as SpeechSynthesisErrorEvent);
    });
    await expect(
      panel.getByRole("button", { name: pause, exact: true }),
    ).toBeVisible();
    await panel.getByRole("button", { name: pause, exact: true }).click();
    await expect(
      panel.getByRole("button", { name: resume, exact: true }),
    ).toBeVisible();
    await panel
      .getByRole("button", {
        name: vi ? "Dừng đọc" : "Stop reading",
        exact: true,
      })
      .click();
    await expect(
      panel.getByRole("button", {
        name: vi ? "Đọc chương này" : "Read this chapter",
        exact: true,
      }),
    ).toBeVisible();
    await panel
      .getByRole("button", {
        name: vi ? "Đọc chương này" : "Read this chapter",
        exact: true,
      })
      .click();
    await panel.getByRole("button", { name: pause, exact: true }).click();
    await panel
      .getByRole("button", { name: vi ? "Đóng" : "Close", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: vi ? "Chương sau" : "Next chapter",
        exact: true,
      })
      .click();
    await expect(page.locator(".reader-shell")).toHaveAttribute(
      "data-ready",
      "true",
    );
    await expect(
      page.getByRole("button", {
        name: vi ? "Đọc giọng nói" : "Read aloud",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: resume, exact: true }),
    ).toHaveCount(0);
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
    page.getByRole("button", { name: "Tạm dừng đọc", exact: true }),
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
