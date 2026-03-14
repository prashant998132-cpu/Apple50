'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getRecentChats, type Chat } from '@/lib/db'

export default function ChatHistoryPage() {
  const router = useRouter()
  const [chats, setChats] = useState<Chat[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Chat | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRecentChats(100).then(c => { setChats(c); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const filtered = (chats as Chat[]).filter(c =>
    search === '' || c.content.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filtered.reduce((acc: Record<string, Chat[]>, chat) => {
    const d = new Date(chat.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    if (!acc[d]) acc[d] = []
    acc[d].push(chat)
    return acc
  }, {})

  return (
    <div style={{ background: '#060610', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>💬 Chat History</div>
          <div style={{ color: '#555', fontSize: 11 }}>{chats.length} messages</div>
        </div>
      </div>

      <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search chats..."
          style={{ width: '100%', background: '#111118', border: '1px solid #2a2a4a', borderRadius: 8, padding: '8px 12px', color: '#e0e0ff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {loading && <div style={{ textAlign: 'center', color: '#555', padding: 30 }}>Loading...</div>}
        {!loading && chats.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#444' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <div>Abhi koi chat history nahi</div>
          </div>
        )}

        {selected && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', flexDirection: 'column', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ color: '#00d4ff', fontWeight: 600 }}>{selected.role === 'user' ? 'You' : 'JARVIS'}</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', color: '#e0e0ff', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{selected.content}</div>
            <button onClick={() => { navigator.clipboard?.writeText(selected.content); setSelected(null) }}
              style={{ marginTop: 12, background: '#00d4ff', border: 'none', borderRadius: 8, color: '#000', padding: 10, cursor: 'pointer', fontWeight: 700 }}>
              📋 Copy
            </button>
          </div>
        )}

        {Object.entries(grouped).reverse().map(([date, msgs]) => (
          <div key={date} style={{ marginBottom: 16 }}>
            <div style={{ color: '#555', fontSize: 11, fontWeight: 600, marginBottom: 8, padding: '4px 0', borderBottom: '1px solid #111' }}>{date}</div>
            {msgs.map((chat, i) => (
              <div key={i} onClick={() => setSelected(chat)}
                style={{ background: chat.role === 'user' ? '#0f0f1a' : '#0a0a14', border: `1px solid ${chat.role === 'user' ? '#1e1e2e' : '#161624'}`, borderRadius: 10, padding: '8px 12px', marginBottom: 4, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{chat.role === 'user' ? '👤' : '🤖'}</span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ color: chat.role === 'user' ? '#b0d4ff' : '#c8e8ff', fontSize: 12, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                    {chat.content}
                  </div>
                  <div style={{ color: '#333', fontSize: 10, marginTop: 2 }}>{new Date(chat.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
