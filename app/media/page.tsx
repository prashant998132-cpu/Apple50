'use client'
import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { buildSystemPrompt } from '@/lib/personality'

type Tab = 'images' | 'qr' | 'youtube' | 'wallpaper'

const WALLPAPER_PROMPTS = [
  { name: 'Space Galaxy', p: 'ultra hd space galaxy nebula stars cosmic purple blue cinematic wallpaper' },
  { name: 'Cyberpunk City', p: 'cyberpunk neon city night rain reflections 4k wallpaper' },
  { name: 'Nature Forest', p: 'misty enchanted forest morning light rays 4k wallpaper' },
  { name: 'Abstract Art', p: 'colorful abstract geometric art fluid modern 4k wallpaper' },
  { name: 'Ocean Sunset', p: 'dramatic ocean sunset golden hour waves 4k wallpaper' },
  { name: 'Mountain Snow', p: 'himalayan mountain peak snow sunrise dramatic 4k wallpaper' },
  { name: 'Anime Aesthetic', p: 'anime aesthetic lofi city night cherry blossom 4k wallpaper' },
  { name: 'JARVIS Style', p: 'iron man JARVIS holographic blue interface sci-fi 4k wallpaper' },
]

interface SavedImage { url: string; prompt: string; ts: number }

export default function MediaPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('images')
  const [images, setImages] = useState<SavedImage[]>([])
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [qrText, setQrText] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [ytQuery, setYtQuery] = useState('')
  const [ytResults, setYtResults] = useState<any[]>([])
  const [ytLoading, setYtLoading] = useState(false)
  const [aiExpanding, setAiExpanding] = useState(false)

  const generateImage = (p: string, label?: string) => {
    const key = label || p
    setLoading(key)
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(p + ', ultra hd, high quality')}?width=1024&height=1024&nologo=true&seed=${Date.now()}`
    const img = new window.Image()
    img.onload = img.onerror = () => {
      setImages(prev => [{ url, prompt: label || p, ts: Date.now() }, ...prev].slice(0, 20))
      setLoading(null)
    }
    img.src = url
  }

  const handleGenerate = () => {
    if (!prompt.trim()) return
    generateImage(prompt.trim())
    setPrompt('')
  }

  const expandPromptAI = async () => {
    if (!prompt.trim()) return
    setAiExpanding(true)
    try {
      const res = await fetch('/api/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Expand this into a detailed AI image prompt (15-20 words, English, no explanation): "${prompt}"` }],
          mode: 'flash', noStream: true,
        }),
      })
      const d = await res.json()
      if (d.content) setPrompt(d.content.replace(/^["']|["']$/g, '').trim())
    } catch {}
    setAiExpanding(false)
  }

  const generateQR = () => {
    if (!qrText.trim()) return
    setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrText)}&bgcolor=060610&color=00d4ff&qzone=1`)
  }

  const searchYouTube = async () => {
    if (!ytQuery.trim()) return
    setYtLoading(true); setYtResults([])
    try {
      const res = await fetch('/api/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `YouTube pe "${ytQuery}" ke liye 5 best video titles suggest karo. Format: JSON array [{title, channel, duration, url}] where url = https://www.youtube.com/results?search_query=ENCODED_TITLE. Only JSON, no explanation.` }],
          mode: 'flash', noStream: true,
        }),
      })
      const d = await res.json()
      const match = (d.content || '').match(/\[[\s\S]*\]/)
      if (match) setYtResults(JSON.parse(match[0]))
    } catch {}
    setYtLoading(false)
  }

  const TABS = [
    { k: 'images' as Tab, icon: '🎨', label: 'AI Images' },
    { k: 'wallpaper' as Tab, icon: '🖼️', label: 'Wallpapers' },
    { k: 'qr' as Tab, icon: '📱', label: 'QR Code' },
    { k: 'youtube' as Tab, icon: '▶️', label: 'YouTube' },
  ]

  return (
    <div style={{ background: '#060610', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>🎨 Media Hub</div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #1e1e2e' }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{ flex: 1, padding: '9px 4px', background: 'none', border: 'none', borderBottom: tab === t.k ? '2px solid #00d4ff' : '2px solid transparent', color: tab === t.k ? '#00d4ff' : '#555', fontSize: 10, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 16 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

        {/* AI IMAGES */}
        {tab === 'images' && (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                placeholder="Describe the image..."
                style={{ flex: 1, background: '#111118', border: '1px solid #2a2a4a', borderRadius: 10, padding: '9px 12px', color: '#e0e0ff', fontSize: 13, outline: 'none' }} />
              <button onClick={expandPromptAI} disabled={aiExpanding || !prompt.trim()} title="AI se expand karwao"
                style={{ background: '#111120', border: '1px solid #2a2a4a', borderRadius: 8, color: '#888', padding: '0 10px', cursor: 'pointer', fontSize: 16 }}>
                {aiExpanding ? '⏳' : '✨'}
              </button>
              <button onClick={handleGenerate} disabled={!!loading || !prompt.trim()}
                style={{ background: '#00d4ff', border: 'none', borderRadius: 10, color: '#000', padding: '0 14px', cursor: 'pointer', fontWeight: 700 }}>
                Gen
              </button>
            </div>
            <div style={{ color: '#333', fontSize: 11, marginBottom: 12 }}>✨ = AI se prompt enhance karo</div>
            {images.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: 40, color: '#444' }}>
                <div style={{ fontSize: 48 }}>🎨</div>
                <div style={{ marginTop: 8 }}>Koi prompt daalo — AI image banayega</div>
              </div>
            )}
            {loading && <div style={{ textAlign: 'center', padding: 20, color: '#00d4ff', fontSize: 13 }}>⏳ Generating "{loading}"...</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {images.map((img, i) => (
                <div key={i} style={{ borderRadius: 12, overflow: 'hidden', background: '#111118' }}>
                  <img src={img.url} alt={img.prompt} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '6px 8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#444', fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.prompt}</span>
                    <a href={img.url} download={`jarvis-${i}.jpg`} target="_blank" rel="noopener noreferrer" style={{ color: '#555', fontSize: 14, textDecoration: 'none', marginLeft: 6 }}>⬇️</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WALLPAPERS */}
        {tab === 'wallpaper' && (
          <div>
            <div style={{ color: '#555', fontSize: 12, marginBottom: 12 }}>Phone wallpaper size (1024×1024) mein generate hoga</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {WALLPAPER_PROMPTS.map(w => (
                <button key={w.name} onClick={() => generateImage(w.p, w.name)} disabled={loading === w.name}
                  style={{ background: '#111118', border: `1px solid ${loading === w.name ? '#00d4ff' : '#1e1e2e'}`, borderRadius: 14, padding: 14, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 60, height: 60, borderRadius: 10, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                    {loading === w.name ? '⏳' : '🖼️'}
                  </div>
                  <span style={{ color: loading === w.name ? '#00d4ff' : '#888', fontSize: 12 }}>{w.name}</span>
                </button>
              ))}
            </div>
            {images.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ color: '#555', fontSize: 12, marginBottom: 8 }}>GENERATED</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {images.slice(0, 4).map((img, i) => (
                    <div key={i} style={{ borderRadius: 10, overflow: 'hidden' }}>
                      <img src={img.url} alt={img.prompt} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 6px', background: '#111118' }}>
                        <span style={{ color: '#555', fontSize: 10 }}>{img.prompt}</span>
                        <a href={img.url} download target="_blank" rel="noopener noreferrer" style={{ color: '#555', textDecoration: 'none' }}>⬇️</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* QR CODE */}
        {tab === 'qr' && (
          <div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>Website URL, text, phone number, UPI ID — kuch bhi QR mein convert karo</div>
            <input value={qrText} onChange={e => setQrText(e.target.value)} onKeyDown={e => e.key === 'Enter' && generateQR()}
              placeholder="URL ya text daalo..."
              style={{ width: '100%', background: '#111118', border: '1px solid #2a2a4a', borderRadius: 10, padding: '11px 12px', color: '#e0e0ff', fontSize: 14, outline: 'none', marginBottom: 10, boxSizing: 'border-box' }} />
            <button onClick={generateQR} style={{ width: '100%', background: '#00d4ff', border: 'none', borderRadius: 10, color: '#000', padding: 12, cursor: 'pointer', fontWeight: 700, marginBottom: 20 }}>
              📱 QR Code Generate Karo
            </button>

            {qrUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 16, padding: 16 }}>
                  <img src={qrUrl} alt="QR Code" style={{ width: 200, height: 200, borderRadius: 8 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <a href={qrUrl} download="jarvis-qr.png" target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, textAlign: 'center', background: '#111118', border: '1px solid #2a2a4a', borderRadius: 10, padding: 10, color: '#888', fontSize: 13, textDecoration: 'none' }}>
                    ⬇️ Download
                  </a>
                  <button onClick={() => { setQrUrl(''); setQrText('') }}
                    style={{ flex: 1, background: '#111118', border: '1px solid #2a2a4a', borderRadius: 10, color: '#888', padding: 10, cursor: 'pointer', fontSize: 13 }}>
                    🔄 New
                  </button>
                </div>
                <div style={{ color: '#555', fontSize: 11, textAlign: 'center' }}>{qrText}</div>
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <div style={{ color: '#555', fontSize: 12, marginBottom: 8 }}>QUICK QR</div>
              {[
                { label: '📸 Instagram Profile', val: 'https://instagram.com' },
                { label: '💬 WhatsApp', val: 'https://wa.me/' },
                { label: '📞 UPI Payment', val: 'upi://pay?pa=yourname@upi' },
                { label: '🌐 GitHub', val: 'https://github.com' },
              ].map(q => (
                <button key={q.label} onClick={() => { setQrText(q.val); generateQR() }}
                  style={{ display: 'block', width: '100%', background: '#111118', border: '1px solid #1e1e2e', borderRadius: 10, padding: '10px 12px', color: '#888', fontSize: 13, cursor: 'pointer', marginBottom: 6, textAlign: 'left' }}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* YOUTUBE SEARCH */}
        {tab === 'youtube' && (
          <div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>JARVIS YouTube ke best videos suggest karta hai</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input value={ytQuery} onChange={e => setYtQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchYouTube()}
                placeholder="Kya dekhna chahte ho?"
                style={{ flex: 1, background: '#111118', border: '1px solid #2a2a4a', borderRadius: 10, padding: '10px 12px', color: '#e0e0ff', fontSize: 14, outline: 'none' }} />
              <button onClick={searchYouTube} disabled={ytLoading || !ytQuery.trim()}
                style={{ background: '#ff0000', border: 'none', borderRadius: 10, color: '#fff', padding: '0 16px', cursor: 'pointer', fontWeight: 700 }}>
                {ytLoading ? '⏳' : '▶'}
              </button>
            </div>

            {ytLoading && <div style={{ textAlign: 'center', color: '#888', padding: 20 }}>🤖 JARVIS suggestions dhoondh raha hai...</div>}

            {ytResults.length > 0 && ytResults.map((v: any, i) => (
              <a key={i} href={v.url || `https://www.youtube.com/results?search_query=${encodeURIComponent(v.title)}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12, padding: 12, marginBottom: 8, display: 'flex', gap: 10 }}>
                  <div style={{ width: 44, height: 44, background: '#1a0000', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>▶️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#e0e0ff', fontSize: 13, lineHeight: 1.4, marginBottom: 3 }}>{v.title}</div>
                    <div style={{ color: '#555', fontSize: 11 }}>{v.channel || 'YouTube'} {v.duration ? `· ${v.duration}` : ''}</div>
                  </div>
                </div>
              </a>
            ))}

            {ytResults.length === 0 && !ytLoading && (
              <div>
                <div style={{ color: '#555', fontSize: 12, marginBottom: 8 }}>POPULAR SEARCHES</div>
                {['NEET 2025 preparation', 'Physics class 12 NCERT', 'Learn coding Python', 'Motivation study', 'JARVIS Iron Man'].map(q => (
                  <button key={q} onClick={() => { setYtQuery(q); searchYouTube() }}
                    style={{ display: 'block', width: '100%', background: '#111118', border: '1px solid #1e1e2e', borderRadius: 10, padding: '10px 12px', color: '#888', fontSize: 13, cursor: 'pointer', marginBottom: 6, textAlign: 'left' }}>
                    🔍 {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
