'use client'
import React, { useState, useEffect } from 'react'
import { getAllGoals, addGoal, updateGoal } from '@/lib/db'
import { getReminders, addReminder } from '@/lib/reminders'
import { openApp, vibrate, showNotification } from '@/lib/automation/bridge'

// ── Calculator Widget ─────────────────────────────────────
export function CalcWidget() {
  const [expr, setExpr] = useState('')
  const [result, setResult] = useState('')
  const calc = () => {
    try {
      // Safe eval
      const r = Function('"use strict"; return (' + expr.replace(/[^0-9+\-*/.()%\s]/g, '') + ')')()
      setResult('= ' + r)
    } catch { setResult('Invalid') }
  }
  return (
    <div style={{ background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: 12, padding: 12, marginTop: 8 }}>
      <div style={{ color: '#00d4ff', fontSize: 11, marginBottom: 6 }}>🧮 Calculator</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={expr} onChange={e => setExpr(e.target.value)} onKeyDown={e => e.key === 'Enter' && calc()}
          placeholder="18% of 4500..."
          style={{ flex: 1, background: '#111', border: '1px solid #2a2a4a', borderRadius: 8, padding: '7px 10px', color: '#e0e0ff', fontSize: 13, outline: 'none' }} />
        <button onClick={calc} style={{ background: '#00d4ff', border: 'none', borderRadius: 8, color: '#000', padding: '0 12px', cursor: 'pointer', fontWeight: 700 }}>=</button>
      </div>
      {result && <div style={{ color: '#22c55e', fontSize: 15, fontWeight: 700, marginTop: 6 }}>{result}</div>}
    </div>
  )
}

// ── Goals Widget ──────────────────────────────────────────
export function GoalsWidget() {
  const [goals, setGoals] = useState<any[]>([])
  const [input, setInput] = useState('')
  useEffect(() => { getAllGoals().then(setGoals).catch(() => {}) }, [])
  const add = async () => {
    if (!input.trim()) return
    await addGoal({ title: input.trim(), completed: false, priority: 'medium', progress: 0, timestamp: Date.now() })
    setInput(''); getAllGoals().then(setGoals)
  }
  const done = async (id: number) => { await updateGoal(id, { completed: true }); getAllGoals().then(setGoals) }
  return (
    <div style={{ background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: 12, padding: 12, marginTop: 8 }}>
      <div style={{ color: '#00d4ff', fontSize: 11, marginBottom: 8 }}>🎯 Goals ({goals.filter(g => !g.completed).length} active)</div>
      {goals.filter(g => !g.completed).slice(0, 4).map(g => (
        <div key={g.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5 }}>
          <button onClick={() => g.id && done(g.id)} style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #00d4ff', background: 'none', cursor: 'pointer', flexShrink: 0 }} />
          <span style={{ color: '#c8e8ff', fontSize: 13 }}>{g.title}</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Naya goal..."
          style={{ flex: 1, background: '#111', border: '1px solid #2a2a4a', borderRadius: 8, padding: '6px 10px', color: '#e0e0ff', fontSize: 12, outline: 'none' }} />
        <button onClick={add} style={{ background: '#00d4ff', border: 'none', borderRadius: 8, color: '#000', padding: '0 10px', cursor: 'pointer', fontWeight: 700 }}>+</button>
      </div>
    </div>
  )
}

// ── Reminder Widget ───────────────────────────────────────
export function ReminderWidget({ suggestion }: { suggestion?: string }) {
  const [text, setText] = useState(suggestion || '')
  const [time, setTime] = useState('')
  const [done, setDone] = useState(false)
  const add = () => {
    if (!text || !time) return
    const [h, m] = time.split(':').map(Number)
    const d = new Date(); d.setHours(h, m, 0, 0)
    if (d < new Date()) d.setDate(d.getDate() + 1)
    addReminder(text, d.getTime())
    setDone(true)
  }
  if (done) return <div style={{ color: '#22c55e', fontSize: 13, marginTop: 6 }}>✅ Reminder set!</div>
  return (
    <div style={{ background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: 12, padding: 12, marginTop: 8 }}>
      <div style={{ color: '#00d4ff', fontSize: 11, marginBottom: 8 }}>⏰ Reminder Set Karo</div>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Kya remind karna hai..."
        style={{ width: '100%', background: '#111', border: '1px solid #2a2a4a', borderRadius: 8, padding: '7px 10px', color: '#e0e0ff', fontSize: 12, outline: 'none', marginBottom: 6, boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="time" value={time} onChange={e => setTime(e.target.value)}
          style={{ flex: 1, background: '#111', border: '1px solid #2a2a4a', borderRadius: 8, padding: '7px 10px', color: '#e0e0ff', fontSize: 12, outline: 'none' }} />
        <button onClick={add} style={{ background: '#00d4ff', border: 'none', borderRadius: 8, color: '#000', padding: '0 12px', cursor: 'pointer', fontWeight: 700 }}>Set</button>
      </div>
    </div>
  )
}

// ── Phone Action Widget ───────────────────────────────────
export function PhoneWidget({ action, label }: { action: string; label: string }) {
  const [status, setStatus] = useState('')
  const run = async () => {
    if (action === 'vibrate') { vibrate([200, 100, 200]); setStatus('📳 Vibrated!') }
    else if (action === 'notify') {
      const ok = await showNotification('JARVIS', label)
      setStatus(ok ? '🔔 Sent!' : '❌ Permission nahi')
    }
    else if (action.startsWith('open:')) {
      const app = action.slice(5)
      const r = openApp(app)
      setStatus(r.ok ? '✅ Opening...' : '❌ ' + r.msg)
    }
  }
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={run} style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 10, color: '#00d4ff', padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>
        ▶ {label}
      </button>
      {status && <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>{status}</span>}
    </div>
  )
}

// ── Image Gen Widget ──────────────────────────────────────
export function ImageWidget({ prompt }: { prompt: string }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const generate = () => {
    setLoading(true)
    const u = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt + ', high quality') + '?width=512&height=512&nologo=true&seed=' + Date.now()
    setUrl(u)
    setLoading(false)
  }
  useEffect(() => { if (prompt) generate() }, [])
  return (
    <div style={{ marginTop: 8 }}>
      {loading && <div style={{ color: '#555', fontSize: 12 }}>🎨 Generating...</div>}
      {url && (
        <div>
          <img src={url} alt={prompt} style={{ width: '100%', maxWidth: 300, borderRadius: 10, display: 'block' }} />
          <a href={url} download target="_blank" rel="noopener noreferrer"
            style={{ color: '#555', fontSize: 11, textDecoration: 'none', display: 'block', marginTop: 4 }}>⬇️ Download</a>
        </div>
      )}
    </div>
  )
}

// ── Weather Widget ────────────────────────────────────────
export function WeatherWidget({ city }: { city: string }) {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    fetch('https://wttr.in/' + encodeURIComponent(city) + '?format=j1')
      .then(r => r.json()).then(setData).catch(() => {})
  }, [city])
  if (!data) return <div style={{ color: '#555', fontSize: 12, marginTop: 6 }}>🌤️ Loading weather...</div>
  const c = data.current_condition?.[0]
  return (
    <div style={{ background: 'linear-gradient(135deg, #001f3f, #003366)', borderRadius: 12, padding: 12, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{city}</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{c?.weatherDesc?.[0]?.value}</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 2 }}>Humidity: {c?.humidity}% · Wind: {c?.windspeedKmph}km/h</div>
      </div>
      <div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>{c?.temp_C}°C</div>
    </div>
  )
}

// ── Widget Detector — parse JARVIS response for widget hints ──
export function detectWidget(aiText: string, userText: string): React.ReactNode | null {
  const u = userText.toLowerCase()
  const a = aiText.toLowerCase()

  // Calculator
  if (/calculate|kitna|percent|\d+.*\+|\d+.*\-|\d+.*\*|bmi|emi|sip/.test(u))
    return <CalcWidget />

  // Goals
  if (/goal|target|kya karna|todo|checklist/.test(u))
    return <GoalsWidget />

  // Reminder
  if (/remind|reminder|yaad dilao|alarm|set.*baje/.test(u)) {
    const timeMatch = userText.match(/(\d{1,2}:\d{2})|(\d{1,2}\s*baje)/i)
    return <ReminderWidget suggestion={userText.replace(/remind|me|karo|set/gi, '').trim()} />
  }

  // Image generation
  if (/image bana|generate image|photo bana|create image|wallpaper/.test(u)) {
    const prompt = userText.replace(/image bana|generate|create|photo|bana|wallpaper/gi, '').trim() || 'beautiful digital art'
    return <ImageWidget prompt={prompt} />
  }

  // Weather
  if (/weather|mausam|temperature|barish/.test(u)) {
    const cityMatch = userText.match(/(?:of|in|at|ka|mein)\s+(\w+)/i)
    return <WeatherWidget city={cityMatch?.[1] || 'Maihar'} />
  }

  // WhatsApp open
  if (/whatsapp.*khol|open.*whatsapp/.test(u))
    return <PhoneWidget action="open:whatsapp" label="WhatsApp Kholo" />

  // Vibrate
  if (/vibrate|buzz/.test(u))
    return <PhoneWidget action="vibrate" label="Vibrate Now" />

  return null
}
