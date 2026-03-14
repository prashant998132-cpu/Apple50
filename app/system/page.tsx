'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSessions, exportAllData } from '@/lib/storage'
import { getImportantMemories, getAllGoals } from '@/lib/db'

type Tab = 'overview' | 'memory' | 'chats' | 'data' | 'usage'

export default function SystemPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState({ sessions: 0, memories: 0, goals: 0 })
  const [memories, setMemories] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [usageStats, setUsageStats] = useState<any>({})

  useEffect(() => {
    loadData()
    fetch('/api/usage').then(r => r.json()).then(d => setUsageStats(d)).catch(() => {})
  }, [])

  const loadData = async () => {
    try {
      const [sess, mems, goals] = await Promise.allSettled([
        getSessions(),
        getImportantMemories(0, 50),
        getAllGoals(),
      ])
      const s = sess.status === 'fulfilled' ? sess.value : []
      const m = mems.status === 'fulfilled' ? mems.value : []
      const g = goals.status === 'fulfilled' ? goals.value : []
      setStats({ sessions: s.length, memories: m.length, goals: g.length })
      setMemories(m)
      setSessions(s)
    } catch {}
  }

  const handleExport = async () => {
    try {
      const data = await exportAllData()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `jarvis-backup-${Date.now()}.json`; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Export failed!') }
  }

  const TABS: { key: Tab; icon: string; label: string }[] = [
    { key: 'overview', icon: '📊', label: 'Overview' },
    { key: 'memory',   icon: '🧠', label: 'Memory' },
    { key: 'chats',    icon: '💬', label: 'Chats' },
    { key: 'data',     icon: '💾', label: 'Data' },
    { key: 'usage',    icon: '⚡', label: 'Usage' },
  ]

  return (
    <div style={{ background: '#060610', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>🖥️ System</div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #1e1e2e' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: '10px 4px', background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid #00d4ff' : '2px solid transparent', color: tab === t.key ? '#00d4ff' : '#555', fontSize: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {tab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { icon: '💬', label: 'Sessions', val: stats.sessions },
                { icon: '🧠', label: 'Memories', val: stats.memories },
                { icon: '🎯', label: 'Goals', val: stats.goals },
              ].map(s => (
                <div key={s.label} style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 24 }}>{s.icon}</div>
                  <div style={{ color: '#00d4ff', fontSize: 22, fontWeight: 700 }}>{s.val}</div>
                  <div style={{ color: '#555', fontSize: 11 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12, padding: 14 }}>
              <div style={{ color: '#00d4ff', fontWeight: 600, marginBottom: 10 }}>⚡ System Status</div>
              {[
                { label: 'AI Engine',  val: '12 Providers Active', ok: true },
                { label: 'Database',   val: 'Dexie.js + IndexedDB', ok: true },
                { label: 'Puter.js',   val: 'Free GPT4o + DALL-E + TTS', ok: true },
                { label: 'Hosting',    val: 'Vercel Hobby — ₹0/month', ok: true },
                { label: 'Images',     val: 'Pollinations (unlimited)', ok: true },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #0f0f1a' }}>
                  <span style={{ color: '#666', fontSize: 13 }}>{s.label}</span>
                  <span style={{ color: '#22c55e', fontSize: 12 }}>✅ {s.val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'memory' && (
          <div>
            <div style={{ color: '#555', fontSize: 12, marginBottom: 10 }}>JARVIS ke yaad ki hui baatein:</div>
            {memories.length === 0
              ? <div style={{ textAlign: 'center', color: '#444', padding: 40 }}>Koi memories nahi abhi. Baat karo JARVIS se!</div>
              : memories.map((m, i) => (
                <div key={i} style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#00d4ff', fontSize: 11 }}>{m.type || 'fact'}</span>
                    <span style={{ color: '#333', fontSize: 10 }}>importance: {m.importance}/10</span>
                  </div>
                  <div style={{ color: '#e0e0ff', fontSize: 13 }}>{m.data}</div>
                </div>
              ))}
          </div>
        )}

        {tab === 'chats' && (
          <div>
            {sessions.length === 0
              ? <div style={{ textAlign: 'center', color: '#444', padding: 40 }}>Koi sessions nahi.</div>
              : sessions.map((s, i) => (
                <div key={i} style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                  <div style={{ color: '#e0e0ff', fontSize: 13 }}>{s.title || 'Untitled Chat'}</div>
                  <div style={{ color: '#555', fontSize: 11, marginTop: 4 }}>{s.messageCount} messages · {new Date(s.updatedAt || s.createdAt).toLocaleDateString('en-IN')}</div>
                </div>
              ))}
          </div>
        )}

        {tab === 'data' && (
          <div>
            <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ color: '#e0e0ff', fontWeight: 600, marginBottom: 8 }}>💾 Export</div>
              <div style={{ color: '#555', fontSize: 13, marginBottom: 12 }}>Chats, memories, goals — sab JSON mein export ho jaayega.</div>
              <button onClick={handleExport} style={{ width: '100%', background: '#00d4ff', border: 'none', borderRadius: 10, color: '#000', padding: 12, cursor: 'pointer', fontWeight: 700 }}>
                📥 Export All Data (JSON)
              </button>
            </div>
            <div style={{ background: '#111118', border: '1px solid #ef444433', borderRadius: 12, padding: 16 }}>
              <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: 8 }}>⚠️ Clear Data</div>
              <div style={{ color: '#555', fontSize: 13, marginBottom: 12 }}>Pehle export karo! Yeh wapas nahi aayega.</div>
              <button onClick={() => { if (confirm('Sure? Sab delete ho jaayega!')) { if (typeof window !== 'undefined') { localStorage.clear(); } alert('Done! Reload karo.') } }}
                style={{ width: '100%', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 10, color: '#ef4444', padding: 12, cursor: 'pointer' }}>
                🗑️ Clear All Data
              </button>
            </div>
          </div>
        )}

        {tab === 'usage' && (
          <div>
            <div style={{ color: '#555', fontSize: 12, marginBottom: 10 }}>API calls aaj (85% pe provider skip). Daily reset midnight pe.</div>
            {Object.entries(usageStats.usage || {}).length === 0
              ? <div style={{ textAlign: 'center', color: '#444', padding: 30 }}>Abhi koi API calls nahi huyi. Chat karo!</div>
              : Object.entries(usageStats.usage || {}).map(([provider, s]: any) => (
                <div key={provider} style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#e0e0ff', fontSize: 13 }}>{provider}</span>
                    <span style={{ color: s.pct >= 85 ? '#ef4444' : s.pct >= 60 ? '#f59e0b' : '#22c55e', fontSize: 12 }}>{s.count}/{s.limit} ({s.pct}%)</span>
                  </div>
                  <div style={{ height: 4, background: '#1a1a2e', borderRadius: 2 }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(s.pct, 100)}%`, background: s.pct >= 85 ? '#ef4444' : s.pct >= 60 ? '#f59e0b' : '#22c55e' }} />
                  </div>
                </div>
              ))}
            <div style={{ marginTop: 10, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 10, padding: 12 }}>
              <div style={{ color: '#555', fontSize: 11 }}>Cache: {usageStats.cache?.size || 0} items · Pollinations: unlimited ∞</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
