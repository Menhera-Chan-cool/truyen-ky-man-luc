import { afterEach, expect, it, vi } from "vitest";
import { createProgressSaver } from "../src/lib/progress-saver";
afterEach(() => vi.useRealTimers());
it("bounds writes during continuous scroll and flushes the exact latest position", async () => {
  vi.useFakeTimers();
  const saved: {
    chapterId: string;
    ratio: number;
    page: number;
    revision: number;
  }[] = [];
  const saver = createProgressSaver(async (p) => {
    saved.push(p);
  });
  for (let i = 0; i < 120; i++) {
    saver.schedule({
      chapterId: "chapter-1",
      ratio: i / 200,
      page: 0,
      revision: 7,
    });
    await vi.advanceTimersByTimeAsync(16);
  }
  expect(saved.length).toBeLessThanOrEqual(2);
  await saver.flush();
  expect(saved.at(-1)?.ratio).toBe(119 / 200);
  await vi.advanceTimersByTimeAsync(2000);
  expect(saved).toHaveLength(2);
});
it("keeps a pending save bound to its chapter and does not duplicate a flush", async () => {
  vi.useFakeTimers();
  const saved: string[] = [];
  const a = createProgressSaver(async (p) => {
    saved.push(p.chapterId);
  });
  a.schedule({ chapterId: "chapter-1", ratio: 0.3, page: 0, revision: 1 });
  await a.flush();
  await a.flush();
  const b = createProgressSaver(async (p) => {
    saved.push(p.chapterId);
  });
  b.schedule({ chapterId: "chapter-2", ratio: 0.7, page: 0, revision: 2 });
  await vi.advanceTimersByTimeAsync(1100);
  expect(saved).toEqual(["chapter-1", "chapter-2"]);
});
