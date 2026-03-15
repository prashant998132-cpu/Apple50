'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setProfile } from '@/lib/db'

const STEPS = [
  { key: 'name',     icon: '👋', title: 'Tera naam kya hai?',            placeholder: 'e.g. Pranshu',         type: 'text' },
  { key: 'city',     icon: '📍', title: 'Kahan se hai?',                  placeholder: 'e.g. Maihar, MP',       type: 'text' },
  { key: 'goal',     icon: '🎯', title: 'Abhi kya kar raha hai?',         placeholder: 'e.g. Engineer banna hai, startup chahiye', type: 'text' },
  { key: 'hours',    icon: '⏰', title: 'Din mein kitne ghante kaam karta hai?', placeholder: 'e.g. 4-6 ghante', type: 'text' },
  { key: 'interest', icon: '💡', title: 'Kya kya interest hai?',          placeholder: 'e.g. coding, music, gaming', type: 'text' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string,string>>({})
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)

  const current = STEPS[step]

  const next = async () => {
    if (!val.trim()) return
    const updated = { ...answers, [current.key]: val.trim() }
    setAnswers(updated)
    setVal('')

    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      // Save all to DB
      setSaving(true)
      await Promise.all(Object.entries(updated).map(([k, v]) => setProfile(k, v).catch(() => {})))
      await setProfile('onboarded', true).catch(() => {})
      setSaving(false)
      router.replace('/')
    }
  }

  const skip = async () => {
    await setProfile('onboarded', true).catch(() => {})
    router.replace('/')
  }

  const progress = ((step) / STEPS.length) * 100

  return (
    <div style={{ background: '#060610', height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 400, height: 3, background: '#1a1a2e', borderRadius: 2, marginBottom: 40, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: '#00d4ff', borderRadius: 2, width: progress + '%', transition: 'width 0.4s' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>{current.icon}</div>
        <div style={{ color: '#e0e0ff', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>{current.title}</div>
        <div style={{ color: '#444', fontSize: 12, marginBottom: 32 }}>{step + 1} of {STEPS.length}</div>

        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && next()}
          placeholder={current.placeholder}
          style={{ width: '100%', background: '#111118', border: '1px solid #2a2a4a', borderRadius: 14, padding: '14px 16px', color: '#e0e0ff', fontSize: 16, outline: 'none', textAlign: 'center', boxSizing: 'border-box', marginBottom: 16 }}
        />

        <button onClick={next} disabled={!val.trim() || saving}
          style={{ width: '100%', background: val.trim() ? 'linear-gradient(135deg,#00d4ff,#0077bb)' : '#1a1a2e', border: 'none', borderRadius: 14, color: val.trim() ? '#000' : '#444', padding: 16, fontSize: 16, fontWeight: 700, cursor: val.trim() ? 'pointer' : 'not-allowed', marginBottom: 12, transition: 'all 0.2s' }}>
          {saving ? 'Saving...' : step === STEPS.length - 1 ? '🚀 JARVIS Start Karo' : 'Aage →'}
        </button>

        <button onClick={skip} style={{ background: 'none', border: 'none', color: '#333', fontSize: 13, cursor: 'pointer' }}>
          Skip karo →
        </button>
      </div>
    </div>
  )
}
