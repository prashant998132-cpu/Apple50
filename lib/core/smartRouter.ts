/* lib/core/smartRouter.ts
 *
 * PHILOSOPHY (API Cost Optimization):
 *   1. classifyQuery PEHLE  → local ho toh zero API
 *   2. 85% limit check      → provider skip karo, next pe ja
 *   3. Token budget         → nano/simple/normal/deep/research
 *   4. Cascade              → Groq → Gemini → Together → ... → Pollinations → Puter
 *   5. Guarantee            → Keyword fallback (offline bhi chale)
 */

export type RouterMode = 'flash' | 'think' | 'deep';

interface Message { role: 'user' | 'assistant' | 'system'; content: string; }

export interface RouterResult {
  text: string;
  provider: string;
  model: string;
  tokensUsed?: number;
  fromCache?: boolean;
}

// ── Daily Usage Tracker (85% Rule) ────────────────────────────────────────
// Resets at midnight. Edge runtime: in-memory is fine.
interface Usage { count: number; resetAt: number; }
const USAGE = new Map<string, Usage>();

const DAILY_LIMITS: Record<string, number> = {
  groq:         6000,
  gemini:       1500,
  together:     500,
  cerebras:     1000,
  mistral:      500,
  cohere:       1000,
  fireworks:    600,
  openrouter:   200,
  deepinfra:    500,
  huggingface:  1000,
  pollinations: 999999, // unlimited
};

function canUse(provider: string): boolean {
  const limit = DAILY_LIMITS[provider];
  if (!limit) return true;
  const now = Date.now();
  let u = USAGE.get(provider);
  if (!u || now > u.resetAt) {
    const midnight = new Date(); midnight.setHours(0,0,0,0); midnight.setDate(midnight.getDate()+1);
    u = { count: 0, resetAt: midnight.getTime() };
    USAGE.set(provider, u);
  }
  // 85% rule — skip before full exhaustion
  if (u.count >= Math.floor(limit * 0.85)) return false;
  u.count++;
  return true;
}

export function getUsage(): Record<string, { count: number; limit: number; pct: number }> {
  const result: Record<string, { count: number; limit: number; pct: number }> = {};
  USAGE.forEach((v, k) => {
    const limit = DAILY_LIMITS[k] ?? 999;
    result[k] = { count: v.count, limit, pct: Math.round(v.count / limit * 100) };
  });
  return result;
}

// ── Response Cache (same query → zero API) ─────────────────────────────────
interface CacheEntry { text: string; provider: string; model: string; expiresAt: number; }
const RESPONSE_CACHE = new Map<string, CacheEntry>();

function getCacheKey(messages: Message[], mode: RouterMode): string {
  const last = messages.filter(m => m.role === 'user').pop()?.content ?? '';
  return `${mode}:${last.slice(0, 80)}`;
}

function getFromCache(key: string): RouterResult | null {
  const e = RESPONSE_CACHE.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { RESPONSE_CACHE.delete(key); return null; }
  return { text: e.text, provider: e.provider, model: e.model, fromCache: true };
}

function setCache(key: string, result: RouterResult, ttlMs = 30000): void {
  // Only cache flash responses, not think/deep (they may need fresh reasoning)
  RESPONSE_CACHE.set(key, { ...result, expiresAt: Date.now() + ttlMs });
  if (RESPONSE_CACHE.size > 100) {
    // Evict oldest
    const oldest = RESPONSE_CACHE.keys().next().value;
    if (oldest) RESPONSE_CACHE.delete(oldest);
  }
}

// ── Token saving: trim system prompt for simple queries ────────────────────
function buildMessages(messages: Message[], mode: RouterMode, maxHistory: number): Message[] {
  const system = messages.find(m => m.role === 'system');
  const history = messages.filter(m => m.role !== 'system').slice(-maxHistory);
  return system ? [system, ...history] : history;
}

function getMaxHistory(mode: RouterMode, msgCount: number): number {
  if (mode === 'flash') return Math.min(6, msgCount);
  if (mode === 'think') return Math.min(10, msgCount);
  return Math.min(8, msgCount); // deep
}

// ── Provider configs ───────────────────────────────────────────────────────
const P = {
  groq8b:    { url: 'https://api.groq.com/openai/v1/chat/completions',                                          model: 'llama-3.1-8b-instant',                             key: () => process.env.GROQ_API_KEY,        name: 'groq' },
  groq70b:   { url: 'https://api.groq.com/openai/v1/chat/completions',                                          model: 'llama-3.3-70b-versatile',                          key: () => process.env.GROQ_API_KEY,        name: 'groq' },
  groqR1:    { url: 'https://api.groq.com/openai/v1/chat/completions',                                          model: 'deepseek-r1-distill-llama-70b',                    key: () => process.env.GROQ_API_KEY,        name: 'groq' },
  gemFlash:  { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',                  model: 'gemini-2.0-flash',                                 key: () => process.env.GEMINI_API_KEY,      name: 'gemini' },
  gemThink:  { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',                  model: 'gemini-2.0-flash-thinking-exp',                    key: () => process.env.GEMINI_API_KEY,      name: 'gemini' },
  together:  { url: 'https://api.together.xyz/v1/chat/completions',                                              model: 'meta-llama/Llama-3-70b-chat-hf',                   key: () => process.env.TOGETHER_API_KEY,    name: 'together' },
  cerebras:  { url: 'https://api.cerebras.ai/v1/chat/completions',                                               model: 'llama3.1-70b',                                     key: () => process.env.CEREBRAS_API_KEY,    name: 'cerebras' },
  mistral:   { url: 'https://api.mistral.ai/v1/chat/completions',                                                model: 'mistral-small-latest',                             key: () => process.env.MISTRAL_API_KEY,     name: 'mistral' },
  fireworks: { url: 'https://api.fireworks.ai/inference/v1/chat/completions',                                    model: 'accounts/fireworks/models/llama-v3p1-70b-instruct', key: () => process.env.FIREWORKS_API_KEY,   name: 'fireworks' },
  openroute: { url: 'https://openrouter.ai/api/v1/chat/completions',                                             model: 'deepseek/deepseek-r1:free',                        key: () => process.env.OPENROUTER_API_KEY,  name: 'openrouter' },
  deepinfra: { url: 'https://api.deepinfra.com/v1/openai/chat/completions',                                      model: 'meta-llama/Meta-Llama-3-70B-Instruct',             key: () => process.env.DEEPINFRA_API_KEY,   name: 'deepinfra' },
  huggingf:  { url: 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions', model: 'mistralai/Mistral-7B-Instruct-v0.3', key: () => process.env.HUGGINGFACE_API_KEY, name: 'huggingface' },
};

// ── OpenAI-compat call ─────────────────────────────────────────────────────
async function callOAI(
  cfg: { url: string; model: string; key: () => string | undefined; name: string },
  msgs: Message[],
  maxTokens: number,
  signal?: AbortSignal,
): Promise<string> {
  const key = cfg.key();
  if (!key) throw new Error(`No key: ${cfg.name}`);
  if (!canUse(cfg.name)) throw new Error(`${cfg.name} at 85% limit`);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  const sig = signal ?? ctrl.signal;

  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: cfg.model, messages: msgs, max_tokens: maxTokens, temperature: 0.7 }),
      signal: sig,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`${res.status}`);
    const d = await res.json();
    const text = d?.choices?.[0]?.message?.content ?? d?.choices?.[0]?.text;
    if (!text?.trim()) throw new Error('Empty');
    return text.trim();
  } finally { clearTimeout(timer); }
}

// ── Cohere special format ──────────────────────────────────────────────────
async function callCohere(msgs: Message[], maxTokens: number, signal?: AbortSignal): Promise<string> {
  const key = process.env.COHERE_API_KEY;
  if (!key) throw new Error('No Cohere key');
  if (!canUse('cohere')) throw new Error('cohere at 85% limit');

  const userMsg = msgs.filter(m => m.role === 'user').pop()?.content ?? '';
  const history = msgs.filter(m => m.role !== 'user' && m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'CHATBOT' : 'USER', message: m.content,
  }));

  const res = await fetch('https://api.cohere.com/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ message: userMsg, chat_history: history, model: 'command-r', max_tokens: maxTokens }),
    signal,
  });
  if (!res.ok) throw new Error(`Cohere ${res.status}`);
  const d = await res.json();
  return d?.text ?? '';
}

// ── Pollinations (UNLIMITED free — no key needed) ─────────────────────────
async function callPollinations(msgs: Message[], maxTokens: number, signal?: AbortSignal): Promise<string> {
  const res = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai', messages: msgs, max_tokens: maxTokens }),
    signal,
  });
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);
  const d = await res.json();
  const text = d?.choices?.[0]?.message?.content;
  if (!text?.trim()) throw new Error('Empty Pollinations');
  return text.trim();
}

// ── MAIN ROUTER ────────────────────────────────────────────────────────────
export async function smartRouter(
  messages: Message[],
  mode: RouterMode = 'flash',
  maxTokens = 350,
  signal?: AbortSignal,
): Promise<RouterResult> {

  // 1. Check cache first (zero API for repeated queries)
  const cacheKey = getCacheKey(messages, mode);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // 2. Trim history to save tokens
  const maxHist = getMaxHistory(mode, messages.length);
  const trimmedMsgs = buildMessages(messages, mode, maxHist);

  // 3. Build cascade based on mode
  type CascadeEntry = [string, string, () => Promise<string>];
  let cascade: CascadeEntry[];

  if (mode === 'think' || mode === 'deep') {
    // Reasoning-first cascade — DeepSeek R1 pehle (Groq pe free)
    cascade = [
      ['Groq',        'DeepSeek-R1',     () => callOAI(P.groqR1,    trimmedMsgs, maxTokens, signal)],
      ['OpenRouter',  'DeepSeek-R1',     () => callOAI(P.openroute, trimmedMsgs, maxTokens, signal)],
      ['Gemini',      'Flash-Thinking',  () => callOAI(P.gemThink,  trimmedMsgs, maxTokens, signal)],
      ['Together',    'Llama-3-70B',     () => callOAI(P.together,  trimmedMsgs, maxTokens, signal)],
      ['Gemini',      'Flash',           () => callOAI(P.gemFlash,  trimmedMsgs, maxTokens, signal)],
      ['Pollinations','openai',          () => callPollinations(trimmedMsgs, maxTokens, signal)],
    ];
  } else {
    // Flash cascade — speed + cost priority
    // Skip providers with no key immediately (saves timeout wait)
    cascade = [
      // 8b first — fastest, cheapest
      ['Groq',       'Llama-3.1-8B',    () => callOAI(P.groq8b,   trimmedMsgs, maxTokens, signal)],
      // 70b if 8b fails
      ['Groq',       'Llama-3.3-70B',   () => callOAI(P.groq70b,  trimmedMsgs, maxTokens, signal)],
      ['Cerebras',   'Llama-3.1-70B',   () => callOAI(P.cerebras, trimmedMsgs, maxTokens, signal)],
      ['Together',   'Llama-3-70B',     () => callOAI(P.together, trimmedMsgs, maxTokens, signal)],
      ['Gemini',     'Flash',           () => callOAI(P.gemFlash, trimmedMsgs, maxTokens, signal)],
      ['Mistral',    'Small',           () => callOAI(P.mistral,  trimmedMsgs, maxTokens, signal)],
      ['Cohere',     'Command-R',       () => callCohere(trimmedMsgs, maxTokens, signal)],
      ['Fireworks',  'Llama-3-70B',     () => callOAI(P.fireworks,trimmedMsgs, maxTokens, signal)],
      ['DeepInfra',  'Llama-3-70B',     () => callOAI(P.deepinfra,trimmedMsgs, maxTokens, signal)],
      ['HuggingFace','Mistral-7B',      () => callOAI(P.huggingf, trimmedMsgs, maxTokens, signal)],
      ['Pollinations','openai',         () => callPollinations(trimmedMsgs, maxTokens, signal)],
    ];
  }

  // 4. Try each provider
  for (const [provider, model, fn] of cascade) {
    try {
      const text = await fn();
      if (text && text.length > 2) {
        const result: RouterResult = { text, provider, model };
        // Cache flash responses for 30 seconds (repeat queries = zero API)
        if (mode === 'flash') setCache(cacheKey, result, 30_000);
        return result;
      }
    } catch {
      // Silent fail → try next provider
    }
  }

  // 5. Ultimate offline fallback (keyword responses — zero API)
  const lastMsg = messages.filter(m => m.role === 'user').pop()?.content?.toLowerCase() ?? '';
  return {
    text: keywordFallback(lastMsg),
    provider: 'Offline-Fallback',
    model: 'keyword',
  };
}

// ── Offline keyword fallback ───────────────────────────────────────────────
function keywordFallback(input: string): string {
  if (/hi|hello|hii|hey|namaste/i.test(input))
    return 'Hello! Main JARVIS hun. Abhi network thoda slow hai, par main yahan hun. Kya chahiye? 😊';
  if (/time|samay|waqt/i.test(input))
    return `🕐 Abhi: **${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}**`;
  if (/date|aaj|today/i.test(input))
    return `📅 Aaj: **${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}**`;
  if (/neet|jee|exam|study/i.test(input))
    return 'NEET ki taiyari kar rahe ho? 💪 /study pe jao — MCQs milenge. Keep going!';
  if (/weather|mausam|temperature/i.test(input))
    return '🌤️ "weather [city name]" likho — main live data laata hun.';
  if (/joke|funny|hasao/i.test(input))
    return '😂 Teacher: "Apna homework do."\nStudent: "Kutta kha gaya."\nTeacher: "Kutta? Class mein lao usse!"\nStudent: "Sir, wo bhi absent hai!" 😅';
  if (/motivat|inspire|himmat/i.test(input))
    return '💪 *"Mushkilein aati hain taaki hum strong banen."*\n\nTu kar sakta hai! JARVIS believes in you. 🔥';
  if (/capital|rajdhani/i.test(input))
    return '📍 India ki rajdhani: **New Delhi**. Kisi specific country ke baare mein poochho!';
  return '🔄 Network slow hai. Settings mein API keys add karo ya thodi der mein retry karo. Main hamesha yahan hun!';
}
