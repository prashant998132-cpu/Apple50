// lib/db/index.ts — JARVIS Brain (Dexie.js, 5 stores, offline-first)
'use client'

// ── Types ─────────────────────────────────────────────────
export interface Chat {
  id?: number
  timestamp: number
  role: 'user' | 'assistant'
  content: string
  mood?: 'happy' | 'stressed' | 'neutral' | 'focused'
  feedback?: 'up' | 'down'
  toolsUsed?: string[]
  mode?: string
  location?: string
}

export interface Profile {
  key: string
  value: string | number | boolean | string[]
}

export interface Memory {
  id?: number
  type: 'habit' | 'fact' | 'preference' | 'correction' | 'joke' | 'summary'
  data: string
  timestamp: number
  importance: number   // 0–10
  links?: number[]
  lastUsed?: number
  useCount?: number
}

export interface JarvisSetting {
  key: string
  value: string | number | boolean
}

export interface TempCache {
  id?: number
  key: string
  data: string
  expires: number
}

// ── Lazy DB init (SSR safe) ────────────────────────────────
let _db: any = null

async function getDB() {
  if (_db) return _db
  if (typeof window === 'undefined') return null
  const Dexie = (await import('dexie')).default
  class JarvisDB extends Dexie {
    chats!: any
    profile!: any
    memory!: any
    settings!: any
    temp!: any
    constructor() {
      super('JarvisDB_v3')
      this.version(1).stores({
        chats:   '++id, timestamp, role, mood',
        profile: 'key',
        memory:  '++id, type, timestamp, importance',
        settings:'key',
        temp:    '++id, key, expires',
      })
    }
  }
  _db = new JarvisDB()
  return _db
}

// ── Profile ────────────────────────────────────────────────
export async function getProfile(key: string): Promise<any> {
  try { const db = await getDB(); const r = await db?.profile.get(key); return r?.value ?? null } catch { return null }
}

export async function setProfile(key: string, value: any): Promise<void> {
  try { const db = await getDB(); await db?.profile.put({ key, value }) } catch {}
}

export async function getAllProfile(): Promise<Record<string, any>> {
  try {
    const db = await getDB()
    const all = await db?.profile.toArray() ?? []
    return Object.fromEntries(all.map((r: any) => [r.key, r.value]))
  } catch { return {} }
}

// ── Memory ─────────────────────────────────────────────────
export async function addMemory(type: Memory['type'], data: string, importance = 5): Promise<void> {
  try {
    const db = await getDB()
    const existing = await db?.memory.where('data').equals(data).first()
    if (existing) {
      await db?.memory.update(existing.id, {
        importance: Math.min(10, (existing.importance ?? 5) + 1),
        lastUsed: Date.now(),
        useCount: (existing.useCount ?? 0) + 1,
      })
    } else {
      await db?.memory.add({ type, data, timestamp: Date.now(), importance, lastUsed: Date.now(), useCount: 1 })
    }
    // Cleanup low importance old memories (> 60 days, importance < 3)
    const cutoff = Date.now() - 60 * 86400000
    await db?.memory.where('importance').below(3).and((m: Memory) => (m.timestamp ?? 0) < cutoff).delete()
  } catch {}
}

export async function getImportantMemories(minImportance = 5, limit = 12): Promise<Memory[]> {
  try {
    const db = await getDB()
    return await db?.memory.where('importance').aboveOrEqual(minImportance).reverse().limit(limit).toArray() ?? []
  } catch { return [] }
}

export async function buildMemoryContext(): Promise<string> {
  try {
    const [mems, profile] = await Promise.all([getImportantMemories(4, 12), getAllProfile()])
    const lines: string[] = []
    if (profile.name) lines.push(`Naam: ${profile.name}`)
    if (profile.location) lines.push(`Location: ${profile.location}`)
    if (profile.goal) lines.push(`Goal: ${profile.goal}`)
    const jokes = mems.filter(m => m.type === 'joke').map(m => `  [joke] ${m.data}`)
    const corrections = mems.filter(m => m.type === 'correction').map(m => `  [sudhaar] ${m.data}`)
    const facts = mems.filter(m => !['joke','correction'].includes(m.type)).map(m => `  ${m.data}`)
    if (facts.length) lines.push('Jo mujhe pata hai:\n' + facts.join('\n'))
    if (corrections.length) lines.push('Pichli galtiyan:\n' + corrections.join('\n'))
    if (jokes.length) lines.push('Inside jokes:\n' + jokes.join('\n'))
    return lines.join('\n')
  } catch { return '' }
}

// ── Chats ──────────────────────────────────────────────────
export async function saveChat(chat: Omit<Chat, 'id'>): Promise<void> {
  try {
    const db = await getDB()
    await db?.chats.add(chat)
    const count = await db?.chats.count() ?? 0
    if (count > 500) {
      const oldest = await db?.chats.orderBy('timestamp').limit(count - 500).primaryKeys()
      if (oldest?.length) await db?.chats.bulkDelete(oldest)
    }
  } catch {}
}

export async function getRecentChats(limit = 30): Promise<Chat[]> {
  try { const db = await getDB(); return await db?.chats.orderBy('timestamp').reverse().limit(limit).toArray() ?? [] }
  catch { return [] }
}

export async function updateChatFeedback(id: number, feedback: 'up' | 'down'): Promise<void> {
  try { const db = await getDB(); await db?.chats.update(id, { feedback }) } catch {}
}

export async function getTodayChats(): Promise<Chat[]> {
  try {
    const db = await getDB()
    const since = new Date().setHours(0,0,0,0)
    return await db?.chats.where('timestamp').aboveOrEqual(since).toArray() ?? []
  } catch { return [] }
}

// ── Settings ───────────────────────────────────────────────
export async function getSetting(key: string, fallback?: any): Promise<any> {
  try { const db = await getDB(); const r = await db?.settings.get(key); return r?.value ?? fallback }
  catch { return fallback }
}

export async function setSetting(key: string, value: any): Promise<void> {
  try { const db = await getDB(); await db?.settings.put({ key, value }) } catch {}
}

// ── Cache ──────────────────────────────────────────────────
export async function getCache(key: string): Promise<string | null> {
  try {
    const db = await getDB()
    const r = await db?.temp.where('key').equals(key).and((r: TempCache) => r.expires > Date.now()).first()
    return r?.data ?? null
  } catch { return null }
}

export async function setCache(key: string, data: string, ttlMs = 300000): Promise<void> {
  try {
    const db = await getDB()
    await db?.temp.where('key').equals(key).delete()
    await db?.temp.add({ key, data, expires: Date.now() + ttlMs })
  } catch {}
}

// ── Firebase sync (optional) ───────────────────────────────

// ── DB Maintenance ─────────────────────────────────────────
export async function runMaintenance(): Promise<{ deletedChats: number; deletedMemories: number; deletedCache: number }> {
  const db = await getDB()
  if (!db) return { deletedChats: 0, deletedMemories: 0, deletedCache: 0 }

  let deletedChats = 0, deletedMemories = 0, deletedCache = 0

  try {
    // Cap chats at 500 (oldest first)
    const chatCount = await db.chats.count()
    if (chatCount > 500) {
      const oldest = await db.chats.orderBy('timestamp').limit(chatCount - 500).toArray()
      await db.chats.bulkDelete(oldest.map((c: any) => c.id))
      deletedChats = oldest.length
    }

    // Cap memories at 100 — delete lowest importance
    const memCount = await db.memory.count()
    if (memCount > 100) {
      const lowest = await db.memory.orderBy('importance').limit(memCount - 100).toArray()
      await db.memory.bulkDelete(lowest.map((m: any) => m.id))
      deletedMemories = lowest.length
    }

    // Expire temp cache
    const now = Date.now()
    const expired = await db.temp.where('expires').below(now).toArray()
    await db.temp.bulkDelete(expired.map((t: any) => t.id))
    deletedCache = expired.length

  } catch {}

  return { deletedChats, deletedMemories, deletedCache }
}

// ══════════════════════════════════════════════════════════
// GOALS, XP, BADGES — v14 Extension
// ══════════════════════════════════════════════════════════

export interface Goal {
  id?: number
  title: string
  deadline?: number
  priority: 'high' | 'medium' | 'low'
  progress: number   // 0-100
  completed: boolean
  timestamp: number
  category?: string
}

// ── Goals CRUD ─────────────────────────────────────────────
async function getGoalsDB() {
  if (typeof window === 'undefined') return null
  const Dexie = (await import('dexie')).default
  class GoalsDB extends Dexie {
    goals!: any
    constructor() {
      super('JarvisGoals_v1')
      this.version(1).stores({ goals: '++id, completed, priority, timestamp' })
    }
  }
  return new GoalsDB()
}

export async function getAllGoals(): Promise<Goal[]> {
  try { const db = await getGoalsDB(); return await db?.goals.orderBy('timestamp').reverse().toArray() ?? [] }
  catch { return [] }
}
export async function addGoal(g: Omit<Goal, 'id'>): Promise<void> {
  try { const db = await getGoalsDB(); await db?.goals.add(g) } catch {}
}
export async function updateGoal(id: number, changes: Partial<Goal>): Promise<void> {
  try { const db = await getGoalsDB(); await db?.goals.update(id, changes) } catch {}
}
export async function deleteGoal(id: number): Promise<void> {
  try { const db = await getGoalsDB(); await db?.goals.delete(id) } catch {}
}

// ── XP & Badges (localStorage — fast, simple) ─────────────
const XP_KEY   = 'jarvis_xp_v1'
const STK_KEY  = 'jarvis_streak_v1'
const BDGE_KEY = 'jarvis_badges_v1'
const STAT_KEY = 'jarvis_stats_v1'

export interface XPData { xp: number; level: number; totalMessages: number; flashUses: number; thinkUses: number; deepUses: number }
export interface StreakData { current: number; best: number; lastDate: string }
export interface BadgeData { [id: string]: boolean }
export interface StatsData { totalMessages: number; imagesGenerated: number; voiceMinutes: number; todayMessages: number; todayDate: string }

export function getXP(): XPData {
  try { return JSON.parse(localStorage.getItem(XP_KEY) || '{"xp":0,"level":1,"totalMessages":0,"flashUses":0,"thinkUses":0,"deepUses":0}') }
  catch { return { xp:0, level:1, totalMessages:0, flashUses:0, thinkUses:0, deepUses:0 } }
}
export function addXP(amount: number): { newXP: number; leveledUp: boolean; newLevel: number } {
  const d = getXP()
  d.xp += amount
  const newLevel = Math.floor(d.xp / 100) + 1
  const leveledUp = newLevel > d.level
  d.level = newLevel
  try { localStorage.setItem(XP_KEY, JSON.stringify(d)) } catch {}
  return { newXP: d.xp, leveledUp, newLevel }
}
export function incMessageCount(mode?: string): void {
  const d = getXP()
  d.totalMessages = (d.totalMessages || 0) + 1
  if (mode === 'flash') d.flashUses = (d.flashUses||0)+1
  else if (mode === 'think') d.thinkUses = (d.thinkUses||0)+1
  else if (mode === 'deep')  d.deepUses  = (d.deepUses||0)+1
  try { localStorage.setItem(XP_KEY, JSON.stringify(d)) } catch {}
}

export function getStreak(): StreakData {
  try { return JSON.parse(localStorage.getItem(STK_KEY) || '{"current":0,"best":0,"lastDate":""}') }
  catch { return { current:0, best:0, lastDate:'' } }
}
export function touchStreak(): number {
  const today = new Date().toDateString()
  const d = getStreak()
  if (d.lastDate === today) return d.current
  const yesterday = new Date(Date.now()-86400000).toDateString()
  d.current = d.lastDate === yesterday ? d.current + 1 : 1
  d.best = Math.max(d.best, d.current)
  d.lastDate = today
  try { localStorage.setItem(STK_KEY, JSON.stringify(d)) } catch {}
  return d.current
}

export function getBadges(): BadgeData {
  try { return JSON.parse(localStorage.getItem(BDGE_KEY) || '{}') }
  catch { return {} }
}
export function earnBadge(id: string): boolean {
  const b = getBadges()
  if (b[id]) return false
  b[id] = true
  try { localStorage.setItem(BDGE_KEY, JSON.stringify(b)) } catch {}
  return true
}

export const ALL_BADGES = [
  { id:'first_chat',    icon:'🌟', name:'First Chat',      desc:'Send first message',         xp:10 },
  { id:'streak_3',      icon:'🔥', name:'3-Day Streak',    desc:'Use 3 days in a row',        xp:20 },
  { id:'streak_7',      icon:'⚡', name:'Week Warrior',    desc:'Use 7 days in a row',        xp:50 },
  { id:'chatterbox',    icon:'💬', name:'Chatterbox',      desc:'Send 50 messages',           xp:30 },
  { id:'pro_user',      icon:'🗣️', name:'Pro User',        desc:'Send 200 messages',          xp:100 },
  { id:'image_creator', icon:'🎨', name:'Image Creator',   desc:'Generate first image',       xp:15 },
  { id:'goal_setter',   icon:'🎯', name:'Goal Setter',     desc:'Add your first goal',        xp:10 },
  { id:'goal_done',     icon:'✅', name:'Achiever',        desc:'Complete a goal',            xp:25 },
  { id:'deep_thinker',  icon:'🧠', name:'Deep Thinker',    desc:'Use Think or Deep mode',     xp:15 },
  { id:'night_owl',     icon:'🦉', name:'Night Owl',       desc:'Chat after midnight',        xp:10 },
  { id:'study_star',    icon:'📚', name:'Study Star',      desc:'Complete an MCQ session',    xp:20 },
  { id:'voice_user',    icon:'🎙️', name:'Voice User',      desc:'Use voice mode',             xp:10 },
  { id:'memory_maker',  icon:'🧩', name:'Memory Maker',    desc:'10 memories saved',          xp:15 },
  { id:'india_explorer',icon:'🇮🇳', name:'India Explorer',  desc:'Use India Hub',              xp:10 },
]

// ── Search chats ───────────────────────────────────────────
export async function searchChats(query: string, limit = 30): Promise<Chat[]> {
  try {
    const db = await getDB()
    if (!db) return []
    const all: Chat[] = await db.chats.toArray()
    const q = query.toLowerCase()
    return all
      .filter((c: Chat) => c.content.toLowerCase().includes(q))
      .sort((a: Chat, b: Chat) => b.timestamp - a.timestamp)
      .slice(0, limit)
  } catch { return [] }
}

// ── Delete old chats (keep last N) ────────────────────────
export async function pruneChats(keepLast = 2000): Promise<number> {
  try {
    const db = await getDB()
    if (!db) return 0
    const all: Chat[] = await db.chats.orderBy('timestamp').reverse().toArray()
    if (all.length <= keepLast) return 0
    const toDelete = all.slice(keepLast).map((c: Chat) => c.id!).filter(Boolean)
    await db.chats.bulkDelete(toDelete)
    return toDelete.length
  } catch { return 0 }
}

// ── Chat Sessions (auto titles) — v17 ─────────────────────
export interface ChatSession {
  id?: number
  title: string
  startTs: number
  endTs: number
  messageCount: number
  preview: string   // first user message (40 chars)
  mood?: string
}

let _sessionDb: any = null
async function getSessionDB() {
  if (_sessionDb) return _sessionDb
  if (typeof window === 'undefined') return null
  const Dexie = (await import('dexie')).default
  class SessionDB extends Dexie {
    sessions!: any
    constructor() {
      super('JarvisSessions_v1')
      this.version(1).stores({ sessions: '++id, startTs, endTs' })
    }
  }
  _sessionDb = new SessionDB()
  return _sessionDb
}

export async function saveSession(session: Omit<ChatSession,'id'>): Promise<number> {
  try { const db = await getSessionDB(); return await db?.sessions.add(session) || 0 }
  catch { return 0 }
}

export async function getRecentSessions(limit = 20): Promise<ChatSession[]> {
  try {
    const db = await getSessionDB()
    if (!db) return []
    return await db.sessions.orderBy('startTs').reverse().limit(limit).toArray()
  } catch { return [] }
}

export async function updateSessionTitle(id: number, title: string): Promise<void> {
  try { const db = await getSessionDB(); await db?.sessions.update(id, { title }) }
  catch {}
}

// ══════════════════════════════════════════════════════════
// CHAT HISTORY v21 — Pin + Auto-Compress (15 din)
// ══════════════════════════════════════════════════════════

export interface HistorySession {
  id: string
  title: string
  messages: Array<{ role: string; content: string; timestamp: number; card?: unknown }>
  createdAt: number
  updatedAt: number
  pinned: boolean
  compressed: boolean
  summary?: string
  messageCount: number
}

let _histDb: any = null
async function getHistDB() {
  if (_histDb) return _histDb
  if (typeof window === 'undefined') return null
  const Dexie = (await import('dexie')).default
  class HistDB extends Dexie {
    sessions!: any
    constructor() {
      super('JarvisHistoryDB_v1')
      this.version(1).stores({ sessions: 'id, createdAt, updatedAt, pinned, compressed' })
    }
  }
  _histDb = new HistDB()
  return _histDb
}

export async function createHistorySession(title: string): Promise<string> {
  try {
    const db = await getHistDB()
    if (!db) return ''
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const session: HistorySession = {
      id, title: title.slice(0, 60) || 'New Chat',
      messages: [], createdAt: Date.now(), updatedAt: Date.now(),
      pinned: false, compressed: false, messageCount: 0,
    }
    await db.sessions.add(session)
    return id
  } catch { return '' }
}

export async function updateHistorySession(
  id: string,
  messages: HistorySession['messages'],
  title?: string
): Promise<void> {
  try {
    const db = await getHistDB()
    if (!db || !id) return
    const updates: Partial<HistorySession> = { messages, updatedAt: Date.now(), messageCount: messages.length }
    if (title) updates.title = title.slice(0, 60)
    await db.sessions.update(id, updates)
  } catch {}
}

export async function getAllHistorySessions(): Promise<HistorySession[]> {
  try {
    const db = await getHistDB()
    if (!db) return []
    return await db.sessions.orderBy('updatedAt').reverse().toArray()
  } catch { return [] }
}

export async function getHistorySession(id: string): Promise<HistorySession | null> {
  try { const db = await getHistDB(); return (await db?.sessions.get(id)) ?? null } catch { return null }
}

export async function deleteHistorySession(id: string): Promise<void> {
  try { const db = await getHistDB(); await db?.sessions.delete(id) } catch {}
}

export async function pinHistorySession(id: string, pinned: boolean): Promise<void> {
  try { const db = await getHistDB(); await db?.sessions.update(id, { pinned }) } catch {}
}

export async function getSessionsToCompress(): Promise<HistorySession[]> {
  try {
    const db = await getHistDB()
    if (!db) return []
    const cutoff = Date.now() - 15 * 24 * 60 * 60 * 1000
    const all: HistorySession[] = await db.sessions.toArray()
    return all.filter(s => !s.pinned && !s.compressed && s.updatedAt < cutoff && s.messages.length > 2)
  } catch { return [] }
}

export async function markSessionCompressed(id: string, summary: string): Promise<void> {
  try {
    const db = await getHistDB()
    if (!db) return
    await db.sessions.update(id, { compressed: true, summary, messages: [] })
  } catch {}
}

// ════════════════════════════════════════════════════════════
// JARVIS BRAIN v2 — Result Storage + Behavioral Learning
// ════════════════════════════════════════════════════════════

// ── Saved Results (generated content) ────────────────────
export interface SavedResult {
  id?: number
  title: string          // auto-generated from content
  content: string        // full AI output
  type: 'plan' | 'script' | 'image' | 'note' | 'research' | 'chat' | 'other'
  tags: string[]         // extracted keywords
  userQuery: string      // what user asked
  starred: boolean
  createdAt: number
  usedCount: number
}

let _resultsDB: any = null
async function getResultsDB() {
  if (_resultsDB) return _resultsDB
  if (typeof window === 'undefined') return null
  const Dexie = (await import('dexie')).default
  class ResultsDB extends Dexie {
    results!: any
    behavior!: any
    constructor() {
      super('JarvisResults_v1')
      this.version(1).stores({
        results:  '++id, type, createdAt, starred, *tags',
        behavior: 'key',
      })
    }
  }
  _resultsDB = new ResultsDB()
  return _resultsDB
}

// Auto-detect content type from text
function detectResultType(query: string, content: string): SavedResult['type'] {
  const q = query.toLowerCase()
  const c = content.toLowerCase()
  if (/plan|schedule|timetable|routine/.test(q) || /plan|schedule/.test(c)) return 'plan'
  if (/script|video|youtube|reel/.test(q)) return 'script'
  if (/image|photo|generate.*img|!\[/.test(c)) return 'image'
  if (/research|news|search|summarize/.test(q)) return 'research'
  if (/note|save|yaad rakh/.test(q)) return 'note'
  return 'other'
}

// Extract title from content (first meaningful line)
function extractTitle(query: string, content: string): string {
  const firstLine = content.split('\n').find(l => l.trim().length > 5 && !l.startsWith('!'))
  if (firstLine) return firstLine.replace(/[#*_`]/g, '').trim().slice(0, 60)
  return query.slice(0, 60)
}

// Extract tags from content
function extractTags(text: string): string[] {
  const words = text.toLowerCase().match(/\b[a-zA-Z\u0900-\u097F]{4,}\b/g) || []
  const stopWords = new Set(['karo','karna','hai','hain','mein','aur','yeh','woh','toh','nahi','bhi','isko','uska'])
  const freq: Record<string, number> = {}
  words.forEach(w => { if (!stopWords.has(w)) freq[w] = (freq[w] || 0) + 1 })
  return Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0,8).map(e => e[0])
}

// Save any AI-generated result
export async function saveResult(userQuery: string, content: string, forceType?: SavedResult['type']): Promise<void> {
  if (!content || content.length < 50) return // too short to save
  try {
    const db = await getResultsDB()
    if (!db) return
    const type = forceType || detectResultType(userQuery, content)
    const title = extractTitle(userQuery, content)
    const tags = extractTags(userQuery + ' ' + content.slice(0, 200))
    await db.results.add({
      title, content, type, tags,
      userQuery: userQuery.slice(0, 200),
      starred: false,
      createdAt: Date.now(),
      usedCount: 0,
    })
    // Keep max 200 results — delete oldest non-starred
    const count = await db.results.count()
    if (count > 200) {
      const oldest = await db.results.where('starred').equals(0).sortBy('createdAt')
      if (oldest.length > 0) await db.results.delete(oldest[0].id)
    }
  } catch {}
}

export async function getResults(type?: SavedResult['type'], limit = 30): Promise<SavedResult[]> {
  try {
    const db = await getResultsDB()
    if (!db) return []
    let q = db.results.orderBy('createdAt').reverse()
    if (type) q = db.results.where('type').equals(type)
    return await q.limit(limit).toArray()
  } catch { return [] }
}

export async function searchResults(query: string): Promise<SavedResult[]> {
  try {
    const db = await getResultsDB()
    if (!db) return []
    const q = query.toLowerCase()
    const all = await db.results.orderBy('createdAt').reverse().limit(100).toArray()
    return all.filter((r: SavedResult) =>
      r.title.toLowerCase().includes(q) ||
      r.userQuery.toLowerCase().includes(q) ||
      r.tags.some((t: string) => t.includes(q))
    ).slice(0, 20)
  } catch { return [] }
}

export async function starResult(id: number, starred: boolean): Promise<void> {
  try { const db = await getResultsDB(); await db?.results.update(id, { starred }) } catch {}
}

export async function deleteResult(id: number): Promise<void> {
  try { const db = await getResultsDB(); await db?.results.delete(id) } catch {}
}

// ── Behavioral Learning ───────────────────────────────────
export interface BehaviorProfile {
  topTopics: string[]          // Most asked topics
  activeHours: number[]        // [0-23] frequency
  totalSessions: number
  avgSessionLength: number     // minutes
  likedResponseTypes: string[] // What kind of responses user likes
  lastSessionTopics: string[]  // For continuity greeting
  lastActiveAt: number
  longestStreak: number
  preferredMode: 'flash' | 'think' | 'deep'
}

export async function getBehavior(): Promise<BehaviorProfile> {
  try {
    const db = await getResultsDB()
    const r = await db?.behavior.get('profile')
    return r?.value ?? {
      topTopics: [], activeHours: Array(24).fill(0),
      totalSessions: 0, avgSessionLength: 0,
      likedResponseTypes: [], lastSessionTopics: [],
      lastActiveAt: 0, longestStreak: 0, preferredMode: 'flash',
    }
  } catch {
    return {
      topTopics: [], activeHours: Array(24).fill(0),
      totalSessions: 0, avgSessionLength: 0,
      likedResponseTypes: [], lastSessionTopics: [],
      lastActiveAt: 0, longestStreak: 0, preferredMode: 'flash',
    }
  }
}

export async function trackInteraction(userMsg: string, mode?: string): Promise<void> {
  try {
    const db = await getResultsDB()
    if (!db) return
    const profile = await getBehavior()
    const hour = new Date().getHours()
    const hours = [...(profile.activeHours || Array(24).fill(0))]
    hours[hour] = (hours[hour] || 0) + 1

    // Extract topic from message
    const topic = userMsg.toLowerCase().match(/\b(physics|chemistry|maths|history|news|code|python|javascript|study|image|video|youtube|whatsapp)\b/)?.[0]

    const topics = [...(profile.lastSessionTopics || [])]
    if (topic && !topics.includes(topic)) topics.unshift(topic)

    const topTopics = [...(profile.topTopics || [])]
    if (topic) {
      const idx = topTopics.indexOf(topic)
      if (idx === -1) topTopics.unshift(topic)
      else { topTopics.splice(idx, 1); topTopics.unshift(topic) }
    }

    await db.behavior.put({
      key: 'profile',
      value: {
        ...profile,
        activeHours: hours,
        topTopics: topTopics.slice(0, 10),
        lastSessionTopics: topics.slice(0, 5),
        lastActiveAt: Date.now(),
        totalSessions: (profile.totalSessions || 0) + 1,
        preferredMode: (mode as any) || profile.preferredMode || 'flash',
      }
    })
  } catch {}
}

// Proactive greeting based on behavior
export async function getSmartGreeting(): Promise<string | null> {
  try {
    const profile = await getBehavior()
    const now = Date.now()
    const hoursSince = (now - (profile.lastActiveAt || 0)) / 3600000
    const hour = new Date().getHours()

    // Was active recently (< 1 hour) — no greeting needed
    if (hoursSince < 1) return null

    const topics = profile.lastSessionTopics || []
    const timeGreet = hour < 12 ? 'Subah' : hour < 17 ? 'Dopahar' : hour < 21 ? 'Shaam' : 'Raat'

    if (hoursSince < 24 && topics.length > 0) {
      return `${timeGreet} again! Kal tu **${topics[0]}** ke baare mein pooch raha tha — continue karein? 👀`
    }
    if (hoursSince >= 24 && topics.length > 0) {
      return `Arre wapas aa gaya! **${topics[0]}** pe kaam adhoora tha — kahan se shuru karein?`
    }
    if (hour >= 22) {
      return `Raat ko kya chal raha hai? 🌙 Kuch chahiye toh bol.`
    }
    return null
  } catch { return null }
}
