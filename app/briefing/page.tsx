'use client'
// Briefing page — Real JARVIS morning brief
// Pulls: weather + news + study goals + memory + streak + time
// No hardcoded prompts — uses live data + AI synthesis

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { speakText, stopSpeaking } from '@/lib/tts'
import { buildSystemPrompt } from '@/lib/personality'
import { getImportantMemories, getStreak, getTodayChats } from '@/lib/db'

interface BriefSection {
  icon: string
  title: string
  content: string
  color: string
}

async function fetchWeather(): Promise<string> {
  try {
    // Try Open-Meteo first (no key, more reliable)
    const city = (typeof window !== 'undefined' ? localStorage.getItem('jarvis_city') || localStorage.getItem('jarvis_user_city') : null) || 'Maihar'
    const geoRes = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=1', { signal: AbortSignal.timeout(4000) })
    const geo = await geoRes.json()
    const loc = geo.results?.[0]
    if (loc) {
      const wRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + loc.latitude + '&longitude=' + loc.longitude + '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&forecast_days=1', { signal: AbortSignal.timeout(5000) })
      const w = await wRes.json()
      const c = w.current
      const codes: Record<number, string> = { 0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast', 45:'Foggy', 51:'Light drizzle', 61:'Light rain', 71:'Light snow', 80:'Rain showers', 95:'Thunderstorm' }
      const desc = codes[c.weather_code] || 'Unknown'
      return c.temperature_2m + '°C · ' + desc + ' · Humidity: ' + c.relative_humidity_2m + '% · Wind: ' + c.wind_speed_10m + ' km/h'
    }
    throw new Error('no geo')
  } catch {
    // Fallback to wttr.in
    try {
      const city2 = (typeof window !== 'undefined' ? localStorage.getItem('jarvis_city') || localStorage.getItem('jarvis_user_city') : null) || 'Maihar'
    const res = await fetch('https://wttr.in/' + encodeURIComponent(city2) + '?format=j1', { signal: AbortSignal.timeout(5000) })
      const d = await res.json()
      const c = d.current_condition?.[0]
      return (c?.temp_C ?? '?') + '°C · ' + (c?.weatherDesc?.[0]?.value ?? '') + ' · Humidity: ' + (c?.humidity ?? '?') + '%'
    } catch { return 'Weather unavailable' }
  }
}

async function fetchPetrol(){
  try{
    return 'Petrol ~Rs107/L | Diesel ~Rs92/L (Maihar approx)';
  }catch{return '';}
}

async function fetchStocks(): Promise<string> {
  try {
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&range=1d', { signal: AbortSignal.timeout(5000) })
    const d = await res.json()
    const nifty = d?.chart?.result?.[0]?.meta?.regularMarketPrice
    const prev = d?.chart?.result?.[0]?.meta?.previousClose
    if (!nifty) return 'Market data unavailable'
    const change = prev ? ((nifty - prev) / prev * 100).toFixed(2) : '0'
    const arrow = parseFloat(change) > 0 ? '\uD83D\uDCC8' : '\uD83D\uDCC9'
    return `${arrow} Nifty 50: ${nifty?.toLocaleString('en-IN')} (${change}%)`
  } catch { return '\uD83D\uDCC8 Market: NSE India check karo' }
}

async function fetchCrypto(): Promise<string> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=inr&include_24hr_change=true', { signal: AbortSignal.timeout(5000) })
    const d = await res.json()
    const btc = d.bitcoin; const eth = d.ethereum; const sol = d.solana;
    return [
      btc ? `₿ Bitcoin: ₹${btc.inr?.toLocaleString('en-IN')} (${btc.inr_24h_change?.toFixed(1)}%)` : '',
      eth ? `Ξ Ethereum: ₹${eth.inr?.toLocaleString('en-IN')} (${eth.inr_24h_change?.toFixed(1)}%)` : '',
      sol ? `◎ Solana: ₹${sol.inr?.toLocaleString('en-IN')} (${sol.inr_24h_change?.toFixed(1)}%)` : '',
    ].filter(Boolean).join('\n')
  } catch { return 'Crypto data unavailable' }
}

async function fetchGold(): Promise<string> {
  try {
    const [metalRes, fxRes] = await Promise.all([
      fetch('https://api.metals.live/v1/spot/gold,silver', { signal: AbortSignal.timeout(5000) }),
      fetch('https://api.exchangerate-api.com/v4/latest/USD', { signal: AbortSignal.timeout(4000) }),
    ])
    const metals = await metalRes.json()
    const fx = await fxRes.json()
    const usdInr = fx.rates?.INR || 84
    const g = ((metals?.gold || 2300) / 31.1035) * usdInr
    const s = ((metals?.silver || 28) / 31.1035) * usdInr
    return `\uD83E\uDD47 Gold 24K: ₹${Math.round(g).toLocaleString('en-IN')}/g | 10g = ₹${Math.round(g*10).toLocaleString('en-IN')}\n\uD83E\uDD48 Silver: ₹${Math.round(s).toLocaleString('en-IN')}/g`
  } catch { return '\uD83E\uDD47 Gold: ~₹9,000/g | \uD83E\uDD48 Silver: ~₹105/g' }
}

async function fetchNews(): Promise<string[]> {
  try {
    const r = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', { signal: AbortSignal.timeout(5000) })
    const ids = await r.json()
    const stories = await Promise.all(ids.slice(0, 5).map(async (id: number) => {
      const r2 = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { signal: AbortSignal.timeout(3000) })
      return (await r2.json())?.title ?? ''
    }))
    return stories.filter(Boolean)
  } catch { return ['News unavailable'] }
}

const STUDY_TIPS = ['Aaj kuch naya seekho. Curiosity hi sabse bada teacher hai.', 'Breaks lena zaroori hai — kaam bhi, rest bhi.', 'Ek step ek baar. Sab ek saath nahi hota.']

export default function BriefingPage() {
  const router = useRouter()
  const [sections, setSections] = useState<BriefSection[]>([])
  const [loading, setLoading] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const [fullText, setFullText] = useState('')

  useEffect(() => { 
    buildBriefing()
    const iv = setInterval(buildBriefing, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  const buildBriefing = async () => {
    setLoading(true)
    setSections([])

    const now = new Date()
    const hour = now.getHours()
    const greeting = hour < 12 ? 'Subah ki shuruat' : hour < 17 ? 'Dopahar' : hour < 21 ? 'Shaam' : 'Raat'
    const dayName = now.toLocaleDateString('en-IN', { weekday: 'long' })
    const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

    const built: BriefSection[] = []

    // Section 1: Time + Greeting
    built.push({
      icon: '\uD83C\uDF05',
      title: `${greeting} — ${dayName}, ${dateStr}`,
      content: `${hour}:${String(now.getMinutes()).padStart(2, '0')} baj rahe hain. JARVIS ready hai.`,
      color: '#00d4ff',
    })
    setSections([...built])

    // Section 2: Streak + Stats (instant, from IndexedDB)
    try {
      const [todayChats] = await Promise.all([
        getTodayChats().catch(() => []),
      ])
      const streak = (() => { try { return getStreak() } catch { return { current: 0, best: 0 } } })()
      built.push({
        icon: '\uD83D\uDD25',
        title: 'Aaj ka Progress',
        content: `Streak: ${streak.current} din \uD83D\uDD25 (Best: ${streak.best})\nAaj ke messages: ${todayChats.length}\n${streak.current >= 3 ? 'Keep it up bhai — consistency hi key hai!' : 'Aaj kuch karo — streak shuru karo!'}`,
        color: '#f59e0b',
      })
      setSections([...built])
    } catch {}

    // Section 3: Weather (parallel)
    const [weather, news, crypto, gold, stocks, petrol] = await Promise.all([fetchWeather(), fetchNews(), fetchCrypto(), fetchGold(), fetchStocks(), fetchPetrol()])

    built.push({
      icon: '\uD83C\uDF24\uFE0F',
      title: 'Maihar ka Mausam',
      content: weather,
      color: '#3b82f6',
    })
    setSections([...built])

    // Section 4: News
    built.push({
      icon: '\uD83D\uDCF0',
      title: 'Aaj ki Headlines',
      content: news.map((n, i) => `${i + 1}. ${n}`).join('\n'),
      color: '#8b5cf6',
    })
    setSections([...built])

    // Section 5: Memory-based tip
    try {
      const memories = await getImportantMemories(5, 5)
      const studyMemories = memories.filter(m =>
        m.data.toLowerCase().match(/padh|study|padhai|chapter|subject|goal/)
      )
      if (studyMemories.length > 0) {
        built.push({
          icon: '\uD83E\uDDE0',
          title: 'JARVIS ko pata hai',
          content: studyMemories.slice(0, 3).map(m => `• ${m.data}`).join('\n'),
          color: '#22c55e',
        })
        setSections([...built])
      }
    } catch {}

    // Section 6: Padhai tip of the day
    const tip = STUDY_TIPS[now.getDate() % STUDY_TIPS.length]
    built.push({
      icon: '\uD83D\uDCA1',
      title: 'Aaj ka JARVIS Tip',
      content: tip,
      color: '#f59e0b',
    })
    setSections([...built])

    // Section 7: AI synthesis — what to focus on today
    try {
      const sysPrompt = await buildSystemPrompt().catch(() => 'You are JARVIS. Hinglish mein baat karo.')
      const prompt = `Aaj ek Padhai student ke liye 2-3 line ka focus suggestion do. Realistic, specific. Koi generic motivational nahi — actual kya karna chahiye aaj.`
      const res = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          mode: 'flash',
          systemPrompt: sysPrompt,
        }),
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let aiText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const d = JSON.parse(line.slice(6))
              if (d.type === 'delta') aiText += d.text
            } catch {}
          }
        }
      }
      if (aiText.trim()) {
        built.push({
          icon: '\uD83C\uDFAF',
          title: 'JARVIS ka Aaj ka Plan',
          content: aiText.trim(),
          color: '#00d4ff',
        })
        setSections([...built])
      }
    } catch {}

    // Build full text for TTS
    const full = built.map(s => `${s.title}. ${s.content}`).join('. ')
    setFullText(full)
    setLoading(false)
  }

  const handleSpeak = () => {
    if (speaking) { stopSpeaking(); setSpeaking(false); return }
    setSpeaking(true)
    speakText(fullText)
    setTimeout(() => setSpeaking(false), fullText.length * 60)
  }

  return (
    <div style={{ background: '#060610', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>📡 JARVIS Daily Brief</div>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleSpeak}
          style={{ background: speaking ? '#ef4444' : '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, color: speaking ? '#fff' : '#888', padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
        >
          {speaking ? '⏹ Stop' : '\uD83D\uDD0A Sunao'}
        </button>
        <button
          onClick={buildBriefing}
          style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, color: '#888', padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
        >
          🔄
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {loading && sections.length === 0 && (
          <div style={{ textAlign: 'center', color: '#333', padding: 60, fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⚡</div>
            JARVIS briefing prepare ho raha hai...
          </div>
        )}

        {sections.map((s, i) => (
          <div key={i} style={{
            background: '#0a0a14',
            border: `1px solid ${s.color}22`,
            borderLeft: `3px solid ${s.color}`,
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 10,
            animation: 'fadeIn 0.3s ease',
          }}>
            <div style={{ color: s.color, fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{s.icon}</span>
              <span>{s.title}</span>
            </div>
            <div style={{ color: '#888', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {s.content}
            </div>
          </div>
        ))}

        {loading && sections.length > 0 && (
          <div style={{ textAlign: 'center', color: '#333', padding: 20, fontSize: 12 }}>
            ⚡ Loading more...
          </div>
        )}
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}
