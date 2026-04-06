'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { speakText, stopSpeaking } from '@/lib/tts'
import { buildSystemPrompt } from '@/lib/personality'

export default function OrbPage() {
  const router = useRouter()
  const [listening, setListening] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [text, setText] = useState('Tap the orb to speak')
  const [subtext, setSubtext] = useState('JARVIS Voice Mode')
  const [pulse, setPulse] = useState(false)
  const recRef = useRef<any>(null)
  const animRef = useRef<number>(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let frame = 0
    const draw = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      const cx = canvas.width / 2
      const cy = canvas.height / 2
      const r = Math.min(cx, cy) * 0.38
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const intensity = listening ? 1 : thinking ? 0.7 : speaking ? 0.9 : 0.3
      const ripples = listening ? 4 : speaking ? 3 : 2

      for (let i = 0; i < ripples; i++) {
        const phase = (frame * 0.02 + i * 0.7) % 1
        const rr = r + phase * r * 1.2
        const alpha = (1 - phase) * 0.18 * intensity
        ctx.beginPath()
        ctx.arc(cx, cy, rr, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0,212,255,${alpha})`
        ctx.lineWidth = 2
        ctx.stroke()
      }

      const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r)
      if (listening) {
        grad.addColorStop(0, 'rgba(0,255,180,0.95)')
        grad.addColorStop(0.5, 'rgba(0,212,255,0.8)')
        grad.addColorStop(1, 'rgba(0,80,200,0.6)')
      } else if (thinking) {
        grad.addColorStop(0, 'rgba(180,100,255,0.95)')
        grad.addColorStop(0.5, 'rgba(100,50,255,0.8)')
        grad.addColorStop(1, 'rgba(50,0,180,0.6)')
      } else if (speaking) {
        grad.addColorStop(0, 'rgba(255,200,0,0.95)')
        grad.addColorStop(0.5, 'rgba(255,130,0,0.8)')
        grad.addColorStop(1, 'rgba(200,50,0,0.6)')
      } else {
        grad.addColorStop(0, 'rgba(0,180,255,0.7)')
        grad.addColorStop(0.5, 'rgba(0,100,200,0.5)')
        grad.addColorStop(1, 'rgba(0,50,120,0.3)')
      }

      const wobble = listening ? Math.sin(frame * 0.15) * 4 : speaking ? Math.sin(frame * 0.1) * 3 : 0
      ctx.beginPath()
      ctx.arc(cx, cy, r + wobble, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()

      ctx.beginPath()
      ctx.arc(cx - r * 0.28, cy - r * 0.28, r * 0.18, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.fill()

      frame++
      animRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [listening, thinking, speaking])

  const send = async (transcript: string) => {
    setThinking(true)
    setSpeaking(false)
    setText('Thinking...')
    setSubtext(transcript)
    try {
      const sysPrompt = await buildSystemPrompt().catch(() => 'You are JARVIS. Hinglish mein bol.')
      const ck: Record<string,string> = {}
      if (typeof window !== 'undefined') {
        ['GROQ_API_KEY','GEMINI_API_KEY','CEREBRAS_API_KEY','TOGETHER_API_KEY','MISTRAL_API_KEY','COHERE_API_KEY','FIREWORKS_API_KEY','OPENROUTER_API_KEY','DEEPINFRA_API_KEY','HUGGINGFACE_API_KEY'].forEach(k => { const v = localStorage.getItem('jarvis_key_'+k); if(v) ck[k]=v })
      }
      const res = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role:'user', content: transcript }], mode:'flash', systemPrompt: sysPrompt, noStream: true, clientKeys: ck })
      })
      const d = await res.json()
      const reply = d.content || 'Kuch samajh nahi aaya.'
      setThinking(false)
      setSpeaking(true)
      setText(reply.slice(0, 120) + (reply.length > 120 ? '...' : ''))
      setSubtext('via ' + (d.provider || 'JARVIS'))
      await speakText(reply, () => { setSpeaking(false); setText('Tap to speak again'); setSubtext('JARVIS ready') })
    } catch {
      setThinking(false)
      setText('Error. Dobara try karo.')
      setSubtext('')
    }
  }

  const handleOrb = async () => {
    if (listening) {
      recRef.current?.stop()
      setListening(false)
      return
    }
    stopSpeaking()
    setSpeaking(false)

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setText('Browser STT not supported'); return }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch { setText('Mic permission do'); return }

    const rec = new SR()
    recRef.current = rec
    rec.lang = 'hi-IN'
    rec.continuous = false
    rec.interimResults = true
    let final = ''

    rec.onstart = () => { setListening(true); setText('Bol boss...'); setSubtext('Listening...') }
    rec.onresult = (e: any) => {
      final = Array.from(e.results).map((r: any) => r[0].transcript).join('')
      setText(final || '...')
    }
    rec.onerror = () => { setListening(false); setText('Mic error. Retry.'); setSubtext('') }
    rec.onend = () => { setListening(false); if (final.trim()) send(final.trim()) }
    rec.start()
  }

  const stateColor = listening ? '#00ffb4' : thinking ? '#a855f7' : speaking ? '#f59e0b' : '#00d4ff'
  const stateLabel = listening ? '🎙️ Listening' : thinking ? '🧠 Thinking' : speaking ? '🔊 Speaking' : '💤 Ready'

  return (
    <div style={{ background:'#050510', minHeight:'100dvh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
      {/* Stars bg */}
      <div style={{ position:'absolute', inset:0, backgroundImage:'radial-gradient(circle, rgba(0,212,255,0.03) 1px, transparent 1px)', backgroundSize:'32px 32px', pointerEvents:'none' }} />

      {/* Back */}
      <button onClick={() => router.push('/')} style={{ position:'absolute', top:16, left:16, background:'rgba(0,212,255,0.1)', border:'1px solid #1e1e2e', borderRadius:10, color:'#00d4ff', padding:'6px 14px', fontSize:13, cursor:'pointer' }}>← Home</button>

      {/* Status pill */}
      <div style={{ position:'absolute', top:16, right:16, background:'rgba(0,0,0,0.5)', border:'1px solid #1e1e2e', borderRadius:20, padding:'4px 12px', fontSize:11, color: stateColor }}>
        {stateLabel}
      </div>

      {/* Canvas orb */}
      <div style={{ position:'relative', width:260, height:260, cursor:'pointer' }} onClick={handleOrb}>
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%' }} />
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:4, pointerEvents:'none' }}>
          <span style={{ fontSize: listening ? 36 : 28, transition:'font-size 0.3s' }}>{listening ? '🎙️' : thinking ? '🧠' : speaking ? '🔊' : 'J'}</span>
        </div>
      </div>

      {/* Text */}
      <div style={{ marginTop:24, textAlign:'center', padding:'0 32px', maxWidth:340 }}>
        <div style={{ color:'#e0e0ff', fontSize:16, fontWeight:600, lineHeight:1.5, marginBottom:6 }}>{text}</div>
        <div style={{ color:'#444', fontSize:12 }}>{subtext}</div>
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:12, marginTop:32 }}>
        <button onClick={() => { stopSpeaking(); setSpeaking(false); setText('Tap to speak'); setSubtext('JARVIS ready') }}
          style={{ background:'rgba(239,68,68,0.1)', border:'1px solid #ef4444', borderRadius:10, color:'#ef4444', padding:'8px 18px', fontSize:12, cursor:'pointer' }}>
          ⏹ Stop
        </button>
        <button onClick={() => router.push('/voice')}
          style={{ background:'rgba(0,212,255,0.08)', border:'1px solid #1e1e2e', borderRadius:10, color:'#00d4ff', padding:'8px 18px', fontSize:12, cursor:'pointer' }}>
          🎙️ Voice Page
        </button>
      </div>

      <div style={{ position:'absolute', bottom:32, color:'#1a1a2e', fontSize:11 }}>JARVIS v24 · Orb Mode</div>
    </div>
  )
}
