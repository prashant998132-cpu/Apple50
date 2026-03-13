'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { buildSystemPrompt } from '@/lib/personality'

const TEMPLATES = [
  { name: 'Study Schedule', icon: '📚', prompt: 'NEET study timetable, colorful, organized, motivational poster' },
  { name: 'Motivational Poster', icon: '💪', prompt: 'motivational quote poster for students, bold text, inspiring' },
  { name: 'Mind Map', icon: '🧠', prompt: 'mind map diagram, colorful branches, knowledge tree, educational' },
  { name: 'Biology Cell', icon: '🔬', prompt: 'biology animal cell diagram, detailed labeled, educational illustration' },
  { name: 'Chemistry Lab', icon: '⚗️', prompt: 'chemistry laboratory illustration, test tubes, colorful, science' },
  { name: 'Physics Diagram', icon: '⚡', prompt: 'physics force diagram, vectors, clean scientific illustration' },
  { name: 'India Map', icon: '🗺️', prompt: 'India map illustration, artistic, colorful states, detailed' },
  { name: 'Space Poster', icon: '🚀', prompt: 'space exploration poster, galaxy, planets, astronaut, cinematic' },
  { name: 'Human Anatomy', icon: '🫀', prompt: 'human anatomy diagram, heart, lungs, detailed medical illustration' },
  { name: 'Periodic Table', icon: '⚛️', prompt: 'periodic table elements, colorful, beautiful chemistry poster' },
  { name: 'DNA Structure', icon: '🧬', prompt: 'DNA double helix structure, colorful, scientific, detailed' },
  { name: 'Neuron Diagram', icon: '🧪', prompt: 'neuron synapse diagram, axon dendrite, detailed biology illustration' },
]

interface SavedImage { url: string; prompt: string; timestamp: number }

export default function CanvaPage() {
  const router = useRouter()
  const [customPrompt, setCustomPrompt] = useState('')
  const [images, setImages] = useState<SavedImage[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [style, setStyle] = useState<'realistic' | 'cartoon' | 'diagram' | 'poster'>('diagram')
  const [aiPrompt, setAiPrompt] = useState('')
  const [expandingPrompt, setExpandingPrompt] = useState(false)

  const styleMap = { realistic: 'photorealistic, detailed', cartoon: 'cartoon style, vibrant', diagram: 'clean diagram, educational, labeled', poster: 'poster design, bold, colorful' }

  const generate = async (prompt: string) => {
    setLoading(prompt)
    const fullPrompt = `${prompt}, ${styleMap[style]}, high quality`
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1024&height=1024&nologo=true&seed=${Date.now()}`
    // Pre-load image then show
    const img = new Image()
    img.onload = () => {
      setImages(prev => [{ url, prompt, timestamp: Date.now() }, ...prev])
      setLoading(null)
    }
    img.onerror = () => {
      setImages(prev => [{ url, prompt, timestamp: Date.now() }, ...prev])
      setLoading(null)
    }
    img.src = url
  }

  const handleCustom = () => {
    if (!customPrompt.trim()) return
    generate(customPrompt.trim())
    setCustomPrompt('')
  }

  // JARVIS expand the prompt using AI
  const expandWithAI = async () => {
    if (!customPrompt.trim()) return
    setExpandingPrompt(true)
    try {
      const sysPrompt = await buildSystemPrompt().catch(() => '')
      const res = await fetch('/api/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Iss image prompt ko better aur detailed banao for AI image generation (10-15 words, English only, no explanation): "${customPrompt}"` }],
          mode: 'flash', systemPrompt: sysPrompt, noStream: true,
        }),
      })
      const d = await res.json()
      if (d.content) setCustomPrompt(d.content.trim().replace(/^["']|["']$/g, ''))
    } catch {}
    setExpandingPrompt(false)
  }

  return (
    <div style={{ background: '#060610', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>🖌️ Canva — AI Images</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {/* Style selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
          {(['diagram', 'poster', 'realistic', 'cartoon'] as const).map(s => (
            <button key={s} onClick={() => setStyle(s)} style={{
              flexShrink: 0, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
              background: style === s ? 'rgba(0,212,255,0.15)' : '#111118',
              border: style === s ? '1px solid #00d4ff' : '1px solid #1e1e2e',
              color: style === s ? '#00d4ff' : '#555',
            }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>

        {/* Custom prompt */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustom()}
            placeholder="Apna prompt likho..."
            style={{ flex: 1, background: '#111118', border: '1px solid #2a2a4a', borderRadius: 10, padding: '9px 12px', color: '#e0e0ff', fontSize: 14, outline: 'none' }} />
          <button onClick={expandWithAI} disabled={expandingPrompt || !customPrompt.trim()}
            title="JARVIS se prompt better karwao"
            style={{ background: '#111120', border: '1px solid #2a2a4a', borderRadius: 10, color: '#888', padding: '0 10px', cursor: 'pointer', fontSize: 16 }}>
            {expandingPrompt ? '⏳' : '✨'}
          </button>
          <button onClick={handleCustom} disabled={!!loading || !customPrompt.trim()}
            style={{ background: '#00d4ff', border: 'none', borderRadius: 10, color: '#000', padding: '0 14px', cursor: 'pointer', fontWeight: 700 }}>
            Gen
          </button>
        </div>
        <div style={{ color: '#333', fontSize: 11, marginBottom: 14 }}>✨ = JARVIS se prompt expand karwao</div>

        {/* Templates grid */}
        <div style={{ color: '#555', fontSize: 11, marginBottom: 8, fontWeight: 600 }}>TEMPLATES</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
          {TEMPLATES.map(t => (
            <button key={t.name} onClick={() => generate(t.prompt)} disabled={!!loading}
              style={{ background: loading === t.prompt ? 'rgba(0,212,255,0.1)' : '#111118', border: `1px solid ${loading === t.prompt ? '#00d4ff' : '#1e1e2e'}`, borderRadius: 12, padding: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: loading === t.prompt ? 24 : 26 }}>{loading === t.prompt ? '⏳' : t.icon}</span>
              <span style={{ color: '#666', fontSize: 10, textAlign: 'center', lineHeight: 1.3 }}>{t.name}</span>
            </button>
          ))}
        </div>

        {/* Generated images */}
        {images.length > 0 && (
          <>
            <div style={{ color: '#555', fontSize: 11, marginBottom: 8, fontWeight: 600 }}>GENERATED ({images.length})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {images.map((img, i) => (
                <div key={i} style={{ borderRadius: 12, overflow: 'hidden', background: '#111118' }}>
                  <img src={img.url} alt={img.prompt} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                    onError={e => (e.currentTarget.style.opacity = '0.3')} />
                  <div style={{ padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#444', fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.prompt}</span>
                    <a href={img.url} download target="_blank" rel="noopener noreferrer"
                      style={{ color: '#555', fontSize: 14, textDecoration: 'none', marginLeft: 6 }}>⬇️</a>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
