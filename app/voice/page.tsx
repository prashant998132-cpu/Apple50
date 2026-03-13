'use client'
import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { speakText, stopSpeaking } from '@/lib/tts'
import { buildSystemPrompt } from '@/lib/personality'
import { saveChat } from '@/lib/db'

interface Msg { role: 'user' | 'assistant'; content: string }

export default function VoicePage() {
  const router = useRouter()
  const [history, setHistory] = useState<Msg[]>([])
  const [transcript, setTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const [loading, setLoading] = useState(false)
  const [provider, setProvider] = useState('')
  const [error, setError] = useState('')
  const [autoSpeak, setAutoSpeak] = useState(true)

  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const startBrowserSTT = (): boolean => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return false
    const rec = new SR()
    rec.lang = 'hi-IN'; rec.continuous = false; rec.interimResults = true
    let final = ''
    rec.onresult = (e: any) => {
      final = Array.from(e.results).map((r: any) => r[0].transcript).join('')
      setTranscript(final)
    }
    rec.onerror = async () => { rec.stop(); await startWhisperSTT() }
    rec.onend = async () => { setListening(false); if (final.trim()) await sendToJARVIS(final.trim()) }
    rec.start()
    recognitionRef.current = rec
    setProvider('Browser STT')
    return true
  }

  const startWhisperSTT = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop()); setListening(false)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const form = new FormData(); form.append('audio', blob, 'voice.webm'); form.append('lang', 'hi')
        setLoading(true); setProvider('Groq Whisper')
        try {
          const res = await fetch('/api/stt', { method: 'POST', body: form })
          const d = await res.json()
          if (d.text) { setTranscript(d.text); await sendToJARVIS(d.text) }
          else setError(d.error || 'Whisper ne kuch nahi suna.')
        } catch { setError('STT failed. Dobara try karo.') }
        setLoading(false)
      }
      mediaRecorderRef.current = mr; mr.start(); setListening(true); setProvider('Groq Whisper')
      setTimeout(() => { if (mr.state === 'recording') mr.stop() }, 10000)
    } catch { setError('Microphone permission chahiye!'); setListening(false) }
  }

  const startListening = async () => {
    setTranscript(''); setError('')
    const ok = startBrowserSTT()
    if (!ok) await startWhisperSTT()
    else setListening(true)
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    mediaRecorderRef.current?.stop()
    setListening(false)
  }

  const sendToJARVIS = async (text: string) => {
    if (!text.trim()) return
    const newHistory: Msg[] = [...history, { role: 'user', content: text }]
    setHistory(newHistory)
    setLoading(true)
    try {
      const systemPrompt = await buildSystemPrompt().catch(() =>
        'You are JARVIS. Hinglish mein baat karo. Voice response ke liye short rakho — 2-3 sentences max.'
      )
      // Keep last 6 msgs for context
      const contextMsgs = newHistory.slice(-6)
      const res = await fetch('/api/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: contextMsgs, mode: 'flash', systemPrompt }),
      })
      const reader = res.body!.getReader(); const decoder = new TextDecoder(); let full = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ')) {
            try { const d = JSON.parse(line.slice(6)); if (d.type === 'delta') full += d.text } catch {}
          }
        }
      }
      if (full) {
        setHistory(prev => [...prev, { role: 'assistant', content: full }])
        if (autoSpeak) speakText(full)
        // Save to db
        saveChat({ role: 'user', content: text, timestamp: Date.now(), mode: 'voice' }).catch(() => {})
        saveChat({ role: 'assistant', content: full, timestamp: Date.now(), mode: 'voice' }).catch(() => {})
      }
    } catch { setError('JARVIS se connect nahi ho paya.') }
    setLoading(false)
  }

  return (
    <div style={{ background: '#060610', height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e', flexShrink: 0 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>🎙️ Voice Mode</div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ color: '#444', fontSize: 10 }}>{provider}</div>
          <button onClick={() => setAutoSpeak(!autoSpeak)}
            style={{ background: autoSpeak ? 'rgba(0,212,255,0.1)' : '#111', border: `1px solid ${autoSpeak ? '#00d4ff' : '#333'}`, borderRadius: 6, color: autoSpeak ? '#00d4ff' : '#555', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
            {autoSpeak ? '🔊 Auto' : '🔇 Mute'}
          </button>
          {history.length > 0 && (
            <button onClick={() => { setHistory([]); stopSpeaking() }}
              style={{ background: 'none', border: '1px solid #333', borderRadius: 6, color: '#444', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Conversation history */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {history.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#333' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎙️</div>
            <div style={{ fontSize: 14 }}>Mic tap karo aur JARVIS se baat karo</div>
            <div style={{ fontSize: 11, marginTop: 6 }}>Hindi, English, Hinglish — sab chalega</div>
          </div>
        )}
        {history.map((m, i) => (
          <div key={i} style={{ marginBottom: 10, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%', borderRadius: 12, padding: '10px 14px',
              background: m.role === 'user' ? 'rgba(0,212,255,0.12)' : '#0f0f1a',
              border: m.role === 'user' ? '1px solid rgba(0,212,255,0.3)' : '1px solid #1e1e2e',
              color: m.role === 'user' ? '#b0e0ff' : '#c8e8ff', fontSize: 14, lineHeight: 1.6,
            }}>
              {m.content}
              {m.role === 'assistant' && (
                <button onClick={() => speakText(m.content)}
                  style={{ display: 'block', marginTop: 6, background: 'none', border: 'none', color: '#333', fontSize: 11, cursor: 'pointer', padding: 0 }}>
                  🔊 Phir sunao
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 6, padding: '10px 0' }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#00d4ff', opacity: 0.6, animation: `pulse 1.2s ${i*0.2}s infinite` }} />)}
          </div>
        )}
        {transcript && !loading && (
          <div style={{ color: '#444', fontSize: 12, fontStyle: 'italic', marginBottom: 8 }}>
            🎙️ "{transcript}"
          </div>
        )}
        {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 10, color: '#ef4444', fontSize: 12 }}>⚠️ {error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Mic button */}
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, borderTop: '1px solid #1e1e2e', flexShrink: 0 }}>
        <button
          onClick={listening ? stopListening : startListening}
          disabled={loading}
          style={{
            width: 70, height: 70, borderRadius: '50%', fontSize: 28,
            background: listening ? 'radial-gradient(circle, rgba(239,68,68,0.3), rgba(239,68,68,0.1))' : 'radial-gradient(circle, rgba(0,212,255,0.2), rgba(0,212,255,0.05))',
            border: listening ? '2px solid #ef4444' : '2px solid #00d4ff',
            cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.3s',
          }}>
          {loading ? '⏳' : listening ? '⏹️' : '🎙️'}
        </button>
        <div style={{ color: '#444', fontSize: 12 }}>
          {listening ? '🔴 Sun raha hun...' : loading ? '⏳ Soch raha hun...' : 'Tap to speak'}
        </div>
        <button onClick={stopSpeaking} style={{ background: 'none', border: '1px solid #1e1e2e', borderRadius: 8, color: '#333', padding: '5px 16px', cursor: 'pointer', fontSize: 12 }}>
          🔇 Stop Speaking
        </button>
      </div>
    </div>
  )
}
