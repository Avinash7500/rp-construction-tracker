/*
  Service Worker for RP Construction Tracker (Vite + React)

  Why this file exists:
  - Enables PWA installability requirements.
  - Caches the app shell for faster repeat loads.
  - Provides a basic offline fallback for SPA navigation.
*/

const CACHE_NAME = "rp-construction-tracker-v1";
// Resolve app base path from registration scope so this SW works on root or sub-path deploys.
const BASE_PATH = new URL(self.registration.scope).pathname;
const APP_SHELL = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.json`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Keep non-GET requests untouched (important for auth flows and any writes).
  if (req.method !== "GET") return;

  // For SPA navigation requests, prefer network, fall back to cached index shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches
          .match(`${BASE_PATH}index.html`)
          .then((resp) => resp || caches.match(BASE_PATH)),
      ),
    );
    return;
  }

  // Cache-first for same-origin static assets.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((networkResp) => {
          const clone = networkResp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return networkResp;
        });
      }),
    );
  }
});
