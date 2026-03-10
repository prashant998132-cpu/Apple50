'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { dispatchTool } from '@/lib/tools/connected';

const SERVICES = [
  { id: 'weather', icon: '🌤️', name: 'Weather', category: 'Utility' },
  { id: 'news', icon: '📰', name: 'News', category: 'Info' },
  { id: 'image', icon: '🎨', name: 'AI Image', category: 'Creative' },
  { id: 'crypto', icon: '💰', name: 'Crypto', category: 'Finance' },
  { id: 'stock', icon: '📈', name: 'Stocks', category: 'Finance' },
  { id: 'currency', icon: '💱', name: 'Currency', category: 'Finance' },
  { id: 'wiki', icon: '📚', name: 'Wikipedia', category: 'Info' },
  { id: 'movie', icon: '🎬', name: 'Movies', category: 'Entertainment' },
  { id: 'recipe', icon: '🍳', name: 'Recipes', category: 'Food' },
  { id: 'joke', icon: '😂', name: 'Jokes', category: 'Fun' },
  { id: 'quote', icon: '✨', name: 'Quotes', category: 'Motivation' },
  { id: 'trivia', icon: '🧠', name: 'Trivia', category: 'Fun' },
  { id: 'anime', icon: '🎌', name: 'Anime', category: 'Entertainment' },
  { id: 'pokemon', icon: '⚡', name: 'Pokemon', category: 'Fun' },
  { id: 'nasa', icon: '🚀', name: 'NASA APOD', category: 'Space' },
  { id: 'iss', icon: '🛸', name: 'ISS Location', category: 'Space' },
  { id: 'space', icon: '🌌', name: 'Space News', category: 'Space' },
  { id: 'github', icon: '🔥', name: 'GitHub Trending', category: 'Dev' },
  { id: 'qr', icon: '📱', name: 'QR Code', category: 'Utility' },
  { id: 'fact', icon: '🤯', name: 'Random Fact', category: 'Fun' },
  { id: 'wordofday', icon: '📝', name: 'Word of Day', category: 'Learning' },
  { id: 'dictionary', icon: '📖', name: 'Dictionary', category: 'Learning' },
  { id: 'shorturl', icon: '🔗', name: 'URL Shortener', category: 'Utility' },
  { id: 'cricket', icon: '🏏', name: 'Cricket', category: 'Sports' },
];

const CATEGORIES = ['All', 'Finance', 'Info', 'Fun', 'Space', 'Dev', 'Entertainment', 'Utility', 'Creative', 'Food', 'Motivation', 'Learning', 'Sports'];

export default function AppsPage() {
  const router = useRouter();
  const [cat, setCat] = useState('All');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [activeId, setActiveId] = useState('');
  const [loading, setLoading] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [card, setCard] = useState<any>(null);

  const filtered = SERVICES.filter(s =>
    (cat === 'All' || s.category === cat) &&
    (s.name.toLowerCase().includes(query.toLowerCase()))
  );

  const runTool = async (id: string) => {
    setActiveId(id);
    setLoading(true);
    setResult('');
    setCard(null);
    const args: Record<string, string> = inputVal ? { query: inputVal, prompt: inputVal, text: inputVal, title: inputVal, coin: inputVal, word: inputVal, city: inputVal, dish: inputVal } : {};
    const res = await dispatchTool(id, args);
    setResult(res.text || res.error || 'No result');
    if (res.card) setCard(res.card);
    setLoading(false);
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>📱 Apps Hub</div>
          <div style={{ color: '#555', fontSize: 11 }}>{SERVICES.length} services · all free</div>
        </div>
      </div>

      <div style={{ padding: '10px 14px' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search apps..."
          style={{ width: '100%', background: '#111118', border: '1px solid #2a2a4a', borderRadius: 10, padding: '8px 12px', color: '#e0e0ff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '0 14px 10px', overflowX: 'auto' }}>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', background: cat === c ? '#00d4ff' : '#1a1a2e', color: cat === c ? '#000' : '#888', border: 'none', fontWeight: cat === c ? 700 : 400 }}>
            {c}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {filtered.map(s => (
            <button
              key={s.id}
              onClick={() => runTool(s.id)}
              style={{
                background: activeId === s.id ? 'rgba(0,212,255,0.1)' : '#111118',
                border: activeId === s.id ? '1px solid #00d4ff' : '1px solid #1e1e2e',
                borderRadius: 12, padding: '12px 6px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
            >
              <span style={{ fontSize: 24 }}>{s.icon}</span>
              <span style={{ color: activeId === s.id ? '#00d4ff' : '#888', fontSize: 10, textAlign: 'center' }}>{s.name}</span>
            </button>
          ))}
        </div>

        {activeId && (
          <div style={{ marginTop: 14 }}>
            <input
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="Query (optional)..."
              onKeyDown={e => e.key === 'Enter' && runTool(activeId)}
              style={{ width: '100%', background: '#111118', border: '1px solid #2a2a4a', borderRadius: 10, padding: '8px 12px', color: '#e0e0ff', fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
            />
            <button onClick={() => runTool(activeId)} style={{ width: '100%', background: '#00d4ff', border: 'none', borderRadius: 10, color: '#000', padding: 10, cursor: 'pointer', fontWeight: 700 }}>
              {loading ? 'Loading...' : 'Run'}
            </button>
          </div>
        )}

        {card?.imageUrl && (
          <img src={card.imageUrl} alt={card.title} style={{ width: '100%', borderRadius: 12, marginTop: 10, maxHeight: 300, objectFit: 'cover' }} onError={e => (e.currentTarget.style.display = 'none')} />
        )}

        {result && (
          <div style={{ marginTop: 10, background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 12, padding: 14, color: '#c8e8ff', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
