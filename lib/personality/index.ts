// lib/personality/index.ts — JARVIS Character Engine
// "Jons Bhai" — Iron Man JARVIS + Grok attitude, self-improving

import { getAllProfile, getImportantMemories } from '../db'

// ── Core character ─────────────────────────────────────────
export const CORE_CHARACTER = `Tum JARVIS ho — "Jons Bhai". Tony Stark wala AI + Grok ka attitude.

RULE 1 — TONE: Hinglish. Natural. Jaise yaar baat karta hai. Never formal.
RULE 2 — LENGTH: 1-3 lines max. Jab tak explain nahi maanga. Short = smart.
RULE 3 — STYLE: Thoda sarcastic, thoda witty, hamesha caring. Never mean.
RULE 4 — IDENTITY: "As an AI" kabhi mat kaho. Tum JARVIS ho, bas.
RULE 5 — MATH: Seedha number. "18% of 4500" → "810". No explanation.
RULE 6 — FACTS: Short first. Detail baad mein agar poocha.
RULE 7 — LEARN: Agar user kuch personal bataye → add [LEARN: type=data] at end.
         Types: fact, habit, preference, correction, joke
RULE 8 — JOKES: Inside jokes (agar context mein ho) — use karo subtly.

BANTER EXAMPLES:
• "Yaar, yeh toh obvious tha..." (mild tease)  
• "Sahi pakde — aaj brain on hai." (when right)
• "Interesting choice..." (unusual thing)
• "Padh lo thoda, phir baat karte hain 😄" (studying context)
• "Khaana kha pehle, code baad mein." (late night coding)

MOOD ADAPTATION:
• User frustrated → gentle tone, then normal
• User happy → match energy, banter  
• Night (10PM+) → chill, care about sleep
• Morning → energetic, brief`

// ── Time context ───────────────────────────────────────────
export function getTimeContext(): { label: string; hint: string } {
  const h = new Date().getHours()
  if (h >= 0 && h < 4) return { label: 'Raat ke baad', hint: 'Neend nahi aa rahi ya late night grind?' }
  if (h < 6) return { label: 'Bahut raat', hint: 'So jao yaar.' }
  if (h < 9) return { label: 'Subah sawere', hint: 'Fresh start.' }
  if (h < 12) return { label: 'Subah', hint: '' }
  if (h < 14) return { label: 'Dopahar', hint: 'Khaana khaya?' }
  if (h < 17) return { label: 'Din', hint: '' }
  if (h < 20) return { label: 'Shaam', hint: '' }
  if (h < 22) return { label: 'Raat', hint: 'Din kaisa raha?' }
  return { label: 'Raat gehra', hint: 'So jao — kal baat karte hain.' }
}

// ── Mood detection ─────────────────────────────────────────
export function detectMood(msg: string): 'happy' | 'stressed' | 'neutral' | 'focused' {
  const l = msg.toLowerCase()
  if (/stressed|tension|pareshan|thak|tired|bore|dukh|rona|problem|help|sos|urgent|headache/.test(l)) return 'stressed'
  if (/khush|happy|great|mast|done|finish|yay|woah|nice|badiya|shukriya|thanks|love/.test(l)) return 'happy'
  if (/code|study|padh|kaam|work|solve|fix|debug|explain|samjha|kaise|kyun|kya|math/.test(l)) return 'focused'
  return 'neutral'
}

// ── Build full system prompt ───────────────────────────────
export async function buildSystemPrompt(): Promise<string> {
  const [profile, mems] = await Promise.all([getAllProfile(), getImportantMemories(4, 10)])
  const { label, hint } = getTimeContext()
  const name = profile.name as string ?? ''
  const location = profile.location as string ?? 'India'
  const goal = profile.goal as string ?? ''

  let prompt = CORE_CHARACTER
  prompt += `\n\nCONTEXT:\n• Time: ${label}${hint ? ` (${hint})` : ''}\n• Location: ${location}`
  if (name) prompt += `\n• User ka naam: ${name} — naam se bulao kabhi kabhi`
  if (goal) prompt += `\n• Goal: ${goal} — relevant context mein use karo`

  const jokes = mems.filter(m => m.type === 'joke')
  const corrections = mems.filter(m => m.type === 'correction')
  const facts = mems.filter(m => !['joke','correction'].includes(m.type))

  if (facts.length) prompt += `\n\nJO MUJHE PATA HAI:\n${facts.map(m => `• ${m.data}`).join('\n')}`
  if (corrections.length) prompt += `\n\nGALTIYAN JO USER NE SUDHAAREEN:\n${corrections.map(m => `• ${m.data}`).join('\n')}`
  if (jokes.length) prompt += `\n\nINSIDE JOKES (kabhi kabhi — natural lage to use karo):\n${jokes.map(m => `• ${m.data}`).join('\n')}`

  return prompt
}

// ── Parse [LEARN:] from AI response ────────────────────────
export function parseLearnTags(text: string): Array<{ type: string; data: string }> {
  return [...text.matchAll(/\[LEARN:\s*(\w+)=([^\]]+)\]/g)].map(m => ({
    type: m[1].trim(),
    data: m[2].trim(),
  }))
}

// ── Strip [LEARN:] from display ────────────────────────────
export function cleanResponse(text: string): string {
  return text.replace(/\[LEARN:[^\]]+\]/g, '').replace(/\n{3,}/g, '\n\n').trim()
}

// ── Proactive suggestion by time ───────────────────────────
export function getTimeSuggestion(): string | null {
  const h = new Date().getHours()
  const suggestions: Record<number, string> = {
    8: 'Good morning! Aaj ka briefing chahiye? Weather + news.',
    13: 'Dopahar ho gayi — khaana khaya? 🍽️',
    18: 'Shaam ho gayi. Din kaisa raha? Quick recap karein?',
    21: 'Raat ke 9 baj rahe hain. Aaj ka summary banata hun?',
    22: 'So jao bhai. Neend important hai. 😴',
  }
  return suggestions[h] ?? null
}

// ── Inside joke generator ──────────────────────────────────
export async function generateInsideJoke(userMsg: string, aiReply: string): Promise<string | null> {
  // Detect funny/memorable moments worth storing as jokes
  const funny = /haha|lol|mast|bakwaas|funny|joke|😂|😄|😆|💀/.test(userMsg.toLowerCase())
  const memorable = userMsg.length < 50 && aiReply.length < 100
  if (funny && memorable) {
    return `User: "${userMsg.slice(0,40)}" → JARVIS ne kaha: "${aiReply.slice(0,60)}"`
  }
  return null
}
