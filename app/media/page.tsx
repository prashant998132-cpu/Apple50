'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const PROMPTS = ['galaxy nebula space', 'mountain sunrise nature', 'cyberpunk city night', 'ocean waves sunset', 'forest mystical fog', 'futuristic AI robot'];

export default function MediaPage() {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const urls = PROMPTS.slice(0, 4).map(p => `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=400&height=400&nologo=true&seed=${p.length * 13}`);
    setImages(urls);
  }, []);

  const generateNew = () => {
    const p = customPrompt.trim() || PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=800&height=800&nologo=true&seed=${Date.now()}`;
    setImages(prev => [url, ...prev].slice(0, 12));
    setCustomPrompt('');
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>🎵 Media Gallery</div>
      </div>
      <div style={{ padding: '10px 14px', display: 'flex', gap: 8 }}>
        <input value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && generateNew()} placeholder="Image prompt..." style={{ flex: 1, background: '#111118', border: '1px solid #2a2a4a', borderRadius: 10, padding: '8px 12px', color: '#e0e0ff', fontSize: 14, outline: 'none' }} />
        <button onClick={generateNew} style={{ background: '#00d4ff', border: 'none', borderRadius: 10, color: '#000', padding: '0 14px', cursor: 'pointer', fontWeight: 700 }}>+</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {images.map((url, i) => (
            <div key={i} style={{ borderRadius: 12, overflow: 'hidden', aspectRatio: '1', background: '#111118' }}>
              <img src={url} alt={`AI ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => (e.currentTarget.style.opacity = '0.3')} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
