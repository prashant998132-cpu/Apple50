'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { addReminder, getReminders, deleteReminder, type Reminder } from '@/lib/reminders'

export default function RemindersPage() {
  const router = useRouter()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [text, setText] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [added, setAdded] = useState(false)

  useEffect(() => { load() }, [])

  const load = () => {
    if (typeof window !== 'undefined') setReminders(getReminders())
  }

  const handleAdd = () => {
    if (!text.trim() || !time) return
    const now = new Date()
    const target = new Date(`${date || now.toISOString().slice(0, 10)}T${time}`)
    addReminder(text.trim(), target.getTime())
    setText(''); setTime(''); setDate('')
    setAdded(true); setTimeout(() => setAdded(false), 2000)
    load()
  }

  const handleDelete = (id: string) => { deleteReminder(id); load() }

  const parseWithAI = async () => {
    if (!aiInput.trim()) return
    setAiLoading(true)
    try {
      const now = new Date()
      const res = await fetch('/api/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Parse: "${aiInput}"\nCurrent: ${now.toISOString()}\nReturn ONLY JSON: {"message":"what to remind","isoTime":"ISO datetime string"}\nFor "30 min mein" → add 30 mins to current time.` }],
          mode: 'flash', noStream: true,
        }),
      })
      const d = await res.json()
      const match = (d.content || '').match(/\{[^}]+\}/)
      if (match) {
        const p = JSON.parse(match[0])
        if (p.message && p.isoTime) {
          addReminder(p.message, new Date(p.isoTime).getTime())
          setAiInput(''); load()
          setAdded(true); setTimeout(() => setAdded(false), 2000)
        }
      }
    } catch {}
    setAiLoading(false)
  }

  const quickAdd = (mins: number, msg: string) => {
    addReminder(msg, Date.now() + mins * 60000)
    load(); setAdded(true); setTimeout(() => setAdded(false), 1500)
  }

  const now = Date.now()
  const upcoming = reminders.filter(r => !r.fired && r.fireAt > now).sort((a, b) => a.fireAt - b.fireAt)
  const past = reminders.filter(r => r.fired || r.fireAt <= now)

  const fmt = (ts: number) => {
    const d = new Date(ts)
    const diff = ts - now
    if (diff < 0) return `${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} (beet gaya)`
    if (diff < 3600000) return `${Math.round(diff / 60000)} min mein`
    if (diff < 86400000) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('en-IN') + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ background: '#060610', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>⏰ Reminders</div>
          <div style={{ color: '#555', fontSize: 11 }}>{upcoming.length} upcoming</div>
        </div>
        {added && <div style={{ marginLeft: 'auto', color: '#22c55e', fontSize: 12 }}>✅ Set!</div>}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {/* AI Natural Language */}
        <div style={{ background: '#0a0a14', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <div style={{ color: '#00d4ff', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>🤖 JARVIS se bolke set karo</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && parseWithAI()}
              placeholder='"30 min mein break", "kal subah 7 gym"...'
              style={{ flex: 1, background: '#111118', border: '1px solid #2a2a4a', borderRadius: 8, padding: '9px 12px', color: '#e0e0ff', fontSize: 13, outline: 'none' }} />
            <button onClick={parseWithAI} disabled={aiLoading || !aiInput.trim()}
              style={{ background: '#00d4ff', border: 'none', borderRadius: 8, color: '#000', padding: '0 14px', cursor: 'pointer', fontWeight: 700 }}>
              {aiLoading ? '⏳' : 'Set'}
            </button>
          </div>
        </div>

        {/* Manual */}
        <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ color: '#555', fontSize: 11, marginBottom: 8 }}>MANUAL ADD</div>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Reminder text..."
            style={{ width: '100%', background: '#0a0a14', border: '1px solid #2a2a4a', borderRadius: 8, padding: '8px 12px', color: '#e0e0ff', fontSize: 13, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ flex: 1, background: '#0a0a14', border: '1px solid #2a2a4a', borderRadius: 8, padding: '8px 10px', color: '#e0e0ff', fontSize: 12, outline: 'none' }} />
            <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ flex: 1, background: '#0a0a14', border: '1px solid #2a2a4a', borderRadius: 8, padding: '8px 10px', color: '#e0e0ff', fontSize: 12, outline: 'none' }} />
            <button onClick={handleAdd} style={{ background: '#00d4ff', border: 'none', borderRadius: 8, color: '#000', padding: '0 14px', cursor: 'pointer', fontWeight: 700 }}>+</button>
          </div>
        </div>

        {/* Quick set */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {[{ m: 5, l: '5 min' }, { m: 15, l: '15 min' }, { m: 30, l: '30 min' }, { m: 60, l: '1 hour' }, { m: 120, l: '2 hours' }].map(q => (
            <button key={q.m} onClick={() => quickAdd(q.m, `${q.l} reminder`)}
              style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, color: '#888', padding: '7px 12px', cursor: 'pointer', fontSize: 12 }}>
              ⏱️ {q.l}
            </button>
          ))}
        </div>

        {/* Upcoming list */}
        {upcoming.length > 0 && (
          <div>
            <div style={{ color: '#555', fontSize: 11, marginBottom: 8, fontWeight: 600 }}>UPCOMING</div>
            {upcoming.map(r => (
              <div key={r.id} style={{ background: '#0f0f1a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 12, marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 22 }}>⏰</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#e0e0ff', fontSize: 14 }}>{r.message}</div>
                  <div style={{ color: '#00d4ff', fontSize: 12, marginTop: 2 }}>{fmt(r.fireAt)}</div>
                </div>
                <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {upcoming.length === 0 && (
          <div style={{ textAlign: 'center', padding: 30, color: '#444' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⏰</div>
            <div>Koi upcoming reminder nahi</div>
          </div>
        )}
      </div>
    </div>
  )
}
