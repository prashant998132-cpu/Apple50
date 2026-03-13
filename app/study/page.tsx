'use client'
// Study Hub v2 — NEET MCQs + AI explanations + score persistence + AI question generation
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { addXP, getXP, getSetting, setSetting } from '@/lib/db'

const MCQ_BANK = [
  { q:"The powerhouse of the cell is:", options:["Nucleus","Mitochondria","Ribosome","Golgi body"], ans:1, subject:"Biology", topic:"Cell Biology" },
  { q:"Which is correct electronic configuration of Fe²⁺?", options:["[Ar]3d⁶","[Ar]3d⁴","[Ar]4s²3d⁴","[Ar]3d⁸"], ans:0, subject:"Chemistry", topic:"Atomic Structure" },
  { q:"Newton's second law: F=ma means:", options:["Reaction pair","Force=mass×acc","Object stays at rest","Energy conserved"], ans:1, subject:"Physics", topic:"Laws of Motion" },
  { q:"Protein synthesis occurs in:", options:["Mitochondria","Chloroplast","Ribosome","Lysosome"], ans:2, subject:"Biology", topic:"Cell Organelles" },
  { q:"SI unit of electric charge:", options:["Ampere","Volt","Coulomb","Ohm"], ans:2, subject:"Physics", topic:"Electricity" },
  { q:"Photosynthesis dark reaction occurs in:", options:["Stroma","Thylakoid","Matrix","Cristae"], ans:0, subject:"Biology", topic:"Photosynthesis" },
  { q:"Which is an alkali metal?", options:["Magnesium","Calcium","Sodium","Aluminum"], ans:2, subject:"Chemistry", topic:"Periodic Table" },
  { q:"DNA replication is:", options:["Conservative","Semi-conservative","Dispersive","None"], ans:1, subject:"Biology", topic:"Genetics" },
  { q:"pH of pure water at 25°C:", options:["5","6","7","8"], ans:2, subject:"Chemistry", topic:"Acids & Bases" },
  { q:"Myopia corrected by:", options:["Convex","Concave","Bifocal","Cylindrical"], ans:1, subject:"Physics", topic:"Optics" },
  { q:"Universal blood donor:", options:["A","B","AB","O"], ans:3, subject:"Biology", topic:"Human Physiology" },
  { q:"Avogadro's number:", options:["6.022×10²³","6.022×10²²","3.14×10²³","1.6×10¹⁹"], ans:0, subject:"Chemistry", topic:"Mole Concept" },
  { q:"Escape velocity from Earth:", options:["7.9 km/s","11.2 km/s","3 km/s","15 km/s"], ans:1, subject:"Physics", topic:"Gravitation" },
  { q:"Blood sugar regulated by:", options:["Thyroxine","Adrenaline","Insulin","Cortisol"], ans:2, subject:"Biology", topic:"Endocrinology" },
  { q:"IUPAC name of CH₃CHO:", options:["Methanal","Ethanal","Propanal","Ethanol"], ans:1, subject:"Chemistry", topic:"Organic Chemistry" },
  { q:"Hybridization in CH₄:", options:["sp","sp²","sp³","sp³d"], ans:2, subject:"Chemistry", topic:"Chemical Bonding" },
  { q:"Mendel's law of segregation:", options:["Genes linked","Alleles separate in gametes","Traits blend","Random assortment"], ans:1, subject:"Biology", topic:"Genetics" },
  { q:"Ohm's law: V doubles, R same → current:", options:["Halves","Doubles","Same","Quadruples"], ans:1, subject:"Physics", topic:"Current Electricity" },
  { q:"Which is NOT liver function?", options:["Bile production","Gluconeogenesis","Insulin production","Urea synthesis"], ans:2, subject:"Biology", topic:"Digestion" },
  { q:"Combustion enthalpy change is:", options:["Positive","Zero","Negative","Undefined"], ans:2, subject:"Chemistry", topic:"Thermodynamics" },
  { q:"Law of Reflection states:", options:["Snell's Law","i=r","Huygens","Brewster"], ans:1, subject:"Physics", topic:"Wave Optics" },
  { q:"Water vascular system in:", options:["Porifera","Mollusca","Echinodermata","Arthropoda"], ans:2, subject:"Biology", topic:"Animal Kingdom" },
  { q:"Krebs cycle occurs in:", options:["Cytoplasm","Mitochondrial matrix","Nucleus","Endoplasmic reticulum"], ans:1, subject:"Biology", topic:"Respiration" },
  { q:"Valency of Carbon:", options:["2","3","4","6"], ans:2, subject:"Chemistry", topic:"Atomic Structure" },
  { q:"Boyle's law: at constant T, PV =", options:["Increases","Decreases","Constant","Zero"], ans:2, subject:"Physics", topic:"Kinetic Theory" },
  { q:"Which is a vestigial organ in humans?", options:["Liver","Appendix","Kidney","Heart"], ans:1, subject:"Biology", topic:"Evolution" },
  { q:"Atomic number of Oxygen:", options:["6","7","8","9"], ans:2, subject:"Chemistry", topic:"Periodic Table" },
  { q:"Work = Force × Distance × cos(θ). If θ=90°, work=", options:["Maximum","Minimum","Zero","Negative"], ans:2, subject:"Physics", topic:"Work & Energy" },
]

const SUBJECTS = ['All','Biology','Chemistry','Physics']
const SCORE_KEY = 'jarvis_study_score_v1'

interface Score { correct: number; wrong: number; streak: number; bestStreak: number; total: number }

function loadScore(): Score {
  try { return JSON.parse(localStorage.getItem(SCORE_KEY) || 'null') || { correct:0,wrong:0,streak:0,bestStreak:0,total:0 } }
  catch { return { correct:0,wrong:0,streak:0,bestStreak:0,total:0 } }
}
function saveScore(s: Score) {
  try { localStorage.setItem(SCORE_KEY, JSON.stringify(s)) } catch {}
}

export default function StudyPage() {
  const router = useRouter()
  const [subject, setSubject] = useState('All')
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<number|null>(null)
  const [score, setScore] = useState<Score>(loadScore())
  const [aiExplain, setAiExplain] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiQs, setAiQs] = useState<typeof MCQ_BANK>([])
  const [genLoading, setGenLoading] = useState(false)
  const [tab, setTab] = useState<'quiz'|'ai'|'stats'>('quiz')
  const [xp, setXp] = useState({ xp: 0, level: 1 })

  // Load persisted AI questions from DB
  useEffect(() => {
    getSetting('study_ai_questions').then(saved => {
      if (saved && Array.isArray(saved)) setAiQs(saved)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    try { setXp(getXP()) } catch {}
  }, [])

  const bank = [...MCQ_BANK, ...aiQs]
  const filtered = subject === 'All' ? bank : bank.filter(q => q.subject === subject)
  const current = filtered[idx % filtered.length]

  const handleSelect = (i: number) => {
    if (selected !== null) return
    setSelected(i)
    const correct = i === current.ans
    const newScore = {
      ...score,
      correct: score.correct + (correct ? 1 : 0),
      wrong: score.wrong + (correct ? 0 : 1),
      streak: correct ? score.streak + 1 : 0,
      bestStreak: correct ? Math.max(score.bestStreak, score.streak + 1) : score.bestStreak,
      total: score.total + 1,
    }
    setScore(newScore)
    saveScore(newScore)
    if (correct) {
      try { addXP(10) } catch {}
    }
  }

  const next = () => { setSelected(null); setAiExplain(''); setIdx(i => (i+1) % filtered.length) }

  const askJARVIS = async () => {
    setAiLoading(true)
    try {
      const prompt = `NEET question explain karo Hinglish mein (3-4 lines max):\n\nQ: ${current.q}\nCorrect answer: ${current.options[current.ans]}\nTopic: ${current.topic}\n\nWHY correct hai — simple explanation.`
      const res = await fetch('/api/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role:'user', content: prompt }], mode: 'think' }),
      })
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let text = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        for (const line of dec.decode(value).split('\n')) {
          if (line.startsWith('data: ')) try { const d = JSON.parse(line.slice(6)); if (d.type==='delta') { text+=d.text; setAiExplain(text) } } catch {}
        }
      }
    } catch { setAiExplain('Network error.') }
    setAiLoading(false)
  }

  const generateAIQuestions = async () => {
    setGenLoading(true)
    try {
      const prompt = `Generate 5 NEET MCQs for ${subject === 'All' ? 'Biology/Chemistry/Physics' : subject}. 
Format EXACTLY as JSON array (no markdown, no explanation):
[{"q":"question","options":["A","B","C","D"],"ans":0,"subject":"Biology","topic":"Cell Biology"}]
ans = index of correct option (0-3). Return ONLY the JSON array.`
      const res = await fetch('/api/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role:'user', content: prompt }], mode: 'think', noStream: true }),
      })
      const d = await res.json()
      const content = d.content || ''
      const match = content.match(/\[[\s\S]*\]/)
      if (match) {
        const qs = JSON.parse(match[0])
        const newQs = qs.filter((q: any) => q.q && q.options?.length === 4)
        setAiQs(prev => {
          const updated = [...prev, ...newQs]
          setSetting('study_ai_questions', updated).catch(() => {})
          return updated
        })
      }
    } catch {}
    setGenLoading(false)
  }

  const accuracy = score.total > 0 ? Math.round(score.correct / score.total * 100) : 0

  return (
    <div style={{ background:'#060610', minHeight:'100vh', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderBottom:'1px solid #1e1e2e' }}>
        <button onClick={()=>router.push('/')} style={{ background:'none', border:'none', color:'#666', fontSize:20, cursor:'pointer' }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ color:'#00d4ff', fontWeight:700, fontSize:16 }}>📚 NEET Study Hub</div>
          <div style={{ color:'#555', fontSize:11 }}>{filtered.length} questions · Level {xp.level} · {xp.xp} XP</div>
        </div>
        {score.streak >= 3 && <div style={{ background:'rgba(245,158,11,0.15)', border:'1px solid #f59e0b', borderRadius:8, padding:'3px 8px', color:'#f59e0b', fontSize:11 }}>🔥 {score.streak} streak</div>}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #1e1e2e' }}>
        {(['quiz','ai','stats'] as const).map(t => (
          <button key={t} onClick={()=>setTab(t)} style={{ flex:1, padding:'10px 0', background:'none', border:'none', borderBottom: tab===t ? '2px solid #00d4ff' : '2px solid transparent', color: tab===t ? '#00d4ff' : '#555', fontSize:12, cursor:'pointer' }}>
            {t==='quiz'?'📝 Quiz':t==='ai'?'🤖 AI Questions':'📊 Stats'}
          </button>
        ))}
      </div>

      {/* Subject filter */}
      <div style={{ display:'flex', gap:6, padding:'8px 14px', overflowX:'auto' }}>
        {SUBJECTS.map(s => (
          <button key={s} onClick={()=>{setSubject(s);setIdx(0);setSelected(null);setAiExplain('')}} style={{ padding:'5px 12px', borderRadius:20, fontSize:11, cursor:'pointer', background: subject===s?'#00d4ff':'#1a1a2e', color: subject===s?'#000':'#888', border:'none', whiteSpace:'nowrap' }}>{s}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:14 }}>
        {/* QUIZ TAB */}
        {tab === 'quiz' && (
          <>
            <div style={{ background:'#111118', border:'1px solid #1e1e2e', borderRadius:16, padding:16, marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ background:'#1a1a2e', borderRadius:6, padding:'3px 8px', fontSize:11, color:'#00d4ff' }}>{current.subject}</span>
                <span style={{ color:'#555', fontSize:11 }}>{current.topic}</span>
              </div>
              <div style={{ color:'#e0e0ff', fontSize:15, fontWeight:500, lineHeight:1.5, marginBottom:16 }}>
                {(idx % filtered.length)+1}/{filtered.length}. {current.q}
              </div>
              {current.options.map((opt, i) => {
                let bg='#1a1a2e', border='1px solid #2a2a4a', color='#888'
                if (selected!==null) {
                  if (i===current.ans) { bg='rgba(34,197,94,0.15)'; border='1px solid #22c55e'; color='#22c55e' }
                  else if (i===selected) { bg='rgba(239,68,68,0.15)'; border='1px solid #ef4444'; color='#ef4444' }
                }
                return <button key={i} onClick={()=>handleSelect(i)} style={{ width:'100%', textAlign:'left', padding:'12px 14px', marginBottom:8, borderRadius:10, border, background:bg, color, fontSize:14, cursor: selected===null?'pointer':'default' }}>{String.fromCharCode(65+i)}. {opt}</button>
              })}
              {selected!==null && !aiExplain && !aiLoading && (
                <button onClick={askJARVIS} style={{ background:'rgba(0,212,255,0.1)', border:'1px solid #00d4ff', borderRadius:8, color:'#00d4ff', padding:'8px 14px', fontSize:13, cursor:'pointer', marginTop:8 }}>🤖 JARVIS se explain karwao</button>
              )}
              {aiLoading && <div style={{ color:'#555', fontSize:13, marginTop:8 }}>🧠 JARVIS soch raha hai...</div>}
              {aiExplain && <div style={{ background:'rgba(0,212,255,0.05)', border:'1px solid #1e1e2e', borderRadius:10, padding:12, marginTop:8, color:'#c8e8ff', fontSize:13, lineHeight:1.6 }}><span style={{ color:'#00d4ff', fontWeight:600 }}>JARVIS: </span>{aiExplain}</div>}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>{setIdx(i=>(i-1+filtered.length)%filtered.length);setSelected(null);setAiExplain('')}} style={{ flex:1, padding:12, background:'#1a1a2e', border:'1px solid #2a2a4a', borderRadius:10, color:'#888', cursor:'pointer' }}>← Prev</button>
              <button onClick={next} style={{ flex:1, padding:12, background:'#00d4ff', border:'none', borderRadius:10, color:'#000', cursor:'pointer', fontWeight:700 }}>Next →</button>
            </div>
          </>
        )}

        {/* AI QUESTIONS TAB */}
        {tab === 'ai' && (
          <div>
            <button onClick={generateAIQuestions} disabled={genLoading} style={{ width:'100%', background: genLoading?'#1a1a2e':'linear-gradient(135deg,#00d4ff,#0066cc)', border:'none', borderRadius:12, color: genLoading?'#555':'#000', padding:'14px', cursor: genLoading?'not-allowed':'pointer', fontWeight:700, fontSize:15, marginBottom:12 }}>
              {genLoading ? '🧠 Generating...' : '⚡ AI se 5 naye Questions Generate karo'}
            </button>
            <div style={{ color:'#444', fontSize:11, marginBottom:16, textAlign:'center' }}>{subject === 'All' ? 'All subjects' : subject} · AI generates unique NEET-style questions</div>
            {aiQs.length === 0 ? (
              <div style={{ textAlign:'center', color:'#333', padding:40 }}>Generate button dabao → AI NEET questions banayega</div>
            ) : (
              <div style={{ color:'#22c55e', fontSize:12, marginBottom:8 }}>✅ {aiQs.length} AI questions added to quiz!</div>
            )}
          </div>
        )}

        {/* STATS TAB */}
        {tab === 'stats' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:14 }}>
              {[
                { label:'Correct', val: score.correct, color:'#22c55e' },
                { label:'Wrong', val: score.wrong, color:'#ef4444' },
                { label:'Accuracy', val: `${accuracy}%`, color:'#00d4ff' },
                { label:'Best Streak', val: `🔥${score.bestStreak}`, color:'#f59e0b' },
              ].map(s => (
                <div key={s.label} style={{ background:'#111118', border:`1px solid ${s.color}33`, borderRadius:12, padding:'16px', textAlign:'center' }}>
                  <div style={{ color:s.color, fontSize:26, fontWeight:700 }}>{s.val}</div>
                  <div style={{ color:'#555', fontSize:11 }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ background:'#111118', border:'1px solid #1e1e2e', borderRadius:12, padding:14, marginBottom:10 }}>
              <div style={{ color:'#00d4ff', fontSize:12, marginBottom:8 }}>Progress Bar</div>
              <div style={{ background:'#1a1a2e', borderRadius:4, height:8, overflow:'hidden' }}>
                <div style={{ width:`${accuracy}%`, height:'100%', background:'linear-gradient(90deg,#22c55e,#00d4ff)', borderRadius:4, transition:'width 0.5s' }} />
              </div>
              <div style={{ color:'#555', fontSize:11, marginTop:6, textAlign:'right' }}>{score.total} questions attempted</div>
            </div>
            <button onClick={()=>{ const r={correct:0,wrong:0,streak:0,bestStreak:score.bestStreak,total:0}; setScore(r); saveScore(r) }} style={{ width:'100%', background:'none', border:'1px solid #2a2a4a', borderRadius:10, color:'#555', padding:10, cursor:'pointer', fontSize:12 }}>🔄 Reset Score (Best streak preserved)</button>
          </div>
        )}
      </div>
    </div>
  )
}
