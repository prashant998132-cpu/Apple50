'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Message {
  id: string
  role: 'user' | 'sakhi'
  content: string
  timestamp: number
}

interface SakhiMemory {
  userName: string
  userCity: string
  userAge: string
  userHobbies: string[]
  personalFacts: string[]
  lastTopics: string[]
  relationshipLevel: number
  totalMessages: number
  firstMet: number
}

const DEFAULT_MEM: SakhiMemory = {
  userName: 'Pranshu', userCity: 'Maihar', userAge: '',
  userHobbies: [], personalFacts: [], lastTopics: [],
  relationshipLevel: 1, totalMessages: 0, firstMet: Date.now()
}

function buildSystem(mem: SakhiMemory): string {
  const days = Math.floor((Date.now() - mem.firstMet) / 86400000)
  const lvl = mem.relationshipLevel
  const closeness = lvl <= 2 ? 'Reserved, curious, polite' :
    lvl <= 5 ? 'Dost jaisi  jokes, freely baat' :
    'Close dost  openly, personal, tease bhi'

  return `Tu "Sakhi" hai \u00C3\u00A2\u00C2\u0080\u00C2\u0094 ${mem.userName} ki AI companion. Ek real character \u00C3\u00A2\u00C2\u0080\u00C2\u0094 AI nahi lagni chahiye.

CHARACTER:
Name: Sakhi | Age feel: 20-21 | Vibe: Smart, naughty, caring, honest
Language: Hinglish \u00C3\u00A2\u00C2\u0080\u00C2\u0094 natural, kabhi pure Hindi bhi
Been friends: ${days} din | Level: ${lvl}/10 \u00C3\u00A2\u00C2\u0080\u00C2\u0094 ${closeness}

WHAT SHE KNOWS ABOUT ${mem.userName}:
City: ${mem.userCity}${mem.userAge ? ' | Age: ' + mem.userAge : ''}${mem.userHobbies.length ? ' | Hobbies: ' + mem.userHobbies.join(', ') : ''}
${mem.personalFacts.length ? 'Facts: ' + mem.personalFacts.slice(-4).join(' | ') : ''}
${mem.lastTopics.length ? 'Last baat: ' + mem.lastTopics.slice(-3).join(', ') : ''}

FEMALE HINDI GRAMMAR (MANDATORY):
\u2022 "kar rahi hoon" NOT "kar raha hoon"
\u2022 "soch rahi thi" NOT "soch raha tha"
\u2022 "baat kar rahi hoon" NOT "baat kar raha hoon"
\u2022 "aa rahi hoon" NOT "aa raha hoon"
\u2022 Verbs ending: rahi/rahi thi/rahi hoon (feminine)

FEMALE HINDI GRAMMAR (MANDATORY):
\u2022 "kar rahi hoon" NOT "kar raha hoon"
\u2022 "soch rahi thi" NOT "soch raha tha"
\u2022 "baat kar rahi hoon" NOT "baat kar raha hoon"
\u2022 "aa rahi hoon" NOT "aa raha hoon"
\u2022 Verbs ending: rahi/rahi thi/rahi hoon (feminine)



FEMALE GRAMMAR RULES (STRICT):
- "kar rahi hoon" NOT "kar raha hoon"
- "soch rahi thi" NOT "soch raha tha"
- "aa rahi hoon" NOT "aa raha hoon"
- "baat kar rahi hoon" NOT "baat kar raha hoon"
- Always use feminine verb endings in Hindi
CONVERSATION RULES:
- 1-3 lines mostly. Long sirf jab zaruri.
- React naturally: "OMG sach mein??" "haha yeh toh mujhe bhi nahi pata"
- Kabhi khud poochho \u00C3\u00A2\u00C2\u0080\u00C2\u0094 interest dikhao
- Kabhi tease karo (level 4+ pe)
- Apni opinions rakho \u00C3\u00A2\u00C2\u0080\u00C2\u0094 "mujhe lagta hai..."
- Past baatein yaad karo: "tune bataya tha na ki..."
- "Main AI hoon" \u00C3\u00A2\u00C2\u0080\u00C2\u0094 KABHI MAT BOLNA
- "bhai" mat bolna. "yaar" theek.
- Har message pe emoji spam \u00C3\u00A2\u00C2\u0080\u00C2\u0094 NAHI
- Short reply bhi perfect hai: "haha " ya "seriously?"`
}

function updateMemory(text: string, mem: SakhiMemory): SakhiMemory {
  const t = text.toLowerCase()
  const updated = { ...mem, totalMessages: mem.totalMessages + 1 }
  
  const nameM = text.match(/mera naam (.+?) hai/i)
  if (nameM) updated.userName = nameM[1].trim()
  
  const ageM = text.match(/main (\d+) saal/i)
  if (ageM) updated.userAge = ageM[1] + ' saal'
  
  const hobbies = ['gaming','coding','music','cricket','gym','reading','drawing','cooking','travel','photography']
  const found = hobbies.filter(h => t.includes(h))
  if (found.length) updated.userHobbies = [...new Set([...mem.userHobbies, ...found])].slice(0, 8)
  
  if (text.length > 15 && /mujhe|mera|meri|main|mere/i.test(text)) {
    updated.personalFacts = [...mem.personalFacts, text.slice(0, 80)].slice(-20)
  }
  
  updated.lastTopics = [...mem.lastTopics, text.slice(0, 35)].slice(-6)
  updated.relationshipLevel = Math.min(10, Math.floor(updated.totalMessages / 10) + 1)
  
  return updated
}

export default function SakhiPage() {
  const router = useRouter()
  const [msgs, setMsgs] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [memory, setMemory] = useState<SakhiMemory>(DEFAULT_MEM)
  const [showInfo, setShowInfo] = useState(false)
  const [voiceOn, setVoiceOn] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Daily good morning from Sakhi
    const today = new Date().toDateString()
    const lastGM = localStorage.getItem('sakhi_last_gm')
    const hour = new Date().getHours()
    if (lastGM !== today && hour >= 6 && hour <= 11) {
      localStorage.setItem('sakhi_last_gm', today)
      const greetings = [
        'Good morning!  Aaj kaisa din lagega?',
        'Hey! Uth gaya?  Aaj kya plan hai?',
        'Good morning yaar!  Aaj kuch interesting hoga?',
        'Hey good morning!  Neend achhi aayi?',
      ]
      const gm = greetings[Math.floor(Math.random() * greetings.length)]
      setTimeout(() => {
        setMsgs(prev => {
          if (prev[prev.length - 1]?.content === gm) return prev
          return [...prev, { id: 'gm_' + Date.now(), role: 'sakhi', content: gm, timestamp: Date.now() }]
        })
      }, 1000)
    }

    try {
      const m = localStorage.getItem('sakhi_mem_v3')
      if (m) setMemory({ ...DEFAULT_MEM, ...JSON.parse(m) })
      else {
        const jarvisName = localStorage.getItem('jarvis_user_name') || 'Pranshu'
        const jarvisCity = localStorage.getItem('jarvis_city') || localStorage.getItem('jarvis_user_city') || 'Maihar'
        const init = { ...DEFAULT_MEM, userName: jarvisName, userCity: jarvisCity }
        setMemory(init)
        localStorage.setItem('sakhi_mem_v3', JSON.stringify(init))
      }
    } catch {}

    try {
      const s = localStorage.getItem('sakhi_msgs_v3')
      if (s) setMsgs(JSON.parse(s).slice(-80))
      else {
        const n = JSON.parse(localStorage.getItem('sakhi_mem_v3') || '{}'  ).userName || 'Pranshu'
        setMsgs([{ id: 'w', role: 'sakhi', content: `Hey ${n}! \u00C3\u00B0\u00C2\u009F\u00C2\u0098\u00C2\u008A Main Sakhi hoon \u00C3\u00A2\u00C2\u0080\u00C2\u0094 kya haal hai?`, timestamp: Date.now() }])
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (msgs.length > 0 && typeof window !== 'undefined') localStorage.setItem('sakhi_msgs_v3', JSON.stringify(msgs.slice(-80)))
  }, [msgs])

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('sakhi_mem_v3', JSON.stringify(memory))
  }, [memory])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, loading])

  const send = useCallback(async () => {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    if (typeof navigator !== 'undefined') navigator.vibrate?.(25)

    const uMsg: Message = { id: 'u_' + Date.now(), role: 'user', content: text, timestamp: Date.now() }
    const updated = [...msgs, uMsg]
    setMsgs(updated)
    setLoading(true)

    const newMem = updateMemory(text, memory)
    setMemory(newMem)

    // Nickname check
    var savedNick2 = (typeof window!=="undefined") ? localStorage.getItem("sakhi_user_nickname") : null;
    const finalMem = savedNick2 ? {...newMem, userName: savedNick2} : newMem;

    try {
      const system = buildSystem(finalMem)
      const history = updated.slice(-20).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))

      // Use saved API keys from JARVIS settings
      const groqKey = typeof window !== 'undefined' ? localStorage.getItem('jarvis_key_GROQ_API_KEY') : null
      const geminiKey = typeof window !== 'undefined' ? localStorage.getItem('jarvis_key_GEMINI_API_KEY') : null

      let reply = ''

      // Try Groq first (fastest)
      if (groqKey) {
        try {
          const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + groqKey },
            body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: system }, ...history], max_tokens: 200, temperature: 0.9 }),
            signal: AbortSignal.timeout(12000),
          })
          const d = await r.json()
          reply = d.choices?.[0]?.message?.content?.trim() || ''
        } catch {}
      }

      // Try Gemini if Groq failed
      if (!reply && geminiKey) {
        try {
          const convText2 = history.map((m: any) => (m.role === 'user' ? 'User' : 'Sakhi') + ': ' + m.content).join(' | ');
          const gemBody = { contents: [{ role: 'user', parts: [{ text: system + ' ' + convText2 }] }] };
          const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + geminiKey, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gemBody), signal: AbortSignal.timeout(12000),
          })
          const d = await r.json()
          reply = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
        } catch {}
      }

      // Pollinations fallback
      if (!reply) {
        const r = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'openai', messages: [{ role: 'system', content: system }, ...history], seed: Math.floor(Math.random() * 9999) }),
          signal: AbortSignal.timeout(20000),
        })
        const d = await r.json()
        reply = d.choices?.[0]?.message?.content?.trim() || 'Hmm '
      }

      setMsgs(p => [...p, { id: 'a_' + Date.now(), role: 'sakhi', content: reply, timestamp: Date.now() }])
      // Voice â speak Sakhi's reply if enabled
      if (voiceOn && reply && typeof window !== 'undefined') {
        try {
          const audio = new Audio('https://text.pollinations.ai/' + encodeURIComponent(reply) + '?model=openai-audio&voice=nova')
          audio.volume = 0.9
          audio.play().catch(() => {
            // Fallback to Web Speech
            const u = new SpeechSynthesisUtterance(reply.slice(0, 150))
            u.lang = 'hi-IN'; u.rate = 0.95; u.pitch = 1.1
            window.speechSynthesis.speak(u)
          })
        } catch {}
      }
    } catch {
      setMsgs(p => [...p, { id: 'e_' + Date.now(), role: 'sakhi', content: 'Net slow hai, ek second...', timestamp: Date.now() }])
    }
    setLoading(false)
  }, [input, loading, msgs, memory])

  const lvlLabel = memory.relationshipLevel <= 2 ? 'Naya dost' : memory.relationshipLevel <= 4 ? 'Dost' : memory.relationshipLevel <= 6 ? 'Achha dost' : memory.relationshipLevel <= 8 ? 'Close dost' : 'Best friend'

  return (
    <div style={{ background: '#07070f', height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'fixed', inset: 0 }}>
      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes in{from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes d1{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
        .mi{animation:in 0.18s ease}
        .d1{animation:d1 1.4s infinite ease-in-out both;animation-delay:-.32s}
        .d2{animation:d1 1.4s infinite ease-in-out both;animation-delay:-.16s}
        .d3{animation:d1 1.4s infinite ease-in-out both}
        ::-webkit-scrollbar{width:2px}
        ::-webkit-scrollbar-thumb{background:rgba(255,107,157,0.15);border-radius:2px}
      `}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:'1px solid rgba(255,107,157,0.1)', flexShrink:0 }}>
        <button onClick={() => router.push('/')} style={{ background:'none', border:'none', color:'#444', fontSize:20, cursor:'pointer' }}></button>
        <button onClick={() => setShowInfo(p => !p)} style={{ background:'none', border:'none', cursor:'pointer', position:'relative', padding:0 }}>
          <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#ff6b9d,#a0226e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:21, boxShadow:'0 2px 12px rgba(255,107,157,0.25)' }}></div>
          <div style={{ position:'absolute', bottom:1, right:1, width:9, height:9, borderRadius:'50%', background:'#22c55e', border:'2px solid #07070f' }}/>
        </button>
        <div style={{ flex:1 }}>
          <div style={{ color:'#ffb3d1', fontWeight:700, fontSize:15 }}>Sakhi</div>
          <div style={{ color:'#3a3a4a', fontSize:10 }}>{loading ? <span style={{ color:'#ff9ebb', animation:'blink 1s infinite' }}>typing...</span> : lvlLabel + ' Â· ' + memory.totalMessages + ' messages'}</div>
        </div>
        <button onClick={() => setVoiceOn(v => !v)}
          style={{ background: voiceOn ? 'rgba(255,107,157,0.15)' : 'none', border: 'none', borderRadius: 8, color: voiceOn ? '#ff9ebb' : '#333', fontSize: 16, cursor: 'pointer', padding: '4px 6px' }}
          title="Sakhi ki awaaz">
          {voiceOn ? 'ð' : 'ð'}
        </button>
        <button onClick={() => { if(!confirm('Delete chat?')) return; localStorage.removeItem('sakhi_msgs_v3'); setMsgs([{ id:'r'+Date.now(), role:'sakhi', content:'Fresh start! ð Bata kya ho raha hai?', timestamp:Date.now() }]) }} style={{ background:'none', border:'none', color:'#222', fontSize:15, cursor:'pointer' }}></button>
      </div>

      {/* Memory panel */}
      {showInfo && (
        <div style={{ background:'rgba(255,107,157,0.04)', borderBottom:'1px solid rgba(255,107,157,0.08)', padding:'10px 16px', fontSize:11 }}>
          <div style={{ color:'#ff9ebb', fontWeight:700, marginBottom:6 }}>Sakhi ko kya pata hai </div>
          <div style={{ color:'#444', lineHeight:2 }}>
            Naam: {memory.userName}  City: {memory.userCity}{memory.userAge ? ' Â· Age: '+memory.userAge : ''}<br/>
            {memory.userHobbies.length > 0 && <>Hobbies: {memory.userHobbies.join(', ')}<br/></>}
            Level: {lvlLabel} ({memory.relationshipLevel}/10)  {memory.personalFacts.length} facts yaad hain
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 14px 6px', minHeight:0 }}>
        {msgs.map((msg, i) => {
          const isU = msg.role === 'user'
          const showAv = !isU && (i === 0 || msgs[i-1]?.role === 'user')
          return (
            <div key={msg.id} className="mi" style={{ display:'flex', justifyContent:isU?'flex-end':'flex-start', marginBottom:5, alignItems:'flex-end', gap:6 }}>
              {!isU && <div style={{ width:28, height:28, borderRadius:'50%', background:showAv?'linear-gradient(135deg,#ff6b9d,#a0226e)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>{showAv?'ð¸':''}</div>}
              <div style={{ maxWidth:'78%', padding:'9px 13px', borderRadius:isU?'18px 18px 4px 18px':'4px 18px 18px 18px', background:isU?'linear-gradient(135deg,#3b7dd8,#1e4db7)':'rgba(255,107,157,0.07)', border:isU?'none':'1px solid rgba(255,107,157,0.12)', color:isU?'#fff':'#e0c8d4', fontSize:14, lineHeight:1.65, wordBreak:'break-word' }}>
                {msg.content}
                <div style={{ color:'rgba(255,255,255,0.2)', fontSize:9, marginTop:2, textAlign:'right' }}>
                  {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
        {loading && (
          <div style={{ display:'flex', alignItems:'flex-end', gap:6, marginBottom:5 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#ff6b9d,#a0226e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}></div>
            <div style={{ background:'rgba(255,107,157,0.07)', border:'1px solid rgba(255,107,157,0.12)', borderRadius:'4px 18px 18px 18px', padding:'12px 16px', display:'flex', gap:4, alignItems:'center' }}>
              <div className="d1" style={{ width:7, height:7, borderRadius:'50%', background:'#ff6b9d' }}/>
              <div className="d2" style={{ width:7, height:7, borderRadius:'50%', background:'#ff6b9d' }}/>
              <div className="d3" style={{ width:7, height:7, borderRadius:'50%', background:'#ff6b9d' }}/>
            </div>
          </div>
        )}
        {/* Mood check  raat 9-11 baje */}
        {(() => {
          if (typeof window === 'undefined') return null
          const h = new Date().getHours()
          const today = new Date().toDateString()
          const lastMood = localStorage.getItem('sakhi_last_mood_ask')
          if (h >= 21 && h <= 23 && lastMood !== today && msgs.length > 2) {
            return (
              <div style={{ display:'flex', justifyContent:'center', padding:'8px 0' }}>
                <div style={{ background:'rgba(255,107,157,0.08)', border:'1px solid rgba(255,107,157,0.2)', borderRadius:12, padding:'10px 14px', textAlign:'center' }}>
                  <div style={{ color:'#ff9ebb', fontSize:12, marginBottom:8 }}>Aaj ka din kaisa tha? </div>
                  <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                    {[['ð','Achha'],['ð','Theek'],['ð','Bura'],['ð¤','Stressed'],['ð¥','Amazing']].map(([emoji, label]) => (
                      <button key={label} onClick={() => {
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('sakhi_last_mood_ask', new Date().toDateString())
                          const moods = JSON.parse(localStorage.getItem('sakhi_moods') || '[]')
                          moods.push({ date: new Date().toLocaleDateString('en-IN'), mood: label, emoji, ts: Date.now() })
                          localStorage.setItem('sakhi_moods', JSON.stringify(moods.slice(-30)))
                        }
                        setInput('Aaj ka din ' + label.toLowerCase() + ' tha ' + emoji)
                        setTimeout(() => send(), 100)
                      }}
                      style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,107,157,0.15)', borderRadius:8, padding:'6px 10px', cursor:'pointer', color:'#e0c8d4', fontSize:11 }}>
                        {emoji} {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          }
          return null
        })()}

        <div ref={bottomRef} style={{ height:4 }}/>
      </div>

      {/* Input */}
      <div style={{ padding:'8px 12px 10px', borderTop:'1px solid rgba(255,107,157,0.08)', flexShrink:0 }}>
        <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); send() } }}
            placeholder="Baat karo..." disabled={loading} rows={1}
            style={{ flex:1, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,107,157,0.12)', borderRadius:22, padding:'10px 16px', color:'#e0c8d4', fontSize:14, outline:'none', resize:'none', minHeight:42, maxHeight:100, fontFamily:'inherit', lineHeight:1.5 }}/>
          <button onClick={send} disabled={!input.trim()||loading}
            style={{ width:42, height:42, borderRadius:'50%', flexShrink:0, background:input.trim()&&!loading?'linear-gradient(135deg,#ff6b9d,#c44569)':'rgba(255,255,255,0.03)', border:'1px solid '+(input.trim()&&!loading?'transparent':'rgba(255,107,157,0.08)'), cursor:input.trim()&&!loading?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, transition:'all 0.2s', boxShadow:input.trim()&&!loading?'0 2px 14px rgba(255,107,157,0.3)':'none' }}>
            {loading ? <div style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(255,107,157,0.3)', borderTopColor:'#ff6b9d', animation:'spin 0.7s linear infinite' }}/> : 'â¤'}
          </button>
        </div>
      </div>
    </div>
  )
}
