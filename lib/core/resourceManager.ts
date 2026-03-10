/* lib/core/resourceManager.ts — API Credit Tracker + Cache + Rate Limiter */

// ── Cache Store ───────────────────────────────────────────────────────────
interface CacheEntry {
  data: any;
  expiresAt: number;
}

const CACHE: Map<string, CacheEntry> = new Map();

// Cache TTLs (milliseconds)
const CACHE_TTL: Record<string, number> = {
  weather:     10 * 60 * 1000,   // 10 min
  forecast:    15 * 60 * 1000,   // 15 min
  news:         5 * 60 * 1000,   // 5 min
  crypto:      30 * 1000,        // 30 sec
  stock:        2 * 60 * 1000,   // 2 min
  currency:     5 * 60 * 1000,   // 5 min
  wiki:        60 * 60 * 1000,   // 1 hour
  movie:       60 * 60 * 1000,   // 1 hour
  recipe:      60 * 60 * 1000,   // 1 hour
  trivia:       5 * 60 * 1000,   // 5 min
  joke:         1 * 60 * 1000,   // 1 min
  quote:        5 * 60 * 1000,   // 5 min
  space:       15 * 60 * 1000,   // 15 min
  github:      10 * 60 * 1000,   // 10 min
  nasa:        60 * 60 * 1000,   // 1 hour
  iss:         10 * 1000,        // 10 sec (moves fast)
  pokemon:     24 * 60 * 60 * 1000, // 24 hours
  anime:       60 * 60 * 1000,   // 1 hour
  wordofday:   24 * 60 * 60 * 1000, // 24 hours
  fact:         5 * 60 * 1000,   // 5 min
  default:      5 * 60 * 1000,   // 5 min fallback
};

export function cacheGet(key: string): any | null {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    CACHE.delete(key);
    return null;
  }
  return entry.data;
}

export function cacheSet(key: string, data: any, tool = 'default'): void {
  const ttl = CACHE_TTL[tool] || CACHE_TTL.default;
  CACHE.set(key, { data, expiresAt: Date.now() + ttl });
}

export function cacheClear(): void {
  CACHE.clear();
}

export function cacheStats(): { size: number; keys: string[] } {
  return { size: CACHE.size, keys: Array.from(CACHE.keys()) };
}

// ── API Usage Tracker (per provider, per day) ────────────────────────────
interface UsageData {
  count: number;
  resetAt: number; // midnight timestamp
  limit: number;
}

const DAILY_LIMITS: Record<string, number> = {
  groq:          6000,
  gemini:        1500,
  together:      500,
  cerebras:      1000,
  mistral:       500,
  cohere:        1000,
  fireworks:     600,
  openrouter:    200,
  deepinfra:     500,
  huggingface:   1000,
  gnews:         100,
  newsapi:       100,
  omdb:          1000,
  nasa:          50,
  coingecko:     200,
  serper:        83,   // 2500/month ÷ 30
  ipapi:         33,   // 1000/day actually
};

// In-memory usage (resets on server restart, good enough for edge)
const USAGE: Map<string, UsageData> = new Map();

function getTodayMidnight(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

export function trackUsage(provider: string): boolean {
  const limit = DAILY_LIMITS[provider.toLowerCase()];
  if (!limit) return true; // unknown provider, allow

  const now = Date.now();
  let usage = USAGE.get(provider);

  // Reset if new day
  if (!usage || now > usage.resetAt) {
    usage = { count: 0, resetAt: getTodayMidnight(), limit };
    USAGE.set(provider, usage);
  }

  // Check 85% threshold
  const threshold = Math.floor(limit * 0.85);
  if (usage.count >= threshold) {
    console.warn(`[ResourceManager] ${provider} at ${Math.round(usage.count/limit*100)}% daily limit — skipping`);
    return false; // skip this provider
  }

  usage.count++;
  return true;
}

export function getUsageStats(): Record<string, { count: number; limit: number; pct: number }> {
  const stats: Record<string, { count: number; limit: number; pct: number }> = {};
  USAGE.forEach((val, key) => {
    stats[key] = {
      count: val.count,
      limit: val.limit,
      pct: Math.round(val.count / val.limit * 100),
    };
  });
  return stats;
}

// ── Lazy Tool Loader ──────────────────────────────────────────────────────
// Maps category → tool module loader (loaded only when needed)
type ToolModule = () => Promise<any>;

const TOOL_REGISTRY: Record<string, ToolModule> = {
  // These are dynamically imported only when category matches
  calculator:  () => Promise.resolve({ run: localCalculator }),
  qr:          () => Promise.resolve({ run: localQR }),
  password:    () => Promise.resolve({ run: localPassword }),
  converter:   () => Promise.resolve({ run: localConverter }),
  hash:        () => Promise.resolve({ run: localHash }),
  base64:      () => Promise.resolve({ run: localBase64 }),
  uuid:        () => Promise.resolve({ run: localUUID }),
  bmi:         () => Promise.resolve({ run: localBMI }),
  emi:         () => Promise.resolve({ run: localEMI }),
  sip:         () => Promise.resolve({ run: localSIP }),
  age:         () => Promise.resolve({ run: localAge }),
  gst:         () => Promise.resolve({ run: localGST }),
};

const loadedTools: Map<string, any> = new Map();

export async function loadTool(category: string): Promise<any | null> {
  if (loadedTools.has(category)) return loadedTools.get(category);
  const loader = TOOL_REGISTRY[category];
  if (!loader) return null;
  const mod = await loader();
  loadedTools.set(category, mod);
  return mod;
}

// ── Local (Zero-API) Tools ────────────────────────────────────────────────
function localCalculator(expr: string): string {
  try {
    const clean = expr.replace(/[^0-9+\-*/().\s^%]/g, '').trim();
    const result = Function(`'use strict'; return (${clean})`)();
    return `🧮 **Calculator**\n${expr} = **${result}**`;
  } catch {
    return `❌ Invalid expression: ${expr}`;
  }
}

function localQR(text: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
}

function localPassword(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let pwd = '';
  for (let i = 0; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return `🔒 **Generated Password** (${length} chars):\n\`${pwd}\`\n\n_Strength: Strong_`;
}

function localConverter(value: number, from: string, to: string): string {
  const conversions: Record<string, Record<string, number>> = {
    km:    { miles: 0.621371, m: 1000, cm: 100000 },
    miles: { km: 1.60934, m: 1609.34 },
    kg:    { lb: 2.20462, g: 1000, oz: 35.274 },
    lb:    { kg: 0.453592 },
    c:     { f: (v: number) => v * 9/5 + 32, k: (v: number) => v + 273.15 },
    f:     { c: (v: number) => (v - 32) * 5/9 },
    l:     { ml: 1000, gallon: 0.264172 },
  };
  const fromLower = from.toLowerCase();
  const toLower = to.toLowerCase();
  const conv = conversions[fromLower]?.[toLower];
  if (!conv) return `Cannot convert ${from} to ${to}`;
  const result = typeof conv === 'function' ? (conv as Function)(value) : value * (conv as number);
  return `📐 **Unit Converter**\n${value} ${from} = **${result.toFixed(4)} ${to}**`;
}

async function localHash(text: string): Promise<string> {
  if (typeof window === 'undefined') return 'Hash only available in browser';
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `🔐 **SHA-256 Hash:**\nInput: \`${text}\`\nHash: \`${hex}\``;
}

function localBase64(text: string, encode = true): string {
  try {
    if (encode) {
      const result = btoa(unescape(encodeURIComponent(text)));
      return `🔤 **Base64 Encode:**\nInput: \`${text}\`\nEncoded: \`${result}\``;
    } else {
      const result = decodeURIComponent(escape(atob(text)));
      return `🔤 **Base64 Decode:**\nEncoded: \`${text}\`\nDecoded: \`${result}\``;
    }
  } catch {
    return '❌ Invalid Base64 input';
  }
}

function localUUID(): string {
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  return `🆔 **UUID Generated:**\n\`${uuid}\``;
}

function localBMI(weight: number, height: number): string {
  const bmi = weight / ((height / 100) ** 2);
  const cat = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal ✅' : bmi < 30 ? 'Overweight' : 'Obese';
  return `⚖️ **BMI:** ${bmi.toFixed(1)} — ${cat}`;
}

function localEMI(principal: number, rate: number, months: number): string {
  const r = rate / 12 / 100;
  const emi = principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
  return `💰 **EMI:** ₹${Math.round(emi).toLocaleString('en-IN')}/month`;
}

function localSIP(monthly: number, rate: number, years: number): string {
  const months = years * 12;
  const r = rate / 12 / 100;
  const maturity = monthly * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
  return `📊 **SIP Maturity:** ₹${Math.round(maturity).toLocaleString('en-IN')}`;
}

function localAge(dob: string): string {
  const d = new Date(dob);
  const now = new Date();
  const years = Math.floor((now.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  return `🎂 **Age:** ${years} years`;
}

function localGST(amount: number, rate: number): string {
  const gst = (amount * rate / 100).toFixed(2);
  const total = (amount + parseFloat(gst)).toFixed(2);
  return `🧮 **GST:** ₹${gst} | Total: ₹${total}`;
}

// ── Smart Query Classifier ────────────────────────────────────────────────
// Decides whether to use local tool, API tool, or AI
export type QueryType = 'local' | 'api_tool' | 'ai_reason' | 'ai_simple';

export function classifyQuery(input: string): QueryType {
  const lower = input.toLowerCase();

  // Local tools — no API needed
  if (/calculate|calc|[\d\+\-\*\/]+|bmi|emi|sip|gst|convert|uuid|hash|base64|password generate|qr code/i.test(lower)) {
    return 'local';
  }

  // API tools — specific data needed
  if (/weather|news|crypto|bitcoin|stock|movie|recipe|wiki|translate|anime|pokemon|cricket|nasa|iss|space/i.test(lower)) {
    return 'api_tool';
  }

  // AI reasoning — complex
  if (/neet|jee|explain|solve|derive|prove|step by step|write|code|create|analyze|compare|essay/i.test(lower)) {
    return 'ai_reason';
  }

  return 'ai_simple';
}
