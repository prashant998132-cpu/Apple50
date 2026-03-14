'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { buildSystemPrompt } from '@/lib/personality'

const QUICK_LINKS = [
  { icon: '🚂', label: 'Train Status', url: 'https://www.railyatri.in/live-train-status' },
  { icon: '✈️', label: 'Flights', url: 'https://www.indigo.in' },
  { icon: '🏏', label: 'Cricket', url: 'https://www.espncricinfo.com/live-cricket-score' },
  { icon: '📈', label: 'NSE', url: 'https://www.nseindia.com' },
  { icon: '📰', label: 'Times of India', url: 'https://timesofindia.com' },
  { icon: '🏛️', label: 'Govt Portal', url: 'https://india.gov.in' },
  { icon: '💊', label: 'Aarogya Setu', url: 'https://www.aarogyasetu.gov.in' },
  { icon: '🎓', label: 'NTA NEET', url: 'https://neet.nta.nic.in' },
]

const INDIA_SHORTCUTS = [
  { icon: '🚂', label: 'PNR status?', prompt: 'PNR status check karne ka process batao step by step' },
  { icon: '🏏', label: 'Cricket score?', prompt: 'Aaj ka live cricket score kaise check karein? Apps batao' },
  { icon: '💰', label: 'UPI problems?', prompt: 'UPI transaction fail ho gayi — kya karna chahiye? Steps batao' },
  { icon: '🏥', label: 'NEET 2025?', prompt: 'NEET 2025 exam date, syllabus aur preparation tips batao' },
  { icon: '📱', label: 'Aadhaar update?', prompt: 'Aadhaar card mein address update karne ka process batao' },
  { icon: '📊', label: 'NSE/BSE?', prompt: 'Indian stock market basics — NSE BSE kaise kaam karta hai beginners ke liye' },
  { icon: '🌦️', label: 'IMD forecast?', prompt: 'India mein monsoon forecast kaise check karein aur IMD kya hai' },
  { icon: '🎯', label: 'Govt schemes?', prompt: 'Students ke liye best government schemes 2025 — PM scholarships, loans etc.' },
]

export default function IndiaHubPage() {
  const router = useRouter()
  const [weather, setWeather] = useState<any>(null)
  const [news, setNews] = useState<any[]>([])
  const [city, setCity] = useState('Maihar')
  const [aiResponse, setAiResponse] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [customQuery, setCustomQuery] = useState('')
  const [activePrompt, setActivePrompt] = useState('')

  useEffect(() => { loadWeather() }, [])

  const loadWeather = async () => {
    try {
      const [wRes, nRes] = await Promise.allSettled([
        fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`).then(r => r.json()),
        fetch('https://hacker-news.firebaseio.com/v0/topstories.json').then(r => r.json()).then(async ids => {
          const top = await Promise.all(ids.slice(0, 4).map((id: number) =>
            fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
          ))
          return top.filter(Boolean)
        }),
      ])
      if (wRes.status === 'fulfilled') setWeather(wRes.value)
      if (nRes.status === 'fulfilled') setNews(nRes.value)
    } catch {}
  }

  const askJARVIS = async (prompt: string) => {
    if (!prompt.trim()) return
    setAiLoading(true); setAiResponse(''); setActivePrompt(prompt)
    try {
      const sysPrompt = await buildSystemPrompt().catch(() => '')
      const fullSys = `${sysPrompt}\n\nTum India Hub mein ho. India-specific, practical, helpful answers do. Hindi/Hinglish preferred. Real links aur steps do jahan possible ho.`
      const res = await fetch('/api/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], mode: 'flash', systemPrompt: fullSys }),
      })
      const reader = res.body!.getReader(); const decoder = new TextDecoder(); let text = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ')) { try { const d = JSON.parse(line.slice(6)); if (d.type === 'delta') { text += d.text; setAiResponse(text) } } catch {} }
        }
      }
    } catch { setAiResponse('Error. Dobara try karo.') }
    setAiLoading(false)
  }

  const temp = weather?.current_condition?.[0]?.temp_C
  const desc = weather?.current_condition?.[0]?.weatherDesc?.[0]?.value
  const humidity = weather?.current_condition?.[0]?.humidity

  return (
    <div style={{ background: '#060610', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>🇮🇳 India Hub</div>
        <div style={{ flex: 1 }} />
        <input value={city} onChange={e => setCity(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadWeather()}
          placeholder="City" style={{ background: '#111118', border: '1px solid #2a2a4a', borderRadius: 8, padding: '4px 8px', color: '#e0e0ff', fontSize: 13, outline: 'none', width: 70 }} />
        <button onClick={loadWeather} style={{ background: '#00d4ff', border: 'none', borderRadius: 8, color: '#000', padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Go</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {/* Weather card */}
        {weather && (
          <div style={{ background: 'linear-gradient(135deg, #001f3f, #003366)', borderRadius: 16, padding: 16, marginBottom: 14, border: '1px solid rgba(0,212,255,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{city}</div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{desc}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#fff', fontSize: 32, fontWeight: 700 }}>{temp}°C</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Humidity: {humidity}%</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
              {[
                { label: 'Wind', val: `${weather.current_condition?.[0]?.windspeedKmph} km/h` },
                { label: 'Feels Like', val: `${weather.current_condition?.[0]?.FeelsLikeC}°C` },
                { label: 'UV Index', val: weather.current_condition?.[0]?.uvIndex || '-' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>{item.label}</div>
                  <div style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* JARVIS India Assistant */}
        <div style={{ background: '#0a0a14', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 14, padding: 12, marginBottom: 14 }}>
          <div style={{ color: '#00d4ff', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>🤖 JARVIS India Assistant</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 10 }}>
            {INDIA_SHORTCUTS.map(s => (
              <button key={s.label} onClick={() => askJARVIS(s.prompt)}
                style={{ background: activePrompt === s.prompt && aiLoading ? 'rgba(0,212,255,0.12)' : '#111120', border: '1px solid #1e1e2e', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left' }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <span style={{ color: '#888', fontSize: 11 }}>{s.label}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={customQuery} onChange={e => setCustomQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && askJARVIS(customQuery)}
              placeholder="Koi bhi India related sawal poocho..."
              style={{ flex: 1, background: '#111118', border: '1px solid #2a2a4a', borderRadius: 8, padding: '8px 12px', color: '#e0e0ff', fontSize: 13, outline: 'none' }} />
            <button onClick={() => askJARVIS(customQuery)} disabled={aiLoading || !customQuery.trim()}
              style={{ background: '#00d4ff', border: 'none', borderRadius: 8, color: '#000', padding: '0 14px', cursor: 'pointer', fontWeight: 700 }}>
              {aiLoading ? '⏳' : '→'}
            </button>
          </div>
          {aiResponse && (
            <div style={{ marginTop: 10, background: 'rgba(0,212,255,0.03)', border: '1px solid #1e1e2e', borderRadius: 10, padding: 12, color: '#c8e8ff', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 250, overflowY: 'auto' }}>
              {aiResponse}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: '#555', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>QUICK LINKS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {QUICK_LINKS.map(link => (
              <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer"
                style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12, padding: '12px 4px', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 22 }}>{link.icon}</span>
                <span style={{ color: '#666', fontSize: 10, textAlign: 'center' }}>{link.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Tech News */}
        {news.length > 0 && (
          <div>
            <div style={{ color: '#555', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>TRENDING (HN)</div>
            {news.map((item: any) => (
              <a key={item.id} href={item.url || `https://news.ycombinator.com/item?id=${item.id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 10, padding: 12, marginBottom: 8, display: 'flex', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>📰</span>
                  <div>
                    <div style={{ color: '#e0e0ff', fontSize: 13, lineHeight: 1.4 }}>{item.title}</div>
                    <div style={{ color: '#555', fontSize: 11, marginTop: 3 }}>⬆ {item.score} · {item.by}</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
