// lib/offline/status.ts — Network Status + Offline-first utilities
'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Network status hook ───────────────────────────────────
export function useOnlineStatus() {
  const [online, setOnline]       = useState(true)
  const [wasOffline, setWasOffline] = useState(false)
  const [reconnected, setReconnected] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline  = () => {
      setOnline(true)
      if (wasOffline) {
        setReconnected(true)
        setTimeout(() => setReconnected(false), 3000)
      }
    }
    const handleOffline = () => {
      setOnline(false)
      setWasOffline(true)
    }

    setOnline(navigator.onLine)

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [wasOffline])

  return { online, wasOffline, reconnected }
}

// ── Ping check (more reliable than navigator.onLine) ──────
export async function checkActualConnectivity(): Promise<boolean> {
  try {
    const res = await fetch('https://api.puter.com', {
      method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(3000),
      cache: 'no-cache',
    })
    return true
  } catch { return false }
}

// ── Offline AI response cache ─────────────────────────────
// Cache last N AI responses for offline replay

const OFFLINE_CACHE_KEY = 'jarvis_offline_cache_v1'
const MAX_OFFLINE_CACHE = 50

interface CachedResponse {
  query:    string
  response: string
  ts:       number
  mode:     string
}

export function cacheAIResponse(query: string, response: string, mode: string) {
  try {
    const cache: CachedResponse[] = JSON.parse(
      localStorage.getItem(OFFLINE_CACHE_KEY) || '[]'
    )
    // Don't cache very short responses or errors
    if (response.length < 20) return

    cache.unshift({ query, response, ts: Date.now(), mode })
    localStorage.setItem(
      OFFLINE_CACHE_KEY,
      JSON.stringify(cache.slice(0, MAX_OFFLINE_CACHE))
    )
  } catch {}
}

export function getOfflineFallback(query: string): string | null {
  try {
    const cache: CachedResponse[] = JSON.parse(
      localStorage.getItem(OFFLINE_CACHE_KEY) || '[]'
    )
    if (!cache.length) return null

    const q = query.toLowerCase()
    const tokens = q.split(/\s+/).filter(t => t.length > 2)

    // Exact match
    const exact = cache.find(c => c.query.toLowerCase().includes(q))
    if (exact) return `[Offline — Cached response from ${new Date(exact.ts).toLocaleDateString('hi-IN')}]\n\n${exact.response}`

    // Keyword match
    const keyword = cache.find(c =>
      tokens.some(t => c.query.toLowerCase().includes(t))
    )
    if (keyword) return `[Offline — Similar cached response]\n\n${keyword.response}`

    return null
  } catch { return null }
}

// ── Static offline responses (Hindi) ──────────────────────
const OFFLINE_RESPONSES = [
  'Bhai, abhi internet nahi hai. Offline mode mein hoon. Jo cached hai woh bata sakta hoon, naya nahi.',
  'Net nahi hai yaar. Teri baat sun raha hoon, but answer dene ke liye thoda connectivity chahiye.',
  'Offline hoon filhaal. Pehle ke cached replies mein check kar raha hoon...',
]

export function getStaticOfflineReply(): string {
  return OFFLINE_RESPONSES[Math.floor(Math.random() * OFFLINE_RESPONSES.length)]
}

// ── LocalStorage chat buffer (offline write queue) ───────
const CHAT_BUFFER_KEY = 'jarvis_chat_buffer_v1'

export function bufferChatForSync(msg: { role: string; content: string; ts: number }) {
  try {
    const buf = JSON.parse(localStorage.getItem(CHAT_BUFFER_KEY) || '[]')
    buf.push(msg)
    localStorage.setItem(CHAT_BUFFER_KEY, JSON.stringify(buf.slice(-200)))
  } catch {}
}

export function getChatBuffer(): Array<{ role: string; content: string; ts: number }> {
  try { return JSON.parse(localStorage.getItem(CHAT_BUFFER_KEY) || '[]') }
  catch { return [] }
}

export function clearChatBuffer() {
  try { localStorage.removeItem(CHAT_BUFFER_KEY) } catch {}
}

// ── Network quality estimator ─────────────────────────────
export type NetworkQuality = 'fast' | 'slow' | 'offline'

export async function estimateNetworkQuality(): Promise<NetworkQuality> {
  if (!navigator.onLine) return 'offline'

  const start = Date.now()
  try {
    await fetch('https://api.puter.com', {
      method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(3000), cache: 'no-cache'
    })
    const ms = Date.now() - start
    return ms < 800 ? 'fast' : 'slow'
  } catch {
    return 'offline'
  }
}
