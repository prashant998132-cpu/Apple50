'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { addGoal, getGoals, completeGoal, deleteGoal, type Goal } from '@/lib/storage';

export default function TargetPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => { loadGoals(); }, []);

  const loadGoals = async () => {
    try { setGoals(await getGoals()); } catch {}
  };

  const handleAdd = async () => {
    if (!input.trim()) return;
    await addGoal(input.trim());
    setInput('');
    loadGoals();
  };

  const handleComplete = async (id: number) => {
    await completeGoal(id);
    loadGoals();
  };

  const handleDelete = async (id: number) => {
    await deleteGoal(id);
    loadGoals();
  };

  const active = goals.filter(g => !g.completed);
  const done = goals.filter(g => g.completed);

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>🎯 Goals & Targets</div>
          <div style={{ color: '#555', fontSize: 11 }}>{active.length} active · {done.length} completed</div>
        </div>
      </div>

      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="New goal add karo..."
            style={{
              flex: 1, background: '#111118', border: '1px solid #2a2a4a',
              borderRadius: 10, padding: '10px 12px', color: '#e0e0ff',
              fontSize: 14, outline: 'none',
            }}
          />
          <button
            onClick={handleAdd}
            style={{ background: '#00d4ff', border: 'none', borderRadius: 10, color: '#000', padding: '0 16px', cursor: 'pointer', fontWeight: 700 }}
          >
            +
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px' }}>
        {active.length > 0 && (
          <>
            <div style={{ color: '#555', fontSize: 12, marginBottom: 8, fontWeight: 600 }}>ACTIVE GOALS</div>
            {active.map(g => (
              <div key={g.id} style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12, padding: 12, marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  onClick={() => g.id && handleComplete(g.id)}
                  style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid #00d4ff', background: 'none', cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ flex: 1, color: '#e0e0ff', fontSize: 14 }}>{g.text}</span>
                <button
                  onClick={() => g.id && handleDelete(g.id)}
                  style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 16 }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </>
        )}

        {done.length > 0 && (
          <>
            <div style={{ color: '#555', fontSize: 12, marginBottom: 8, marginTop: 16, fontWeight: 600 }}>COMPLETED</div>
            {done.map(g => (
              <div key={g.id} style={{ background: '#0d0d1a', border: '1px solid #1a1a2a', borderRadius: 12, padding: 12, marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center', opacity: 0.7 }}>
                <span style={{ color: '#22c55e', fontSize: 18 }}>✅</span>
                <span style={{ flex: 1, color: '#666', fontSize: 14, textDecoration: 'line-through' }}>{g.text}</span>
                <button onClick={() => g.id && handleDelete(g.id)} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
            ))}
          </>
        )}

        {goals.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#444' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
            <div>Koi goal nahi hai abhi</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Upar add karo!</div>
          </div>
        )}
      </div>
    </div>
  );
}
