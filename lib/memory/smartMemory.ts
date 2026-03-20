// lib/memory/smartMemory.ts — JARVIS persistent brain
// Stores: user facts, preferences, important events, conversation patterns
'use client'

interface MemoryEntry {
  id: string
  type: 'fact' | 'preference' | 'event' | 'skill' | 'goal'
  content: string
  confidence: number   // 0-1
  timestamp: number
  usedCount: number
}

const DB_KEY = 'jarvis_smart_memory_v2'

function loadMemory(): MemoryEntry[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]') }
  catch { return [] }
}

function saveMemory(entries: MemoryEntry[]): void {
  if (typeof window === 'undefined') return
  // Keep max 100 entries, sorted by usedCount desc
  const sorted = entries.sort((a, b) => (b.usedCount + b.confidence) - (a.usedCount + a.confidence)).slice(0, 100)
  localStorage.setItem(DB_KEY, JSON.stringify(sorted))
}

// Auto-extract facts from user messages
export function learnFromMessage(text: string): void {
  const entries = loadMemory()
  const patterns: [RegExp, MemoryEntry['type']][] = [
    [/(?:mera naam|my name is|main|I am)\s+([A-Z][a-z]+)/i, 'fact'],
    [/(?:main|I)\s+(?:rehta|stay|live)\s+(?:in|at|mein)\s+(\w+(?:\s+\w+)?)/i, 'fact'],
    [/(?:mujhe|I)\s+(?:pasand|like|love|enjoy)\s+(.{3,30})/i, 'preference'],
    [/(?:mera|my)\s+(?:kaam|job|work|profession)\s+(?:hai|is)\s+(.{3,30})/i, 'fact'],
    [/(?:I|main)\s+(?:hate|nafrat|dislike|nahi pasand)\s+(.{3,30})/i, 'preference'],
  ]

  for (const [regex, type] of patterns) {
    const match = text.match(regex)
    if (match?.[1]) {
      const content = match[1].trim()
      const existing = entries.find(e => e.content.toLowerCase().includes(content.toLowerCase()))
      if (!existing) {
        entries.push({
          id: Date.now().toString(),
          type,
          content: content,
          confidence: 0.8,
          timestamp: Date.now(),
          usedCount: 0,
        })
        saveMemory(entries)
      }
    }
  }
}

// Get relevant memories for a query
export function getRelevantMemories(query: string, limit = 5): string {
  const entries = loadMemory()
  if (!entries.length) return ''

  const q = query.toLowerCase()
  const scored = entries.map(e => {
    const words = e.content.toLowerCase().split(' ')
    const score = words.filter(w => q.includes(w) && w.length > 2).length
    e.usedCount++ // increment usage
    return { ...e, score }
  }).filter(e => e.score > 0 || e.type === 'fact').sort((a, b) => b.score - a.score).slice(0, limit)

  saveMemory(entries)

  if (!scored.length) return ''
  return '[MEMORY: ' + scored.map(e => e.content).join('; ') + ']'
}

// Manually add a memory
export function addMemory(content: string, type: MemoryEntry['type'] = 'fact'): void {
  const entries = loadMemory()
  entries.push({ id: Date.now().toString(), type, content, confidence: 1.0, timestamp: Date.now(), usedCount: 0 })
  saveMemory(entries)
}

// Get all memories (for display)
export function getAllMemories(): MemoryEntry[] {
  return loadMemory()
}

// Delete a memory
export function deleteMemory(id: string): void {
  const entries = loadMemory().filter(e => e.id !== id)
  saveMemory(entries)
}

// Clear all
export function clearAllMemory(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(DB_KEY)
}
