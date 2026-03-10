'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { calculateBMI, calculateEMI, calculateSIP } from '@/lib/tools/connected';

type Tool = 'bmi' | 'emi' | 'sip' | 'gst' | 'age' | 'tip';

export default function ToolsPage() {
  const router = useRouter();
  const [tool, setTool] = useState<Tool>('bmi');
  const [result, setResult] = useState('');

  // BMI
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  // EMI
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [months, setMonths] = useState('');
  // SIP
  const [monthly, setMonthly] = useState('');
  const [sipRate, setSipRate] = useState('12');
  const [years, setYears] = useState('');
  // GST
  const [amount, setAmount] = useState('');
  const [gstRate, setGstRate] = useState('18');
  // Age
  const [dob, setDob] = useState('');
  // Tip
  const [bill, setBill] = useState('');
  const [tipPct, setTipPct] = useState('10');

  const calcBMI = () => {
    const r = calculateBMI(parseFloat(weight), parseFloat(height));
    setResult(r.text || '');
  };

  const calcEMI = () => {
    const r = calculateEMI(parseFloat(principal), parseFloat(rate), parseInt(months));
    setResult(r.text || '');
  };

  const calcSIP = () => {
    const r = calculateSIP(parseFloat(monthly), parseFloat(sipRate), parseInt(years));
    setResult(r.text || '');
  };

  const calcGST = () => {
    const amt = parseFloat(amount);
    const r = parseFloat(gstRate);
    const gstAmt = (amt * r / 100).toFixed(2);
    const total = (amt + parseFloat(gstAmt)).toFixed(2);
    setResult(`🧮 GST Calculator\nAmount: ₹${amt.toLocaleString('en-IN')}\nGST (${gstRate}%): ₹${parseFloat(gstAmt).toLocaleString('en-IN')}\n\n💰 Total: ₹${parseFloat(total).toLocaleString('en-IN')}`);
  };

  const calcAge = () => {
    const d = new Date(dob);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const age = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
    const months2 = Math.floor((diff % (365.25 * 24 * 3600 * 1000)) / (30 * 24 * 3600 * 1000));
    const days = Math.floor((diff % (30 * 24 * 3600 * 1000)) / (24 * 3600 * 1000));
    setResult(`🎂 Age Calculator\nDate of Birth: ${new Date(dob).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n📅 Age: ${age} years, ${months2} months, ${days} days`);
  };

  const calcTip = () => {
    const b = parseFloat(bill);
    const t = b * parseFloat(tipPct) / 100;
    setResult(`💸 Tip Calculator\nBill: ₹${b.toLocaleString('en-IN')}\nTip (${tipPct}%): ₹${t.toFixed(2)}\n\n✅ Total: ₹${(b + t).toFixed(2)}`);
  };

  const TOOLS: { key: Tool; icon: string; label: string }[] = [
    { key: 'bmi', icon: '⚖️', label: 'BMI' },
    { key: 'emi', icon: '🏦', label: 'EMI' },
    { key: 'sip', icon: '📈', label: 'SIP' },
    { key: 'gst', icon: '🧮', label: 'GST' },
    { key: 'age', icon: '🎂', label: 'Age' },
    { key: 'tip', icon: '💸', label: 'Tip' },
  ];

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0d0d1a', border: '1px solid #2a2a4a',
    borderRadius: 8, padding: '10px 12px', color: '#e0e0ff',
    fontSize: 15, outline: 'none', marginBottom: 10, boxSizing: 'border-box',
  };

  const btnStyle: React.CSSProperties = {
    width: '100%', background: '#00d4ff', border: 'none', borderRadius: 10,
    color: '#000', padding: 12, cursor: 'pointer', fontWeight: 700, fontSize: 15, marginTop: 4,
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>🛠️ India Calculators</div>
      </div>

      {/* Tool selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: 12 }}>
        {TOOLS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTool(t.key); setResult(''); }}
            style={{
              padding: '10px 4px', borderRadius: 10, cursor: 'pointer',
              background: tool === t.key ? 'rgba(0,212,255,0.15)' : '#111118',
              border: tool === t.key ? '1px solid #00d4ff' : '1px solid #1e1e2e',
              color: tool === t.key ? '#00d4ff' : '#888',
              fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ fontSize: 22 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Calculator */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 16, padding: 16 }}>
          {tool === 'bmi' && (
            <>
              <div style={{ color: '#e0e0ff', fontWeight: 600, marginBottom: 14 }}>⚖️ BMI Calculator</div>
              <input type="number" style={inputStyle} placeholder="Weight (kg)" value={weight} onChange={e => setWeight(e.target.value)} />
              <input type="number" style={inputStyle} placeholder="Height (cm)" value={height} onChange={e => setHeight(e.target.value)} />
              <button style={btnStyle} onClick={calcBMI}>Calculate BMI</button>
            </>
          )}

          {tool === 'emi' && (
            <>
              <div style={{ color: '#e0e0ff', fontWeight: 600, marginBottom: 14 }}>🏦 EMI Calculator</div>
              <input type="number" style={inputStyle} placeholder="Loan Amount (₹)" value={principal} onChange={e => setPrincipal(e.target.value)} />
              <input type="number" style={inputStyle} placeholder="Interest Rate (% per year)" value={rate} onChange={e => setRate(e.target.value)} />
              <input type="number" style={inputStyle} placeholder="Tenure (months)" value={months} onChange={e => setMonths(e.target.value)} />
              <button style={btnStyle} onClick={calcEMI}>Calculate EMI</button>
            </>
          )}

          {tool === 'sip' && (
            <>
              <div style={{ color: '#e0e0ff', fontWeight: 600, marginBottom: 14 }}>📈 SIP Calculator</div>
              <input type="number" style={inputStyle} placeholder="Monthly SIP (₹)" value={monthly} onChange={e => setMonthly(e.target.value)} />
              <input type="number" style={inputStyle} placeholder="Expected Return (%)" value={sipRate} onChange={e => setSipRate(e.target.value)} />
              <input type="number" style={inputStyle} placeholder="Duration (years)" value={years} onChange={e => setYears(e.target.value)} />
              <button style={btnStyle} onClick={calcSIP}>Calculate SIP</button>
            </>
          )}

          {tool === 'gst' && (
            <>
              <div style={{ color: '#e0e0ff', fontWeight: 600, marginBottom: 14 }}>🧮 GST Calculator</div>
              <input type="number" style={inputStyle} placeholder="Base Amount (₹)" value={amount} onChange={e => setAmount(e.target.value)} />
              <div style={{ marginBottom: 10 }}>
                <div style={{ color: '#666', fontSize: 12, marginBottom: 6 }}>GST Rate</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['5', '12', '18', '28'].map(r => (
                    <button
                      key={r}
                      onClick={() => setGstRate(r)}
                      style={{
                        flex: 1, padding: 8, borderRadius: 8, cursor: 'pointer', fontSize: 13,
                        background: gstRate === r ? '#00d4ff' : '#1a1a2e',
                        color: gstRate === r ? '#000' : '#888',
                        border: 'none',
                      }}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>
              <button style={btnStyle} onClick={calcGST}>Calculate GST</button>
            </>
          )}

          {tool === 'age' && (
            <>
              <div style={{ color: '#e0e0ff', fontWeight: 600, marginBottom: 14 }}>🎂 Age Calculator</div>
              <div style={{ color: '#666', fontSize: 12, marginBottom: 6 }}>Date of Birth</div>
              <input type="date" style={inputStyle} value={dob} onChange={e => setDob(e.target.value)} />
              <button style={btnStyle} onClick={calcAge}>Calculate Age</button>
            </>
          )}

          {tool === 'tip' && (
            <>
              <div style={{ color: '#e0e0ff', fontWeight: 600, marginBottom: 14 }}>💸 Tip Calculator</div>
              <input type="number" style={inputStyle} placeholder="Bill Amount (₹)" value={bill} onChange={e => setBill(e.target.value)} />
              <div style={{ marginBottom: 10 }}>
                <div style={{ color: '#666', fontSize: 12, marginBottom: 6 }}>Tip %</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['5', '10', '15', '20'].map(r => (
                    <button
                      key={r}
                      onClick={() => setTipPct(r)}
                      style={{
                        flex: 1, padding: 8, borderRadius: 8, cursor: 'pointer', fontSize: 13,
                        background: tipPct === r ? '#00d4ff' : '#1a1a2e',
                        color: tipPct === r ? '#000' : '#888',
                        border: 'none',
                      }}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
              </div>
              <button style={btnStyle} onClick={calcTip}>Calculate Tip</button>
            </>
          )}
        </div>

        {/* Result */}
        {result && (
          <div style={{
            marginTop: 14, background: 'rgba(0,212,255,0.05)',
            border: '1px solid rgba(0,212,255,0.2)', borderRadius: 12,
            padding: 16, color: '#c8e8ff', fontSize: 14, lineHeight: 1.8,
            whiteSpace: 'pre-line',
          }}>
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
