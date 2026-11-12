"use client";
import { readPreference, saveOfflineSnapshot, deleteOfflineSnapshot } from "./db";
import {downloadOfflineAlignments} from './offline-alignment';
import {loadNovelLookup} from './reader-modules';
import {
  validateOfflineBook,
  bookAssetPaths,
  OFFLINE_KEY,
  OFFLINE_CACHE_PREFIX,
  type OfflineBook,
} from "./offline-book";
export async function readOfflineBook() {
  const saved = await readPreference<OfflineBook>(OFFLINE_KEY);
  if (!saved) return undefined;
  if (
    !/^tkml-offline-data-[0-9a-f-]{36}$/.test(saved.cacheName) ||
    !Number.isFinite(Date.parse(saved.downloadedAt))
  )
    throw Error("Invalid offline download");
  return { ...saved, book: validateOfflineBook(saved.book) };
}
async function workerReady() {
  if (!("serviceWorker" in navigator) || !("caches" in window))
    throw Error("Offline reading is not supported by this browser");
  await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  const registration = await navigator.serviceWorker.ready;
  await new Promise<void>((resolve) => {
    if (navigator.serviceWorker.controller) {
      resolve();
      return;
    }
    const changed = () => {
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
      resolve();
    };
    navigator.serviceWorker.addEventListener("controllerchange", changed);
  });
  return navigator.serviceWorker.controller ?? registration.active!;
}
function message(
  worker: ServiceWorker,
  data: unknown,
  onProgress?: (v: { done: number; total: number; bytes: number }) => void,
  signal?: AbortSignal,
) {
  return new Promise<{ bytes?: number }>((resolve, reject) => {
    const channel = new MessageChannel(),
      timer = setTimeout(
        () => finish(Error("Offline download timed out")),
        300000,
      );
    const abort = () => {
      worker.postMessage({
        type: "cancel-offline",
        cacheName: (data as { cacheName?: string }).cacheName,
      });
      finish(new DOMException("Cancelled", "AbortError"));
    };
    const finish = (error?: Error, result?: { bytes?: number }) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      channel.port1.close();
      error ? reject(error) : resolve(result ?? {});
    };
    channel.port1.onmessage = (e) => {
      if (e.data.progress) onProgress?.(e.data.progress);
      else if (e.data.error) finish(Error(e.data.error));
      else if (e.data.ok) finish(undefined, e.data);
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    worker.postMessage(data, [channel.port2]);
  });
}
export async function downloadOfflineBook(
  onProgress: (v: { done: number; total: number; bytes: number;phase?:'lookup' }) => void,
  signal: AbortSignal,
) {
  const worker = await workerReady();
  signal.throwIfAborted();
  const response = await fetch("/api/book", {
    cache: "no-store",
    credentials: "omit",
    signal,
  });
  if (!response.ok) throw Error("Unable to load the published book");
  const book = validateOfflineBook(await response.json());
  const old = await readOfflineBook();
  const cacheName = OFFLINE_CACHE_PREFIX + crypto.randomUUID(),
    assets = bookAssetPaths(book);
  try {
    await Promise.all([
      import("../components/OfflineReader"),
      import("pdfjs-dist"),
      loadNovelLookup(),
    ]);
    signal.throwIfAborted();
    const html = await (
        await fetch("/offline", {
          cache: "no-store",
          credentials: "omit",
          signal,
        })
      ).text(),
      doc = new DOMParser().parseFromString(html, "text/html"),
      urls = new Set<string>([
        "/offline",
        "/vendor/page-flip-2.0.7.js",
        "/pdf.worker.min.mjs",
        ...assets,
      ]);
    const add = (value: string, base = location.origin) => {
      try {
        const url = new URL(value, base);
        if (
          url.origin === location.origin &&
          url.pathname.startsWith("/_next/static/")
        )
          urls.add(url.href);
      } catch {
        /* Ignore unrelated markup URLs. */
      }
    };
    doc
      .querySelectorAll<HTMLScriptElement>("script[src]")
      .forEach((el) => add(el.getAttribute("src")!));
    doc
      .querySelectorAll<HTMLLinkElement>("link[href]")
      .forEach((el) => add(el.getAttribute("href")!));
    for (const resource of performance.getEntriesByType("resource"))
      add(resource.name);
    const cssUrls = [...urls].filter((url) => /\.css(?:\?|$)/.test(url));
    for (const url of cssUrls) {
      const css = await (await fetch(url, { signal })).text();
      for (const match of css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g))
        add(match[1], new URL(url, location.origin).href);
    }
    const result = await message(
      worker,
      { type: "prepare-offline", cacheName, urls: [...urls] },
      onProgress,
      signal,
    );
    signal.throwIfAborted();
    const alignment=await downloadOfflineAlignments(book,signal,(done,total,bytes)=>onProgress({done,total,bytes:(result.bytes??0)+bytes,phase:'lookup'}),200*1024*1024-(result.bytes??0));
    signal.throwIfAborted();
    const saved: OfflineBook = {
      book,
      cacheName,
      assets,
      downloadedAt: new Date().toISOString(),
      bytes: (result.bytes ?? 0)+alignment.bytes,
      alignmentKeys:alignment.keys,
    };
    await saveOfflineSnapshot(saved,alignment.artifacts);
    await message(worker, { type: "offline-updated" });
    for (const key of await caches.keys())
      if (key.startsWith(OFFLINE_CACHE_PREFIX) && key !== cacheName)
        await caches.delete(key);
    window.dispatchEvent(new Event("offline-book-changed"));
    return saved;
  } catch (e) {
    if (
      (await readPreference<OfflineBook>(OFFLINE_KEY))?.cacheName !== cacheName
    )
      await caches.delete(cacheName);
    throw e;
  }
}
export async function removeOfflineBook() {
  await deleteOfflineSnapshot();
  for (const name of await caches.keys())
    if (
      name.startsWith(OFFLINE_CACHE_PREFIX) ||
      name === "tkml-public-static-v1"
    )
      await caches.delete(name);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.controller?.postMessage({
      type: "offline-updated",
    });
    const registration = await navigator.serviceWorker.getRegistration("/");
    if (registration?.active?.scriptURL === location.origin + "/sw.js")
      await registration.unregister();
  }
  window.dispatchEvent(new Event("offline-book-changed"));
}
