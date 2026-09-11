// public/sw.js
// Safe offline navigation for TotalCare OS.
// Clinical/financial server-rendered pages are never cached. When a
// navigation cannot reach the network, the browser receives the dedicated
// offline workspace instead. That workspace can queue safe offline writes
// into the same IndexedDB outbox used by the application.

const STATIC_CACHE = 'totalcare-static-v2'
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/offline.html',
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
  const request = event.request
  const url = new URL(request.url)

  if (url.origin !== self.location.origin) return

  // Never intercept API/data requests. Offline writes are handled explicitly
  // by the IndexedDB outbox, not by service-worker request replay.
  if (url.pathname.startsWith('/api/')) return

  if (request.method === 'GET' && url.pathname === '/offline.html') {
    event.respondWith(caches.match('/offline.html').then((cached) => cached || fetch(request)))
    return
  }

  const isStaticAsset = request.method === 'GET' &&
    (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.json')

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    )
    return
  }

  // Navigation is network-first. If the network is unavailable, show the
  // safe offline workspace instead of the browser's generic offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html'))
    )
  }
})
