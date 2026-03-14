'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

type Tool = 'bmi' | 'emi' | 'sip' | 'gst' | 'compound' | 'age' | 'tip' | 'unit' | 'percentage' | 'date' | 'password' | 'base64'

const TOOLS = [
  { k: 'bmi' as Tool, icon: '⚖️', label: 'BMI', cat: 'Health' },
  { k: 'emi' as Tool, icon: '🏠', label: 'EMI Loan', cat: 'Finance' },
  { k: 'sip' as Tool, icon: '📈', label: 'SIP Returns', cat: 'Finance' },
  { k: 'gst' as Tool, icon: '🧾', label: 'GST', cat: 'Finance' },
  { k: 'compound' as Tool, icon: '💰', label: 'Compound Interest', cat: 'Finance' },
  { k: 'percentage' as Tool, icon: '%', label: 'Percentage', cat: 'Math' },
  { k: 'age' as Tool, icon: '🎂', label: 'Age Calculator', cat: 'Utility' },
  { k: 'tip' as Tool, icon: '🍽️', label: 'Tip Splitter', cat: 'Utility' },
  { k: 'unit' as Tool, icon: '📏', label: 'Unit Converter', cat: 'Utility' },
  { k: 'date' as Tool, icon: '📅', label: 'Date Difference', cat: 'Utility' },
  { k: 'password' as Tool, icon: '🔐', label: 'Password Gen', cat: 'Security' },
  { k: 'base64' as Tool, icon: '🔢', label: 'Base64', cat: 'Dev' },
]

function calcBMI(w: number, h: number) {
  const bmi = w / ((h / 100) ** 2)
  const cat = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal ✅' : bmi < 30 ? 'Overweight ⚠️' : 'Obese ❌'
  return `BMI: **${bmi.toFixed(1)}** — ${cat}`
}

function calcEMI(p: number, r: number, n: number) {
  const monthly = r / 12 / 100
  const emi = p * monthly * Math.pow(1 + monthly, n) / (Math.pow(1 + monthly, n) - 1)
  const total = emi * n
  const interest = total - p
  return `EMI: ₹${emi.toFixed(0)}/month\nTotal: ₹${total.toFixed(0)} | Interest: ₹${interest.toFixed(0)}`
}

function calcSIP(monthly: number, rate: number, years: number) {
  const months = years * 12, r = rate / 12 / 100
  const fv = monthly * ((Math.pow(1 + r, months) - 1) / r) * (1 + r)
  const invested = monthly * months
  return `Invested: ₹${invested.toLocaleString('en-IN')}\nReturns: ₹${(fv - invested).toLocaleString('en-IN')}\n**Total: ₹${fv.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}**`
}

function calcGST(amount: number, rate: number, mode: 'add' | 'remove') {
  if (mode === 'add') {
    const gst = amount * rate / 100
    return `Original: ₹${amount}\nGST (${rate}%): ₹${gst.toFixed(2)}\n**Total: ₹${(amount + gst).toFixed(2)}**\nCGST: ₹${(gst/2).toFixed(2)} | SGST: ₹${(gst/2).toFixed(2)}`
  } else {
    const original = amount * 100 / (100 + rate)
    const gst = amount - original
    return `GST Inclusive: ₹${amount}\nOriginal: ₹${original.toFixed(2)}\n**GST (${rate}%): ₹${gst.toFixed(2)}**\nCGST: ₹${(gst/2).toFixed(2)} | SGST: ₹${(gst/2).toFixed(2)}`
  }
}

function calcCompound(p: number, r: number, n: number, freq: number) {
  const amount = p * Math.pow(1 + r / (freq * 100), freq * n)
  const interest = amount - p
  return `Principal: ₹${p.toLocaleString('en-IN')}\nInterest: ₹${interest.toFixed(2)}\n**Total: ₹${amount.toFixed(2)}**`
}

function calcAge(dob: string) {
  const birth = new Date(dob), now = new Date()
  let years = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth() - birth.getMonth()
  let days = now.getDate() - birth.getDate()
  if (days < 0) { months--; days += 30 }
  if (months < 0) { years--; months += 12 }
  const totalDays = Math.floor((now.getTime() - birth.getTime()) / 86400000)
  const nextBirthday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate())
  if (nextBirthday < now) nextBirthday.setFullYear(now.getFullYear() + 1)
  const daysToB = Math.floor((nextBirthday.getTime() - now.getTime()) / 86400000)
  return `Umar: **${years} years ${months} months ${days} days**\nTotal days alive: ${totalDays.toLocaleString()}\nNext birthday: ${daysToB} days mein 🎂`
}

function calcTip(bill: number, tipPct: number, people: number) {
  const tip = bill * tipPct / 100
  const total = bill + tip
  return `Bill: ₹${bill} | Tip (${tipPct}%): ₹${tip.toFixed(2)}\n**Total: ₹${total.toFixed(2)}**\nPer person (${people}): ₹${(total / people).toFixed(2)}`
}

function calcPercentage(type: string, a: number, b: number) {
  if (type === 'of') return `${a}% of ${b} = **${(a * b / 100).toFixed(2)}**`
  if (type === 'change') return `Change from ${a} to ${b}: **${(((b - a) / a) * 100).toFixed(2)}%**`
  if (type === 'what') return `${a} is **${((a / b) * 100).toFixed(2)}%** of ${b}`
  return ''
}

function calcDateDiff(d1: string, d2: string) {
  const a = new Date(d1), b = new Date(d2)
  const ms = Math.abs(b.getTime() - a.getTime())
  const days = Math.floor(ms / 86400000)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30.44)
  const years = Math.floor(days / 365.25)
  return `Difference: **${days} days**\n= ${weeks} weeks | ${months} months | ${years} years`
}

function generatePassword(len: number, opts: { upper: boolean; nums: boolean; symbols: boolean }) {
  let chars = 'abcdefghijklmnopqrstuvwxyz'
  if (opts.upper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (opts.nums) chars += '0123456789'
  if (opts.symbols) chars += '!@#$%^&*_-+=?'
  let pwd = ''
  for (let i = 0; i < len; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  return pwd
}

function fmtResult(text: string) {
  return text.split('\n').map((line, i) => {
    const bold = line.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#00d4ff">$1</strong>')
    return <div key={i} style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: bold }} />
  })
}

export default function ToolsPage() {
  const router = useRouter()
  const [active, setActive] = useState<Tool>('bmi')
  const [result, setResult] = useState('')
  const [f, setF] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)

  const v = (key: string, def = '') => f[key] ?? def
  const n = (key: string) => parseFloat(v(key) || '0')
  const set = (key: string, val: string) => setF(p => ({ ...p, [key]: val }))

  const run = () => {
    try {
      let r = ''
      if (active === 'bmi') r = calcBMI(n('weight'), n('height'))
      else if (active === 'emi') r = calcEMI(n('principal'), n('rate'), n('months'))
      else if (active === 'sip') r = calcSIP(n('monthly'), n('sipRate'), n('years'))
      else if (active === 'gst') r = calcGST(n('amount'), n('gstRate'), (v('gstMode') || 'add') as any)
      else if (active === 'compound') r = calcCompound(n('cp'), n('cr'), n('cn'), n('cf') || 1)
      else if (active === 'age') r = calcAge(v('dob'))
      else if (active === 'tip') r = calcTip(n('bill'), n('tipPct') || 10, n('people') || 1)
      else if (active === 'percentage') r = calcPercentage(v('ptype') || 'of', n('pa'), n('pb'))
      else if (active === 'date') r = calcDateDiff(v('date1'), v('date2'))
      else if (active === 'password') r = generatePassword(n('pwdLen') || 16, { upper: v('pwdUpper') !== 'false', nums: v('pwdNums') !== 'false', symbols: v('pwdSymbols') !== 'false' })
      else if (active === 'base64') r = v('b64mode') === 'decode' ? atob(v('b64text') || '') : btoa(v('b64text') || '')
      setResult(r)
    } catch { setResult('Invalid input. Check karo.') }
  }

  const inp = (key: string, placeholder: string, type = 'number') => (
    <input type={type} value={v(key)} onChange={e => set(key, e.target.value)} placeholder={placeholder}
      style={{ width: '100%', background: '#111118', border: '1px solid #2a2a4a', borderRadius: 8, padding: '9px 12px', color: '#e0e0ff', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
  )

  const sel = (key: string, options: { val: string; label: string }[]) => (
    <select value={v(key)} onChange={e => set(key, e.target.value)}
      style={{ width: '100%', background: '#111118', border: '1px solid #2a2a4a', borderRadius: 8, padding: '9px 12px', color: '#e0e0ff', fontSize: 13, outline: 'none', marginBottom: 8 }}>
      {options.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
    </select>
  )

  const FORMS: Record<Tool, React.ReactNode> = {
    bmi: <>{inp('weight', 'Weight (kg)')}{inp('height', 'Height (cm)')}</>,
    emi: <>{inp('principal', 'Loan Amount (₹)')}{inp('rate', 'Interest Rate (% per year)')}{inp('months', 'Loan Duration (months)')}</>,
    sip: <>{inp('monthly', 'Monthly Investment (₹)')}{inp('sipRate', 'Expected Return (% per year)')}{inp('years', 'Duration (years)')}</>,
    gst: <>{inp('amount', 'Amount (₹)')}{inp('gstRate', 'GST Rate (%)')}{sel('gstMode', [{ val: 'add', label: 'Add GST to price' }, { val: 'remove', label: 'Remove GST from price' }])}</>,
    compound: <>{inp('cp', 'Principal (₹)')}{inp('cr', 'Annual Rate (%)')}{inp('cn', 'Time (years)')}{sel('cf', [{ val: '1', label: 'Yearly' }, { val: '2', label: 'Half-yearly' }, { val: '4', label: 'Quarterly' }, { val: '12', label: 'Monthly' }])}</>,
    age: <>{inp('dob', 'Date of Birth', 'date')}</>,
    tip: <>{inp('bill', 'Bill Amount (₹)')}{inp('tipPct', 'Tip % (default 10)')}{inp('people', 'Number of People')}</>,
    percentage: <>{sel('ptype', [{ val: 'of', label: 'X% of Y' }, { val: 'change', label: '% Change from X to Y' }, { val: 'what', label: 'X is what % of Y' }])}{inp('pa', 'X (first number)')}{inp('pb', 'Y (second number)')}</>,
    date: <>{inp('date1', 'Start Date', 'date')}{inp('date2', 'End Date', 'date')}</>,
    password: <>{inp('pwdLen', 'Length (default 16)')}{sel('pwdUpper', [{ val: 'true', label: 'Include uppercase' }, { val: 'false', label: 'Only lowercase' }])}{sel('pwdNums', [{ val: 'true', label: 'Include numbers' }, { val: 'false', label: 'No numbers' }])}{sel('pwdSymbols', [{ val: 'true', label: 'Include symbols' }, { val: 'false', label: 'No symbols' }])}</>,
    base64: <>{sel('b64mode', [{ val: 'encode', label: 'Text → Base64' }, { val: 'decode', label: 'Base64 → Text' }])}<textarea value={v('b64text')} onChange={e => set('b64text', e.target.value)} placeholder="Text yahan likho..." rows={3} style={{ width: '100%', background: '#111118', border: '1px solid #2a2a4a', borderRadius: 8, padding: '9px 12px', color: '#e0e0ff', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: 8 }} /></>,
    unit: <div style={{ color: '#555', fontSize: 13 }}>Coming soon — Unit converter</div>,
  }

  return (
    <div style={{ background: '#060610', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>🛠️ Tools & Calculators</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {TOOLS.map(t => (
            <button key={t.k} onClick={() => { setActive(t.k); setResult('') }} style={{ background: active === t.k ? 'rgba(0,212,255,0.12)' : '#111118', border: `1px solid ${active === t.k ? '#00d4ff' : '#1e1e2e'}`, borderRadius: 10, padding: '10px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <span style={{ color: active === t.k ? '#00d4ff' : '#666', fontSize: 10, textAlign: 'center', lineHeight: 1.2 }}>{t.label}</span>
            </button>
          ))}
        </div>

        <div style={{ background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: 14, padding: 16 }}>
          <div style={{ color: '#00d4ff', fontWeight: 600, marginBottom: 12 }}>
            {TOOLS.find(t => t.k === active)?.icon} {TOOLS.find(t => t.k === active)?.label}
          </div>
          {FORMS[active]}
          <button onClick={run} style={{ width: '100%', background: '#00d4ff', border: 'none', borderRadius: 10, color: '#000', padding: 12, cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
            Calculate ⚡
          </button>

          {result && (
            <div style={{ marginTop: 14, background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 10, padding: 14 }}>
              <div style={{ color: '#c8e8ff', fontSize: 14, lineHeight: 1.8 }}>{fmtResult(result)}</div>
              <button onClick={() => { navigator.clipboard?.writeText(result.replace(/\*\*/g, '')); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                style={{ marginTop: 8, background: 'none', border: '1px solid #333', borderRadius: 6, color: '#555', padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>
                {copied ? '✅ Copied!' : '📋 Copy'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
