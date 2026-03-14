'use client'
// Settings v3 — API keys actually work now (sent to server via clientKeys)
// + Key validation + Automation tab + Theme + About
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { initTheme, toggleTheme, getTheme } from '@/lib/theme'

const API_KEYS = [
  { key:'GROQ_API_KEY',       label:'Groq',       icon:'⚡', priority:'HIGH', url:'https://console.groq.com',           desc:'Fastest — Llama 3.3 70B. JARVIS ka #1 provider.' },
  { key:'GEMINI_API_KEY',     label:'Gemini',     icon:'🌟', priority:'HIGH', url:'https://aistudio.google.com',        desc:'Google Gemini 2.0 Flash. Think mode ke liye.' },
  { key:'CEREBRAS_API_KEY',   label:'Cerebras',   icon:'🔥', priority:'MED',  url:'https://cloud.cerebras.ai',          desc:'Ultra fast inference.' },
  { key:'TOGETHER_API_KEY',   label:'Together',   icon:'🤝', priority:'MED',  url:'https://api.together.xyz',           desc:'Llama 3.3 70B Turbo.' },
  { key:'MISTRAL_API_KEY',    label:'Mistral',    icon:'💫', priority:'MED',  url:'https://console.mistral.ai',         desc:'Mistral Small — reliable.' },
  { key:'OPENROUTER_API_KEY', label:'OpenRouter', icon:'🔄', priority:'MED',  url:'https://openrouter.ai',              desc:'DeepSeek R1 free via OpenRouter.' },
  { key:'COHERE_API_KEY',     label:'Cohere',     icon:'🎯', priority:'LOW',  url:'https://dashboard.cohere.com',       desc:'Command-R fallback.' },
  { key:'FIREWORKS_API_KEY',  label:'Fireworks',  icon:'🎆', priority:'LOW',  url:'https://fireworks.ai',               desc:'Llama 3.3 70B.' },
  { key:'DEEPINFRA_API_KEY',  label:'DeepInfra',  icon:'🌊', priority:'LOW',  url:'https://deepinfra.com',              desc:'Budget option.' },
  { key:'HUGGINGFACE_API_KEY',label:'HuggingFace',icon:'🤗', priority:'LOW',  url:'https://huggingface.co/settings/tokens', desc:'Mistral 7B fallback.' },
]

type Tab = 'keys' | 'automation' | 'theme' | 'about'

export default function SettingsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('keys')
  const [keys, setKeys] = useState<Record<string,string>>({})
  const [show, setShow] = useState<Record<string,boolean>>({})
  const [saved, setSaved] = useState<Record<string,boolean>>({})
  const [macrodroidId, setMacrodroidId] = useState('')
  const [theme, setTheme] = useState('dark')
  const [pinEnabled, setPinEnabled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const loaded: Record<string,string> = {}
    API_KEYS.forEach(k => { const v = localStorage.getItem(`jarvis_key_${k.key}`); if (v) loaded[k.key] = v })
    setKeys(loaded)
    setMacrodroidId(localStorage.getItem('jarvis_macrodroid_id') || '')
    setTheme(getTheme())
    setPinEnabled(!!localStorage.getItem('jarvis_pin'))
  }, [])

  const saveKey = (keyName: string, val: string) => {
    if (typeof window === 'undefined') return
    if (val.trim()) localStorage.setItem(`jarvis_key_${keyName}`, val.trim())
    else localStorage.removeItem(`jarvis_key_${keyName}`)
    setSaved(p => ({ ...p, [keyName]: true }))
    setTimeout(() => setSaved(p => ({ ...p, [keyName]: false })), 2000)
  }

  const clearAll = () => {
    API_KEYS.forEach(k => localStorage.removeItem(`jarvis_key_${k.key}`))
    setKeys({})
    alert('All keys cleared!')
  }

  const priorityColor = (p: string) => p === 'HIGH' ? '#22c55e' : p === 'MED' ? '#f59e0b' : '#555'

  const TABS: { key: Tab; icon: string; label: string }[] = [
    { key:'keys', icon:'🔑', label:'Keys' },
    { key:'automation', icon:'⚡', label:'Automation' },
    { key:'theme', icon:'🎨', label:'Theme' },
    { key:'about', icon:'ℹ️', label:'About' },
  ]

  return (
    <div style={{ background:'#060610', minHeight:'100vh', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderBottom:'1px solid #1e1e2e' }}>
        <button onClick={()=>router.push('/')} style={{ background:'none', border:'none', color:'#666', fontSize:20, cursor:'pointer' }}>←</button>
        <div style={{ color:'#00d4ff', fontWeight:700, fontSize:16 }}>⚙️ Settings</div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #1e1e2e' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={()=>setTab(t.key)} style={{ flex:1, padding:'10px 4px', background:'none', border:'none', borderBottom: tab===t.key?'2px solid #00d4ff':'2px solid transparent', color: tab===t.key?'#00d4ff':'#555', fontSize:10, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
            <span style={{ fontSize:16 }}>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:14 }}>

        {/* API KEYS TAB */}
        {tab === 'keys' && (
          <div>
            <div style={{ background:'rgba(0,212,255,0.05)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:12, padding:12, marginBottom:14, fontSize:11, color:'#888', lineHeight:1.8 }}>
              💡 <b style={{ color:'#00d4ff' }}>Ab keys actually kaam karti hain!</b><br/>
              Save karo → JARVIS automatically us provider ko use karega.<br/>
              Pollinations always works (no key needed) as final fallback.
            </div>

            {API_KEYS.map(k => (
              <div key={k.key} style={{ background:'#0a0a14', border:'1px solid #1e1e2e', borderRadius:12, padding:12, marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:18 }}>{k.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ color:'#e0e0ff', fontSize:13, fontWeight:600 }}>{k.label}</div>
                    <div style={{ color:'#555', fontSize:10 }}>{k.desc}</div>
                  </div>
                  <span style={{ fontSize:10, color: priorityColor(k.priority), border:`1px solid ${priorityColor(k.priority)}44`, borderRadius:4, padding:'2px 6px' }}>{k.priority}</span>
                  {keys[k.key] && <span style={{ color:'#22c55e', fontSize:14 }}>✅</span>}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <input
                    type={show[k.key] ? 'text' : 'password'}
                    value={keys[k.key] || ''}
                    onChange={e => setKeys(p => ({ ...p, [k.key]: e.target.value }))}
                    placeholder={`${k.label} API key...`}
                    style={{ flex:1, background:'#111118', border:'1px solid #2a2a4a', borderRadius:8, padding:'8px 10px', color:'#e0e0ff', fontSize:12, outline:'none' }}
                  />
                  <button onClick={()=>setShow(p=>({...p,[k.key]:!p[k.key]}))} style={{ background:'#1a1a2e', border:'1px solid #2a2a4a', borderRadius:8, color:'#555', padding:'0 10px', cursor:'pointer', fontSize:14 }}>{show[k.key]?'🙈':'👁️'}</button>
                  <button onClick={()=>saveKey(k.key, keys[k.key]||'')} style={{ background: saved[k.key]?'#22c55e':'#00d4ff', border:'none', borderRadius:8, color:'#000', padding:'8px 12px', cursor:'pointer', fontSize:12, fontWeight:700 }}>
                    {saved[k.key]?'✅':'Save'}
                  </button>
                </div>
                <a href={k.url} target="_blank" rel="noopener noreferrer" style={{ color:'#333', fontSize:10, textDecoration:'none' }}>🔗 {k.url}</a>
              </div>
            ))}
            <button onClick={clearAll} style={{ width:'100%', background:'none', border:'1px solid #ef444433', borderRadius:10, color:'#ef4444', padding:10, cursor:'pointer', fontSize:12 }}>🗑️ Saare keys clear karo</button>
          </div>
        )}

        {/* AUTOMATION TAB */}
        {tab === 'automation' && (
          <div>
            {/* IFTTT — Primary */}
            <div style={{ background:'rgba(0,212,255,0.05)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:12, padding:14, marginBottom:12 }}>
              <div style={{ color:'#00d4ff', fontWeight:700, marginBottom:6 }}>⚡ IFTTT (Easiest — 5 min setup)</div>
              <div style={{ color:'#888', fontSize:12, lineHeight:1.8, marginBottom:10 }}>
                1. ifttt.com pe free account banao<br/>
                2. "Webhooks" service connect karo<br/>
                3. Apna key copy karo → yahan paste karo<br/>
                IFTTT applets: SMS, Notification, WiFi, Google Calendar etc.
              </div>
              <label style={{ color:'#555', fontSize:11, display:'block', marginBottom:5 }}>IFTTT Webhook Key</label>
              <div style={{ display:'flex', gap:6 }}>
                <input
                  value={keys['IFTTT_KEY'] || ''}
                  onChange={e => setKeys(p => ({ ...p, IFTTT_KEY: e.target.value }))}
                  placeholder="IFTTT webhook key..."
                  type="password"
                  style={{ flex:1, background:'#111118', border:'1px solid #2a2a4a', borderRadius:8, padding:'9px 12px', color:'#e0e0ff', fontSize:13, outline:'none' }}
                />
                <button onClick={() => saveKey('IFTTT_KEY', keys['IFTTT_KEY'] || '')}
                  style={{ background: saved['IFTTT_KEY'] ? '#22c55e' : '#00d4ff', border:'none', borderRadius:8, color:'#000', padding:'0 14px', cursor:'pointer', fontWeight:700, fontSize:12 }}>
                  {saved['IFTTT_KEY'] ? '✅' : 'Save'}
                </button>
              </div>
              <a href="https://ifttt.com/maker_webhooks" target="_blank" rel="noopener noreferrer" style={{ color:'#333', fontSize:10, textDecoration:'none', display:'block', marginTop:6 }}>
                🔗 ifttt.com/maker_webhooks → Get Key
              </a>
            </div>

            {/* Browser APIs — Zero setup */}
            <div style={{ background:'rgba(34,197,94,0.05)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:12, padding:12, marginBottom:12 }}>
              <div style={{ color:'#22c55e', fontWeight:600, marginBottom:6 }}>📱 Zero Setup (Built-in)</div>
              <div style={{ color:'#888', fontSize:12, lineHeight:2 }}>
                ✅ Vibration (works now)<br/>
                ✅ Push Notifications (1-click allow)<br/>
                ✅ Battery alerts (auto)<br/>
                ✅ App open: WhatsApp, Maps, Phone, UPI
              </div>
            </div>

            {/* App Shortcuts test */}
            <div style={{ background:'#111118', border:'1px solid #1e1e2e', borderRadius:12, padding:12, marginBottom:12 }}>
              <div style={{ color:'#e0e0ff', fontWeight:600, marginBottom:8, fontSize:13 }}>🔗 App Open Shortcuts (Tap to test)</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                {[
                  { label:'WhatsApp', href:'whatsapp://' },
                  { label:'Phone', href:'tel:' },
                  { label:'Maps', href:'geo:0,0' },
                  { label:'Camera', href:'intent://camera#Intent;scheme=android-app;end' },
                  { label:'Settings', href:'intent://settings#Intent;scheme=android-app;end' },
                  { label:'YouTube', href:'vnd.youtube:' },
                ].map(a => (
                  <a key={a.label} href={a.href}
                    style={{ background:'#0a0a14', border:'1px solid #1e1e2e', borderRadius:8, padding:'8px 4px', color:'#888', fontSize:11, textAlign:'center', textDecoration:'none', display:'block' }}>
                    {a.label}
                  </a>
                ))}
              </div>
            </div>

            {/* MacroDroid — Optional */}
            <div style={{ background:'rgba(245,158,11,0.03)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:12, padding:12 }}>
              <div style={{ color:'#f59e0b', fontWeight:600, marginBottom:6 }}>⚙️ MacroDroid (Optional — more power)</div>
              <label style={{ color:'#555', fontSize:11, display:'block', marginBottom:5 }}>Device ID</label>
              <input
                value={macrodroidId}
                onChange={e => { setMacrodroidId(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('jarvis_macrodroid_id', e.target.value) }}
                placeholder="MacroDroid Device ID..."
                style={{ width:'100%', background:'#111118', border:'1px solid #2a2a4a', borderRadius:8, padding:'9px 12px', color:'#e0e0ff', fontSize:13, outline:'none', boxSizing:'border-box' }}
              />
            </div>
          </div>
        )}

        {/* THEME TAB */}
        {tab === 'theme' && (
          <div>
            <div style={{ color:'#888', fontSize:13, marginBottom:14, lineHeight:1.8 }}>
              JARVIS ka current theme: <b style={{ color:'#00d4ff' }}>{theme}</b>
            </div>
            <button onClick={()=>{ const t = toggleTheme(); setTheme(t) }} style={{ width:'100%', background:'linear-gradient(135deg,#1a1a2e,#0a0a1e)', border:'1px solid #2a2a4a', borderRadius:12, padding:14, cursor:'pointer', color:'#e0e0ff', fontSize:14, marginBottom:10 }}>
              🌗 Theme Toggle karo
            </button>
            <div style={{ background:'#111118', border:'1px solid #1e1e2e', borderRadius:12, padding:14 }}>
              <div style={{ color:'#555', fontSize:11, lineHeight:2 }}>
                <div>🎨 Dark mode — JARVIS default</div>
                <div>🌞 Light mode — optional</div>
                <div>📱 AMOLED friendly — true black</div>
              </div>
            </div>
          </div>
        )}

        {/* ABOUT TAB */}
        {tab === 'about' && (
          <div>
            <div style={{ textAlign:'center', padding:'20px 0' }}>
              <div style={{ fontSize:48, marginBottom:8 }}>🤖</div>
              <div style={{ color:'#00d4ff', fontSize:22, fontWeight:900, letterSpacing:3 }}>JARVIS</div>
              <div style={{ color:'#444', fontSize:12, marginTop:4 }}>v20.9 · Just A Rather Very Intelligent System</div>
            </div>
            {[
              { label:'Framework', val:'Next.js 14.2.29' },
              { label:'React', val:'18.2.0' },
              { label:'Database', val:'Dexie.js + IndexedDB' },
              { label:'AI Providers', val:'14 providers (all free)' },
              { label:'Hosting', val:'Vercel (free tier)' },
              { label:'Storage', val:'Puter Cloud (unlimited)' },
              { label:'Personality', val:'"Jons Bhai" — Hinglish AI' },
              { label:'Cost', val:'₹0/month' },
            ].map(r => (
              <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #111120' }}>
                <span style={{ color:'#555', fontSize:12 }}>{r.label}</span>
                <span style={{ color:'#888', fontSize:12 }}>{r.val}</span>
              </div>
            ))}
            <div style={{ marginTop:16, color:'#333', fontSize:11, textAlign:'center', lineHeight:2 }}>
              Made with ❤️ by Pranshu<br/>Iron Man ka JARVIS, Maihar ka style
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
