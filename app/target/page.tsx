'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { addGoal, getAllGoals, updateGoal, deleteGoal, type Goal } from '@/lib/db'
import { buildSystemPrompt } from '@/lib/personality'

export default function TargetPage() {
  const router = useRouter()
  const [goals, setGoals] = useState<Goal[]>([])
  const [input, setInput] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [loadingSug, setLoadingSug] = useState(false)
  const [filter, setFilter] = useState<'active' | 'done' | 'all'>('active')

  useEffect(() => { load() }, [])

  const load = async () => {
    try { setGoals(await getAllGoals()) } catch {}
  }

  const handleAdd = async () => {
    if (!input.trim()) return
    await addGoal({ title: input.trim(), completed: false, priority: 'medium', progress: 0, timestamp: Date.now() })
    setInput('')
    load()
  }

  const handleComplete = async (id: number) => {
    await updateGoal(id, { completed: true, progress: 100 })
    load()
  }

  const handleUndo = async (id: number) => {
    await updateGoal(id, { completed: false, progress: 0 })
    load()
  }

  const handleDelete = async (id: number) => {
    await deleteGoal(id)
    load()
  }

  const getAISuggestion = async () => {
    setLoadingSug(true); setAiSuggestion('')
    try {
      const activeGoals = goals.filter(g => !g.completed).map(g => g.title).join(', ')
      const sysPrompt = await buildSystemPrompt().catch(() => '')
      const prompt = activeGoals
        ? `Mere active goals hain: "${activeGoals}". 3 related aur specific goals suggest karo. Hinglish, short, actionable.`
        : 'Ek NEET student ke liye 3 specific daily goals suggest karo. Realistic. Hinglish, short.'
      const res = await fetch('/api/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], mode: 'flash', systemPrompt: sysPrompt }),
      })
      const reader = res.body!.getReader(); const decoder = new TextDecoder(); let text = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ')) { try { const d = JSON.parse(line.slice(6)); if (d.type === 'delta') { text += d.text; setAiSuggestion(text) } } catch {} }
        }
      }
    } catch { setAiSuggestion('Suggest nahi ho sake.') }
    setLoadingSug(false)
  }

  const active = goals.filter(g => !g.completed)
  const done = goals.filter(g => g.completed)
  const displayed = filter === 'active' ? active : filter === 'done' ? done : goals

  return (
    <div style={{ background: '#060610', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>🎯 Goals & Targets</div>
          <div style={{ color: '#555', fontSize: 11 }}>{active.length} active · {done.length} done</div>
        </div>
      </div>

      {/* Add + AI */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Naya goal add karo..."
            style={{ flex: 1, background: '#111118', border: '1px solid #2a2a4a', borderRadius: 10, padding: '10px 12px', color: '#e0e0ff', fontSize: 14, outline: 'none' }} />
          <button onClick={handleAdd} style={{ background: '#00d4ff', border: 'none', borderRadius: 10, color: '#000', padding: '0 18px', cursor: 'pointer', fontWeight: 700, fontSize: 18 }}>+</button>
        </div>
        <button onClick={getAISuggestion} disabled={loadingSug}
          style={{ width: '100%', background: '#0f0f1a', border: '1px solid #1e1e2e', borderRadius: 10, color: '#888', padding: 10, cursor: 'pointer', fontSize: 13 }}>
          {loadingSug ? '⏳ JARVIS soch raha hai...' : '🤖 JARVIS se goals suggest karwao'}
        </button>
        {aiSuggestion && (
          <div style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 10, padding: 12, marginTop: 8, fontSize: 13, color: '#88c8ff', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            💡 {aiSuggestion}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e1e2e' }}>
        {(['active', 'done', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            flex: 1, padding: '8px 4px', background: 'none', border: 'none',
            borderBottom: filter === f ? '2px solid #00d4ff' : '2px solid transparent',
            color: filter === f ? '#00d4ff' : '#444', fontSize: 12, cursor: 'pointer',
          }}>
            {f === 'active' ? `Active (${active.length})` : f === 'done' ? `Done (${done.length})` : `All (${goals.length})`}
          </button>
        ))}
      </div>

      {/* Goals list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {displayed.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#444' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
            <div>Koi goal nahi hai abhi</div>
          </div>
        )}
        {displayed.map(g => (
          <div key={g.id} style={{ background: g.completed ? '#0a0a10' : '#0f0f1a', border: `1px solid ${g.completed ? '#111' : '#1e1e2e'}`, borderRadius: 12, padding: 12, marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center', opacity: g.completed ? 0.6 : 1 }}>
            <button onClick={() => g.id && (g.completed ? handleUndo(g.id) : handleComplete(g.id))}
              style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${g.completed ? '#22c55e' : '#00d4ff'}`, background: g.completed ? '#22c55e22' : 'none', cursor: 'pointer', flexShrink: 0, color: '#22c55e', fontSize: 13 }}>
              {g.completed ? '✓' : ''}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ color: g.completed ? '#555' : '#e0e0ff', fontSize: 14, textDecoration: g.completed ? 'line-through' : 'none' }}>{g.title}</div>
              {!g.completed && g.progress > 0 && (
                <div style={{ marginTop: 4, background: '#1a1a2e', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${g.progress}%`, height: '100%', background: '#00d4ff', borderRadius: 4 }} />
                </div>
              )}
            </div>
            <button onClick={() => g.id && handleDelete(g.id)} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: 16 }}>🗑️</button>
          </div>
        ))}
      </div>
    </div>
  )
}
