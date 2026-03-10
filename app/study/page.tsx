'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const MCQ_BANK = [
  { q: "The powerhouse of the cell is:", options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi body"], ans: 1, subject: "Biology", topic: "Cell Biology" },
  { q: "Which of the following is the correct electronic configuration of Fe2+?", options: ["[Ar]3d6", "[Ar]3d4", "[Ar]4s23d4", "[Ar]3d8"], ans: 0, subject: "Chemistry", topic: "Atomic Structure" },
  { q: "Newton's second law of motion states:", options: ["Every action has equal reaction", "F = ma", "An object at rest stays at rest", "Energy is conserved"], ans: 1, subject: "Physics", topic: "Laws of Motion" },
  { q: "Which organelle is responsible for protein synthesis?", options: ["Mitochondria", "Chloroplast", "Ribosome", "Lysosome"], ans: 2, subject: "Biology", topic: "Cell Organelles" },
  { q: "The SI unit of electric charge is:", options: ["Ampere", "Volt", "Coulomb", "Ohm"], ans: 2, subject: "Physics", topic: "Electricity" },
  { q: "Photosynthesis occurs in which part of chloroplast?", options: ["Stroma", "Thylakoid", "Matrix", "Cristae"], ans: 1, subject: "Biology", topic: "Photosynthesis" },
  { q: "Which of the following is an alkali metal?", options: ["Magnesium", "Calcium", "Sodium", "Aluminum"], ans: 2, subject: "Chemistry", topic: "Periodic Table" },
  { q: "The formula for velocity is:", options: ["v = d/t", "v = t/d", "v = d×t", "v = 1/(d×t)"], ans: 0, subject: "Physics", topic: "Kinematics" },
  { q: "DNA replication is:", options: ["Conservative", "Semi-conservative", "Dispersive", "None"], ans: 1, subject: "Biology", topic: "Genetics" },
  { q: "The pH of pure water at 25°C is:", options: ["5", "6", "7", "8"], ans: 2, subject: "Chemistry", topic: "Acids & Bases" },
  { q: "Which lens is used to correct myopia?", options: ["Convex", "Concave", "Bifocal", "Cylindrical"], ans: 1, subject: "Physics", topic: "Optics" },
  { q: "Mendel's law of segregation states:", options: ["Genes are linked", "Alleles separate during gamete formation", "Traits blend", "Random assortment"], ans: 1, subject: "Biology", topic: "Genetics" },
  { q: "Hybridization in CH4 is:", options: ["sp", "sp2", "sp3", "sp3d"], ans: 2, subject: "Chemistry", topic: "Chemical Bonding" },
  { q: "Work done by a force is zero when:", options: ["Force is large", "Displacement is perpendicular to force", "Friction acts", "Body moves fast"], ans: 1, subject: "Physics", topic: "Work & Energy" },
  { q: "Which blood group is the universal donor?", options: ["A", "B", "AB", "O"], ans: 3, subject: "Biology", topic: "Human Physiology" },
  { q: "Avogadro's number is approximately:", options: ["6.022×10²³", "6.022×10²²", "3.14×10²³", "1.6×10¹⁹"], ans: 0, subject: "Chemistry", topic: "Mole Concept" },
  { q: "The escape velocity from Earth's surface is approximately:", options: ["7.9 km/s", "11.2 km/s", "3 km/s", "15 km/s"], ans: 1, subject: "Physics", topic: "Gravitation" },
  { q: "Which hormone regulates blood sugar?", options: ["Thyroxine", "Adrenaline", "Insulin", "Cortisol"], ans: 2, subject: "Biology", topic: "Endocrinology" },
  { q: "The IUPAC name of CH3CHO is:", options: ["Methanal", "Ethanal", "Propanal", "Ethanol"], ans: 1, subject: "Chemistry", topic: "Organic Chemistry" },
  { q: "Ohm's law is V = IR. If V doubles and R stays same, current:", options: ["Halves", "Doubles", "Stays same", "Quadruples"], ans: 1, subject: "Physics", topic: "Current Electricity" },
  { q: "Which is NOT a function of the liver?", options: ["Bile production", "Gluconeogenesis", "Insulin production", "Urea synthesis"], ans: 2, subject: "Biology", topic: "Digestion" },
  { q: "Enthalpy change in a combustion reaction is typically:", options: ["Positive", "Zero", "Negative", "Undefined"], ans: 2, subject: "Chemistry", topic: "Thermodynamics" },
  { q: "The angle of incidence equals angle of reflection is:", options: ["Snell's Law", "Law of Reflection", "Huygen's Principle", "Brewster's Law"], ans: 1, subject: "Physics", topic: "Wave Optics" },
  { q: "Which phylum has a water vascular system?", options: ["Porifera", "Mollusca", "Echinodermata", "Arthropoda"], ans: 2, subject: "Biology", topic: "Animal Kingdom" },
];

const SUBJECTS = ['All', 'Biology', 'Chemistry', 'Physics'];

export default function StudyPage() {
  const router = useRouter();
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [mode, setMode] = useState<'quiz' | 'browse'>('browse');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const filtered = subjectFilter === 'All' ? MCQ_BANK : MCQ_BANK.filter(q => q.subject === subjectFilter);
  const current = filtered[currentIdx % filtered.length];

  const handleSelect = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === current.ans) setScore(s => ({ ...s, correct: s.correct + 1 }));
    else setScore(s => ({ ...s, wrong: s.wrong + 1 }));
  };

  const next = () => {
    setSelected(null);
    setAiAnswer('');
    setCurrentIdx(i => (i + 1) % filtered.length);
  };

  const askJARVIS = async () => {
    setAiLoading(true);
    try {
      const prompt = `Explain the answer to this NEET question in simple Hinglish:\n\nQ: ${current.q}\nAnswer: ${current.options[current.ans]}\n\nExplain WHY this is correct in 3-4 lines. Use simple language.`;
      const res = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], mode: 'think' }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const d = JSON.parse(line.slice(6));
              if (d.type === 'delta') { text += d.text; setAiAnswer(text); }
            } catch {}
          }
        }
      }
    } catch {
      setAiAnswer('Network error. Settings mein API keys check karo.');
    }
    setAiLoading(false);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>📚 NEET Study Hub</div>
          <div style={{ color: '#555', fontSize: 11 }}>{filtered.length} MCQs · Score: {score.correct}/{score.correct + score.wrong}</div>
        </div>
      </div>

      {/* Subject filter */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', overflowX: 'auto' }}>
        {SUBJECTS.map(s => (
          <button
            key={s}
            onClick={() => { setSubjectFilter(s); setCurrentIdx(0); setSelected(null); setAiAnswer(''); }}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
              background: subjectFilter === s ? '#00d4ff' : '#1a1a2e',
              color: subjectFilter === s ? '#000' : '#888',
              border: 'none', whiteSpace: 'nowrap',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* MCQ Card */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ background: '#1a1a2e', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#00d4ff' }}>{current.subject}</span>
            <span style={{ color: '#555', fontSize: 11 }}>{current.topic}</span>
          </div>

          <div style={{ color: '#e0e0ff', fontSize: 15, fontWeight: 500, lineHeight: 1.5, marginBottom: 16 }}>
            {currentIdx + 1}. {current.q}
          </div>

          {/* Options */}
          {current.options.map((opt, i) => {
            let bg = '#1a1a2e', border = '1px solid #2a2a4a', color = '#888';
            if (selected !== null) {
              if (i === current.ans) { bg = 'rgba(34,197,94,0.15)'; border = '1px solid #22c55e'; color = '#22c55e'; }
              else if (i === selected) { bg = 'rgba(239,68,68,0.15)'; border = '1px solid #ef4444'; color = '#ef4444'; }
            }
            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                style={{
                  width: '100%', textAlign: 'left', padding: '12px 14px',
                  marginBottom: 8, borderRadius: 10, border, background: bg, color,
                  fontSize: 14, cursor: selected === null ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}
              >
                {String.fromCharCode(65 + i)}. {opt}
              </button>
            );
          })}

          {/* AI Explanation */}
          {selected !== null && (
            <div style={{ marginTop: 12 }}>
              {!aiAnswer && !aiLoading && (
                <button
                  onClick={askJARVIS}
                  style={{
                    background: 'rgba(0,212,255,0.1)', border: '1px solid #00d4ff',
                    borderRadius: 8, color: '#00d4ff', padding: '8px 14px',
                    fontSize: 13, cursor: 'pointer',
                  }}
                >
                  🤖 JARVIS se explain karwao
                </button>
              )}
              {aiLoading && <div style={{ color: '#555', fontSize: 13 }}>🧠 JARVIS soch raha hai...</div>}
              {aiAnswer && (
                <div style={{
                  background: 'rgba(0,212,255,0.05)', border: '1px solid #1e1e2e',
                  borderRadius: 10, padding: 12, marginTop: 8, color: '#c8e8ff', fontSize: 13, lineHeight: 1.6,
                }}>
                  <div style={{ color: '#00d4ff', fontWeight: 600, marginBottom: 4 }}>JARVIS explains:</div>
                  {aiAnswer}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { setCurrentIdx(i => (i - 1 + filtered.length) % filtered.length); setSelected(null); setAiAnswer(''); }}
            style={{ flex: 1, padding: 12, background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 10, color: '#888', cursor: 'pointer' }}
          >
            ← Prev
          </button>
          <button
            onClick={next}
            style={{ flex: 1, padding: 12, background: '#00d4ff', border: 'none', borderRadius: 10, color: '#000', cursor: 'pointer', fontWeight: 700 }}
          >
            Next →
          </button>
        </div>

        {/* Score summary */}
        {(score.correct + score.wrong) > 0 && (
          <div style={{ marginTop: 14, background: '#111118', borderRadius: 12, padding: 12, display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: '#22c55e', fontSize: 22, fontWeight: 700 }}>{score.correct}</div>
              <div style={{ color: '#555', fontSize: 11 }}>Correct</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: '#ef4444', fontSize: 22, fontWeight: 700 }}>{score.wrong}</div>
              <div style={{ color: '#555', fontSize: 11 }}>Wrong</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: '#00d4ff', fontSize: 22, fontWeight: 700 }}>
                {Math.round(score.correct / (score.correct + score.wrong) * 100)}%
              </div>
              <div style={{ color: '#555', fontSize: 11 }}>Accuracy</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
