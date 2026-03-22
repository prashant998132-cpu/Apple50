'use client'
import React, { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { runAgent, type AgentStep } from '@/lib/agent/jarvisAgent'

function AgentContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [goal, setGoal] = useState(params?.get('goal') || '')
  const [history, setHistory] = React.useState<{goal:string; steps:number; ts:number}[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('jarvis_agent_history') || '[]') } catch { return [] }
  })
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [finalAnswer, setFinalAnswer] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps, finalAnswer])

  const start = async () => {
    if (!goal.trim() || status === 'running') return
    setSteps([])
    setFinalAnswer('')
    setError('')
    setStatus('running')

    await runAgent(
      goal.trim(),
      (step, idx) => {
        setSteps(prev => {
          const next = [...prev]
          next[idx] = step
          return next
        })
      },
      (answer) => {
        // Save to history
        const run = { goal: goal.trim(), steps: steps.length, ts: Date.now() }
        const updated = [run, ...history].slice(0, 20)
        setHistory(updated)
        if (typeof window !== 'undefined') localStorage.setItem('jarvis_agent_history', JSON.stringify(updated))
        setFinalAnswer(answer)
        setStatus('done')
      },
      (msg) => {
        setError(msg)
        setStatus('error')
      }
    )
  }

  // Auto-start if goal in URL
  useEffect(() => {
    if (params?.get('goal') && status === 'idle') {
      setTimeout(start, 500)
    }
  }, [])

  const EXAMPLES = [
    'Maihar ka weather check karo aur agar barish ho toh reminder set karo',
    'Bitcoin aur Ethereum ka price check karo aur ek note save karo',
    'Latest tech news search karo aur summary likho',
    'Mera study plan banao aur goals mein add karo',
    'Happy birthday message likho aur WhatsApp kholo',
  ]

  return (
    <div style={{ background: '#060610', height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>⚡ Agent Mode</div>
          <div style={{ color: '#444', fontSize: 10 }}>JARVIS khud sab karta hai</div>
        </div>
        <div style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: 12, background: status === 'running' ? 'rgba(239,68,68,0.15)' : status === 'done' ? 'rgba(34,197,94,0.15)' : 'rgba(0,212,255,0.1)', color: status === 'running' ? '#ef4444' : status === 'done' ? '#22c55e' : '#00d4ff', fontSize: 10 }}>
          {status === 'idle' ? '● Ready' : status === 'running' ? '● Running' : status === 'done' ? '● Done' : '● Error'}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, minHeight: 0 }}>

        {/* Idle state — show examples */}
        {/* Run History */}
        {status === 'idle' && history.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#444', fontSize: 11, marginBottom: 8 }}>RECENT RUNS</div>
            {history.slice(0, 5).map((h, i) => (
              <button key={i} onClick={() => { setGoal(h.goal); }}
                style={{ width: '100%', background: '#0d0d18', border: '1px solid #1e1e2e', borderRadius: 10, padding: '8px 12px', color: '#666', fontSize: 12, cursor: 'pointer', textAlign: 'left', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{h.goal}</span>
                <span style={{ color: '#333', fontSize: 10, flexShrink: 0 }}>{h.steps} steps</span>
              </button>
            ))}
          </div>
        )}

        {status === 'idle' && steps.length === 0 && (
          <div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 14, lineHeight: 1.8 }}>
              Goal do — JARVIS khud plan banayega, tools use karega, aur complete karega. Tu sirf dekh!
            </div>
            <div style={{ color: '#555', fontSize: 11, marginBottom: 8 }}>Examples:</div>
            {EXAMPLES.map(ex => (
              <button key={ex} onClick={() => { setGoal(ex); setTimeout(start, 100); }}
                style={{ width: '100%', background: '#111118', border: '1px solid #1e1e2e', borderRadius: 10, padding: '10px 12px', color: '#888', fontSize: 12, cursor: 'pointer', textAlign: 'left', marginBottom: 8, lineHeight: 1.6 }}>
                ⚡ {ex}
              </button>
            ))}
          </div>
        )}

        {/* Running steps */}
        {steps.map((step, i) => (
          <div key={i} style={{ marginBottom: 14 }}>
            {/* Thought bubble */}
            <div style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 10, padding: '8px 12px', marginBottom: 6 }}>
              <div style={{ color: '#555', fontSize: 10, marginBottom: 3 }}>🧠 THOUGHT {i+1}</div>
              <div style={{ color: '#888', fontSize: 12, lineHeight: 1.6 }}>{step.thought}</div>
            </div>
            {/* Action */}
            <div style={{ background: '#0d0d18', border: '1px solid #1e1e2e', borderRadius: 10, padding: '8px 12px', marginBottom: 6 }}>
              <div style={{ color: '#555', fontSize: 10, marginBottom: 3 }}>⚡ ACTION</div>
              <div style={{ color: '#00d4ff', fontSize: 12, fontFamily: 'monospace' }}>{step.action}</div>
            </div>
            {/* Result */}
            {step.result && (
              <div style={{ background: step.status === 'error' ? 'rgba(239,68,68,0.05)' : 'rgba(34,197,94,0.05)', border: `1px solid ${step.status === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`, borderRadius: 10, padding: '8px 12px' }}>
                <div style={{ color: '#555', fontSize: 10, marginBottom: 3 }}>{step.status === 'error' ? '❌ ERROR' : '✅ RESULT'}</div>
                <div style={{ color: step.status === 'error' ? '#ef4444' : '#22c55e', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{step.result}</div>
              </div>
            )}
            {/* Running indicator */}
            {step.status === 'running' && !step.result && (
              <div style={{ color: '#444', fontSize: 12, padding: '8px 12px' }}>⏳ Running...</div>
            )}
          </div>
        ))}

        {/* Final Answer */}
        {finalAnswer && (
          <div style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.3)', borderRadius: 12, padding: 14, marginTop: 8 }}>
            <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>🎯 JARVIS Done!</div>
            <div style={{ color: '#ccc', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{finalAnswer}</div>
            <button onClick={() => { setSteps([]); setFinalAnswer(''); setStatus('idle'); setGoal(''); }}
              style={{ marginTop: 12, background: 'rgba(0,212,255,0.15)', border: '1px solid #00d4ff', borderRadius: 8, color: '#00d4ff', padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>
              Naya Goal →
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, marginTop: 8, color: '#ef4444', fontSize: 12 }}>
            ❌ {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #1e1e2e' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            ref={inputRef}
            value={goal}
            onChange={e => setGoal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && start()}
            placeholder="Goal do — JARVIS khud karta hai..."
            disabled={status === 'running'}
            style={{ flex: 1, background: '#111118', border: '1px solid #2a2a4a', borderRadius: 20, padding: '10px 14px', color: '#e0e0ff', fontSize: 14, outline: 'none', opacity: status === 'running' ? 0.6 : 1 }}
          />
          <button onClick={start} disabled={!goal.trim() || status === 'running'}
            style={{ width: 44, height: 44, borderRadius: '50%', background: goal.trim() && status !== 'running' ? 'linear-gradient(135deg,#00d4ff,#0077bb)' : '#1a1a2e', border: 'none', color: goal.trim() && status !== 'running' ? '#000' : '#333', fontSize: 18, cursor: goal.trim() && status !== 'running' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
            {status === 'running' ? '⏳' : '⚡'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AgentPage() {
  return (
    <Suspense fallback={<div style={{ background:'#060610', height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', color:'#00d4ff' }}>⏳ Loading...</div>}>
      <AgentContent />
    </Suspense>
  )
}
