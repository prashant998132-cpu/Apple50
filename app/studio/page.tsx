'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { buildSystemPrompt } from '@/lib/personality'
import { saveResult, getResults, type SavedResult } from '@/lib/db'

type Mode = 'image' | 'story' | 'poem' | 'script' | 'code'

const MODES: { k: Mode; icon: string; label: string; hint: string }[] = [
  { k: 'image',  icon: '🖼️', label: 'AI Image',  hint: 'Describe karo — Pollinations generate karega' },
  { k: 'story',  icon: '📖', label: 'Story',      hint: 'Topic batao — JARVIS likhega' },
  { k: 'poem',   icon: '🌸', label: 'Poem/Shayari',hint: 'Hinglish mein khubsoorat shayari' },
  { k: 'script', icon: '🎬', label: 'YouTube Script', hint: 'Topic → full video script' },
  { k: 'code',   icon: '💻', label: 'Code',       hint: 'Kya banana hai batao' },
]

export default function StudioPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('image')
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState<SavedResult[]>([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    getResults('script', 10).then(r => setHistory(r)).catch(() => {})
  }, [])

  const generate = async () => {
    if (!prompt.trim()) return
    setLoading(true); setResult(''); setImageUrl(''); setSaved(false)

    if (mode === 'image') {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ', high quality, detailed, artistic')}?width=1024&height=1024&nologo=true&seed=${Date.now()}`
      setImageUrl(url)
      setLoading(false)
      return
    }

    const sysMap: Record<string, string> = {
      story:  'You are a creative Hinglish writer. Write an engaging short story (200-300 words) in Hinglish (Hindi+English mix). Use vivid descriptions, relatable Indian context.',
      poem:   'You are a Hinglish poet. Write a beautiful poem or shayari (8-16 lines) in Hinglish. Emotional, rhythmic, meaningful. End with a powerful line.',
      script: 'You are a YouTube script writer for Indian creators. Write a complete video script with: Hook (15 sec), Intro, 3-4 main points with examples, CTA. Hinglish. Engaging and practical.',
      code:   'You are an expert programmer. Write clean, well-commented code. Include: explanation, the code in a code block, and how to run it. Be concise but complete.',
    }

    try {
      const [sysPrompt, modeSystem] = await Promise.all([
        buildSystemPrompt().catch(() => ''),
        Promise.resolve(sysMap[mode] || ''),
      ])
      const fullSystem = `${sysPrompt}\n\n${modeSystem}`

      const res = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          mode: mode === 'code' ? 'think' : 'flash',
          systemPrompt: fullSystem,
        }),
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ')) {
            try { const d = JSON.parse(line.slice(6)); if (d.type === 'delta') { text += d.text; setResult(text) } } catch {}
          }
        }
      }
      // Auto-save to IndexedDB
      if (text.length > 50) {
        const type = mode === 'script' ? 'script' : mode === 'story' || mode === 'poem' ? 'note' : 'other'
        await saveResult(prompt, text, type as any).catch(() => {})
      }
    } catch { setResult('Error generating. Try again!') }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!result) return
    await saveResult(prompt, result).catch(() => {})
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(result)
  }

  return (
    <div style={{ background: '#060610', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>🎨 AI Studio</div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowHistory(!showHistory)} style={{ background: 'none', border: '1px solid #1e1e2e', borderRadius: 8, color: '#555', padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
          📚 History
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {/* Mode selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
          {MODES.map(m => (
            <button key={m.k} onClick={() => setMode(m.k)} style={{
              flexShrink: 0, padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
              background: mode === m.k ? 'rgba(0,212,255,0.15)' : '#111118',
              border: mode === m.k ? '1px solid #00d4ff' : '1px solid #1e1e2e',
              color: mode === m.k ? '#00d4ff' : '#555', fontSize: 12,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 64,
            }}>
              <span style={{ fontSize: 18 }}>{m.icon}</span>{m.label}
            </button>
          ))}
        </div>

        <div style={{ color: '#333', fontSize: 11, marginBottom: 10 }}>
          💡 {MODES.find(m => m.k === mode)?.hint}
        </div>

        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && e.ctrlKey && generate()}
          placeholder={mode === 'image' ? 'Image describe karo... (Ctrl+Enter to generate)' : 'Topic ya idea batao... (Ctrl+Enter to generate)'}
          rows={3}
          style={{ width: '100%', background: '#111118', border: '1px solid #2a2a4a', borderRadius: 10, padding: '10px 12px', color: '#e0e0ff', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: 10 }}
        />

        <button onClick={generate} disabled={loading || !prompt.trim()} style={{
          width: '100%', background: loading ? '#1a1a2e' : '#00d4ff',
          border: 'none', borderRadius: 10, color: loading ? '#555' : '#000',
          padding: 12, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 15, marginBottom: 14,
        }}>
          {loading ? '⏳ Creating...' : `✨ Generate ${MODES.find(m => m.k === mode)?.label}`}
        </button>

        {/* Image result */}
        {imageUrl && (
          <div>
            <img src={imageUrl} alt="AI Generated" style={{ width: '100%', borderRadius: 12, marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <a href={imageUrl} download target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, textAlign: 'center', background: '#111118', border: '1px solid #2a2a4a', borderRadius: 8, padding: 8, color: '#888', fontSize: 12, textDecoration: 'none' }}>
                ⬇️ Download
              </a>
              <button onClick={() => { const p2 = prompt + ` variation ${Date.now()}`; setPrompt(p2); generate() }}
                style={{ flex: 1, background: '#111118', border: '1px solid #2a2a4a', borderRadius: 8, color: '#888', fontSize: 12, cursor: 'pointer' }}>
                🔄 Variation
              </button>
            </div>
          </div>
        )}

        {/* Text result */}
        {result && (
          <div style={{ background: 'rgba(0,212,255,0.03)', border: '1px solid #1e1e2e', borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ color: '#e0e0ff', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 12 }}>{result}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCopy} style={{ flex: 1, background: '#111118', border: '1px solid #2a2a4a', borderRadius: 8, color: '#888', padding: 8, cursor: 'pointer', fontSize: 12 }}>📋 Copy</button>
              <button onClick={handleSave} style={{ flex: 1, background: saved ? '#22c55e22' : '#111118', border: `1px solid ${saved ? '#22c55e' : '#2a2a4a'}`, borderRadius: 8, color: saved ? '#22c55e' : '#888', padding: 8, cursor: 'pointer', fontSize: 12 }}>
                {saved ? '✅ Saved!' : '💾 Save'}
              </button>
            </div>
          </div>
        )}

        {/* History */}
        {showHistory && history.length > 0 && (
          <div>
            <div style={{ color: '#555', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>RECENT CREATIONS</div>
            {history.map(h => (
              <div key={h.id} onClick={() => setResult(h.content)}
                style={{ background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: 10, padding: 10, marginBottom: 6, cursor: 'pointer' }}>
                <div style={{ color: '#888', fontSize: 12, marginBottom: 3 }}>{h.title}</div>
                <div style={{ color: '#444', fontSize: 10 }}>{new Date(h.createdAt).toLocaleDateString('en-IN')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
