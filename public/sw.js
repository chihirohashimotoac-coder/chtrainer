/*
 * Darts Training Analyzer - Service Worker
 * 譁ｹ驥・
 *  - install 譎ゅ↓繧｢繝励Μ繧ｷ繧ｧ繝ｫ繧偵く繝｣繝・す繝･
 *  - 蜷御ｸ繧ｪ繝ｪ繧ｸ繝ｳ縺ｮ GET 縺ｯ繧ｭ繝｣繝・す繝･蜆ｪ蜈・+ 繝舌ャ繧ｯ繧ｰ繝ｩ繧ｦ繝ｳ繝画峩譁ｰ (stale-while-revalidate)
 *  - 繝翫ン繧ｲ繝ｼ繧ｷ繝ｧ繝ｳ縺ｯ繝阪ャ繝医Ρ繝ｼ繧ｯ螟ｱ謨玲凾縺ｫ index.html 縺ｸ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
 *  - 譁ｰ縺励＞ SW 縺・waiting 縺ｫ縺ｪ縺｣縺溘ｉ繧ｯ繝ｩ繧､繧｢繝ｳ繝医∈譖ｴ譁ｰ蜿ｯ閭ｽ繧帝夂衍
 */
const CACHE_VERSION = "dta-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

async function cacheAppShell(cache) {
  await cache.addAll(APP_SHELL);
  const indexResponse = await fetch("./index.html", { cache: "no-cache" });
  if (!indexResponse.ok) return;

  await cache.put("./index.html", indexResponse.clone());
  const html = await indexResponse.text();
  const assetUrls = [...html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)=["']([^"']+)["']/gi)]
    .map((match) => new URL(match[1], self.location.href))
    .filter(
      (url) =>
        url.origin === self.location.origin &&
        (url.pathname.endsWith(".js") || url.pathname.endsWith(".css"))
    )
    .map((url) => url.href);

  await Promise.all(
    [...new Set(assetUrls)].map(async (url) => {
      try {
        await cache.add(url);
      } catch {
        // The shell still works with stale-while-revalidate if an optional asset is unavailable.
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cacheAppShell));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_VERSION);
          cache.put("./index.html", response.clone());
          return response;
        } catch {
          const cached = await caches.match("./index.html");
          if (cached) return cached;
          return new Response("offline", { status: 503 });
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const fetchAndCache = fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_VERSION);
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => undefined);
      if (cached) {
        fetchAndCache.catch(() => undefined);
        return cached;
      }
      const fresh = await fetchAndCache;
      if (fresh) return fresh;
      return new Response("offline", { status: 503 });
    })()
  );
});
