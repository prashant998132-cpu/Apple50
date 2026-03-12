/* lib/core/smartRouter.ts — JARVIS Smart Router v3
 *
 * VERCEL FREE LIMITS (Hobby plan):
 *   Edge functions: 500K req/month = ~16K/day
 *   maxDuration: 30s per edge function
 *   Memory: 128MB per edge invocation
 *   Bandwidth: 100GB/month
 *
 * STRATEGY (Vercel-aware):
 *   1. Cache first — same query in 60s = 0 API calls
 *   2. Complexity detect — nano queries = tiny tokens
 *   3. Provider cascade — fastest/free first, paid last
 *   4. 85% daily limit — never hit hard limits
 *   5. Pollinations = unlimited free fallback (always works)
 *   6. In-memory usage resets per cold start (Edge behavior)
 *      — acceptable, better than crashing
 */

export type RouterMode = 'flash' | 'think' | 'deep'

interface Message { role: 'user' | 'assistant' | 'system'; content: string }

export interface RouterResult {
  text: string
  provider: string
  model: string
  tokensUsed?: number
  fromCache?: boolean
  latencyMs?: number
}

// ── Daily Usage Tracker (Edge: in-memory per cold start) ──
// Note: Vercel Edge resets per cold start — that's fine, prevents abuse
interface Usage { count: number; resetAt: number }
const USAGE = new Map<string, Usage>()

// Conservative daily limits (85% rule applied)
const DAILY_LIMITS: Record<string, number> = {
  groq:         14400, // 14400/day free (generous)
  gemini:       1500,  // 1500 RPD free tier
  together:     500,
  cerebras:     1000,
  mistral:      1000,
  cohere:       1000,
  fireworks:    600,
  openrouter:   200,   // very limited
  deepinfra:    500,
  huggingface:  500,
  pollinations: 999999, // unlimited — our safety net
  puter:        999999, // unlimited via Puter SDK
}

function canUse(provider: string): boolean {
  const limit = DAILY_LIMITS[provider]
  if (!limit) return true
  const now = Date.now()
  let u = USAGE.get(provider)
  if (!u || now > u.resetAt) {
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    midnight.setDate(midnight.getDate() + 1)
    u = { count: 0, resetAt: midnight.getTime() }
    USAGE.set(provider, u)
  }
  if (u.count >= Math.floor(limit * 0.85)) return false
  u.count++
  return true
}

export function getUsage(): Record<string, { count: number; limit: number; pct: number }> {
  const result: Record<string, { count: number; limit: number; pct: number }> = {}
  for (const [provider, limit] of Object.entries(DAILY_LIMITS)) {
    const u = USAGE.get(provider)
    const count = u?.count ?? 0
    result[provider] = { count, limit, pct: Math.round(count / limit * 100) }
  }
  return result
}

// ── Response Cache — Vercel Edge compatible ────────────────
// Edge: Map is per-isolate, shared within same region
// TTL: 60s for flash (conversational), longer for factual
interface CacheEntry { text: string; provider: string; model: string; expiresAt: number }
const RESPONSE_CACHE = new Map<string, CacheEntry>()

function cacheKey(messages: Message[], mode: RouterMode): string {
  const last = messages.filter(m => m.role === 'user').pop()?.content ?? ''
  return `${mode}:${last.slice(0, 100).toLowerCase().replace(/\s+/g, ' ')}`
}

function fromCache(key: string): RouterResult | null {
  const e = RESPONSE_CACHE.get(key)
  if (!e) return null
  if (Date.now() > e.expiresAt) { RESPONSE_CACHE.delete(key); return null }
  return { text: e.text, provider: e.provider, model: e.model, fromCache: true }
}

function toCache(key: string, result: RouterResult, ttlMs: number): void {
  RESPONSE_CACHE.set(key, { ...result, expiresAt: Date.now() + ttlMs })
  // Cap at 200 entries — prevent memory bloat in long-running isolates
  if (RESPONSE_CACHE.size > 200) {
    const oldest = RESPONSE_CACHE.keys().next().value
    if (oldest) RESPONSE_CACHE.delete(oldest)
  }
}

// Cache TTL by mode:
// flash = 60s (conversation, may change with next message)
// think = 5min (reasoning, stable)
// deep = 2min (tools involved, data may update)
const CACHE_TTL: Record<RouterMode, number> = {
  flash: 60_000,
  think: 300_000,
  deep:  120_000,
}

// ── Message trimmer — save tokens = save Vercel bandwidth ─
function buildMsgs(messages: Message[], mode: RouterMode): Message[] {
  const system = messages.find(m => m.role === 'system')
  const convo = messages.filter(m => m.role !== 'system')
  // History window: flash=6 msgs, think=10, deep=8
  const limit = mode === 'think' ? 10 : mode === 'deep' ? 8 : 6
  const trimmed = convo.slice(-limit)
  return system ? [system, ...trimmed] : trimmed
}

// ── Token budget by query complexity ──────────────────────
// Vercel Edge: responses stream through, no extra cost for larger tokens
// But provider rate limits care — keep reasonable
function getMaxTokens(messages: Message[], mode: RouterMode): number {
  if (mode === 'think') return 800
  if (mode === 'deep') return 600
  // Flash: detect complexity
  const last = messages.filter(m => m.role === 'user').pop()?.content ?? ''
  const words = last.trim().split(/\s+/).length
  if (words <= 3) return 80   // nano: "hi", "time?", "ok"
  if (words <= 8) return 200  // simple: "weather delhi"
  if (words <= 20) return 400 // normal
  return 600                  // research/long
}

// ── Provider configs — ordered by: speed → quality → cost ─
const P = {
  // Groq: fastest inference, generous free tier (14.4K RPD)
  groq8b:    { url: 'https://api.groq.com/openai/v1/chat/completions',    model: 'llama-3.1-8b-instant',         key: () => process.env.GROQ_API_KEY,        name: 'groq' },
  groq70b:   { url: 'https://api.groq.com/openai/v1/chat/completions',    model: 'llama-3.3-70b-versatile',      key: () => process.env.GROQ_API_KEY,        name: 'groq' },
  groqR1:    { url: 'https://api.groq.com/openai/v1/chat/completions',    model: 'deepseek-r1-distill-llama-70b', key: () => process.env.GROQ_API_KEY,       name: 'groq' },
  // Gemini: great quality, 1500 RPD free
  gemFlash:  { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.0-flash', key: () => process.env.GEMINI_API_KEY, name: 'gemini' },
  gemThink:  { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash-preview-04-17', key: () => process.env.GEMINI_API_KEY, name: 'gemini' },
  // Cerebras: fast inference
  cerebras:  { url: 'https://api.cerebras.ai/v1/chat/completions',        model: 'llama-3.3-70b',                key: () => process.env.CEREBRAS_API_KEY,    name: 'cerebras' },
  // Together: good variety
  together:  { url: 'https://api.together.xyz/v1/chat/completions',       model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', key: () => process.env.TOGETHER_API_KEY, name: 'together' },
  // Mistral: reliable
  mistral:   { url: 'https://api.mistral.ai/v1/chat/completions',         model: 'mistral-small-latest',         key: () => process.env.MISTRAL_API_KEY,     name: 'mistral' },
  // OpenRouter: free DeepSeek R1
  openroute: { url: 'https://openrouter.ai/api/v1/chat/completions',      model: 'deepseek/deepseek-r1:free',    key: () => process.env.OPENROUTER_API_KEY,  name: 'openrouter' },
  // Others
  fireworks: { url: 'https://api.fireworks.ai/inference/v1/chat/completions', model: 'accounts/fireworks/models/llama-v3p3-70b-instruct', key: () => process.env.FIREWORKS_API_KEY, name: 'fireworks' },
  deepinfra: { url: 'https://api.deepinfra.com/v1/openai/chat/completions', model: 'meta-llama/Meta-Llama-3.1-70B-Instruct', key: () => process.env.DEEPINFRA_API_KEY, name: 'deepinfra' },
  huggingf:  { url: 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions', model: 'mistralai/Mistral-7B-Instruct-v0.3', key: () => process.env.HUGGINGFACE_API_KEY, name: 'huggingface' },
}

// ── OpenAI-compatible provider call ───────────────────────
async function callOAI(
  cfg: { url: string; model: string; key: () => string | undefined; name: string },
  msgs: Message[], maxTokens: number,
): Promise<string> {
  const key = cfg.key()
  if (!key) throw new Error(`No key: ${cfg.name}`)
  if (!canUse(cfg.name)) throw new Error(`${cfg.name} at 85% limit`)

  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: cfg.model, messages: msgs, max_tokens: maxTokens, temperature: 0.72 }),
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`${cfg.name} ${res.status}`)
  const d = await res.json()
  const text = d?.choices?.[0]?.message?.content ?? d?.choices?.[0]?.text ?? ''
  if (!text.trim()) throw new Error(`Empty from ${cfg.name}`)
  return text.trim()
}

// ── Cohere (different format) ──────────────────────────────
async function callCohere(msgs: Message[], maxTokens: number): Promise<string> {
  const key = process.env.COHERE_API_KEY
  if (!key) throw new Error('No Cohere key')
  if (!canUse('cohere')) throw new Error('cohere at 85%')
  const userMsg = msgs.filter(m => m.role === 'user').pop()?.content ?? ''
  const history = msgs
    .filter(m => m.role !== 'user' && m.role !== 'system')
    .map(m => ({ role: m.role === 'assistant' ? 'CHATBOT' : 'USER', message: m.content }))
  const res = await fetch('https://api.cohere.com/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ message: userMsg, chat_history: history, model: 'command-r', max_tokens: maxTokens }),
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`Cohere ${res.status}`)
  const d = await res.json()
  return d?.text?.trim() ?? ''
}

// ── Pollinations — UNLIMITED, no key, always works ────────
async function callPollinations(msgs: Message[], maxTokens: number): Promise<string> {
  const res = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai', messages: msgs, max_tokens: maxTokens }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Pollinations ${res.status}`)
  const d = await res.json()
  const text = d?.choices?.[0]?.message?.content ?? ''
  if (!text.trim()) throw new Error('Empty Pollinations')
  return text.trim()
}

// ── Puter.js fallback (unlimited, browser-only) ───────────
// Note: Puter is client-side only, can't use in Edge route
// Kept as reference — handled in client lib/providers/puter.ts

// ── MAIN ROUTER v3 ─────────────────────────────────────────
export async function smartRouter(
  messages: Message[],
  mode: RouterMode = 'flash',
  maxTokens?: number,
): Promise<RouterResult> {
  const t0 = Date.now()

  // 1. Cache check — zero API, zero Vercel invocation cost
  const key = cacheKey(messages, mode)
  const cached = fromCache(key)
  if (cached) return cached

  // 2. Trim + budget
  const trimmed = buildMsgs(messages, mode)
  const tokens = maxTokens ?? getMaxTokens(messages, mode)

  // 3. Build cascade — Vercel-aware ordering
  // Flash: speed priority → Groq 8B (fastest) → Groq 70B → Cerebras → Gemini → others → Pollinations
  // Think: reasoning priority → DeepSeek R1 on Groq → OpenRouter → Gemini 2.5 → others
  // Deep: quality + tools → Gemini Flash → Groq 70B → others

  type Entry = [string, string, () => Promise<string>]
  let cascade: Entry[]

  if (mode === 'think') {
    cascade = [
      ['Groq',         'DeepSeek-R1-70B',    () => callOAI(P.groqR1,    trimmed, tokens)],
      ['OpenRouter',   'DeepSeek-R1:free',   () => callOAI(P.openroute, trimmed, tokens)],
      ['Gemini',       '2.5-Flash',          () => callOAI(P.gemThink,  trimmed, tokens)],
      ['Groq',         'Llama-3.3-70B',      () => callOAI(P.groq70b,   trimmed, tokens)],
      ['Together',     'Llama-3.3-70B-Turbo',() => callOAI(P.together,  trimmed, tokens)],
      ['Cerebras',     'Llama-3.3-70B',      () => callOAI(P.cerebras,  trimmed, tokens)],
      ['Gemini',       'Flash',              () => callOAI(P.gemFlash,  trimmed, tokens)],
      ['Pollinations', 'openai',             () => callPollinations(trimmed, tokens)],
    ]
  } else if (mode === 'deep') {
    cascade = [
      ['Gemini',       'Flash',              () => callOAI(P.gemFlash,  trimmed, tokens)],
      ['Groq',         'Llama-3.3-70B',      () => callOAI(P.groq70b,   trimmed, tokens)],
      ['Cerebras',     'Llama-3.3-70B',      () => callOAI(P.cerebras,  trimmed, tokens)],
      ['Together',     'Llama-3.3-70B-Turbo',() => callOAI(P.together,  trimmed, tokens)],
      ['Mistral',      'Small',              () => callOAI(P.mistral,   trimmed, tokens)],
      ['Pollinations', 'openai',             () => callPollinations(trimmed, tokens)],
    ]
  } else {
    // Flash — speed > quality
    cascade = [
      ['Groq',         'Llama-3.1-8B',       () => callOAI(P.groq8b,    trimmed, tokens)],
      ['Groq',         'Llama-3.3-70B',      () => callOAI(P.groq70b,   trimmed, tokens)],
      ['Cerebras',     'Llama-3.3-70B',      () => callOAI(P.cerebras,  trimmed, tokens)],
      ['Gemini',       'Flash',              () => callOAI(P.gemFlash,  trimmed, tokens)],
      ['Together',     'Llama-3.3-70B-Turbo',() => callOAI(P.together,  trimmed, tokens)],
      ['Mistral',      'Small',              () => callOAI(P.mistral,   trimmed, tokens)],
      ['Cohere',       'Command-R',          () => callCohere(trimmed, tokens)],
      ['Fireworks',    'Llama-3.3-70B',      () => callOAI(P.fireworks, trimmed, tokens)],
      ['DeepInfra',    'Llama-3.1-70B',      () => callOAI(P.deepinfra, trimmed, tokens)],
      ['HuggingFace',  'Mistral-7B',         () => callOAI(P.huggingf,  trimmed, tokens)],
      ['Pollinations', 'openai',             () => callPollinations(trimmed, tokens)],
    ]
  }

  // 4. Try cascade — first success wins
  for (const [provider, model, fn] of cascade) {
    try {
      const text = await fn()
      if (text && text.length > 2) {
        const result: RouterResult = {
          text, provider, model,
          latencyMs: Date.now() - t0,
        }
        toCache(key, result, CACHE_TTL[mode])
        return result
      }
    } catch {
      // Silent → next provider
    }
  }

  // 5. Ultimate fallback — always works, no network needed
  const lastMsg = messages.filter(m => m.role === 'user').pop()?.content?.toLowerCase() ?? ''
  return {
    text: keywordFallback(lastMsg),
    provider: 'Offline',
    model: 'keyword',
    latencyMs: Date.now() - t0,
  }
}

// ── Smart autoRouteMode v2 — proactive suggestions ─────────
// Detects what the query actually needs, routes accordingly
// Saves Vercel invocations: simple queries never hit 'deep'
export function autoRouteMode(input: string): RouterMode {
  const l = input.toLowerCase()
  const words = l.trim().split(/\s+/).length

  // Nano: single words/greetings → flash (tiny tokens)
  if (words <= 2 || /^(hi|hello|hey|ok|thanks|bye|haan|nahi|acha)$/i.test(l.trim())) {
    return 'flash'
  }

  // Think: academic, math, reasoning, code
  if (/neet|jee|upsc|physics|chemistry|biology|math|derive|prove|solve|algorithm|debug|code.*explain|explain.*code|step.?by.?step|formula|theorem|numerica|kaise kaam/i.test(l)) {
    return 'think'
  }

  // Deep: real-time data needed
  if (/weather|news|search|image|movie|cricket|stock|crypto|live|today.*news|aaj.*news|current|price|rate/i.test(l)) {
    return 'deep'
  }

  // Default: flash (conversational)
  return 'flash'
}

// ── Proactive Suggestions ──────────────────────────────────
// JARVIS khud suggest karta hai based on query patterns
// No API calls — pure logic
export function getProactiveSuggestion(userMsg: string): string | null {
  const l = userMsg.toLowerCase()

  // If studying late night
  const h = new Date().getHours()
  if (h >= 23 || h <= 4) {
    if (/padh|study|notes|chapter|neet|jee/i.test(l)) {
      return '😴 Bhai, neend bhi padhai ka hissa hai. 7-8 ghante zaroor so — memory consolidation hoti hai. Kal fresh mind se padh.'
    }
  }

  // If asking same topic multiple times (repetitive learning pattern)
  if (/same|phir se|dobara|again|repeat|samajh nahi/i.test(l)) {
    return '💡 Tip: Is topic ko flashcard mein save karo — /study mein MCQ practice se better yaad rahega!'
  }

  // If frustrated
  if (/kuch nahi|samajh nahi|bura|fail|dar|tension|stress|pareshan|rona|give up/i.test(l)) {
    return '🤝 Yaar, sab ke saath hota hai. Ek 10 min break lo, phir wapas aao. Main hoon na.'
  }

  // Suggest voice for long questions
  if (userMsg.length > 150 && !/code|```/i.test(l)) {
    return '🎤 Itna lamba likha! /voice pe ja — bolke poochh, jaldi hoga.'
  }

  return null
}

// ── Keyword fallback (zero network) ───────────────────────
function keywordFallback(input: string): string {
  if (/hi|hello|hey|hii|namaste/i.test(input))
    return 'Hello! Main JARVIS hun. Network slow hai par main yahan hun. Kya chahiye? 😊'
  if (/time|samay|waqt/i.test(input))
    return `🕐 **${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}**`
  if (/date|aaj|today/i.test(input))
    return `📅 **${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}**`
  if (/neet|jee|exam/i.test(input))
    return 'NEET ki taiyari? 💪 /study pe jao — MCQs aur notes wahan hain!'
  if (/weather|mausam/i.test(input))
    return '🌤️ "weather Delhi" ya koi bhi city — live data laata hun!'
  if (/joke|funny/i.test(input))
    return '😂 Teacher: "Homework kahan hai?"\nStudent: "Sir, wind carried it away."\nTeacher: "Kaise?"\nStudent: "Sir, aapki handwriting dekh ke wind bhi bhaag gayi!" 😅'
  if (/motivat|himmat|sad|dukhi/i.test(input))
    return '💪 *"Har expert kabhi beginner tha."*\n\nTu kar sakta hai! 🔥'
  return '🔄 Network slow hai. Thodi der mein retry karo — main hoon na!'
}
