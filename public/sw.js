// public/sw.js
//
// Deliberately minimal. This is a clinical/financial app — a nurse seeing
// a stale medication list, or a cashier seeing an outdated balance because
// the service worker served a cached response, is a patient-safety and
// money-safety risk, not just a UX inconvenience. So this service worker:
//
//   - Caches ONLY static assets (icons, manifest) — never HTML pages,
//     never API/data responses, never Next.js RSC payloads.
//   - Exists mainly to satisfy PWA installability requirements (a
//     registered service worker is one of the criteria browsers check
//     before offering "Add to Home Screen").
//   - Falls through to the network for everything else. If the network
//     is down, the browser's own offline page shows — not a stale cached
//     version of a patient's chart or a bill.
//
// Real offline support (queuing writes locally, syncing on reconnect) is
// a bigger, deliberate feature — see lib/hooks/useNetworkStatus.ts — and
// should be built with the same care, not bolted on via aggressive
// caching here.

const STATIC_CACHE = 'totalcare-static-v1'
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only intercept same-origin requests for the specific static assets
  // above. Everything else — pages, API calls, Supabase requests — goes
  // straight to the network untouched.
  const isStaticAsset = url.origin === self.location.origin &&
    (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json')

  if (!isStaticAsset) return

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  )
})
