'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function IndiaHubPage() {
  const router = useRouter();
  const [weather, setWeather] = useState<any>(null);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState('Delhi');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [wRes, nRes] = await Promise.allSettled([
        fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`).then(r => r.json()),
        fetch('https://hacker-news.firebaseio.com/v0/topstories.json').then(r => r.json()).then(async ids => {
          const top = await Promise.all(ids.slice(0, 5).map((id: number) =>
            fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
          ));
          return top;
        }),
      ]);

      if (wRes.status === 'fulfilled') setWeather(wRes.value);
      if (nRes.status === 'fulfilled') setNews(nRes.value);
    } catch {}
    setLoading(false);
  };

  const QUICK_LINKS = [
    { icon: '🚂', label: 'Train Status', url: 'https://www.railyatri.in/live-train-status' },
    { icon: '✈️', label: 'Flights', url: 'https://www.makemytrip.com/flights/' },
    { icon: '📰', label: 'Times of India', url: 'https://timesofindia.com' },
    { icon: '🏏', label: 'Cricket', url: 'https://www.espncricinfo.com/live-cricket-score' },
    { icon: '📈', label: 'NSE', url: 'https://www.nseindia.com' },
    { icon: '🗳️', label: 'Election Comm', url: 'https://eci.gov.in' },
    { icon: '💊', label: 'CoWIN', url: 'https://www.cowin.gov.in' },
    { icon: '🏛️', label: 'Govt Portal', url: 'https://india.gov.in' },
  ];

  const temp = weather?.current_condition?.[0]?.temp_C;
  const desc = weather?.current_condition?.[0]?.weatherDesc?.[0]?.value;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>🇮🇳 India Hub</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={city}
            onChange={e => setCity(e.target.value)}
            placeholder="City"
            style={{ background: '#111118', border: '1px solid #2a2a4a', borderRadius: 8, padding: '4px 8px', color: '#e0e0ff', fontSize: 13, outline: 'none', width: 80 }}
          />
          <button onClick={loadData} style={{ background: '#00d4ff', border: 'none', borderRadius: 8, color: '#000', padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            Go
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {/* Weather card */}
        {weather && (
          <div style={{
            background: 'linear-gradient(135deg, #003366, #006699)',
            borderRadius: 16, padding: 16, marginBottom: 14,
            border: '1px solid rgba(0,212,255,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>{city}</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{desc}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#fff', fontSize: 36, fontWeight: 700 }}>{temp}°C</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              {[
                { label: 'Humidity', val: `${weather.current_condition?.[0]?.humidity}%` },
                { label: 'Wind', val: `${weather.current_condition?.[0]?.windspeedKmph} km/h` },
                { label: 'Feels Like', val: `${weather.current_condition?.[0]?.FeelsLikeC}°C` },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{item.label}</div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: '#555', fontSize: 12, marginBottom: 10, fontWeight: 600 }}>QUICK LINKS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {QUICK_LINKS.map(link => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12,
                  padding: '12px 4px', textDecoration: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}
              >
                <span style={{ fontSize: 22 }}>{link.icon}</span>
                <span style={{ color: '#888', fontSize: 10, textAlign: 'center' }}>{link.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* News */}
        <div>
          <div style={{ color: '#555', fontSize: 12, marginBottom: 10, fontWeight: 600 }}>TECH NEWS</div>
          {news.map((item: any) => (
            <a
              key={item.id}
              href={item.url || `https://news.ycombinator.com/item?id=${item.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 10, padding: 12, marginBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 16 }}>📰</span>
                <div>
                  <div style={{ color: '#e0e0ff', fontSize: 13, lineHeight: 1.4 }}>{item.title}</div>
                  <div style={{ color: '#555', fontSize: 11, marginTop: 4 }}>⬆ {item.score} · by {item.by}</div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
