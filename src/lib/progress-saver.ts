import type { Progress } from "./types";
export function createProgressSaver<T = Progress>(
  write: (value: T) => Promise<void>,
) {
  let pending: T | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function flush() {
    clearTimeout(timer);
    timer = undefined;
    const value = pending;
    pending = undefined;
    if (value) await write(value);
  }
  return {
    schedule(value: T) {
      pending = value;
      timer ??= setTimeout(() => {
        void flush().catch(() => {});
      }, 1000);
    },
    flush,
  };
}
