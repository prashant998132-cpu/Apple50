// lib/voice/wakeWord.ts — Wake Word Detection v1
// Continuous SpeechRecognition → wake word regex → trigger callback
// Chrome Android mein kaam karta hai, zero cost
'use client'

export type WakeWordCallback = () => void

const WAKE_WORDS = ['hey jarvis', 'jarvis', 'ok jarvis', 'jai jarvis', 'hey jarvish']

export class WakeWordDetector {
  private rec: any = null
  private active = false
  private onWake: WakeWordCallback
  private onPartial?: (text: string) => void
  private restartTimer: ReturnType<typeof setTimeout> | null = null

  constructor(onWake: WakeWordCallback, onPartial?: (text: string) => void) {
    this.onWake = onWake
    this.onPartial = onPartial
  }

  start(): boolean {
    if (typeof window === 'undefined') return false
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return false
    if (this.active) return true
    try {
      this.rec = new SR()
      this.rec.continuous = true
      this.rec.interimResults = true
      this.rec.lang = 'hi-IN'
      this.rec.maxAlternatives = 1

      this.rec.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const text = e.results[i][0].transcript.toLowerCase().trim()
          this.onPartial?.(text)
          if (WAKE_WORDS.some(w => text.includes(w))) {
            this.onWake()
            try { this.rec?.stop() } catch {}
          }
        }
      }

      this.rec.onend = () => {
        if (this.active) {
          this.restartTimer = setTimeout(() => { try { this.rec?.start() } catch {} }, 300)
        }
      }

      this.rec.onerror = (e: any) => {
        if (e.error === 'not-allowed') { this.active = false; return }
        if (this.active) {
          this.restartTimer = setTimeout(() => { try { this.rec?.start() } catch {} }, 1000)
        }
      }

      this.rec.start()
      this.active = true
      return true
    } catch { return false }
  }

  stop() {
    this.active = false
    if (this.restartTimer) clearTimeout(this.restartTimer)
    try { this.rec?.stop() } catch {}
    this.rec = null
  }

  isActive() { return this.active }
}

let _detector: WakeWordDetector | null = null

export function startWakeWord(onWake: WakeWordCallback, onPartial?: (t: string) => void): boolean {
  if (_detector?.isActive()) return true
  _detector = new WakeWordDetector(onWake, onPartial)
  return _detector.start()
}

export function stopWakeWord() { _detector?.stop(); _detector = null }
export function isWakeWordActive() { return _detector?.isActive() ?? false }
