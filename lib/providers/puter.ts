/* lib/providers/puter.ts — Puter.js v2 — FREE GPT-5.4 + Gemini 3.1 + DALL-E 3 + FLUX + TTS */
'use client'

declare global {
  interface Window { puter?: any }
}

let loaded = false
let loading = false
const callbacks: Array<() => void> = []

export function loadPuter(): Promise<any> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(null); return }
    if (loaded && window.puter) { resolve(window.puter); return }
    if (loading) { callbacks.push(() => resolve(window.puter)); return }
    loading = true
    const check = setInterval(() => {
      if (window.puter) {
        clearInterval(check)
        loaded = true; loading = false
        callbacks.forEach(cb => cb()); callbacks.length = 0
        resolve(window.puter)
      }
    }, 200)
    setTimeout(() => { clearInterval(check); loading = false; resolve(null) }, 8000)
  })
}

// ── Text generation — Latest 2026 models FREE via Puter ─────────────
const PUTER_TEXT_MODELS = [
  'gpt-5.4-nano',         // GPT-5.4 Nano — fastest
  'gpt-5.3',              // GPT-5.3 — reliable
  'gemini-3-flash-preview', // Gemini 3 Flash — Google free
  'claude-3-5-haiku',     // Claude 3.5 Haiku — Anthropic free
  'deepseek-r1',          // DeepSeek R1 — reasoning
  'gpt-4o-mini',          // Fallback
]

export async function puterChat(prompt: string, systemPrompt?: string, model?: string): Promise<string | null> {
  try {
    const puter = await loadPuter()
    if (!puter?.ai?.chat) return null
    const m = model || PUTER_TEXT_MODELS[0]
    const messages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }]
      : [{ role: 'user', content: prompt }]
    const res = await puter.ai.chat(messages, { model: m })
    return typeof res === 'string' ? res : res?.message?.content || null
  } catch { return null }
}

// ── Image generation — DALL-E 3, FLUX.1, Gemini Flash Image ──────────
const PUTER_IMAGE_MODELS = [
  'dall-e-3',                          // Best quality
  'black-forest-labs/FLUX.1-schnell',  // Fast + good
  'gemini-2.5-flash-image-preview',    // Google Nano Banana
  'stabilityai/stable-diffusion-xl-base-1.0', // Reliable fallback
]

export async function puterImageGen(prompt: string, model?: string): Promise<string | null> {
  try {
    const puter = await loadPuter()
    if (!puter?.ai?.txt2img) return null
    const m = model || PUTER_IMAGE_MODELS[0]
    const imgEl = await puter.ai.txt2img(prompt, { model: m })
    if (!imgEl) return null
    // Extract src from returned element
    if (imgEl.src) return imgEl.src
    if (typeof imgEl === 'string') return imgEl
    return null
  } catch { return null }
}

// ── TTS — OpenAI quality voice ────────────────────────────────────────
export async function puterTTS(text: string): Promise<HTMLAudioElement | null> {
  try {
    const puter = await loadPuter()
    if (!puter?.ai?.txt2speech) return null
    const audio = await puter.ai.txt2speech(text.slice(0, 400), { provider: 'openai' })
    return audio || null
  } catch { return null }
}

// ── OCR / Image analysis ──────────────────────────────────────────────
export async function puterVision(imageUrl: string, question = 'What is in this image?'): Promise<string | null> {
  try {
    const puter = await loadPuter()
    if (!puter?.ai?.chat) return null
    const res = await puter.ai.chat(question, imageUrl, { model: 'gpt-4o-mini' })
    return typeof res === 'string' ? res : res?.message?.content || null
  } catch { return null }
}
