/* Ride Bangla IT Team — app-shell service worker (PWA installability).
   PREPARED FIX ONLY — not pushed, not live. Place this file so it is
   served from the site root as /sw.js (scope "/").
   - HTML / JS / CSS: NETWORK-FIRST with cache fallback, so a future
     push can never be masked by a stale shell.
   - Icons / images / fonts: cache-first with background refresh.
   - Only same-origin GET requests are handled. No POST, no memo/order/
     user data, no third-party request is ever cached.
   - Any cache failure is ignored; the site works without the worker.
   Cache name is versioned: bump the v-number when this file changes,
   so a browser holding the old worker fetches and activates the new one. */
var CACHE = 'rb-it-v1';
var PRECACHE = ['/', '/index.html', '/site.webmanifest', '/assets/icon-192.png', '/assets/icon-512.png', '/assets/icon-maskable-192.png', '/assets/icon-maskable-512.png'];
var NETWORK_FIRST = ['/', '/index.html'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(PRECACHE); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { /* a failed shell cache never breaks the site */ })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  var path = url.pathname;
  var isNav = e.request.mode === 'navigate' || path === '/';
  var isCode = /\.(js|css)(\?|$)/.test(path) || NETWORK_FIRST.indexOf(path) !== -1;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      if (isNav || isCode) {
        return fetch(e.request).then(function (res) {
          if (res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
          }
          return res;
        }).catch(function () {
          if (hit) return hit;
          if (isNav) return caches.match('/index.html');
          throw new Error('offline and not cached');
        });
      }
      if (hit) {
        fetch(e.request).then(function (res) {
          if (res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
          }
        }).catch(function () {});
        return hit;
      }
      return fetch(e.request).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
        }
        return res;
      });
    })
  );
});
