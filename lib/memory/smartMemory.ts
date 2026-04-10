// lib/memory/smartMemory.ts — JARVIS Claude-style Auto Memory v3
// Auto-extracts facts from every conversation, like Claude's memory system
'use client'

export interface MemoryEntry {
  id: string
  type: 'fact' | 'preference' | 'habit' | 'goal' | 'skill' | 'correction' | 'personal'
  content: string
  source: 'auto' | 'manual' | 'ai'  // kahan se aaya
  confidence: number   // 0-1
  timestamp: number
  usedCount: number
  tags?: string[]
}

const DB_KEY = 'jarvis_smart_memory_v3'
const MAX_MEMORIES = 150

function load(): MemoryEntry[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]') } catch { return [] }
}

function save(entries: MemoryEntry[]): void {
  if (typeof window === 'undefined') return
  // Score = usedCount*2 + confidence*5 + importance_by_type
  const typeScore: Record<string, number> = { goal:10, personal:9, fact:7, preference:6, habit:6, skill:5, correction:8 }
  const sorted = [...entries]
    .sort((a, b) => (b.usedCount*2 + b.confidence*5 + (typeScore[b.type]||5)) - (a.usedCount*2 + a.confidence*5 + (typeScore[a.type]||5)))
    .slice(0, MAX_MEMORIES)
  localStorage.setItem(DB_KEY, JSON.stringify(sorted))
}

// ── Claude-style AI response parser ─────────────────────────
// AI responses mein [MEMORY: type | content] tags dhundho
export function extractFromAIResponse(aiText: string): MemoryEntry[] {
  const results: MemoryEntry[] = []
  // Format: [MEMORY: fact | user prefers dark theme]
  const tagRegex = /\[MEMORY:\s*([\w]+)\s*\|\s*([^\]]{3,200})\]/gi
  let m
  while ((m = tagRegex.exec(aiText)) !== null) {
    const type = m[1].toLowerCase() as MemoryEntry['type']
    const content = m[2].trim()
    results.push({ id: Date.now().toString() + Math.random().toString(36).slice(2), type, content, source:'ai', confidence:0.95, timestamp:Date.now(), usedCount:0 })
  }
  return results
}

// ── Rule-based extractor from USER messages ─────────────────
const PATTERNS: { re: RegExp; type: MemoryEntry['type']; label: string; confidence: number }[] = [
  // Personal identity
  { re: /(?:mera naam|my name is|main hoon|i am)\s+([A-Za-z][a-zA-Z\s]{1,25})/i, type:'personal', label:'naam', confidence:0.95 },
  { re: /(?:main|i)\s+(?:rehta|rehti|stay|live)\s+(?:hun|hoon|in|at|mein)\s+([A-Za-z\s]{2,30})/i, type:'personal', label:'city', confidence:0.9 },
  { re: /(?:meri umar|my age|i am|main)\s+(\d{1,2})\s*(?:saal|sal|years?|yr)/i, type:'personal', label:'age', confidence:0.95 },
  // Goals & study
  { re: /(?:mera goal|preparing for|preparing neet|studying for|cracking)\s+(neet|jee|upsc|ssc|ias|ips|cat|gate|clat|[a-z\s]{2,25})/i, type:'goal', label:'target_exam', confidence:0.9 },
  { re: /(?:class|standard)\s*(\d{1,2})(?:th|st|nd|rd)?\s*(?:mein|student)/i, type:'fact', label:'class', confidence:0.85 },
  // Preferences
  { re: /(?:mujhe|i)\s+(?:pasand|like|love|enjoy)\s+(.{3,30})/i, type:'preference', label:'pasand', confidence:0.75 },
  { re: /(?:mujhe|i)\s+(?:hate|nafrat|dislike|nahi pasand)\s+(.{3,30})/i, type:'preference', label:'napasand', confidence:0.75 },
  // Habits
  { re: /(?:main|i)\s+(?:roz|daily|everyday|har din)\s+(.{3,40})/i, type:'habit', label:'daily', confidence:0.7 },
  { re: /(\d{1,2})\s*(?:baje|am|pm)\s+(?:sone|so|sleep)/i, type:'habit', label:'sleep', confidence:0.85 },
  { re: /(\d{1,2})\s*(?:baje|am|pm)\s+(?:uthna|uthta|wake)/i, type:'habit', label:'wake', confidence:0.85 },
  // Skills & work
  { re: /(?:main|i)\s+(?:developer|engineer|student|teacher|doctor|kaam karta)\s+(?:hoon|hun|am)/i, type:'skill', label:'profession', confidence:0.9 },
  { re: /(?:jarvis|apple50|prashant)\s+(?:mera|my|hai|is)/i, type:'fact', label:'project', confidence:0.8 },
]

export function extractFromUserMsg(text: string): MemoryEntry[] {
  const results: MemoryEntry[] = []
  const seen = new Set<string>()
  for (const p of PATTERNS) {
    const m = text.match(p.re)
    if (m) {
      const val = (m[1]||'').trim()
      if (!val || val.length < 2) continue
      const content = `${p.label}: ${val}`
      if (!seen.has(content.toLowerCase())) {
        seen.add(content.toLowerCase())
        results.push({ id: Date.now().toString()+Math.random().toString(36).slice(2), type:p.type, content, source:'auto', confidence:p.confidence, timestamp:Date.now(), usedCount:0 })
      }
    }
  }
  return results
}

// ── Smart conversation summarizer ────────────────────────────
// After every 5th message, extract a summary fact
export function maybeExtractSummary(userMsg: string, aiReply: string): MemoryEntry | null {
  const topics = [
    { re: /neet|jee|board exam|physics|chemistry|biology/, label:'Studies: NEET/Science prep chal rahi hai' },
    { re: /jarvis|app|vercel|next\.?js|react|coding|code/, label:'Project: JARVIS AI app build kar raha hai' },
    { re: /weight|gym|exercise|fitness|diet/, label:'Health: fitness/gym pe focus hai' },
    { re: /job|interview|salary|career|placement/, label:'Career: job search/career planning chal rahi' },
    { re: /breakup|relationship|love|girlfriend|boyfriend/, label:'Personal: relationship situation' },
  ]
  const combined = (userMsg + ' ' + aiReply).toLowerCase()
  for (const t of topics) {
    if (t.re.test(combined)) {
      return { id: Date.now().toString(), type:'fact', content:t.label, source:'auto', confidence:0.7, timestamp:Date.now(), usedCount:0 }
    }
  }
  return null
}

// ── Main: auto-learn from every exchange ─────────────────────
export function autoLearn(userMsg: string, aiReply: string): void {
  const entries = load()
  const toAdd: MemoryEntry[] = []

  // 1. From user message (rule-based)
  toAdd.push(...extractFromUserMsg(userMsg))

  // 2. From AI response ([MEMORY:] tags)
  toAdd.push(...extractFromAIResponse(aiReply))

  // 3. Maybe add summary
  const msgCount = parseInt(localStorage.getItem('jarvis_msg_count') || '0') + 1
  localStorage.setItem('jarvis_msg_count', String(msgCount))
  if (msgCount % 5 === 0) {
    const summary = maybeExtractSummary(userMsg, aiReply)
    if (summary) toAdd.push(summary)
  }

  // 4. Deduplicate
  const existingContents = new Set(entries.map(e => e.content.toLowerCase().slice(0, 50)))
  const newOnes = toAdd.filter(m => !existingContents.has(m.content.toLowerCase().slice(0, 50)))

  if (newOnes.length > 0) {
    save([...entries, ...newOnes])
  }
}

// ── Build context string for AI system prompt ─────────────────
export function buildMemoryContext(): string {
  const entries = load()
  if (!entries.length) return ''

  // Top 20 most important
  const top = entries.slice(0, 20)
  const grouped: Record<string, string[]> = {}
  for (const e of top) {
    if (!grouped[e.type]) grouped[e.type] = []
    grouped[e.type].push(e.content)
  }

  const lines: string[] = ['[USER MEMORIES — yaad rakh:']
  const order: MemoryEntry['type'][] = ['personal','goal','fact','preference','habit','skill','correction']
  for (const t of order) {
    if (grouped[t]?.length) {
      lines.push(`${t}: ${grouped[t].join(' | ')}`)
    }
  }
  lines.push(']')
  return lines.join('\n')
}

// ── CRUD operations ───────────────────────────────────────────
export function addMemory(content: string, type: MemoryEntry['type'] = 'fact'): void {
  const entries = load()
  if (entries.find(e => e.content.toLowerCase() === content.toLowerCase())) return
  entries.push({ id: Date.now().toString(), type, content, source:'manual', confidence:1.0, timestamp:Date.now(), usedCount:0 })
  save(entries)
}

export function updateMemory(id: string, content: string): void {
  const entries = load().map(e => e.id === id ? { ...e, content, timestamp:Date.now() } : e)
  save(entries)
}

export function deleteMemory(id: string): void {
  save(load().filter(e => e.id !== id))
}

export function clearAllMemory(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(DB_KEY)
    localStorage.removeItem('jarvis_msg_count')
  }
}

export function getAllMemories(): MemoryEntry[] { return load() }
export function getMemoriesByType(type: MemoryEntry['type']): MemoryEntry[] { return load().filter(e => e.type === type) }

// Old compat
export function learnFromMessage(text: string): void { extractFromUserMsg(text) }
