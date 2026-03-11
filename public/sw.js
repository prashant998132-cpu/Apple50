// JARVIS Service Worker v6 — Zero Vercel Media
// Strategy:
//   Pollinations images  → Cache-first 24h (zero Vercel, instant repeat)
//   Next.js static       → Cache-first (fonts, JS, CSS — never changes)
//   Google Fonts         → Cache-first
//   Puter.js CDN         → Cache-first 7d (Puter SDK is big, cache it)
//   API routes           → Network-only (never cache)
//   App pages            → Network-first, SW cache fallback

const CACHE_V    = 'jarvis-v6'
const STATIC     = 'jarvis-static-v6'
const IMG_CACHE  = 'jarvis-img-v6'
const FONT_CACHE = 'jarvis-font-v6'
const SDK_CACHE  = 'jarvis-sdk-v6'

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
]

// ── Install ──────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC).then(c => c.addAll(STATIC_ASSETS).catch(() => {}))
  )
  self.skipWaiting()
})

// ── Activate ─────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => ![CACHE_V, STATIC, IMG_CACHE, FONT_CACHE, SDK_CACHE].includes(k))
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const { url } = e.request
  const u = new URL(url)

  // Skip non-GET
  if (e.request.method !== 'GET') return

  // 1. API routes → Network only (never cache)
  if (u.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {
      headers: { 'Content-Type': 'application/json' }
    })))
    return
  }

  // 2. Puter.js SDK → Cache-first 7 days
  if (url.includes('js.puter.com')) {
    e.respondWith(cacheFirst(e.request, SDK_CACHE, 7 * 24 * 3600))
    return
  }

  // 3. Pollinations images → Cache-first 24h
  if (url.includes('image.pollinations.ai') || url.includes('pollinations.ai/p/')) {
    e.respondWith(cacheFirst(e.request, IMG_CACHE, 24 * 3600))
    return
  }

  // 4. Google Fonts & static CDNs → Cache-first
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com') ||
      url.includes('cdnjs.cloudflare.com')) {
    e.respondWith(cacheFirst(e.request, FONT_CACHE, 30 * 24 * 3600))
    return
  }

  // 5. Next.js static assets → Cache-first
  if (u.pathname.startsWith('/_next/static/')) {
    e.respondWith(cacheFirst(e.request, STATIC, 365 * 24 * 3600))
    return
  }

  // 6. App pages → Network-first, cache fallback
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
        if (e.request.headers.get('Accept')?.includes('text/html')) {
          return caches.match('/offline.html') || new Response('Offline', { status: 503 })
        }
        return new Response('', { status: 503 })
      })
  )
})

// ── Cache-first helper ────────────────────────────────────
async function cacheFirst(req, cacheName, maxAgeSeconds) {
  const cache  = await caches.open(cacheName)
  const cached = await cache.match(req)

  if (cached) {
    const date = cached.headers.get('sw-cached-at')
    if (date) {
      const age = (Date.now() - parseInt(date)) / 1000
      if (age < maxAgeSeconds) return cached
    } else {
      return cached  // Old cached items without timestamp — use them
    }
  }

  try {
    const res = await fetch(req)
    if (res.ok) {
      const headers = new Headers(res.headers)
      headers.set('sw-cached-at', String(Date.now()))
      const cached = new Response(await res.blob(), { status: res.status, headers })
      cache.put(req, cached.clone())
      return cached
    }
    return res
  } catch {
    return cached || new Response('', { status: 503 })
  }
}

// ── Messages from app ─────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING')      { self.skipWaiting(); return }
  if (e.data === 'CLEAN_IMG_CACHE') {
    caches.open(IMG_CACHE).then(async c => {
      const keys = await c.keys()
      let deleted = 0
      for (const req of keys) {
        const res = await c.match(req)
        const date = res?.headers.get('sw-cached-at')
        if (date && (Date.now() - parseInt(date)) / 1000 > 24 * 3600) {
          await c.delete(req); deleted++
        }
      }
      e.source?.postMessage({ type: 'CACHE_CLEANED', deleted })
    })
  }
})

// ── Background sync for offline chat queue ────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'jarvis-sync-queue') {
    e.waitUntil(
      // Notify client to flush sync queue
      self.clients.matchAll().then(clients => {
        clients.forEach(c => c.postMessage({ type: 'FLUSH_SYNC_QUEUE' }))
      })
    )
  }
})

// ── Periodic sync (if supported) ─────────────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'jarvis-media-clean') {
    e.waitUntil(
      caches.open(IMG_CACHE).then(async cache => {
        const keys = await cache.keys()
        let cleaned = 0
        for (const req of keys) {
          const res = await cache.match(req)
          const date = res?.headers.get('sw-cached-at')
          if (date && (Date.now() - parseInt(date)) > 24 * 3600 * 1000) {
            await cache.delete(req); cleaned++
          }
        }
        console.log(`[SW] Media cache cleaned: ${cleaned} entries`)
      })
    )
  }
})
