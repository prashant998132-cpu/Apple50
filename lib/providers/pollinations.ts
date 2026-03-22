// lib/providers/pollinations.ts — Pollinations FREE AI — No key, no signup
// Image: Flux, GPT-Image, Seedream, Kontext
// Text: OpenAI, Mistral, Gemini, DeepSeek, Claude
// Audio: TTS + STT
'use client'

const IMG_BASE = 'https://image.pollinations.ai/prompt'
const TXT_BASE = 'https://text.pollinations.ai'
const FEED_BASE = 'https://text.pollinations.ai/openai'

// ── IMAGE MODELS ─────────────────────────────────────────────────────
export const IMAGE_MODELS = {
  flux:          { id: 'flux',           label: 'FLUX Schnell (Fast)',  quality: 'good'    },
  'flux-pro':    { id: 'flux-pro',       label: 'FLUX Pro (HD)',        quality: 'best'    },
  'flux-2-dev':  { id: 'flux-2-dev',     label: 'FLUX.2 Dev (Alpha)',   quality: 'best'    },
  dirtberry:     { id: 'dirtberry',      label: 'Dirtberry (Alpha)',    quality: 'creative'},
  zimage:        { id: 'zimage',         label: 'Z-Image Turbo',        quality: 'fast'    },
  gptimage:      { id: 'gptimage',       label: 'GPT Image 1 Mini',     quality: 'best'    },
  seedream:      { id: 'seedream',       label: 'Seedream 4.0',         quality: 'artistic'},
  'seedream-5':  { id: 'seedream5',      label: 'Seedream 5.0 Lite',    quality: 'artistic'},
  grok:          { id: 'grok-imagine',   label: 'Grok Imagine (Alpha)', quality: 'creative'},
  imagen:        { id: 'imagen-4',       label: 'Google Imagen 4',      quality: 'best'    },
} as const

export function pollinationsImage(
  prompt: string,
  opts: { model?: string; width?: number; height?: number; seed?: number; enhance?: boolean } = {}
): string {
  const { model = 'flux', width = 1024, height = 1024, seed, enhance = false } = opts
  let url = `${IMG_BASE}/${encodeURIComponent(prompt)}?width=${width}&height=${height}&model=${model}&nologo=true`
  if (seed) url += `&seed=${seed}`
  if (enhance) url += '&enhance=true'
  return url
}

// ── TEXT MODELS ──────────────────────────────────────────────────────
export const TEXT_MODELS = {
  openai:          { id: 'openai',          label: 'GPT-4o (Best)'          },
  mistral:         { id: 'mistral',         label: 'Mistral (Fast)'          },
  gemini:          { id: 'gemini',          label: 'Gemini Flash'            },
  claude:          { id: 'claude-hybridspace', label: 'Claude'              },
  deepseek:        { id: 'deepseek',        label: 'DeepSeek (Reasoning)'   },
  llama:           { id: 'llama',           label: 'Llama 3 (Open)'         },
  searchgpt:       { id: 'searchgpt',       label: 'SearchGPT (Live Web)'   },
  'gemini-search': { id: 'gemini-search',   label: 'Gemini + Live Web'      },
  qwen:            { id: 'qwen',            label: 'Qwen (Fast)'             },
  'nano-banana':   { id: 'nanoBanana',      label: 'NanoBanana (Compact)'   },
} as const

export async function pollinationsText(
  prompt: string,
  opts: { model?: string; system?: string; seed?: number } = {}
): Promise<string> {
  const { model = 'openai', system, seed } = opts
  try {
    const messages = []
    if (system) messages.push({ role: 'system', content: system })
    messages.push({ role: 'user', content: prompt })

    const res = await fetch(FEED_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, seed: seed || Math.floor(Math.random() * 9999) }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(res.status.toString())
    const d = await res.json()
    return d.choices?.[0]?.message?.content || ''
  } catch {
    // Simple GET fallback
    try {
      const url = `${TXT_BASE}/${encodeURIComponent(prompt)}?model=${model}`
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      return await res.text()
    } catch { return '' }
  }
}

// ── AUDIO TTS ────────────────────────────────────────────────────────
export const TTS_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']

export function pollinationsTTSUrl(text: string, voice = 'nova'): string {
  return `${TXT_BASE}/${encodeURIComponent(text)}?model=openai-audio&voice=${voice}`
}

export async function pollinationsSpeak(text: string, voice = 'nova'): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    const url = pollinationsTTSUrl(text.slice(0, 200), voice)
    const audio = new Audio(url)
    audio.play()
    return true
  } catch { return false }
}

// ── SMART ROUTING — best model for task ─────────────────────────────
export async function pollinationsSmart(
  prompt: string,
  task: 'chat' | 'search' | 'reason' | 'creative' | 'code' = 'chat',
  systemPrompt?: string
): Promise<string> {
  const modelMap = {
    chat:     'openai',
    search:   'gemini-search',  // Has live web access
    reason:   'deepseek',       // Best reasoning
    creative: 'mistral',
    code:     'openai',
  }
  return pollinationsText(prompt, { model: modelMap[task], system: systemPrompt })
}
