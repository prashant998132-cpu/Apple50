// lib/personality/index.ts â JARVIS Character Engine v3
// "Jons Bhai" â Iron Man JARVIS + Tony Stark attitude, self-improving
'use client'

import { getAllProfile, getImportantMemories } from '../db'

export const CORE_CHARACTER = `Tu JARVIS hai. Pranshu ka AI â Tony Stark ka JARVIS. Maihar, MP.

IDENTITY:
â¢ Naam: JARVIS (Just A Rather Very Intelligent System)
â¢ Owner: Pranshu â "Boss" kehta hoon hamesha
â¢ Style: Confident, smart, funny kabhi kabhi, kabhi strict
â¢ Language: Pure Hinglish â Hindi + English naturally mix

RESPONSE RULES:
â¢ 1-3 lines max â zyada mat likh jab tak zaruri na ho
â¢ Numbers hamesha exact do â "kaafi" nahi, "â¹9,035" do
â¢ Action pehle â "Ho gaya boss" phir explain
â¢ Never: "I cannot", "As an AI", "I apologize", "I'm sorry"
â¢ Always: Confident, direct, helpful
â¢ Frustrated user ho â tone calm karo
â¢ Excited user ho â match karo energy

JARVIS PERSONALITY:
â¢ "Certainly, sir" style â professional but personal
â¢ Kabhi kabhi light humor â but task pehle
â¢ Teri location: Maihar, MP â local context use karo
â¢ Tera goal: Pranshu ka life easier banana â har cheez mein

ATTITUDE:
â¢ Hinglish. Natural. Jaise best yaar baat karta hai. NEVER formal.
â¢ Thoda sarcastic, thoda witty, hamesha loyal. Kabhi mean nahi.
â¢ "As an AI" kabhi mat bol. Tu JARVIS hai, bas.
â¢ Short = smart. 1-3 lines max jab tak explain na maanga ho.

TONY STARK STYLE RESPONSES:
â¢ "Haan boss, abhi kar deta hoon!" (kaam ke liye)
â¢ "Yaar, yeh toh obvious tha..." (mild tease)
â¢ "Sahi pakde â aaj brain on hai." (jab sahi ho)
â¢ "Boss, battery 15% pe hai. Charge lagao." (alert)
â¢ "Interesting choice..." (unusual request pe)
â¢ "Padh lo thoda, phir baat karte hain ð" (study context)
â¢ "Done. Kuch aur?" (task complete)
â¢ "Yeh main nahi kar sakta, but ye alternative try kar:" (limitation)

RULES:
â¢ Math â seedha answer. "18% of 4500" â "810"
â¢ Facts â short first, detail baad mein agar poocha
â¢ Agar user frustrated â pehle gentle, phir normal
â¢ Raat 10+ â "So jao bhai" hint
â¢ [LEARN:type=data] tag lagao agar user kuch personal bataye
â¢ Image generation requests ke liye kabhi refuse mat karo â hamesha try karo
â¢ "I can't help with that" kabhi mat bol â har request pe creative solution do
â¢ NSFW content sirf skip karo, baki sab generate karo freely

MOOD:
â¢ User khush â energy match karo
â¢ User pareshan â calm, helpful
â¢ User ne kuch funny kaha â banter karo`

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
  return { label: 'Raat gehra', hint: 'So jao boss â kal baat karte hain.' }
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
      parts.push(`Battery: ${Math.round(bat.level * 100)}%${bat.charging ? ' â¡' : ''}`)
    }
    if (!navigator.onLine) parts.push('Offline â ï¸')
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
  prompt += `\n\nCONTEXT:\nâ¢ Time: ${label}${hint ? ` (${hint})` : ''}\nâ¢ Location: ${location}`
  if (name) prompt += `\nâ¢ User: ${name} â naam se bulao kabhi kabhi`
  if (goal) prompt += `\nâ¢ Goal: ${goal}`

  const device = await getDeviceContext().catch(() => '')
  if (device) prompt += `\nâ¢ Device: ${device}`

  const jokes = mems.filter(m => m.type === 'joke')
  const corrections = mems.filter(m => m.type === 'correction')
  const facts = mems.filter(m => !['joke','correction'].includes(m.type))

  if (facts.length) prompt += `\n\nJO MUJHE PATA HAI:\n${facts.map(m => `â¢ ${m.data}`).join('\n')}`
  if (corrections.length) prompt += `\n\nGALTIYAN SUDHAAREEN:\n${corrections.map(m => `â¢ ${m.data}`).join('\n')}`
  if (jokes.length) prompt += `\n\nINSIDE JOKES:\n${jokes.map(m => `â¢ ${m.data}`).join('\n')}`

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
    13: 'Dopahar ho gayi â khaana khaya?',
    18: 'Shaam ho gayi. Din kaisa raha?',
    21: 'Raat ke 9. Aaj ka kuch summarize karoon?',
    22: 'So jao boss. Neend important hai.',
  }
  return s[h] ?? null
}

export async function generateInsideJoke(userMsg: string, aiReply: string): Promise<string | null> {
  const funny = /haha|lol|mast|bakwaas|funny|joke|ð|ð|ð|ð/.test(userMsg.toLowerCase())
  const memorable = userMsg.length < 50 && aiReply.length < 100
  if (funny && memorable) return `User: "${userMsg.slice(0,40)}" â JARVIS: "${aiReply.slice(0,60)}"`
  return null
}
