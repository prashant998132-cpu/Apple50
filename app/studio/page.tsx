'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StudioPage() {
  const router = useRouter();
  const [type, setType] = useState<'image' | 'story' | 'poem'>('image');
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult('');
    setImageUrl('');

    if (type === 'image') {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
      setImageUrl(url);
      setLoading(false);
      return;
    }

    const systemPrompt = type === 'story'
      ? 'You are a creative writer. Write an engaging short story in Hinglish based on the given prompt. Keep it to 200-300 words.'
      : 'You are a poet. Write a beautiful poem in Hinglish (mix of Hindi and English) based on the given prompt. 8-12 lines.';

    try {
      const res = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }], mode: 'think' }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ')) {
            try { const d = JSON.parse(line.slice(6)); if (d.type === 'delta') { text += d.text; setResult(text); } } catch {}
          }
        }
      }
    } catch { setResult('Error generating. Try again!'); }
    setLoading(false);
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>🎨 AI Studio</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[{ k: 'image', icon: '🖼️', label: 'AI Image' }, { k: 'story', icon: '📖', label: 'Story' }, { k: 'poem', icon: '🌸', label: 'Poem' }].map(t => (
            <button key={t.k} onClick={() => setType(t.k as any)} style={{ flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', background: type === t.k ? 'rgba(0,212,255,0.15)' : '#111118', border: type === t.k ? '1px solid #00d4ff' : '1px solid #1e1e2e', color: type === t.k ? '#00d4ff' : '#888', fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder={type === 'image' ? 'Describe the image you want...' : type === 'story' ? 'Story ka topic batao...' : 'Poem ka topic batao...'}
          rows={3}
          style={{ width: '100%', background: '#111118', border: '1px solid #2a2a4a', borderRadius: 10, padding: '10px 12px', color: '#e0e0ff', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: 10 }}
        />

        <button onClick={generate} disabled={loading || !prompt.trim()} style={{ width: '100%', background: '#00d4ff', border: 'none', borderRadius: 10, color: '#000', padding: 12, cursor: 'pointer', fontWeight: 700, fontSize: 15, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Creating...' : `✨ Generate ${type === 'image' ? 'Image' : type === 'story' ? 'Story' : 'Poem'}`}
        </button>

        {imageUrl && <img src={imageUrl} alt="AI Generated" style={{ width: '100%', borderRadius: 12, marginTop: 14 }} onError={e => (e.currentTarget.alt = 'Image loading...')} />}
        {result && <div style={{ marginTop: 14, background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 12, padding: 14, color: '#c8e8ff', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{result}</div>}
      </div>
    </div>
  );
}
