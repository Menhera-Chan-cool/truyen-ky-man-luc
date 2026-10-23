import type { Progress } from "./types";
export function createProgressSaver(write: (value: Progress) => Promise<void>) {
  let pending: Progress | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function flush() {
    clearTimeout(timer);
    timer = undefined;
    const value = pending;
    pending = undefined;
    if (value) await write(value);
  }
  return {
    schedule(value: Progress) {
      pending = value;
      timer ??= setTimeout(() => {
        void flush().catch(() => {});
      }, 1000);
    },
    flush,
  };
}
