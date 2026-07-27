// BASICO SYSTEM — minimal install-only service worker.
// Does NOT cache API responses, Supabase, auth tokens, or any private data.
// Only passes through static asset requests to satisfy PWA installability.

// Subir este número al cambiar cualquier asset estático. El handler de
// `activate` borra toda caché cuyo nombre no coincida con el actual, así que el
// nombre ES el mecanismo de invalidación: el fetch es cache-first para .png,
// .ico y .woff2, y sin cambiarlo los iconos viejos se sirven indefinidamente a
// quien ya haya visitado el sitio.
// v2 — iconos y manifest rehechos (favicon legible, iconos cuadrados).
// v3 — la B pasa de blanca a gris #B3B3B3 y el fondo a círculo.
// v4 — tarjeta social rehecha para leerse a tamaño de feed, ahora a 2400×1260.
// v5 — tarjeta centrada y de vuelta a 1200×630 para no pasar el límite de peso
//      de WhatsApp, que si no degrada a un thumbnail cuadrado.
const STATIC_CACHE = "basico-static-v5";
const STATIC_ASSETS = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // NEVER intercept Supabase, auth, API, or cross-origin sensitive endpoints.
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/api") ||
    url.pathname.includes("supabase")
  ) {
    return;
  }

  // Only handle a small allowlist of static files.
  const isStatic =
    STATIC_ASSETS.includes(url.pathname) ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?|ttf|otf)$/i.test(url.pathname);

  if (!isStatic) return;

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});
