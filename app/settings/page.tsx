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
  { key:'ELEVENLABS_API_KEY', label:'ElevenLabs', icon:'🎙️', priority:'MED',  url:'https://elevenlabs.io',                 desc:'Best TTS voice — 10K chars/month FREE. Realistic human voice.' },
  { key:'GNEWS_API_KEY',      label:'GNews',      icon:'📰', priority:'MED',  url:'https://gnews.io',                      desc:'100 free news requests/day. India + World news.' },
]

type Tab = 'keys' | 'automation' | 'theme' | 'about' | 'memory' | 'display'

function MemoryManager() {
  const [mems, setMems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    import('@/lib/memory/smartMemory').then(m => {
      setMems(m.getAllMemories())
      setLoading(false)
    })
  }, [])

  const del = async (id: string) => {
    const m = await import('@/lib/memory/smartMemory')
    m.deleteMemory(id)
    setMems(m.getAllMemories())
  }

  const clearAll = async () => {
    if (!confirm('Sab memory delete karo?')) return
    const m = await import('@/lib/memory/smartMemory')
    m.clearAllMemory()
    setMems([])
  }

  if (loading) return <div style={{ color:'#444', fontSize:13 }}>Loading...</div>
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
        <div style={{ color:'#888', fontSize:12 }}>{mems.length} memories</div>
        {mems.length > 0 && (
          <button onClick={clearAll} style={{ background:'rgba(239,68,68,0.1)', border:'1px solid #ef4444', color:'#ef4444', borderRadius:8, padding:'4px 12px', fontSize:11, cursor:'pointer' }}>
            🗑️ Clear All
          </button>
        )}
      </div>
      {mems.length === 0 ? (
        <div style={{ color:'#444', fontSize:13 }}>Koi memory nahi. Chat mein "Yaad rakho: [kuch bhi]" bolo.</div>
      ) : mems.map((m: any) => (
        <div key={m.id} style={{ background:'#111118', border:'1px solid #1e1e2e', borderRadius:10, padding:'10px 12px', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ color:'#00d4ff', fontSize:10, marginBottom:2 }}>{m.type}</div>
            <div style={{ color:'#ccc', fontSize:13 }}>{m.content}</div>
          </div>
          <button onClick={() => del(m.id)} style={{ background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:16, padding:4 }}>🗑️</button>
        </div>
      ))}
    </div>
  )
}

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
    { key:'display', icon:'📱', label:'Display' },
    { key:'automation', icon:'⚡', label:'Auto' },
    { key:'memory', icon:'🧠', label:'Memory' },
    { key:'theme', icon:'🎨', label:'Theme' },
    { key:'about', icon:'ℹ️', label:'About' },
  ]

  return (
    <div style={{ background:'#060610', minHeight:'100dvh', display:'flex', flexDirection:'column', overflow:'hidden', height:'100dvh' }}>
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

        {/* DISPLAY TAB */}
        {tab === 'display' && (
          <div>
            {/* Font Size */}
            <div style={{ marginBottom:20 }}>
              <div style={{ color:'#00d4ff', fontWeight:700, fontSize:13, marginBottom:8 }}>📝 Chat Font Size</div>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ color:'#555', fontSize:12 }}>A</span>
                <input type="range" min={12} max={20} step={1}
                  defaultValue={typeof window!=='undefined' ? parseInt(localStorage.getItem('jarvis_font_size')||'15') : 15}
                  onChange={e => {
                    const v = parseInt(e.target.value);
                    localStorage.setItem('jarvis_font_size', String(v));
                  }}
                  style={{ flex:1, accentColor:'#00d4ff' }} />
                <span style={{ color:'#00d4ff', fontSize:16 }}>A</span>
              </div>
              <div style={{ color:'#444', fontSize:10, marginTop:4 }}>Slider drag karo → Reload pe apply hoga</div>
            </div>

            {/* Chat Background */}
            <div style={{ marginBottom:20 }}>
              <div style={{ color:'#00d4ff', fontWeight:700, fontSize:13, marginBottom:8 }}>🖼️ Chat Background</div>
              {[
                {id:'none',label:'Dark (Default)',preview:'#08080f'},
                {id:'gradient1',label:'Cyber',preview:'linear-gradient(135deg,#0a0a1a,#0d1f2d)'},
                {id:'gradient2',label:'Deep Space',preview:'linear-gradient(180deg,#060610,#0f0520)'},
                {id:'gradient3',label:'Matrix',preview:'linear-gradient(180deg,#050e05,#0a1a0a)'},
              ].map(bg => {
                const saved = typeof window!=='undefined' ? localStorage.getItem('jarvis_chat_bg')||'none' : 'none';
                return (
                  <button key={bg.id} onClick={() => {
                    localStorage.setItem('jarvis_chat_bg', bg.id);
                    window.dispatchEvent(new Event('storage'));
                  }}
                    style={{ display:'flex', alignItems:'center', gap:10, width:'100%', background: saved===bg.id?'rgba(0,212,255,0.1)':'#111118', border:'1px solid '+(saved===bg.id?'#00d4ff':'#1e1e2e'), borderRadius:10, padding:'10px 12px', marginBottom:6, cursor:'pointer' }}>
                    <div style={{ width:28, height:28, borderRadius:6, background:bg.preview, border:'1px solid #333', flexShrink:0 }} />
                    <span style={{ color: saved===bg.id?'#00d4ff':'#888', fontSize:13 }}>{bg.label}</span>
                    {saved===bg.id && <span style={{ marginLeft:'auto', color:'#22c55e', fontSize:11 }}>✓ Active</span>}
                  </button>
                );
              })}
            </div>

            {/* Data Export */}
            <div style={{ marginBottom:20 }}>
              <div style={{ color:'#00d4ff', fontWeight:700, fontSize:13, marginBottom:8 }}>💾 Data Export</div>
              <button onClick={async () => {
                try {
                  const { getSessions, getMessages } = await import('@/lib/storage');
                  const sessions = await getSessions();
                  const allData: any = { exportedAt: new Date().toISOString(), version: '24.0.0', sessions: [] };
                  for (const s of sessions.slice(0,50)) {
                    const msgs = await getMessages(s.sessionId);
                    allData.sessions.push({ ...s, messages: msgs });
                  }
                  // Include memories
                  const memMod = await import('@/lib/memory/smartMemory');
                  allData.memories = memMod.getAllMemories();
                  const blob = new Blob([JSON.stringify(allData, null, 2)], { type:'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href=url; a.download='jarvis-backup-'+Date.now()+'.json'; a.click();
                  URL.revokeObjectURL(url);
                } catch(e) { alert('Export failed: '+e); }
              }} style={{ width:'100%', background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.3)', borderRadius:10, padding:'12px', color:'#00d4ff', fontSize:13, cursor:'pointer', marginBottom:8 }}>
                📤 Export All Chats + Memory (JSON)
              </button>
              <button onClick={() => {
                const data: any = {};
                for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)!;data[k]=localStorage.getItem(k);}
                const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
                const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='jarvis-settings-'+Date.now()+'.json';a.click();URL.revokeObjectURL(url);
              }} style={{ width:'100%', background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:10, padding:'12px', color:'#22c55e', fontSize:13, cursor:'pointer' }}>
                📋 Export Settings Only
              </button>
            </div>
          </div>
        )}

        {/* THEME TAB */}
        {tab === 'theme' && (
        <div>
          {/* App Theme */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color:'#00d4ff', fontWeight:700, fontSize:13, marginBottom:8 }}>🎨 App Theme</div>
            <div style={{ color:'#888', fontSize:12, marginBottom:10 }}>Current: <b style={{ color:'#00d4ff' }}>{theme}</b></div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {(['dark','light','amoled','ocean'] as const).map(t => (
                <button key={t} onClick={() => { const r = toggleTheme(); setTheme(r); }}
                  style={{ padding:'8px 14px', borderRadius:10, border: theme===t ? '1px solid #00d4ff' : '1px solid #1e1e2e', background: theme===t ? 'rgba(0,212,255,0.1)' : '#111', color: theme===t ? '#00d4ff' : '#666', fontSize:12, cursor:'pointer', textTransform:'capitalize' }}>
                  {t==='dark'?'🌑':t==='light'?'☀️':t==='amoled'?'⬛':'🌊'} {t}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Background Wallpaper */}
          <div>
            <div style={{ color:'#00d4ff', fontWeight:700, fontSize:13, marginBottom:8 }}>🖼️ Chat Background</div>
            <div style={{ color:'#888', fontSize:12, marginBottom:10 }}>Chat ke peeche wallpaper set karo</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {[
                { id:'none', label:'None', bg:'#060610' },
                { id:'gradient1', label:'Cyan', bg:'linear-gradient(135deg,#0a0a1a,#0d1f2d)' },
                { id:'gradient2', label:'Purple', bg:'linear-gradient(135deg,#0a0a1a,#1a0a2e)' },
                { id:'gradient3', label:'Green', bg:'linear-gradient(135deg,#0a1a0a,#0d2d0d)' },
                { id:'gradient4', label:'Sunset', bg:'linear-gradient(135deg,#1a0a0a,#2d1a0a)' },
                { id:'gradient5', label:'Ocean', bg:'linear-gradient(135deg,#0a0f1a,#0a1a2d)' },
                { id:'dots', label:'Dots', bg:'radial-gradient(#00d4ff22 1px,transparent 1px) 0 0/20px 20px #060610' },
                { id:'grid', label:'Grid', bg:'linear-gradient(#00d4ff11 1px,transparent 1px) 0 0/30px 30px #060610' },
                { id:'stars', label:'Stars', bg:'radial-gradient(#ffffff22 1px,transparent 1px) 0 0/40px 40px #060610' },
              ].map(w => (
                <button key={w.id} onClick={() => {
                    if (typeof window !== 'undefined') { localStorage.setItem('jarvis_chat_bg', w.id); window.dispatchEvent(new Event('storage')); }
                    alert('Background set! JARVIS main chat mein dikhega.');
                  }}
                  style={{ padding:6, borderRadius:10, border:'1px solid #1e1e2e', background:w.bg, cursor:'pointer', aspectRatio:'1.5', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
                  <span style={{ color:'#ccc', fontSize:10, background:'rgba(0,0,0,0.7)', padding:'2px 6px', borderRadius:6 }}>{w.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Sakhi — Companion */}
      <div style={{ padding: '14px', marginTop: 8, borderTop: '1px solid #1e1e2e' }}>
        <button
          onClick={() => { if (typeof window !== 'undefined') window.location.href = '/sakhi'; }}
          style={{ width: '100%', background: 'linear-gradient(135deg,rgba(255,107,157,0.12),rgba(160,34,110,0.1))', border: '1px solid rgba(255,107,157,0.25)', borderRadius: 14, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#ff6b9d,#a0226e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🌸</div>
          <div>
            <div style={{ color: '#ffb3d1', fontWeight: 700, fontSize: 14 }}>Sakhi</div>
            <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>AI Companion — dost ki tarah baat karo</div>
          </div>
          <div style={{ marginLeft: 'auto', color: '#ff6b9d', fontSize: 18 }}>→</div>
        </button>
      </div>

      </div>
    </div>
  );
}
