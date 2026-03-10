'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { speakText } from '@/lib/tts';

export default function BriefingPage() {
  const router = useRouter();
  const [briefing, setBriefing] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { generateBriefing(); }, []);

  const generateBriefing = async () => {
    setLoading(true);
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
    const prompt = `Generate a daily briefing for a NEET student in Hinglish. Include:
1. ${greeting} greeting
2. Today's date: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
3. A motivational NEET tip for today
4. A quick science fact (Biology/Chemistry/Physics)
5. Word of wisdom
Keep it concise, motivating, and in Hinglish.`;

    try {
      const res = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], mode: 'flash' }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ')) {
            try { const d = JSON.parse(line.slice(6)); if (d.type === 'delta') { text += d.text; setBriefing(text); } } catch {}
          }
        }
      }
    } catch { setBriefing('Good morning! Aaj bhi NEET ki taiyari karo. Har din ek step aage!'); }
    setLoading(false);
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>📋 Daily Briefing</div>
        <div style={{ flex: 1 }} />
        <button onClick={() => speakText(briefing)} style={{ background: 'none', border: '1px solid #2a2a4a', borderRadius: 8, color: '#666', padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>🔊 Speak</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>✨ Briefing prepare ho raha hai...</div>
        ) : (
          <div style={{ background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 16, padding: 18, color: '#c8e8ff', fontSize: 14, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
            {briefing}
          </div>
        )}
        <button onClick={generateBriefing} style={{ width: '100%', background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 10, color: '#888', padding: 12, cursor: 'pointer', marginTop: 14 }}>
          🔄 Refresh Briefing
        </button>
      </div>
    </div>
  );
}
