// lib/proactive/engine.ts — Proactive Intelligence Engine v2
// JARVIS khud decide karta hai kya suggest kare — bina pooche
// Cross-session learning + habit detection + smart suggestions

import { getSetting, setSetting, getTodayChats, addMemory, buildMemoryContext } from '../db'
import { getTimeSuggestion } from '../personality'

export interface ProactiveEvent {
  type: 'suggestion' | 'reminder' | 'summary' | 'habit_tip' | 'learning' | 'streak'
  message: string
  priority: 'high' | 'medium' | 'low'
  action?: string
  actionLabel?: string
}

// ── User profile learned from conversations ────────────────
const PROFILE_KEY = 'jarvis_learned_profile_v1'

export interface LearnedProfile {
  topTopics: string[]          // Most asked topics
  activeHours: number[]        // Hours user is most active [0-23]
  studySubjects: string[]      // Subjects user studies
  codingLangs: string[]        // Programming languages used
  interests: string[]          // Hobbies/interests detected
  totalChats: number
  longestStreak: number
  currentStreak: number
  lastActiveDate: string
  weeklyGoal: number           // target study hours/week
}

function loadProfile(): LearnedProfile {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null') || defaultProfile() }
  catch { return defaultProfile() }
}

function saveProfile(p: LearnedProfile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) } catch {}
}

function defaultProfile(): LearnedProfile {
  return {
    topTopics: [], activeHours: [], studySubjects: [], codingLangs: [],
    interests: [], totalChats: 0, longestStreak: 0, currentStreak: 0,
    lastActiveDate: '', weeklyGoal: 10,
  }
}

// ── Learn from every message ───────────────────────────────
export async function trackHabit(message: string): Promise<void> {
  const l = message.toLowerCase()
  const profile = loadProfile()

  // Track active hour
  const h = new Date().getHours()
  if (!profile.activeHours.includes(h)) profile.activeHours = [...profile.activeHours, h].slice(-20)

  // Detect topics
  const topicMap: [RegExp, string][] = [
    [/code|coding|debug|programming|react|node|next|typescript/, 'coding'],
    [/padh|study|chapter|notes|revision|exam/, 'studying'],
    [/anime|manga|otaku|weeb/, 'anime'],
    [/music|song|gana|spotify|deezer/, 'music'],
    [/gym|exercise|walk|run|yoga|workout/, 'fitness'],
    [/news|khabar|politics|election/, 'news'],
    [/stock|share|crypto|invest|bitcoin/, 'finance'],
    [/movie|film|netflix|series|web series/, 'entertainment'],
    [/game|gaming|pubg|free fire|valorant/, 'gaming'],
    [/cook|recipe|khana|food|restaurant/, 'food'],
    [/travel|trip|yatra|ghumna|tourism/, 'travel'],
  ]

  for (const [r, topic] of topicMap) {
    if (r.test(l) && !profile.topTopics.includes(topic)) {
      profile.topTopics = [topic, ...profile.topTopics].slice(0, 8)
    }
  }

  // Detect study subjects
  const subjectMap: [RegExp, string][] = [
    [/\bphysics\b/, 'Physics'], [/\bchemistry\b/, 'Chemistry'], [/\bbiology\b/, 'Biology'],
    [/\bmaths?\b|mathematics/, 'Maths'], [/\bhistory\b/, 'History'], [/\beconomics\b/, 'Economics'],
    [/\bgeography\b/, 'Geography'], [/\bpython\b/, 'Python'], [/\bjavascript\b|nextjs|reactjs/, 'JavaScript'],
  ]
  for (const [r, sub] of subjectMap) {
    if (r.test(l) && !profile.studySubjects.includes(sub)) {
      profile.studySubjects = [sub, ...profile.studySubjects].slice(0, 6)
    }
  }

  // Coding language detection
  const langMap: [RegExp, string][] = [
    [/\bpython\b/, 'Python'], [/\bjavascript\b|\.js\b/, 'JavaScript'],
    [/\btypescript\b|\.ts\b/, 'TypeScript'], [/\breact\b/, 'React'],
    [/\bc\+\+|cpp\b/, 'C++'], [/\bjava\b/, 'Java'],
  ]
  for (const [r, lang] of langMap) {
    if (r.test(l) && !profile.codingLangs.includes(lang)) {
      profile.codingLangs = [lang, ...profile.codingLangs].slice(0, 5)
    }
  }

  // Streak tracking
  const today = new Date().toDateString()
  if (profile.lastActiveDate !== today) {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
    if (profile.lastActiveDate === yesterday.toDateString()) {
      profile.currentStreak = (profile.currentStreak || 0) + 1
    } else {
      profile.currentStreak = 1
    }
    profile.longestStreak = Math.max(profile.longestStreak, profile.currentStreak)
    profile.lastActiveDate = today
  }
  profile.totalChats = (profile.totalChats || 0) + 1

  saveProfile(profile)
  await addMemory('habit', `Active: ${l.slice(0, 40)}`, 2).catch(() => {})
}

// ── Smart proactive check ──────────────────────────────────
export async function checkProactive(): Promise<ProactiveEvent | null> {
  if (typeof window === 'undefined') return null
  const now = Date.now()
  const today = new Date().toDateString()
  const profile = loadProfile()

  // 1. Fired reminders (highest priority)
  try {
    const rems = JSON.parse(localStorage.getItem('jarvis_reminders_v1') || '[]')
    const due = rems.filter((r: any) => !r.fired && r.fireAt <= now)
    if (due.length > 0) return { type: 'reminder', message: `⏰ ${due[0].message}`, priority: 'high' }
  } catch {}

  // 2. Streak milestone
  if (profile.currentStreak > 0 && profile.currentStreak % 7 === 0) {
    const lastMile = await getSetting('last_streak_milestone', '')
    if (lastMile !== today) {
      await setSetting('last_streak_milestone', today)
      return { type: 'streak', message: `🔥 ${profile.currentStreak} din ki streak! Kya baat hai yaar — JARVIS is proud!`, priority: 'high' }
    }
  }

  // 3. Daily summary (9 PM, once/day)
  const h = new Date().getHours()
  if (h === 21) {
    const lastSum = await getSetting('last_summary_date', '')
    if (lastSum !== today) {
      const chats = await getTodayChats()
      if (chats.length >= 3) {
        await setSetting('last_summary_date', today)
        return { type: 'summary', message: `Aaj ${chats.length} conversations huin — din ka summary dekhna hai?`, priority: 'medium', action: 'daily_summary', actionLabel: 'Summary dekho' }
      }
    }
  }

  // 4. Smart study suggestion — based on past topics
  if (profile.studySubjects.length > 0 && (h >= 18 && h <= 22)) {
    const lastStudySug = Number(await getSetting('last_study_sug', 0))
    if (now - lastStudySug > 86_400_000) { // Once per day
      await setSetting('last_study_sug', now)
      const sub = profile.studySubjects[0]
      return {
        type: 'learning',
        message: `${sub} padha hai pehle — aaj bhi practice karo? 📚`,
        priority: 'medium',
        action: `${sub} practice questions do`,
        actionLabel: '📚 Practice karo',
      }
    }
  }

  // 5. Coding break reminder
  const codingChats = await getTodayChats()
  const codingCount = codingChats.filter(c => c.role === 'user' && /code|debug|error|fix|typescript|react/.test(c.content.toLowerCase())).length
  if (codingCount >= 6) {
    const lastTip = Number(await getSetting('last_break_tip', 0))
    if (now - lastTip > 3_600_000) {
      await setSetting('last_break_tip', now)
      return { type: 'habit_tip', message: 'Bahut der se code kar rahe ho — 5 min break lo, aankhein band karo. 👁️', priority: 'low' }
    }
  }

  // 6. Interest-based suggestion (random, once per 3 hrs)
  const lastSug = Number(await getSetting('last_suggestion_ms', 0))
  if (now - lastSug > 10_800_000 && profile.topTopics.length > 0) {
    const topic = profile.topTopics[Math.floor(Math.random() * Math.min(3, profile.topTopics.length))]
    const suggestions: Record<string, string> = {
      coding:        'Koi naya project shuru karna hai? Main help kar sakta hoon! 💻',
      anime:         'Koi naya anime dhundha? Anime Hub mein check karo 🌸',
      music:         'Aaj kya suna? Gana recommend karun? 🎵',
      fitness:       'Aaj workout ki? 20 min bhi kaafi hai 💪',
      news:          'Aaj ki badi khabar jaanoge? 📰',
      finance:       'Market ka haal dekhna hai? Stocks/crypto check karun? 📈',
      gaming:        'Thoda game khelna ho toh? 🎮',
    }
    const msg = suggestions[topic]
    if (msg) {
      await setSetting('last_suggestion_ms', now)
      return { type: 'suggestion', message: msg, priority: 'low' }
    }
  }

  // 7. Morning nudge (8-10 AM, new day)
  if (h >= 8 && h <= 10) {
    const lastMorn = await getSetting('last_morning_nudge', '')
    if (lastMorn !== today) {
      await setSetting('last_morning_nudge', today)
      const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()]
      return { type: 'suggestion', message: `Good morning! ${day} hai — aaj ka plan kya hai? 🌅`, priority: 'low', action: 'aaj ka plan banao', actionLabel: '📋 Plan banao' }
    }
  }

  return null
}

// ── Generate daily summary ─────────────────────────────────
export async function generateDailySummary(): Promise<string> {
  const chats = await getTodayChats()
  if (chats.length < 3) return 'Aaj zyaada baat nahi hui. Kal better karte hain! 💪'
  const userMsgs = chats.filter(c => c.role === 'user').map(c => c.content.slice(0, 80)).join('; ')
  const profile = loadProfile()
  const gemKey = typeof window !== 'undefined' ? localStorage.getItem('jarvis_key_GEMINI_API_KEY') : null
  if (!gemKey) return `Aaj ${chats.length} conversations huin. Topics: ${profile.topTopics.slice(0,3).join(', ')||'general'}. Productive din raha! ⚡`
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gemKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: `User ki aaj ki conversations ka witty Hinglish summary likho — 3 lines mein:\\n${userMsgs}` }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 150 } }),
      signal: AbortSignal.timeout(8000),
    })
    const d = await res.json()
    return d.candidates?.[0]?.content?.parts?.[0]?.text || `Din mast raha! ${chats.length} baatein huin. 🎯`
  } catch {
    return `Aaj ${chats.length} conversations huin. Din productive raha! 🎯`
  }
}

// Export profile for UI use
export { loadProfile, saveProfile }
