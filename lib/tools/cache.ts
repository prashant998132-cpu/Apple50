// lib/tools/cache.ts — JARVIS Tool Cache v1
// L1: In-memory Map (fast, reset on server restart)
// L2: Serializable Map (for edge/serverless persistence within request context)
// Design: TTL-based eviction, LRU eviction at max size

interface CacheEntry<T> {
  value: T
  expiresAt: number   // Unix ms
  hits: number
  toolId: string
}

// ── Server-side: Node.js module-level singleton (survives hot-reload in dev) ─
const GLOBAL_KEY = '__JARVIS_TOOL_CACHE__'
type CacheMap = Map<string, CacheEntry<any>>

function getL1Cache(): CacheMap {
  const g = globalThis as any
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map<string, CacheEntry<any>>()
  return g[GLOBAL_KEY]
}

const MAX_ENTRIES = 1000

// ── Cache key builder ─────────────────────────────────────
export function buildCacheKey(toolId: string, args?: Record<string, any>): string {
  if (!args || Object.keys(args).length === 0) return `tool:${toolId}`
  // Stable sort keys for consistent hashing
  const sorted = Object.keys(args).sort().map(k => `${k}=${JSON.stringify(args[k])}`).join('&')
  return `tool:${toolId}:${sorted}`
}

// ── Set ────────────────────────────────────────────────────
export function cacheSet<T>(key: string, value: T, ttlSeconds: number, toolId: string): void {
  if (ttlSeconds <= 0) return  // TTL=0 means never cache
  const cache = getL1Cache()

  // Evict oldest if at max
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = [...cache.entries()]
      .sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0]?.[0]
    if (oldestKey) cache.delete(oldestKey)
  }

  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
    hits: 0,
    toolId,
  })
}

// ── Get ────────────────────────────────────────────────────
export function cacheGet<T>(key: string): T | null {
  const cache = getL1Cache()
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null }
  entry.hits++
  return entry.value as T
}

// ── Check (without updating hit count) ────────────────────
export function cacheHas(key: string): boolean {
  const cache = getL1Cache()
  const entry = cache.get(key)
  if (!entry) return false
  if (Date.now() > entry.expiresAt) { cache.delete(key); return false }
  return true
}

// ── Delete ─────────────────────────────────────────────────
export function cacheDel(key: string): void {
  getL1Cache().delete(key)
}

// ── Clear expired entries (call periodically) ─────────────
export function cacheEvict(): number {
  const cache = getL1Cache()
  const now = Date.now()
  let deleted = 0
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) { cache.delete(key); deleted++ }
  }
  return deleted
}

// ── Stats ──────────────────────────────────────────────────
export function cacheStats(): { size: number; hits: number; tools: Record<string, number> } {
  const cache = getL1Cache()
  const tools: Record<string, number> = {}
  let totalHits = 0
  for (const entry of cache.values()) {
    totalHits += entry.hits
    tools[entry.toolId] = (tools[entry.toolId] || 0) + 1
  }
  return { size: cache.size, hits: totalHits, tools }
}

// ── Wrapped fetch with auto-cache ─────────────────────────
export async function cachedFetch<T>(
  toolId: string,
  args: Record<string, any> | undefined,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<{ value: T; fromCache: boolean }> {
  const key = buildCacheKey(toolId, args)

  // L1 hit
  const cached = cacheGet<T>(key)
  if (cached !== null) return { value: cached, fromCache: true }

  // Miss — execute and cache
  const value = await fetcher()
  cacheSet(key, value, ttlSeconds, toolId)
  return { value, fromCache: false }
}
