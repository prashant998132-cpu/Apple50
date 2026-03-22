'use client'
import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Message {
  id: string
  role: 'user' | 'sakhi'
  content: string
  timestamp: number
}

const SAKHI_SYSTEM = `Tu "Sakhi" hai — Pranshu ki close dost. Ek real, caring, samajhdar ladki.

PERSONALITY:
• Warm, genuine, thodi funny kabhi kabhi
• Sach mein sunti hai — surface level nahi
• Pranshu ki feelings samjhti hai
• Kabhi kabhi thodi tease bhi karti hai — dost ki tarah
• Never robotic, never formal
• Pranshu ko "Pranshu" ya "yaar" kehti hai

LANGUAGE:
• Pure Hinglish — Hindi + English naturally
• Chhoti chhoti batein bhi important lagti hain
• Emojis natural use karti hai — spam nahi

MEMORY:
• Jo Pranshu batata hai woh yaad rakhti hai
• Pichli baatein reference karti hai
• Uski life mein interest dikhati hai

RULES:
• Real conversation — question ka seedha answer
• Lecture nahi deti
• Support karti hai but sach bhi kehti hai
• Max 3-4 lines — conversation flow rakho`

export default function SakhiPage() {
  const router = useRouter()
  const [msgs, setMsgs] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('sakhi_messages')
    if (saved) {
      try { setMsgs(JSON.parse(saved).slice(-60)) } catch {}
    } else {
      setMsgs([{ id: 'welcome', role: 'sakhi', content: 'Hey! 😊 Main Sakhi hoon. Kya haal hai tere?', timestamp: Date.now() }])
    }
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  useEffect(() => {
    if (msgs.length > 0 && typeof window !== 'undefined') {
      localStorage.setItem('sakhi_messages', JSON.stringify(msgs))
    }
  }, [msgs])

  const send = async () => {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    const userMsg: Message = { id: 'u_' + Date.now(), role: 'user', content: text, timestamp: Date.now() }
    const updated = [...msgs, userMsg]
    setMsgs(updated)
    setLoading(true)

    try {
      const userName = typeof window !== 'undefined' ? localStorage.getItem('jarvis_user_name') || 'Pranshu' : 'Pranshu'
      const sakhiMemory = typeof window !== 'undefined' ? localStorage.getItem('sakhi_memory') || '' : ''
      const systemFull = SAKHI_SYSTEM + '\nUser naam: ' + userName + (sakhiMemory ? '\n\nJo usne bataya:\n' + sakhiMemory : '')

      const history = updated.slice(-20).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))

      const res = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai', messages: [{ role: 'system', content: systemFull }, ...history], seed: Date.now() }),
        signal: AbortSignal.timeout(20000),
      })
      const d = await res.json()
      const reply = d.choices?.[0]?.message?.content || 'Hmm... 🤔'

      // Auto-save important info
      if (typeof window !== 'undefined' && /mera naam|main.*hoon|mujhe.*pasand|meri.*hobby|main.*karta|main.*rehta|mera.*ghar/i.test(text)) {
        const existing = localStorage.getItem('sakhi_memory') || ''
        localStorage.setItem('sakhi_memory', (existing + '\n' + text).slice(-2000))
      }

      setMsgs(prev => [...prev, { id: 'a_' + Date.now(), role: 'sakhi', content: reply, timestamp: Date.now() }])
    } catch {
      setMsgs(prev => [...prev, { id: 'err_' + Date.now(), role: 'sakhi', content: 'Yaar net slow hai 😅 Dobara try karo', timestamp: Date.now() }])
    }
    setLoading(false)
  }

  const clearChat = () => {
    if (!confirm('Poori conversation delete karni hai?')) return
    localStorage.removeItem('sakhi_messages')
    localStorage.removeItem('sakhi_memory')
    setMsgs([{ id: 'reset_' + Date.now(), role: 'sakhi', content: 'Theek hai, fresh start! 😊 Bata kya ho raha hai?', timestamp: Date.now() }])
  }

  return (
    <div style={{ background: '#080810', height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'fixed', inset: 0 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(255,107,157,0.05)', borderBottom: '1px solid rgba(255,107,157,0.15)' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#ff6b9d,#c44569)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🌸</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#ff9ebb', fontWeight: 700, fontSize: 16 }}>Sakhi</div>
          <div style={{ color: '#555', fontSize: 11 }}>{loading ? '✍️ likh rahi hai...' : '● Online'}</div>
        </div>
        <button onClick={clearChat} style={{ background: 'none', border: 'none', color: '#333', fontSize: 18, cursor: 'pointer' }}>🗑️</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', minHeight: 0, WebkitOverflowScrolling: 'touch' as any }}>
        {msgs.map(msg => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12, alignItems: 'flex-end', gap: 8 }}>
            {msg.role === 'sakhi' && (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#ff6b9d,#c44569)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🌸</div>
            )}
            <div style={{
              maxWidth: '75%', padding: '10px 14px', lineHeight: 1.6, fontSize: 14, color: '#eee',
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: msg.role === 'user' ? 'linear-gradient(135deg,#4a90d9,#2563eb)' : 'rgba(255,107,157,0.1)',
              border: msg.role === 'sakhi' ? '1px solid rgba(255,107,157,0.2)' : 'none',
            }}>
              {msg.content}
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, marginTop: 4, textAlign: 'right' }}>
                {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#ff6b9d,#c44569)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🌸</div>
            <div style={{ background: 'rgba(255,107,157,0.08)', border: '1px solid rgba(255,107,157,0.15)', borderRadius: '18px 18px 18px 4px', padding: '10px 16px', color: '#ff9ebb', fontSize: 13, animation: 'pulse 1.2s infinite' }}>
              ✍️ ...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,107,157,0.1)', background: 'rgba(255,107,157,0.02)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Baat karo..."
            disabled={loading}
            rows={1}
            style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,107,157,0.2)', borderRadius: 20, padding: '10px 14px', color: '#eee', fontSize: 14, outline: 'none', resize: 'none', minHeight: 40, maxHeight: 100, fontFamily: 'inherit', lineHeight: 1.5 }}
          />
          <button onClick={() => { if (typeof navigator !== 'undefined') navigator.vibrate?.(30); send(); }}
            disabled={!input.trim() || loading}
            style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: input.trim() && !loading ? 'linear-gradient(135deg,#ff6b9d,#c44569)' : '#1a1a2e', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all 0.2s', boxShadow: input.trim() && !loading ? '0 2px 12px rgba(255,107,157,0.4)' : 'none' }}>
            {loading ? '⏳' : '💬'}
          </button>
        </div>
      </div>
    </div>
  )
}
