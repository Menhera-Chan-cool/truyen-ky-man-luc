/* Published-only offline support. Admin/auth/draft traffic is never stored. */
const STATIC_CACHE = "tkml-public-static-v1",
  PREFIX = "tkml-offline-data-",
  pending = new Map();
let active;
const asset = (p) =>
  p === "/book/cover.jpg" ||
  /^\/api\/assets\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|gif|webp|pdf)$/.test(p);
const safe = (u) => {
  const p = new URL(u, self.location.origin);
  return (
    p.origin === self.location.origin &&
    (p.pathname === "/offline" ||
      p.pathname.startsWith("/_next/static/") ||
      p.pathname === "/vendor/page-flip-2.0.7.js" ||
      p.pathname === "/pdf.worker.min.mjs" ||
      asset(p.pathname))
  );
};
const cacheName = (s) =>
  typeof s === "string" && /^tkml-offline-data-[0-9a-f-]{36}$/.test(s);
async function snapshot() {
  return new Promise((resolve) => {
    const r = indexedDB.open("truyen-ky-man-luc", 1);
    r.onupgradeneeded = () => r.transaction.abort();
    r.onerror = () => resolve(null);
    r.onsuccess = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("preferences")) {
        db.close();
        resolve(null);
        return;
      }
      const q = db
        .transaction("preferences")
        .objectStore("preferences")
        .get("offline-book:v1");
      q.onsuccess = () => {
        db.close();
        const v = q.result;
        resolve(
          v &&
            cacheName(v.cacheName) &&
            Array.isArray(v.assets) &&
            v.assets.every(asset)
            ? { cacheName: v.cacheName, assets: v.assets }
            : null,
        );
      };
      q.onerror = () => {
        db.close();
        resolve(null);
      };
    };
  });
}
const current = () => active ?? (active = snapshot());
self.addEventListener("install", (event) =>
  event.waitUntil(self.skipWaiting()),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("message", (event) => {
  const m = event.data ?? {},
    port = event.ports[0];
  if (m.type === "offline-updated") {
    active = undefined;
    event.waitUntil(current().then(() => port?.postMessage({ ok: true })));
    return;
  }
  if (m.type === "cancel-offline" && cacheName(m.cacheName)) {
    pending.get(m.cacheName)?.abort();
    return;
  }
  if (m.type !== "prepare-offline" || !port) return;
  event.waitUntil(
    (async () => {
      if (
        !cacheName(m.cacheName) ||
        !Array.isArray(m.urls) ||
        m.urls.length > 1000 ||
        m.urls.some((u) => typeof u !== "string" || !safe(u))
      )
        throw Error("Invalid offline resource selection");
      const controller = new AbortController();
      pending.set(m.cacheName, controller);
      const cache = await caches.open(m.cacheName),
        urls = [...new Set(m.urls)];
      let bytes = 0,
        done = 0;
      try {
        for (let i = 0; i < urls.length; i += 4)
          await Promise.all(
            urls.slice(i, i + 4).map(async (url) => {
              const response = await fetch(url, {
                credentials: "omit",
                cache: "reload",
                signal: controller.signal,
              });
              if (!response.ok)
                throw Error(
                  "Cannot download " +
                    new URL(url, self.location.origin).pathname,
                );
              const data = await response.arrayBuffer();
              bytes += data.byteLength;
              if (bytes > 200 * 1024 * 1024)
                throw Error("Offline download exceeds 200 MB");
              await cache.put(
                url,
                new Response(data, {
                  headers: {
                    "Content-Type":
                      response.headers.get("Content-Type") ??
                      "application/octet-stream",
                  },
                }),
              );
              done++;
              port.postMessage({
                progress: { done, total: urls.length, bytes },
              });
            }),
          );
        port.postMessage({ ok: true, bytes });
      } catch (e) {
        controller.abort();
        await caches.delete(m.cacheName);
        throw e;
      } finally {
        pending.delete(m.cacheName);
      }
    })().catch((e) =>
      port.postMessage({ error: e.message ?? "Offline download failed" }),
    ),
  );
});
self.addEventListener("fetch", (event) => {
  const req = event.request,
    url = new URL(req.url);
  if (
    req.method !== "GET" ||
    url.origin !== self.location.origin ||
    /^\/(admin|auth|api\/admin)(\/|$)/.test(url.pathname)
  )
    return;
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/vendor/page-flip-2.0.7.js" ||
    url.pathname === "/pdf.worker.min.mjs"
  ) {
    event.respondWith(
      (async () => {
        const runtime = await caches.open(STATIC_CACHE),
          cached = await runtime.match(req);
        if (cached) return cached;
        const saved = await current();
        if (saved) {
          const hit = await (await caches.open(saved.cacheName)).match(req);
          if (hit) return hit;
        }
        const response = await fetch(req);
        if (response.ok)
          await runtime.put(req, response.clone()).catch(() => {});
        return response;
      })(),
    );
    return;
  }
  if (req.mode === "navigate" && url.pathname === "/offline") {
    active = undefined;
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const saved = await current();
          const response =
            saved &&
            (await (await caches.open(saved.cacheName)).match("/offline"));
          return (
            response ||
            new Response("No downloaded book is available.", {
              status: 503,
              headers: { "Content-Type": "text/plain;charset=utf-8" },
            })
          );
        }
      })(),
    );
    return;
  }
  if (
    req.mode === "navigate" &&
    /^\/(vi|en)(\/read\/[a-z0-9-]+)?\/?$/.test(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const saved = await current();
          if (!saved)
            return new Response(
              "Download the published book before reading offline.",
              { status: 503 },
            );
          const parts = url.pathname.split("/");
          return Response.redirect(
            self.location.origin +
              "/offline?locale=" +
              parts[1] +
              (parts[3] ? "&chapter=" + encodeURIComponent(parts[3]) : ""),
            302,
          );
        }
      })(),
    );
    return;
  }
  if (asset(url.pathname))
    event.respondWith(
      (async () => {
        const client =
          event.clientId && (await self.clients.get(event.clientId));
        if (client && new URL(client.url).pathname.startsWith("/admin"))
          return fetch(req);
        const saved = await current();
        if (!saved?.assets.includes(url.pathname)) return fetch(req);
        try {
          return await fetch(req, { credentials: "omit" });
        } catch {
          const response = await (
            await caches.open(saved.cacheName)
          ).match(url.pathname);
          if (response) return response;
          throw Error("Offline asset is unavailable");
        }
      })(),
    );
});
