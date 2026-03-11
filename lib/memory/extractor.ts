// lib/memory/extractor.ts
// ══════════════════════════════════════════════════════════════
// JARVIS Memory Extractor v2
// Auto-detect what to remember from conversation
// Sources: [LEARN:] tags + rule-based patterns + feedback
// ══════════════════════════════════════════════════════════════

import { addMemory, getImportantMemories, type Memory } from '../db'

// ─── Types ────────────────────────────────────────────────
export interface ExtractedMemory {
  type: Memory['type']
  data: string
  importance: number
  raw?: string
}

// ─── [LEARN:] tag extractor ───────────────────────────────
// JARVIS response mein [LEARN: text] format se
export function extractLearnTags(text: string): ExtractedMemory[] {
  const results: ExtractedMemory[] = []
  const regex = /\[LEARN:\s*([^\]]+)\]/gi
  let match
  while ((match = regex.exec(text)) !== null) {
    const raw = match[1].trim()
    if (raw.length > 3 && raw.length < 300) {
      results.push({
        type:       detectMemoryType(raw),
        data:       raw,
        importance: 7,
        raw:        match[0],
      })
    }
  }
  return results
}

// ─── Rule-based extractor (user messages se) ──────────────
const PATTERNS: { regex: RegExp; type: Memory['type']; importance: number; label: string }[] = [
  // Name
  { regex: /(?:mera naam|my name is|main hoon|i am|i'm)\s+([A-Za-z][a-zA-Z\s]{1,20})/i, type:'fact', importance:9, label:'naam' },
  // Location / city
  { regex: /(?:main\s+)?([A-Za-z\s]+)(?:\s+mein\s+rehta|se hoon|se hun|reside in|live in|from)\b/i, type:'fact', importance:8, label:'location' },
  // Age
  { regex: /(?:meri umar|my age is|i am)\s+(\d{1,2})\s*(?:saal|years?|yr)/i, type:'fact', importance:7, label:'age' },
  // Exam / goal
  { regex: /(?:mera goal|i want to|i'm preparing for|main prepare kar raha|studying for)\s+(neet|jee|upsc|ssc|cat|gate|clat|ias|ips|[a-z\s]{3,30})/i, type:'preference', importance:9, label:'goal' },
  // Subjects
  { regex: /(?:mujhe|i)\s+(?:love|like|pasand hai|enjoy)\s+(physics|chemistry|maths|biology|history|geography|[a-z\s]{3,20})/i, type:'preference', importance:6, label:'likes' },
  // Dislikes
  { regex: /(?:mujhe|i)\s+(?:hate|dislike|pasand nahi|don't like)\s+([\w\s]{3,25})/i, type:'preference', importance:6, label:'dislikes' },
  // Sleep
  { regex: /(?:main\s+)?(\d{1,2})\s*(?:baje|am|pm)\s+(?:sone jata|so jata|sleep)/i, type:'habit', importance:5, label:'sleep_time' },
  // Wake time
  { regex: /(?:main\s+)?(\d{1,2})\s*(?:baje|am|pm)\s+(?:uthta|wake up|jag jata)/i, type:'habit', importance:5, label:'wake_time' },
  // Study hours
  { regex: /(\d{1,2})\s*(?:ghante|hours?)\s+(?:padhta|study karta|read karta)/i, type:'habit', importance:6, label:'study_hours' },
  // School / college
  { regex: /(?:main\s+)?(?:padh raha|study kar raha|hoon)\s+(?:in|at|mein)\s+([A-Za-z\s]{3,40}(?:school|college|university|institute|iit|nit))/i, type:'fact', importance:7, label:'school' },
  // Hobby
  { regex: /(?:my hobby|meri hobby|i enjoy|i love|mujhe achha lagta)\s+([\w\s]{3,25})/i, type:'preference', importance:5, label:'hobby' },
  // Inside jokes / funny moments
  { regex: /(?:haha|lol|😂|🤣){2,}|bhai tu pagal hai|yaar tu bhi|bahut funny/i, type:'joke', importance:4, label:'funny_moment' },
]

export function extractFromUserMessage(msg: string): ExtractedMemory[] {
  const results: ExtractedMemory[] = []
  const seen = new Set<string>()

  for (const p of PATTERNS) {
    const match = msg.match(p.regex)
    if (match) {
      const captured = match[1]?.trim() || msg.slice(0, 80)
      const data = `${p.label}: ${captured}`
      if (!seen.has(data)) {
        seen.add(data)
        results.push({ type: p.type, data, importance: p.importance })
      }
    }
  }

  return results
}

// ─── Type detector ─────────────────────────────────────────
function detectMemoryType(text: string): Memory['type'] {
  const t = text.toLowerCase()
  if (t.includes('joke') || t.includes('funny') || t.includes('haha'))           return 'joke'
  if (t.includes('habit') || t.includes('daily') || t.includes('routine'))       return 'habit'
  if (t.includes('prefer') || t.includes('like') || t.includes('love') || t.includes('pasand')) return 'preference'
  if (t.includes('wrong') || t.includes('actually') || t.includes('correct'))    return 'correction'
  return 'fact'
}

// ─── Main pipeline ─────────────────────────────────────────
export async function processAndSave(
  userMsg: string,
  assistantReply: string,
  feedback?: 'up' | 'down'
): Promise<{ saved: number; items: ExtractedMemory[] }> {
  const toSave: ExtractedMemory[] = []

  // 1. [LEARN:] tags from assistant reply
  toSave.push(...extractLearnTags(assistantReply))

  // 2. Rule-based from user message
  toSave.push(...extractFromUserMessage(userMsg))

  // 3. Feedback adjustments
  if (feedback === 'down') {
    // Bad response → save correction with high importance
    toSave.push({ type: 'correction', data: `User ko pasand nahi aaya: "${userMsg.slice(0,80)}"`, importance: 8 })
  }
  if (feedback === 'up' && toSave.length > 0) {
    toSave.forEach(m => { if (m.importance < 8) m.importance += 1 })
  }

  // 4. Deduplicate against existing memories
  const existing = await getImportantMemories(0, 200).catch(() => [] as Memory[])
  const existingData = new Set(existing.map((m: Memory) => m.data.toLowerCase().slice(0, 50)))

  const newItems = toSave.filter(m => {
    const key = m.data.toLowerCase().slice(0, 50)
    return !existingData.has(key)
  })

  // 5. Save new ones via existing addMemory helper
  for (const item of newItems) {
    await addMemory(item.type, item.data, item.importance).catch(() => {})
  }

  return { saved: newItems.length, items: newItems }
}

// ─── Build context string for system prompt ────────────────
export async function buildMemoryContext(): Promise<string> {
  const memories = await getImportantMemories(0, 30).catch(() => [] as Memory[])

  if (!memories.length) return ''

  const grouped: Record<string, string[]> = {}
  for (const m of memories as Memory[]) {
    if (!grouped[m.type]) grouped[m.type] = []
    grouped[m.type].push(m.data)
  }

  const lines: string[] = ['[USER MEMORY]']
  if (grouped.fact)       lines.push('Facts:',       ...grouped.fact.map(d => `  - ${d}`))
  if (grouped.preference) lines.push('Preferences:', ...grouped.preference.map(d => `  - ${d}`))
  if (grouped.habit)      lines.push('Habits:',      ...grouped.habit.map(d => `  - ${d}`))
  if (grouped.joke)       lines.push('Inside Jokes:', ...grouped.joke.slice(0,3).map(d => `  - ${d}`))
  if (grouped.correction) lines.push('Corrections:', ...grouped.correction.slice(0,3).map(d => `  - ${d}`))
  lines.push('[/USER MEMORY]')

  return lines.join('\n')
}

// ─── Manual save (from Settings or explicit) ──────────────
export async function manualSave(data: string, type: Memory['type'] = 'fact', importance = 8): Promise<void> {
  await addMemory(type, data, importance)
}
