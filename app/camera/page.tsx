'use client'
import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { buildSystemPrompt } from '@/lib/personality'

export default function CameraPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [streaming, setStreaming] = useState(false)
  const [captured, setCaptured] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState('')
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setStreaming(true)
        setError('')
      }
    } catch {
      setError('Camera permission chahiye. Browser settings mein allow karo.')
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
      setStreaming(false)
    }
  }

  useEffect(() => () => { stopCamera() }, [])

  const capture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setCaptured(dataUrl)
    stopCamera()
    setResult('')
  }

  const analyze = async (prompt?: string) => {
    if (!captured) return
    setAnalyzing(true)
    setResult('')
    try {
      const sysPrompt = await buildSystemPrompt().catch(() => '')
      const base64 = captured.split(',')[1]
      const q = prompt || question || 'Yeh image mein kya hai? Describe karo.'
      const res = await fetch('/api/vision', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, question: q, systemPrompt: sysPrompt }),
      })
      const d = await res.json()
      if (d.result) setResult(d.result)
      else if (d.error) setResult('Error: ' + d.error)
    } catch { setResult('Vision API se connect nahi ho paya.') }
    setAnalyzing(false)
  }

  const QUICK_PROMPTS = [
    { label: '📖 Text padho', q: 'Is image mein jo bhi text/writing hai woh exactly read karke batao.' },
    { label: '🔢 Math solve', q: 'Is image mein koi math problem ya equation hai toh solve karo.' },
    { label: '🌱 Plant ID', q: 'Is image mein kaunsa plant/flower/tree hai? Scientific name bhi batao.' },
    { label: '🍽️ Food ID', q: 'Yeh kaunsa khana hai? Ingredients aur calorie estimate batao.' },
    { label: '📊 Data read', q: 'Is image mein koi chart, graph ya table hai toh data read karke explain karo.' },
    { label: '🔍 Details', q: 'Is image ki detailed description do — objects, colors, context sab batao.' },
  ]

  return (
    <div style={{ background: '#060610', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>📷 JARVIS Vision</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 10, padding: 12, marginBottom: 12, color: '#ef4444', fontSize: 13 }}>⚠️ {error}</div>}

        {/* Camera / Preview */}
        <div style={{ borderRadius: 14, overflow: 'hidden', background: '#111118', marginBottom: 12, aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {!streaming && !captured && (
            <div style={{ textAlign: 'center', color: '#444' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>📷</div>
              <div style={{ fontSize: 13 }}>Camera band hai</div>
            </div>
          )}
          <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: streaming ? 'block' : 'none' }} playsInline muted />
          {captured && !streaming && <img src={captured} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* Camera controls */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {!streaming && !captured && (
            <button onClick={startCamera} style={{ flex: 1, background: '#00d4ff', border: 'none', borderRadius: 10, color: '#000', padding: 12, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
              📷 Camera On
            </button>
          )}
          {streaming && (
            <button onClick={capture} style={{ flex: 1, background: '#22c55e', border: 'none', borderRadius: 10, color: '#000', padding: 12, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
              📸 Capture
            </button>
          )}
          {captured && (
            <>
              <button onClick={() => { setCaptured(null); setResult(''); startCamera() }} style={{ flex: 1, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 10, color: '#888', padding: 12, cursor: 'pointer', fontSize: 13 }}>
                🔄 Retake
              </button>
              <button onClick={() => analyze()} disabled={analyzing} style={{ flex: 1, background: '#00d4ff', border: 'none', borderRadius: 10, color: '#000', padding: 12, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                {analyzing ? '⏳ Analyzing...' : '🤖 Analyze'}
              </button>
            </>
          )}
        </div>

        {/* Quick prompts */}
        {captured && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: '#555', fontSize: 11, marginBottom: 8 }}>QUICK ANALYSIS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {QUICK_PROMPTS.map(p => (
                <button key={p.label} onClick={() => analyze(p.q)} disabled={analyzing}
                  style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 10, color: '#888', padding: '9px 8px', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom question */}
        {captured && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === 'Enter' && analyze()}
              placeholder="Koi bhi sawaal poocho..."
              style={{ flex: 1, background: '#111118', border: '1px solid #2a2a4a', borderRadius: 10, padding: '9px 12px', color: '#e0e0ff', fontSize: 13, outline: 'none' }} />
            <button onClick={() => analyze()} disabled={analyzing || !question.trim()}
              style={{ background: '#00d4ff', border: 'none', borderRadius: 10, color: '#000', padding: '0 14px', cursor: 'pointer', fontWeight: 700 }}>
              {analyzing ? '⏳' : '→'}
            </button>
          </div>
        )}

        {/* Upload from gallery */}
        {!streaming && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', background: '#111118', border: '1px dashed #2a2a4a', borderRadius: 10, padding: 12, cursor: 'pointer', textAlign: 'center', color: '#555', fontSize: 13 }}>
              📁 Gallery se photo upload karo
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => { setCaptured(ev.target?.result as string); setResult('') }
                reader.readAsDataURL(file)
              }} />
            </label>
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ background: 'rgba(0,212,255,0.03)', border: '1px solid #1e1e2e', borderRadius: 12, padding: 14 }}>
            <div style={{ color: '#555', fontSize: 11, marginBottom: 6 }}>JARVIS SAYS</div>
            <div style={{ color: '#c8e8ff', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{result}</div>
            <button onClick={() => navigator.clipboard?.writeText(result)} style={{ marginTop: 8, background: 'none', border: '1px solid #333', borderRadius: 6, color: '#444', padding: '4px 12px', cursor: 'pointer', fontSize: 11 }}>📋 Copy</button>
          </div>
        )}
      </div>
    </div>
  )
}
