// lib/chat/autoTitle.ts — Auto Chat Session Titles v17
// Uses Puter GPT-4o-mini to generate 4-6 word title after first AI response
// Falls back to rule-based titling if Puter unavailable

import { saveSession, updateSessionTitle } from '../db'

// ── State per session ─────────────────────────────────────
let _currentSessionId: number | null = null
let _sessionStartTs: number | null = null
let _sessionMsgCount = 0

export function startNewSession(): void {
  _currentSessionId = null
  _sessionStartTs = Date.now()
  _sessionMsgCount = 0
}

export function getCurrentSessionId(): number | null { return _currentSessionId }

// ── Generate title from first exchange ───────────────────
export async function generateAndSaveTitle(
  userMsg: string,
  aiReply: string,
): Promise<string> {
  const preview = userMsg.slice(0, 40)

  // Rule-based title first (instant)
  const ruleTitle = ruleBased(userMsg)

  // Save session with rule title immediately
  const startTs = _sessionStartTs || Date.now()
  const id = await saveSession({
    title: ruleTitle,
    startTs,
    endTs: Date.now(),
    messageCount: 2,
    preview,
    mood: detectSessionMood(userMsg),
  })
  _currentSessionId = id
  _sessionMsgCount = 2

  // Try Puter AI title in background
  generateAITitle(userMsg, aiReply).then(aiTitle => {
    if (aiTitle && id) updateSessionTitle(id, aiTitle).catch(() => {})
  }).catch(() => {})

  return ruleTitle
}

// ── Update session on new messages ───────────────────────
export async function trackSessionMessage(): Promise<void> {
  _sessionMsgCount++
}

// ── AI title via Puter ────────────────────────────────────
async function generateAITitle(userMsg: string, aiReply: string): Promise<string | null> {
  if (typeof window === 'undefined' || !window.puter?.ai) return null
  if (!window.puter.auth?.isSignedIn?.()) return null

  try {
    const resp = await Promise.race([
      window.puter.ai.chat([{
        role: 'user',
        content: `Generate a 3-5 word Hindi/English title for this conversation.
User: "${userMsg.slice(0, 100)}"
AI: "${aiReply.slice(0, 100)}"

Rules:
- Max 5 words
- Hinglish OK (mix Hindi+English)
- No quotes
- Descriptive, not generic
- Examples: "NEET Physics Help", "Delhi Weather Query", "Biryani Recipe Search", "Career Guidance Session"

Reply with ONLY the title, nothing else.`,
      }]),
      new Promise<null>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ])

    if (!resp) return null
    const text = typeof resp === 'string'
      ? resp
      : (resp as any)?.message?.content || (resp as any)?.content || ''

    const clean = text.trim().replace(/^["']|["']$/g, '').slice(0, 50)
    return clean.split(' ').length <= 6 ? clean : null
  } catch { return null }
}

// ── Rule-based title (offline fallback) ──────────────────
function ruleBased(msg: string): string {
  const m = msg.toLowerCase().trim()
  const time = new Date()
  const timeStr = time.getHours() < 12 ? 'Subah' : time.getHours() < 17 ? 'Dopahar' : time.getHours() < 21 ? 'Shaam' : 'Raat'

  // Topic detection
  if (/neet|jee|exam|biology|physics|chemistry|organic|inorganic/i.test(m)) {
    if (/physic/i.test(m)) return 'NEET Physics'
    if (/chemi|organic/i.test(m)) return 'NEET Chemistry'
    if (/bio|cell|dna|evolution/i.test(m)) return 'NEET Biology'
    return 'Exam Preparation'
  }
  if (/weather|mausam|barish|garmi/i.test(m)) return `${timeStr} ka Mausam`
  if (/news|khabar|india|politics/i.test(m)) return 'Aaj ki Khabar'
  if (/food|recipe|khana|biryani|chai|cook/i.test(m)) return 'Khane ki Baat'
  if (/code|programming|python|javascript|error|bug/i.test(m)) return 'Coding Help'
  if (/math|calculate|solve|equation|integral/i.test(m)) return 'Math Solution'
  if (/movie|film|web series|netflix|show/i.test(m)) return 'Entertainment Chat'
  if (/health|doctor|medicine|sick|dawa/i.test(m)) return 'Health Query'
  if (/money|sip|emi|invest|loan|bank/i.test(m)) return 'Finance Chat'
  if (/music|song|gaana|spotify/i.test(m)) return 'Music Talk'
  if (/travel|tour|trip|jao|kahan/i.test(m)) return 'Travel Plans'
  if (/job|career|resume|interview/i.test(m)) return 'Career Help'
  if (/remind|alarm|schedule|kal/i.test(m)) return 'Reminder Set'
  if (/who|kya|explain|bata|what is/i.test(m)) return 'General Query'

  // Use first few words
  const words = msg.trim().split(/\s+/).slice(0, 4).join(' ')
  return words.length > 3 ? words : `${timeStr} Chat`
}

function detectSessionMood(msg: string): string {
  if (/stressed|tension|problem|pareshaan|help me/i.test(msg)) return 'stressed'
  if (/excited|amazing|great|awesome|chal gaya/i.test(msg)) return 'happy'
  if (/study|padh|learn|revise/i.test(msg)) return 'focused'
  return 'neutral'
}
