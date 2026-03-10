'use client';
import React from 'react';
import { useRouter } from 'next/navigation';

const TEMPLATES = [
  { name: 'Study Schedule', icon: '📚', prompt: 'NEET study timetable, colorful, organized, motivational' },
  { name: 'Motivational Poster', icon: '💪', prompt: 'motivational quote poster, bold text, inspiring design' },
  { name: 'Mind Map', icon: '🧠', prompt: 'mind map diagram, colorful branches, knowledge tree' },
  { name: 'Biology Cell', icon: '🔬', prompt: 'biology cell diagram, detailed, labeled, educational' },
  { name: 'Chemistry Lab', icon: '⚗️', prompt: 'chemistry laboratory illustration, test tubes, colorful' },
  { name: 'Physics Diagram', icon: '⚡', prompt: 'physics force diagram, vectors, clean illustration' },
  { name: 'India Map', icon: '🗺️', prompt: 'India map illustration, artistic, colorful states' },
  { name: 'Space Poster', icon: '🚀', prompt: 'space exploration poster, galaxy, planets, astronaut' },
];

export default function CanvaPage() {
  const router = useRouter();

  const generate = (prompt: string) => {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ', high quality, detailed illustration')}?width=1024&height=1024&nologo=true`;
    window.open(url, '_blank');
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>🖌️ Canva Templates</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <div style={{ color: '#555', fontSize: 12, marginBottom: 12 }}>Template tap karo → AI image generate hogi!</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {TEMPLATES.map(t => (
            <button key={t.name} onClick={() => generate(t.prompt)} style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 14, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'border-color 0.2s' }}>
              <span style={{ fontSize: 32 }}>{t.icon}</span>
              <span style={{ color: '#888', fontSize: 12, textAlign: 'center' }}>{t.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
