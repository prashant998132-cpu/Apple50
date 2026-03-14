'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { setSetting, getSetting } from '@/lib/db'
import { buildSystemPrompt } from '@/lib/personality'

interface Note { id: string; title: string; content: string; tag: string; ts: number; pinned: boolean }
interface Flashcard { id: string; front: string; back: string; subject: string; nextReview: number; interval: number; ease: number }

type Tab = 'notes' | 'flashcards'

export default function NotesPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('notes')
  const [notes, setNotes] = useState<Note[]>([])
  const [cards, setCards] = useState<Flashcard[]>([])
  const [editing, setEditing] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tag, setTag] = useState('general')
  const [search, setSearch] = useState('')
  const [aiGen, setAiGen] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [cardFlipped, setCardFlipped] = useState<Record<string, boolean>>({})
  const [newFront, setNewFront] = useState('')
  const [newBack, setNewBack] = useState('')
  const [cardSubject, setCardSubject] = useState('Biology')

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const n = await getSetting('jarvis_notes_v1').catch(() => [])
    const c = await getSetting('jarvis_flashcards_v1').catch(() => [])
    setNotes(Array.isArray(n) ? n : [])
    setCards(Array.isArray(c) ? c : [])
  }

  const saveNotes = async (updated: Note[]) => {
    setNotes(updated)
    await setSetting('jarvis_notes_v1', updated).catch(() => {})
  }

  const saveCards = async (updated: Flashcard[]) => {
    setCards(updated)
    await setSetting('jarvis_flashcards_v1', updated).catch(() => {})
  }

  const handleSaveNote = async () => {
    if (!content.trim()) return
    const note: Note = { id: editing?.id || `n_${Date.now()}`, title: title || content.slice(0, 40), content, tag, ts: Date.now(), pinned: editing?.pinned || false }
    const updated = editing ? notes.map(n => n.id === note.id ? note : n) : [note, ...notes]
    await saveNotes(updated)
    setEditing(null); setTitle(''); setContent(''); setTag('general')
  }

  const deleteNote = async (id: string) => saveNotes(notes.filter(n => n.id !== id))
  const pinNote = async (id: string) => saveNotes(notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n))

  const generateFlashcards = async () => {
    if (!aiGen.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Generate 5 flashcards for: "${aiGen}"\nReturn ONLY JSON array: [{"front":"question","back":"answer","subject":"${cardSubject}"}]\nShort, clear questions and answers. Good for NEET.` }],
          mode: 'flash', noStream: true,
        }),
      })
      const d = await res.json()
      const match = (d.content || '').match(/\[[\s\S]*\]/)
      if (match) {
        const parsed = JSON.parse(match[0])
        const newCards: Flashcard[] = parsed.map((c: any) => ({ id: `fc_${Date.now()}_${Math.random().toString(36).slice(2)}`, front: c.front, back: c.back, subject: c.subject || cardSubject, nextReview: Date.now(), interval: 1, ease: 2.5 }))
        await saveCards([...newCards, ...cards])
        setAiGen('')
      }
    } catch {}
    setAiLoading(false)
  }

  const reviewCard = async (id: string, quality: 1 | 2 | 3) => {
    const card = cards.find(c => c.id === id)
    if (!card) return
    const ease = Math.max(1.3, card.ease + 0.1 - (3 - quality) * 0.14)
    const interval = quality === 1 ? 1 : Math.round(card.interval * ease)
    const nextReview = Date.now() + interval * 86400000
    await saveCards(cards.map(c => c.id === id ? { ...c, ease, interval, nextReview } : c))
  }

  const dueCards = cards.filter(c => c.nextReview <= Date.now())
  const filtered = notes.filter(n => search === '' || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()))
  const pinned = filtered.filter(n => n.pinned)
  const unpinned = filtered.filter(n => !n.pinned)

  const TAGS = ['general', 'study', 'physics', 'chemistry', 'biology', 'code', 'idea', 'todo']

  return (
    <div style={{ background: '#060610', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>📝 Notes & Flashcards</div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #1e1e2e' }}>
        {[{ k: 'notes' as Tab, label: `📝 Notes (${notes.length})` }, { k: 'flashcards' as Tab, label: `🃏 Cards (${dueCards.length} due)` }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{ flex: 1, padding: 10, background: 'none', border: 'none', borderBottom: tab === t.k ? '2px solid #00d4ff' : '2px solid transparent', color: tab === t.k ? '#00d4ff' : '#555', fontSize: 13, cursor: 'pointer' }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {tab === 'notes' && (
          <div>
            {/* Editor */}
            <div style={{ background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)..."
                style={{ width: '100%', background: 'transparent', border: 'none', color: '#00d4ff', fontSize: 15, fontWeight: 600, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
              <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Note likho... (Markdown supported)"
                rows={4} style={{ width: '100%', background: 'transparent', border: 'none', color: '#e0e0ff', fontSize: 13, outline: 'none', resize: 'none', lineHeight: 1.7, boxSizing: 'border-box', marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {TAGS.map(t => (
                  <button key={t} onClick={() => setTag(t)} style={{ background: tag === t ? 'rgba(0,212,255,0.15)' : '#111118', border: `1px solid ${tag === t ? '#00d4ff' : '#1e1e2e'}`, borderRadius: 6, color: tag === t ? '#00d4ff' : '#555', padding: '3px 10px', cursor: 'pointer', fontSize: 11 }}>{t}</button>
                ))}
              </div>
              <button onClick={handleSaveNote} style={{ background: '#00d4ff', border: 'none', borderRadius: 8, color: '#000', padding: '8px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                {editing ? '✏️ Update' : '+ Save Note'}
              </button>
              {editing && <button onClick={() => { setEditing(null); setTitle(''); setContent('') }} style={{ marginLeft: 8, background: 'none', border: '1px solid #333', borderRadius: 8, color: '#555', padding: '8px 14px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>}
            </div>

            {/* Search */}
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Notes search karo..."
              style={{ width: '100%', background: '#111118', border: '1px solid #2a2a4a', borderRadius: 8, padding: '8px 12px', color: '#e0e0ff', fontSize: 13, outline: 'none', marginBottom: 14, boxSizing: 'border-box' }} />

            {/* Notes list */}
            {[...pinned, ...unpinned].map(n => (
              <div key={n.id} style={{ background: '#0f0f1a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#e0e0ff', fontSize: 14, fontWeight: 600 }}>{n.title}</div>
                    <span style={{ color: '#555', fontSize: 10, background: '#1a1a2e', borderRadius: 4, padding: '1px 6px' }}>{n.tag}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => pinNote(n.id)} style={{ background: 'none', border: 'none', color: n.pinned ? '#f59e0b' : '#333', cursor: 'pointer', fontSize: 14 }}>📌</button>
                    <button onClick={() => { setEditing(n); setTitle(n.title); setContent(n.content); setTag(n.tag) }} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 14 }}>✏️</button>
                    <button onClick={() => deleteNote(n.id)} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: 14 }}>🗑️</button>
                  </div>
                </div>
                <div style={{ color: '#888', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'hidden' }}>{n.content}</div>
                <div style={{ color: '#333', fontSize: 10, marginTop: 4 }}>{new Date(n.ts).toLocaleDateString('en-IN')}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'flashcards' && (
          <div>
            {/* AI generate */}
            <div style={{ background: '#0a0a14', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <div style={{ color: '#00d4ff', fontSize: 12, marginBottom: 8 }}>🤖 AI se Flashcards banwao</div>
              <select value={cardSubject} onChange={e => setCardSubject(e.target.value)} style={{ width: '100%', background: '#111118', border: '1px solid #2a2a4a', borderRadius: 8, padding: '8px 10px', color: '#e0e0ff', fontSize: 12, outline: 'none', marginBottom: 8 }}>
                {['Biology', 'Chemistry', 'Physics', 'Math', 'History', 'English'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={aiGen} onChange={e => setAiGen(e.target.value)} onKeyDown={e => e.key === 'Enter' && generateFlashcards()}
                  placeholder="Topic batao — e.g. Krebs cycle, Newton laws..."
                  style={{ flex: 1, background: '#111118', border: '1px solid #2a2a4a', borderRadius: 8, padding: '9px 12px', color: '#e0e0ff', fontSize: 13, outline: 'none' }} />
                <button onClick={generateFlashcards} disabled={aiLoading || !aiGen.trim()}
                  style={{ background: '#00d4ff', border: 'none', borderRadius: 8, color: '#000', padding: '0 14px', cursor: 'pointer', fontWeight: 700 }}>
                  {aiLoading ? '⏳' : 'Gen'}
                </button>
              </div>
            </div>

            {/* Manual card */}
            <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <div style={{ color: '#555', fontSize: 11, marginBottom: 8 }}>MANUAL ADD</div>
              <input value={newFront} onChange={e => setNewFront(e.target.value)} placeholder="Question (front)..."
                style={{ width: '100%', background: '#0a0a14', border: '1px solid #2a2a4a', borderRadius: 8, padding: '8px 12px', color: '#e0e0ff', fontSize: 13, outline: 'none', marginBottom: 6, boxSizing: 'border-box' }} />
              <input value={newBack} onChange={e => setNewBack(e.target.value)} placeholder="Answer (back)..."
                style={{ width: '100%', background: '#0a0a14', border: '1px solid #2a2a4a', borderRadius: 8, padding: '8px 12px', color: '#e0e0ff', fontSize: 13, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
              <button onClick={async () => { if (!newFront || !newBack) return; await saveCards([{ id: `fc_${Date.now()}`, front: newFront, back: newBack, subject: cardSubject, nextReview: Date.now(), interval: 1, ease: 2.5 }, ...cards]); setNewFront(''); setNewBack('') }} style={{ background: '#00d4ff', border: 'none', borderRadius: 8, color: '#000', padding: '8px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>+ Add Card</button>
            </div>

            {/* Due cards */}
            {dueCards.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: '#f59e0b', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>🔥 DUE FOR REVIEW ({dueCards.length})</div>
                {dueCards.slice(0, 5).map(c => (
                  <div key={c.id} style={{ background: '#0f0f1a', border: '1px solid #2a2a0a', borderRadius: 12, padding: 14, marginBottom: 8 }}>
                    <div style={{ color: '#e0e0ff', fontSize: 14, marginBottom: 8 }}>{c.front}</div>
                    {!cardFlipped[c.id] ? (
                      <button onClick={() => setCardFlipped(p => ({ ...p, [c.id]: true }))} style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, color: '#888', padding: '8px 16px', cursor: 'pointer', fontSize: 12 }}>
                        👀 Show Answer
                      </button>
                    ) : (
                      <div>
                        <div style={{ color: '#22c55e', fontSize: 13, padding: '10px', background: 'rgba(34,197,94,0.05)', borderRadius: 8, marginBottom: 10, lineHeight: 1.6 }}>{c.back}</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {[{ q: 1 as const, label: '😰 Hard', color: '#ef4444' }, { q: 2 as const, label: '🤔 OK', color: '#f59e0b' }, { q: 3 as const, label: '😎 Easy', color: '#22c55e' }].map(b => (
                            <button key={b.q} onClick={() => { reviewCard(c.id, b.q); setCardFlipped(p => ({ ...p, [c.id]: false })) }}
                              style={{ flex: 1, background: `${b.color}22`, border: `1px solid ${b.color}55`, borderRadius: 8, color: b.color, padding: 8, cursor: 'pointer', fontSize: 12 }}>
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {cards.length === 0 && (
              <div style={{ textAlign: 'center', padding: 30, color: '#444' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🃏</div>
                <div>Koi flashcards nahi. AI se banwao!</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
