'use client'
import React, { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPlan, type AgentPlan, type AgentStep } from '@/lib/agent/planner'
import { executePlan } from '@/lib/agent/executor'
import { enqueue, getAllPlans, deletePlan, type QueuedPlan } from '@/lib/agent/queue'

const TOOL_ICONS: Record<string, string> = {
  ai_text: '🤖', ai_image: '🎨', ai_tts: '🔊', web_search: '🔍',
  open_app: '📱', phone_action: '⚡', save_note: '💾',
  send_message: '📤', copy_text: '📋', open_url: '🌐', show_result: '✅',
}
const STATUS_COLOR: Record<string, string> = {
  pending: '#444', running: '#00d4ff', done: '#22c55e', failed: '#ef4444',
}

export default function AgentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [goal, setGoal] = useState('')
  const [phase, setPhase] = useState<'idle' | 'planning' | 'running' | 'done'>('idle')
  const [plan, setPlan] = useState<AgentPlan | null>(null)
  const [history, setHistory] = useState<QueuedPlan[]>([])
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [finalResult, setFinalResult] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { getAllPlans().then(setHistory).catch(() => {}) }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [plan?.steps])

  // Auto-run if goal came from main chat
  useEffect(() => {
    const urlGoal = searchParams.get('goal')
    if (urlGoal && phase === 'idle') {
      setGoal(urlGoal)
      setTimeout(() => runGoal(urlGoal), 300)
    }
  }, [searchParams])

  const runGoal = async (targetGoal: string) => {
    if (!targetGoal.trim() || phase === 'running') return
    setPhase('planning')
    setFinalResult('')
    setPlan(null)

    const newPlan = await createPlan(targetGoal)
    await enqueue(newPlan).catch(() => null)
    setPlan(newPlan)
    setPhase('running')

    await executePlan(
      newPlan,
      (step) => {
        setActiveStep(step.id)
        setPlan(p => p ? { ...p, steps: p.steps.map(s => s.id === step.id ? step : s) } : p)
      },
      (donePlan) => {
        setPlan(donePlan)
        setPhase('done')
        setActiveStep(null)
        const lastDone = donePlan.steps.filter(s => s.status === 'done').pop()
        setFinalResult(lastDone?.output || 'Done!')
        getAllPlans().then(setHistory).catch(() => {})
      },
      (err) => { setPhase('done'); setFinalResult('Error: ' + err) }
    )
  }

  const run = () => runGoal(goal)

  const QUICK = [
    'YouTube ke liye ek script banao',
    'Aaj ka AI news search karo',
    'Ek motivational image banao',
    'WiFi on karo',
    '"Kal 7 baje" reminder set karo',
    'WhatsApp ke liye message draft karo',
  ]

  return (
    <div style={{ background: '#060610', minHeight: '100vh', color: '#e0e0ff', fontFamily: 'monospace', maxWidth: 520, margin: '0 auto', padding: '0 0 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid #1e1e2e', position: 'sticky', top: 0, background: '#060610', zIndex: 10 }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 15 }}>⚡ Agent Mode</div>
          <div style={{ color: '#333', fontSize: 10 }}>Multi-step autonomous tasks</div>
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        {/* Goal input */}
        <div style={{ background: '#0e0e1a', border: '1px solid #1e1e2e', borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ color: '#444', fontSize: 10, marginBottom: 6, letterSpacing: 1 }}>GOAL / TASK</div>
          <textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="Kya karna hai? Jaise: YouTube video script banao, aur thumbnail bhi..."
            disabled={phase === 'running' || phase === 'planning'}
            rows={3}
            style={{ width: '100%', background: 'transparent', border: 'none', color: '#e0e0ff', fontSize: 14, resize: 'none', outline: 'none', lineHeight: 1.6 }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run() } }}
          />
          <button onClick={run} disabled={!goal.trim() || phase === 'running' || phase === 'planning'}
            style={{ marginTop: 8, width: '100%', background: phase === 'running' ? '#1e1e2e' : 'linear-gradient(135deg,#00d4ff,#0066cc)', border: 'none', borderRadius: 10, color: phase === 'running' ? '#444' : '#000', padding: '11px', fontWeight: 900, fontSize: 14, cursor: phase === 'running' ? 'not-allowed' : 'pointer' }}>
            {phase === 'planning' ? '⏳ Planning...' : phase === 'running' ? '⚡ Running...' : '🚀 Run Task'}
          </button>
        </div>

        {/* Quick tasks */}
        {phase === 'idle' && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: '#333', fontSize: 10, marginBottom: 6, letterSpacing: 1 }}>QUICK TASKS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {QUICK.map(q => (
                <button key={q} onClick={() => setGoal(q)}
                  style={{ background: '#0e0e1a', border: '1px solid #1e1e2e', borderRadius: 20, color: '#555', fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Plan steps */}
        {plan && (
          <div style={{ background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: 14, padding: 14, marginBottom: 12 }}>
            <div style={{ color: '#00d4ff', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
              📋 {plan.goal.slice(0, 50)}{plan.goal.length > 50 ? '...' : ''}
            </div>
            {plan.steps.map((step, i) => (
              <div key={step.id} style={{ display: 'flex', gap: 10, marginBottom: 10, opacity: step.status === 'pending' ? 0.4 : 1 }}>
                <div style={{ fontSize: 18, minWidth: 24 }}>{TOOL_ICONS[step.tool] || '🔧'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#e0e0ff', fontSize: 12 }}>
                      {step.tool.replace('_', ' ')}
                      {step.status === 'running' && <span style={{ color: '#00d4ff', marginLeft: 6 }}>●</span>}
                    </div>
                    <div style={{ color: STATUS_COLOR[step.status], fontSize: 10 }}>
                      {step.status === 'running' ? '⏳' : step.status === 'done' ? '✅' : step.status === 'failed' ? '❌' : `${i+1}`}
                    </div>
                  </div>
                  {step.output && (
                    <div style={{ color: '#555', fontSize: 10, marginTop: 4, maxHeight: 60, overflow: 'hidden', lineHeight: 1.5 }}>
                      {step.output.slice(0, 120)}{step.output.length > 120 ? '...' : ''}
                    </div>
                  )}
                  {step.error && <div style={{ color: '#ef4444', fontSize: 10, marginTop: 2 }}>{step.error}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Final result */}
        {finalResult && (
          <div style={{ background: '#0a1a0a', border: '1px solid #22c55e33', borderRadius: 14, padding: 14, marginBottom: 12 }}>
            <div style={{ color: '#22c55e', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>✅ Result</div>
            <div style={{ color: '#e0e0ff', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{finalResult}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => navigator.clipboard?.writeText(finalResult)}
                style={{ background: '#1e1e2e', border: 'none', borderRadius: 8, color: '#00d4ff', padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>📋 Copy</button>
              <button onClick={() => { setPhase('idle'); setPlan(null); setGoal(''); setFinalResult('') }}
                style={{ background: '#1e1e2e', border: 'none', borderRadius: 8, color: '#555', padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>🔄 New Task</button>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && phase === 'idle' && (
          <div>
            <div style={{ color: '#333', fontSize: 10, marginBottom: 6, letterSpacing: 1 }}>RECENT TASKS</div>
            {history.slice(0, 5).map(h => (
              <div key={h.id} style={{ background: '#0e0e1a', border: '1px solid #1e1e2e', borderRadius: 10, padding: '10px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#e0e0ff', fontSize: 12 }}>{h.goal.slice(0, 45)}</div>
                  <div style={{ color: '#333', fontSize: 10 }}>{h.steps.length} steps · {new Date(h.createdAt).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: h.status === 'done' ? '#22c55e' : '#ef4444', fontSize: 14 }}>
                    {h.status === 'done' ? '✅' : '❌'}
                  </span>
                  <button onClick={() => deletePlan(h.id).then(() => getAllPlans().then(setHistory))}
                    style={{ background: 'none', border: 'none', color: '#333', fontSize: 14, cursor: 'pointer' }}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
