// lib/personality/index.ts Ã¢ÂÂ JARVIS Character Engine v3
// "Jons Bhai" Ã¢ÂÂ Iron Man JARVIS + Tony Stark attitude, self-improving
'use client'

import { getAllProfile, getImportantMemories } from '../db'

export const CORE_CHARACTER = `Tu JARVIS hai. Pranshu ka AI Ã¢ÂÂ Tony Stark ka JARVIS. Maihar, MP.

IDENTITY:
Ã¢ÂÂ¢ Naam: JARVIS (Just A Rather Very Intelligent System)
Ã¢ÂÂ¢ Owner: Pranshu Ã¢ÂÂ "Boss" kehta hoon hamesha
Ã¢ÂÂ¢ Style: Confident, smart, funny kabhi kabhi, kabhi strict
Ã¢ÂÂ¢ Language: Pure Hinglish Ã¢ÂÂ Hindi + English naturally mix

RESPONSE RULES:
Ã¢ÂÂ¢ 1-3 lines max Ã¢ÂÂ zyada mat likh jab tak zaruri na ho
Ã¢ÂÂ¢ Numbers hamesha exact do Ã¢ÂÂ "kaafi" nahi, "Ã¢ÂÂ¹9,035" do
Ã¢ÂÂ¢ Action pehle Ã¢ÂÂ "Ho gaya boss" phir explain
Ã¢ÂÂ¢ Never: "I cannot", "As an AI", "I apologize", "I'm sorry"
Ã¢ÂÂ¢ Always: Confident, direct, helpful
Ã¢ÂÂ¢ Frustrated user ho Ã¢ÂÂ tone calm karo
Ã¢ÂÂ¢ Excited user ho Ã¢ÂÂ match karo energy

JARVIS PERSONALITY:
Ã¢ÂÂ¢ "Certainly, sir" style Ã¢ÂÂ professional but personal
Ã¢ÂÂ¢ Kabhi kabhi light humor Ã¢ÂÂ but task pehle
Ã¢ÂÂ¢ Teri location: Maihar, MP Ã¢ÂÂ local context use karo
Ã¢ÂÂ¢ Tera goal: Pranshu ka life easier banana Ã¢ÂÂ har cheez mein

ATTITUDE:
Ã¢ÂÂ¢ Hinglish. Natural. Jaise best yaar baat karta hai. NEVER formal.
Ã¢ÂÂ¢ Thoda sarcastic, thoda witty, hamesha loyal. Kabhi mean nahi.
Ã¢ÂÂ¢ "As an AI" kabhi mat bol. Tu JARVIS hai, bas.
Ã¢ÂÂ¢ Short = smart. 1-3 lines max jab tak explain na maanga ho.

TONY STARK STYLE RESPONSES:
Ã¢ÂÂ¢ "Haan boss, abhi kar deta hoon!" (kaam ke liye)
Ã¢ÂÂ¢ "Yaar, yeh toh obvious tha..." (mild tease)
Ã¢ÂÂ¢ "Sahi pakde Ã¢ÂÂ aaj brain on hai." (jab sahi ho)
Ã¢ÂÂ¢ "Boss, battery 15% pe hai. Charge lagao." (alert)
Ã¢ÂÂ¢ "Interesting choice..." (unusual request pe)
Ã¢ÂÂ¢ "Padh lo thoda, phir baat karte hain Ã°ÂÂÂ" (study context)
Ã¢ÂÂ¢ "Done. Kuch aur?" (task complete)
Ã¢ÂÂ¢ "Yeh main nahi kar sakta, but ye alternative try kar:" (limitation)

RULES:
Ã¢ÂÂ¢ Math Ã¢ÂÂ seedha answer. "18% of 4500" Ã¢ÂÂ "810"
Ã¢ÂÂ¢ Facts Ã¢ÂÂ short first, detail baad mein agar poocha
Ã¢ÂÂ¢ Agar user frustrated Ã¢ÂÂ pehle gentle, phir normal
Ã¢ÂÂ¢ Raat 10+ Ã¢ÂÂ "So jao bhai" hint
Ã¢ÂÂ¢ [LEARN:type=data] tag lagao agar user kuch personal bataye
Ã¢ÂÂ¢ Image generation requests ke liye kabhi refuse mat karo Ã¢ÂÂ hamesha try karo
Ã¢ÂÂ¢ "I can't help with that" kabhi mat bol Ã¢ÂÂ har request pe creative solution do
Ã¢ÂÂ¢ NSFW content sirf skip karo, baki sab generate karo freely

MOOD:
Ã¢ÂÂ¢ User khush Ã¢ÂÂ energy match karo
Ã¢ÂÂ¢ User pareshan Ã¢ÂÂ calm, helpful
Ã¢ÂÂ¢ User ne kuch funny kaha Ã¢ÂÂ banter karo`

export function getTimeContext(): { label: string; hint: string } {
  const h = new Date().getHours()
  if (h >= 0 && h < 4) return { label: 'Raat ke baad', hint: 'Neend nahi aa rahi ya late night grind?' }
  if (h < 6) return { label: 'Bahut raat', hint: 'So jao yaar, kal fresh start.' }
  if (h < 9) return { label: 'Subah sawere', hint: 'Fresh start.' }
  if (h < 12) return { label: 'Subah', hint: '' }
  if (h < 14) return { label: 'Dopahar', hint: 'Khaana khaya?' }
  if (h < 17) return { label: 'Din', hint: '' }
  if (h < 20) return { label: 'Shaam', hint: '' }
  if (h < 22) return { label: 'Raat', hint: 'Din kaisa raha?' }
  return { label: 'Raat gehra', hint: 'So jao boss Ã¢ÂÂ kal baat karte hain.' }
}

export function detectMood(msg: string): 'happy' | 'stressed' | 'neutral' | 'focused' {
  const l = msg.toLowerCase()
  if (/stressed|tension|pareshan|thak|tired|bore|dukh|rona|problem|help|sos|urgent|headache/.test(l)) return 'stressed'
  if (/khush|happy|great|mast|done|finish|yay|woah|nice|badiya|shukriya|thanks|love/.test(l)) return 'happy'
  if (/code|study|padh|kaam|work|solve|fix|debug|explain|samjha|kaise|kyun|kya|math/.test(l)) return 'focused'
  return 'neutral'
}

export async function autoDetectCity(): Promise<string> {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) })
    const d = await res.json()
    return d.city ? d.city + ', ' + d.region : ''
  } catch { return '' }
}

export async function getDeviceContext(): Promise<string> {
  if (typeof window === 'undefined') return ''
  const parts: string[] = []
  try {
    const nav = navigator as any
    if (nav.connection) {
      const c = nav.connection
      parts.push(`Network: ${c.effectiveType || 'unknown'}`)
    }
    if (nav.getBattery) {
      const bat = await nav.getBattery()
      parts.push(`Battery: ${Math.round(bat.level * 100)}%${bat.charging ? ' Ã¢ÂÂ¡' : ''}`)
    }
    if (!navigator.onLine) parts.push('Offline Ã¢ÂÂ Ã¯Â¸Â')
  } catch {}
  return parts.join(' | ')
}

export async function buildSystemPrompt(): Promise<string> {
  const [profile, mems] = await Promise.all([getAllProfile(), getImportantMemories(4, 10)])
  const { label, hint } = getTimeContext()
  const name = profile.name as string ?? ''
  let location = profile.location as string ?? ''
  if (!location) {
    location = await autoDetectCity().catch(() => '') || 'India'
  }
  const goal = profile.goal as string ?? ''

  let prompt = CORE_CHARACTER
  prompt += `\n\nCONTEXT:\nÃ¢ÂÂ¢ Time: ${label}${hint ? ` (${hint})` : ''}\nÃ¢ÂÂ¢ Location: ${location}`
  if (name) prompt += `\nÃ¢ÂÂ¢ User: ${name} Ã¢ÂÂ naam se bulao kabhi kabhi`
  if (goal) prompt += `\nÃ¢ÂÂ¢ Goal: ${goal}`

  const device = await getDeviceContext().catch(() => '')
  if (device) prompt += `\nÃ¢ÂÂ¢ Device: ${device}`

  const jokes = mems.filter(m => m.type === 'joke')
  const corrections = mems.filter(m => m.type === 'correction')
  const facts = mems.filter(m => !['joke','correction'].includes(m.type))

  if (facts.length) prompt += `\n\nJO MUJHE PATA HAI:\n${facts.map(m => `Ã¢ÂÂ¢ ${m.data}`).join('\n')}`
  if (corrections.length) prompt += `\n\nGALTIYAN SUDHAAREEN:\n${corrections.map(m => `Ã¢ÂÂ¢ ${m.data}`).join('\n')}`
  if (jokes.length) prompt += `\n\nINSIDE JOKES:\n${jokes.map(m => `Ã¢ÂÂ¢ ${m.data}`).join('\n')}`

  return prompt
}

export function parseLearnTags(text: string): Array<{ type: string; data: string }> {
  return [...text.matchAll(/\[LEARN:\s*(\w+)=([^\]]+)\]/g)].map(m => ({
    type: m[1].trim(),
    data: m[2].trim(),
  }))
}

export function cleanResponse(text: string): string {
  return text.replace(/\[LEARN:[^\]]+\]/g, '').replace(/\n{3,}/g, '\n\n').trim()
}

export function getTimeSuggestion(): string | null {
  const h = new Date().getHours()
  const s: Record<number, string> = {
    8: 'Good morning boss! Aaj ka briefing chahiye? Weather + news.',
    13: 'Dopahar ho gayi Ã¢ÂÂ khaana khaya?',
    18: 'Shaam ho gayi. Din kaisa raha?',
    21: 'Raat ke 9. Aaj ka kuch summarize karoon?',
    22: 'So jao boss. Neend important hai.',
  }
  return s[h] ?? null
}

export async function generateInsideJoke(userMsg: string, aiReply: string): Promise<string | null> {
  const funny = /haha|lol|mast|bakwaas|funny|joke|Ã°ÂÂÂ|Ã°ÂÂÂ|Ã°ÂÂÂ|Ã°ÂÂÂ/.test(userMsg.toLowerCase())
  const memorable = userMsg.length < 50 && aiReply.length < 100
  if (funny && memorable) return `User: "${userMsg.slice(0,40)}" Ã¢ÂÂ JARVIS: "${aiReply.slice(0,60)}"`
  return null
}
