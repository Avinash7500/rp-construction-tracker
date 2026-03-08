/*
  Service Worker for RP Construction Tracker (Vite + React)

  Why this file exists:
  - Enables PWA installability requirements.
  - Caches the app shell for faster repeat loads.
  - Provides a basic offline fallback for SPA navigation.
*/

const CACHE_NAME = "rp-construction-tracker-v2";
// Resolve app base path from registration scope so this SW works on root or sub-path deploys.
const BASE_PATH = new URL(self.registration.scope).pathname;
const APP_SHELL = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.json`,
];

// Firebase Cloud Messaging setup in the existing SW scope.
// This avoids registering a second worker and keeps PWA + push unified.
try {
  importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

  firebase.initializeApp({
    apiKey: "AIzaSyBQT_5WBkHgcGjLv90jMrMLDAXqP0tefco",
    authDomain: "rp-construction-tracker-9d0eb.firebaseapp.com",
    projectId: "rp-construction-tracker-9d0eb",
    storageBucket: "rp-construction-tracker-9d0eb.appspot.com",
    messagingSenderId: "314276287594",
    appId: "1:314276287594:web:28b4e41d9ea2d9805d2613",
  });

  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const notificationTitle =
      payload?.notification?.title || payload?.data?.title || "RP Construction Tracker";
    const notificationOptions = {
      body: payload?.notification?.body || payload?.data?.body || "",
      icon: payload?.notification?.icon || `${BASE_PATH}icons/icon-192.png`,
      data: {
        link: payload?.fcmOptions?.link || payload?.data?.link || `${BASE_PATH}`,
      },
    };
    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (e) {
  // Keep app SW behavior stable if messaging SDK load fails.
}

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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const deepLink = event.notification?.data?.link || `${BASE_PATH}`;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(deepLink);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(deepLink);
      return null;
    }),
  );
});
