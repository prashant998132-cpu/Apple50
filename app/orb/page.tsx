'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const JarvisOrb = dynamic(() => import('@/components/JarvisOrb'), { ssr: false })

type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

export default function OrbPage() {
  const router = useRouter()
  const [orbState, setOrbState] = useState<OrbState>('idle')
  const [audioLevel, setAudioLevel] = useState(0)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{role:string,content:string}[]>([])
  const [loading, setLoading] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)

  // Audio level analyzer
  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length
        setAudioLevel(avg / 128)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch {}
  }

  const stopAudio = () => {
    cancelAnimationFrame(rafRef.current)
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    setAudioLevel(0)
  }

  const handleOrbTap = async () => {
    if (orbState === 'idle') {
      setOrbState('listening')
      await startAudioAnalysis()
      // Auto stop after 5s
      setTimeout(() => {
        stopAudio()
        setOrbState('idle')
      }, 5000)
    } else if (orbState === 'listening') {
      stopAudio()
      setOrbState('idle')
    }
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    setOrbState('thinking')

    try {
      const groqKey = typeof window !== 'undefined' ? localStorage.getItem('jarvis_key_GROQ_API_KEY') : null
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))

      let reply = ''
      if (groqKey) {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + groqKey },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'Tu JARVIS hai. Tony Stark ka AI. Hinglish mein baat kar. Short, confident answers. Max 2-3 lines.' },
              ...history,
              { role: 'user', content: text }
            ],
            max_tokens: 150,
          }),
          signal: AbortSignal.timeout(15000),
        })
        const d = await res.json()
        reply = d.choices?.[0]?.message?.content || ''
      }

      if (!reply) {
        const res = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'openai', messages: [
            { role: 'system', content: 'Tu JARVIS hai. Hinglish. Short answers.' },
            { role: 'user', content: text }
          ]}),
          signal: AbortSignal.timeout(20000),
        })
        const d = await res.json()
        reply = d.choices?.[0]?.message?.content || 'Haan boss?'
      }

      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      setOrbState('speaking')

      // TTS
      try {
        const audio = new Audio('https://text.pollinations.ai/' + encodeURIComponent(reply.slice(0,200)) + '?model=openai-audio&voice=alloy')
        audio.onplay = () => setOrbState('speaking')
        audio.onended = () => setOrbState('idle')
        audio.onerror = () => setOrbState('idle')
        await audio.play()
      } catch { setOrbState('idle') }

    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Net slow hai boss.' }])
      setOrbState('idle')
    }
    setLoading(false)
  }

  useEffect(() => () => { stopAudio() }, [])

  const stateLabel = {
    idle: 'Tap to speak',
    listening: 'Listening... tap to stop',
    thinking: 'Thinking...',
    speaking: 'Speaking...',
  }

  return (
    <div style={{ background: '#04040c', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>

      {/* Animated background */}
      <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(0,50,120,0.3) 0%, rgba(0,0,20,0) 70%)', pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '12px 16px', zIndex: 10 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>
          {'<-'}
        </button>
        <div style={{ flex: 1, textAlign: 'center', color: '#00d4ff', fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>
          JARVIS
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* Orb area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40, paddingBottom: 20 }}>
        <JarvisOrb
          state={orbState}
          size={220}
          audioLevel={audioLevel}
          onTap={handleOrbTap}
        />

        <div style={{ color: '#334', fontSize: 12, letterSpacing: 1, textAlign: 'center' }}>
          {stateLabel[orbState]}
        </div>

        {/* Last message */}
        {messages.length > 0 && (
          <div style={{ maxWidth: 300, textAlign: 'center' }}>
            <div style={{ color: '#556', fontSize: 11, marginBottom: 4 }}>
              {messages[messages.length-1].role === 'user' ? 'You' : 'JARVIS'}
            </div>
            <div style={{ color: messages[messages.length-1].role === 'assistant' ? '#00d4ff' : '#aaa', fontSize: 14, lineHeight: 1.6 }}>
              {messages[messages.length-1].content}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ width: '100%', padding: '12px 16px 20px', zIndex: 10 }}>
        <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 24, padding: '8px 16px', alignItems: 'center' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage(input) }}
            placeholder="Type or tap orb to speak..."
            style={{ flex: 1, background: 'none', border: 'none', color: '#ccc', fontSize: 14, outline: 'none' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{ background: input.trim() && !loading ? 'linear-gradient(135deg,#00d4ff,#0077bb)' : '#111', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', color: input.trim() && !loading ? '#000' : '#333', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {loading ? '...' : '>'}
          </button>
        </div>
      </div>
    </div>
  )
}
