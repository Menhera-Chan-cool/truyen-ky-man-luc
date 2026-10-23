import { expect, it } from "vitest";
import {
  settingsFromCookie,
  readerPalette,
  contrastText,
} from "../src/lib/reader";
it("restores validated appearance and rejects malformed cookies and CSS injection", () => {
  expect(settingsFromCookie("%zz").theme).toBe("sepia");
  const settings = settingsFromCookie(
    encodeURIComponent(
      JSON.stringify({
        theme: "custom",
        background: "url(javascript:alert(1))",
        foreground: "#cdd6f4",
        fontSize: 999,
        voice: { bad: true },
      }),
    ),
  );
  expect(settings.background).toBe("#f5f0e5");
  expect(settings.fontSize).toBe(36);
  expect(settings.voice).toBe("");
  expect(settingsFromCookie("null").theme).toBe("sepia");
  expect(
    settingsFromCookie(encodeURIComponent('{"theme":"constructor"}')).theme,
  ).toBe("sepia");
});
it("maps coffee, dim and custom dark backgrounds to dark book appearance", () => {
  for (const choice of [
    { theme: "coffee" },
    { theme: "dim" },
    { theme: "custom", background: "#1e1e2e" },
  ]) {
    const settings = settingsFromCookie(
      encodeURIComponent(JSON.stringify(choice)),
    );
    expect(contrastText(readerPalette(settings).background)).toBe("#ffffff");
  }
});
