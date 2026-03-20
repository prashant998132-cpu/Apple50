// lib/tts.ts — Smart TTS v3 — 4 providers, auto-fallback
// Priority: ElevenLabs → Pollinations audio → Puter TTS → Web Speech
'use client'

let currentAudio: HTMLAudioElement | null = null
let currentUtterance: SpeechSynthesisUtterance | null = null

export function stopSpeaking(): void {
  if (typeof window === 'undefined') return
  currentAudio?.pause()
  currentAudio = null
  window.speechSynthesis?.cancel()
  currentUtterance = null
}

function cleanText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, 'Code block.')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[|`#*_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400)
}

// Main speak function — tries all providers
export async function speakText(text: string, onEnd?: () => void): Promise<void> {
  if (typeof window === 'undefined') return
  stopSpeaking()
  const clean = cleanText(text)
  if (!clean) return

  // Get user preference from localStorage
  const pref = localStorage.getItem('jarvis_tts_provider') || 'auto'
  const elKey = localStorage.getItem('jarvis_key_ELEVENLABS_API_KEY')
  const voice = localStorage.getItem('jarvis_tts_voice') || 'nova'

  // 1. Try server TTS route (ElevenLabs → Pollinations)
  if (pref !== 'browser') {
    try {
      const clientKeys: Record<string,string> = {}
      if (elKey) clientKeys.ELEVENLABS_API_KEY = elKey
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, voice, provider: pref, clientKeys }),
        signal: AbortSignal.timeout(15000),
      })
      if (res.ok) {
        const ct = res.headers.get('Content-Type') || ''
        if (ct.includes('audio')) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const audio = new Audio(url)
          currentAudio = audio
          audio.onended = () => { URL.revokeObjectURL(url); onEnd?.() }
          await audio.play()
          return
        } else {
          // Fallback signal from server
          const d = await res.json()
          if (d.fallback === 'webspeech') speakBrowser(d.text || clean, voice, onEnd)
          return
        }
      }
    } catch {}
  }

  // 2. Puter TTS
  if (pref !== 'browser') {
    try {
      const puter = (window as any).puter
      if (puter?.ai?.txt2speech) {
        const audio = await puter.ai.txt2speech(clean, { provider: 'openai' })
        if (audio) {
          currentAudio = audio
          audio.onended = onEnd
          audio.play()
          return
        }
      }
    } catch {}
  }

  // 3. Browser Web Speech (always works, robotic but free)
  speakBrowser(clean, voice, onEnd)
}

function speakBrowser(text: string, voice: string, onEnd?: () => void): void {
  if (!window.speechSynthesis) return
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'en-IN'
  utter.rate = 1.05
  utter.pitch = voice === 'onyx' ? 0.8 : 1.0
  utter.volume = 1.0

  // Try to pick a good voice
  const voices = window.speechSynthesis.getVoices()
  const preferred = voices.find(v => v.lang.includes('en') && v.name.includes('India'))
    || voices.find(v => v.lang.includes('en-IN'))
    || voices.find(v => v.lang.startsWith('en'))
  if (preferred) utter.voice = preferred

  utter.onend = onEnd || null
  currentUtterance = utter
  window.speechSynthesis.speak(utter)
}
