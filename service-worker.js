// public/service-worker.js

const CACHE_NAME = "esp32-weather-cache-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// Install
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  console.log("Service Worker installed");
});

// Activate
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))
    )
  );
  console.log("Service Worker activated");
});

// Fetch
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});


self.addEventListener('push', event => {
  console.log('[ServiceWorker] Push received.');
  if (!event.data) return;

  const data = event.data.json();

  // ✅ Only show notifications for "rain" or "humidity" events
  if (data.type === "rain" || data.type === "humidity") {
    const title = data.title || "🌧 Weather Alert";
    const options = {
      body: data.body || "Rain or high humidity detected!",
      icon: "icons/icon-192.png",
      vibrate: [200, 100, 200],
      tag: data.type
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } else {
    console.log("📭 Ignored non-rain/humidity push:", data);
  }
});


// ✅ NOTIFICATIONCLICK: Focus or open page when clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
