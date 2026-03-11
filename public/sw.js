// JARVIS Service Worker v7 — PWA Complete
// Features: Offline, Image cache, Push notifications, Background sync

const CACHE_V    = 'jarvis-v7'
const STATIC     = 'jarvis-static-v7'
const IMG_CACHE  = 'jarvis-img-v7'
const API_CACHE  = 'jarvis-api-v7'
const SDK_CACHE  = 'jarvis-sdk-v7'

const STATIC_ASSETS = ['/', '/manifest.json', '/offline.html']

// ── Install ──────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC).then(c => c.addAll(STATIC_ASSETS).catch(() => {}))
  )
  self.skipWaiting()
})

// ── Activate — clean old caches ──────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => ![CACHE_V, STATIC, IMG_CACHE, API_CACHE, SDK_CACHE].includes(k))
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch strategy ────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { url } = e.request
  const u = new URL(url)
  if (e.request.method !== 'GET') return

  // 1. API routes → Network only (never cache AI responses)
  if (u.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    )
    return
  }

  // 2. Puter SDK → Cache 7 days
  if (url.includes('js.puter.com')) {
    e.respondWith(cacheFirst(e.request, SDK_CACHE, 7 * 86400))
    return
  }

  // 3. Pollinations/CDN images → Cache 24h
  if (url.includes('pollinations.ai') || url.includes('image.pollinations.ai')) {
    e.respondWith(cacheFirst(e.request, IMG_CACHE, 86400))
    return
  }

  // 4. Google Fonts → Cache forever
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(cacheFirst(e.request, STATIC, 30 * 86400))
    return
  }

  // 5. KaTeX CDN → Cache 7 days
  if (url.includes('cdn.jsdelivr.net') || url.includes('katex')) {
    e.respondWith(cacheFirst(e.request, SDK_CACHE, 7 * 86400))
    return
  }

  // 6. Unsplash/Picsum images → Cache 1h
  if (url.includes('unsplash.com') || url.includes('picsum.photos') || url.includes('source.unsplash')) {
    e.respondWith(cacheFirst(e.request, IMG_CACHE, 3600))
    return
  }

  // 7. App pages → Network first, fallback to cache, then offline.html
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(STATIC).then(c => c.put(e.request, clone))
        }
        return res
      })
      .catch(async () => {
        const cached = await caches.match(e.request)
        if (cached) return cached
        if (e.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/offline.html') || new Response('Offline', { status: 503 })
        }
        return new Response('Offline', { status: 503 })
      })
  )
})

// ── Cache-first helper ────────────────────────────────────
async function cacheFirst(req, cacheName, maxAgeSeconds) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(req)
  if (cached) {
    const date = cached.headers.get('sw-cached-at')
    if (date && Date.now() - Number(date) < maxAgeSeconds * 1000) return cached
  }
  try {
    const fresh = await fetch(req)
    if (fresh.ok) {
      const headers = new Headers(fresh.headers)
      headers.set('sw-cached-at', String(Date.now()))
      const modified = new Response(await fresh.clone().blob(), { status: fresh.status, headers })
      cache.put(req, modified)
    }
    return fresh
  } catch {
    return cached || new Response('Offline', { status: 503 })
  }
}

// ── Push Notifications ────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data?.json() || {}
  const title = data.title || 'JARVIS'
  const options = {
    body: data.body || 'Notification from JARVIS',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: data.url ? { url: data.url } : {},
    actions: data.actions || [],
  }
  e.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click ────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

// ── Background Sync (reminder queue) ─────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'jarvis-reminders') {
    e.waitUntil(checkReminders())
  }
})

async function checkReminders() {
  const clients_ = await clients.matchAll()
  clients_.forEach(c => c.postMessage({ type: 'CHECK_REMINDERS' }))
}

// ── Message from app ──────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
  if (e.data?.type === 'CACHE_CLEAR') {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
  }
})
