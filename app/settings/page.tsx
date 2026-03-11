'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePinLock } from '@/components/shared/PinLock';

const API_KEYS = [
  { key: 'GROQ_API_KEY', label: 'Groq API Key', priority: 'HIGH', url: 'https://console.groq.com', desc: 'Fastest — Llama 70B', icon: '⚡' },
  { key: 'GEMINI_API_KEY', label: 'Gemini API Key', priority: 'HIGH', url: 'https://aistudio.google.com', desc: 'Google Gemini 2.0 Flash', icon: '🌟' },
  { key: 'TOGETHER_API_KEY', label: 'Together AI Key', priority: 'MED', url: 'https://together.ai', desc: '$25 free credit', icon: '🤝' },
  { key: 'CEREBRAS_API_KEY', label: 'Cerebras Key', priority: 'MED', url: 'https://cerebras.ai', desc: 'Ultra fast — 1800 tok/s', icon: '🧠' },
  { key: 'MISTRAL_API_KEY', label: 'Mistral Key', priority: 'MED', url: 'https://console.mistral.ai', desc: 'Mistral Small free', icon: '🌪️' },
  { key: 'COHERE_API_KEY', label: 'Cohere Key', priority: 'MED', url: 'https://cohere.com', desc: 'Command-R', icon: '🔗' },
  { key: 'FIREWORKS_API_KEY', label: 'Fireworks Key', priority: 'MED', url: 'https://fireworks.ai', desc: 'Fast open models', icon: '🎆' },
  { key: 'OPENROUTER_API_KEY', label: 'OpenRouter Key', priority: 'MED', url: 'https://openrouter.ai', desc: 'DeepSeek R1 access', icon: '🔄' },
  { key: 'DEEPINFRA_API_KEY', label: 'DeepInfra Key', priority: 'MED', url: 'https://deepinfra.com', desc: 'Llama-3 70B', icon: '⚙️' },
  { key: 'HUGGINGFACE_API_KEY', label: 'HuggingFace Key', priority: 'MED', url: 'https://huggingface.co', desc: 'Mistral 7B free', icon: '🤗' },
  { key: 'NASA_API_KEY', label: 'NASA Key', priority: 'LOW', url: 'https://api.nasa.gov', desc: 'DEMO_KEY works (50/day)', icon: '🚀' },
  { key: 'GNEWS_API_KEY', label: 'GNews Key', priority: 'LOW', url: 'https://gnews.io', desc: '100 req/day free', icon: '📰' },
  { key: 'NEWSAPI_KEY', label: 'NewsAPI Key', priority: 'LOW', url: 'https://newsapi.org', desc: '100 req/day free', icon: '📡' },
  { key: 'OMDB_API_KEY', label: 'OMDB Key', priority: 'LOW', url: 'https://omdbapi.com', desc: 'Movies — 1000/day', icon: '🎬' },
  { key: 'OPENWEATHER_API_KEY', label: 'OpenWeather Key', priority: 'LOW', url: 'https://openweathermap.org', desc: 'Backup weather', icon: '🌤️' },
  { key: 'SERPER_API_KEY', label: 'Serper Key', priority: 'LOW', url: 'https://serper.dev', desc: 'Google search — 2500/month', icon: '🔍' },
];

type Tab = 'keys' | 'security' | 'about';

export default function SettingsPage() {
  const router = useRouter();
  const { hasPIN, setPIN, clearPIN } = usePinLock();
  const [tab, setTab] = useState<Tab>('keys');
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState('');
  const [newPIN, setNewPIN] = useState('');
  const [pinMsg, setPinMsg] = useState('');

  useEffect(() => {
    // Load saved keys from localStorage
    const saved: Record<string, string> = {};
    API_KEYS.forEach(k => {
      const val = localStorage.getItem(`jarvis_key_${k.key}`) || '';
      if (val) saved[k.key] = val;
    });
    setKeys(saved);
  }, []);

  const saveKey = (keyName: string, value: string) => {
    setKeys(prev => ({ ...prev, [keyName]: value }));
    localStorage.setItem(`jarvis_key_${keyName}`, value);
    setToast(`✅ ${keyName} saved!`);
    setTimeout(() => setToast(''), 2000);
  };

  const handleSetPIN = async () => {
    if (newPIN.length !== 4 || !/^\d{4}$/.test(newPIN)) {
      setPinMsg('PIN must be 4 digits!');
      return;
    }
    await setPIN(newPIN);
    setNewPIN('');
    setPinMsg('✅ PIN set! App will lock on next open.');
  };

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'keys', label: 'API Keys', icon: '🔑' },
    { key: 'security', label: 'Security', icon: '🔒' },
    { key: 'about', label: 'About', icon: 'ℹ️' },
    { key: 'automation' as any, label: 'Automation', icon: '📱' },
  ];

  return (
    <div className="page-container">
      {toast && <div className="toast toast-ok">{toast}</div>}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>⚙️ Settings</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e1e2e' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '12px 4px', background: 'none',
              border: 'none', borderBottom: tab === t.key ? '2px solid #00d4ff' : '2px solid transparent',
              color: tab === t.key ? '#00d4ff' : '#555',
              fontSize: 12, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {/* API Keys tab */}
        {tab === 'keys' && (
          <div>
            <div style={{ color: '#555', fontSize: 12, marginBottom: 14 }}>
              Keys sirf is device pe store hote hain. Vercel environment variables mein bhi add karo better performance ke liye.
            </div>

            {['HIGH', 'MED', 'LOW'].map(priority => (
              <div key={priority}>
                <div style={{ color: priority === 'HIGH' ? '#ef4444' : priority === 'MED' ? '#f59e0b' : '#22c55e', fontSize: 11, fontWeight: 700, marginBottom: 8, marginTop: 16 }}>
                  {priority === 'HIGH' ? '🔴' : priority === 'MED' ? '🟡' : '🟢'} {priority} PRIORITY
                </div>
                {API_KEYS.filter(k => k.priority === priority).map(k => (
                  <div key={k.key} style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <span style={{ marginRight: 6 }}>{k.icon}</span>
                        <span style={{ color: '#e0e0ff', fontSize: 13, fontWeight: 600 }}>{k.label}</span>
                      </div>
                      <a href={k.url} target="_blank" rel="noopener noreferrer" style={{ color: '#00d4ff', fontSize: 11 }}>Get key ↗</a>
                    </div>
                    <div style={{ color: '#555', fontSize: 11, marginBottom: 8 }}>{k.desc}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type={showKey[k.key] ? 'text' : 'password'}
                        value={keys[k.key] || ''}
                        onChange={e => setKeys(prev => ({ ...prev, [k.key]: e.target.value }))}
                        placeholder="Enter API key..."
                        style={{
                          flex: 1, background: '#0d0d1a', border: '1px solid #2a2a4a',
                          borderRadius: 8, padding: '8px 10px', color: '#e0e0ff',
                          fontSize: 13, outline: 'none',
                        }}
                      />
                      <button
                        onClick={() => setShowKey(prev => ({ ...prev, [k.key]: !prev[k.key] }))}
                        style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, color: '#666', padding: '0 10px', cursor: 'pointer' }}
                      >
                        {showKey[k.key] ? '🙈' : '👁️'}
                      </button>
                      <button
                        onClick={() => saveKey(k.key, keys[k.key] || '')}
                        style={{ background: '#00d4ff', border: 'none', borderRadius: 8, color: '#000', padding: '0 12px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Security tab */}
        {tab === 'security' && (
          <div>
            <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ color: '#e0e0ff', fontWeight: 600, marginBottom: 8 }}>🔒 PIN Lock</div>
              <div style={{ color: '#555', fontSize: 13, marginBottom: 14 }}>
                Set a 4-digit PIN to lock JARVIS. SHA-256 hashed — JARVIS raw PIN kabhi store nahi karta.
              </div>

              {hasPIN() && (
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', borderRadius: 8, padding: 10, marginBottom: 12, color: '#22c55e', fontSize: 13 }}>
                  ✅ PIN is set and active
                </div>
              )}

              <input
                type="password"
                value={newPIN}
                onChange={e => setNewPIN(e.target.value.slice(0, 4).replace(/\D/g, ''))}
                placeholder="Enter 4-digit PIN"
                maxLength={4}
                style={{
                  width: '100%', background: '#0d0d1a', border: '1px solid #2a2a4a',
                  borderRadius: 8, padding: '10px 12px', color: '#e0e0ff',
                  fontSize: 18, outline: 'none', textAlign: 'center', letterSpacing: 8,
                  marginBottom: 10, boxSizing: 'border-box',
                }}
              />

              {pinMsg && <div style={{ color: pinMsg.startsWith('✅') ? '#22c55e' : '#ef4444', fontSize: 13, marginBottom: 10 }}>{pinMsg}</div>}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleSetPIN}
                  style={{ flex: 1, background: '#00d4ff', border: 'none', borderRadius: 8, color: '#000', padding: 12, cursor: 'pointer', fontWeight: 700 }}
                >
                  {hasPIN() ? 'Update PIN' : 'Set PIN'}
                </button>
                {hasPIN() && (
                  <button
                    onClick={() => { clearPIN(); setPinMsg('PIN removed.'); }}
                    style={{ flex: 1, background: '#1a1a2e', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', padding: 12, cursor: 'pointer' }}
                  >
                    Remove PIN
                  </button>
                )}
              </div>
            </div>

            <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12, padding: 16 }}>
              <div style={{ color: '#e0e0ff', fontWeight: 600, marginBottom: 8 }}>🛡️ Privacy</div>
              <div style={{ color: '#555', fontSize: 13, lineHeight: 1.6 }}>
                • Koi bhi data server pe nahi jaata<br/>
                • API keys sirf is device pe stored hain<br/>
                • Zero tracking or analytics<br/>
                • Chat history sirf browser mein (IndexedDB)
              </div>
            </div>
          </div>
        )}

        {/* About tab */}
        {tab === 'about' && (
          <div>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🤖</div>
              <div style={{ color: '#00d4ff', fontSize: 22, fontWeight: 700 }}>JARVIS AI</div>
              <div style={{ color: '#555', fontSize: 13, marginTop: 4 }}>v20.3 · "Bahar se iPhone, andar se Iron Man"</div>
            </div>

            {[
              { label: 'Developer', value: 'Prashant (Mayur) · Maihar, MP' },
              { label: 'Stack', value: 'Next.js 14 + TypeScript + Puter.js' },
              { label: 'AI Providers', value: '12+ providers, 100% free' },
              { label: 'Storage', value: 'IndexedDB (Dexie) — local only' },
              { label: 'Cost', value: '₹0/month — forever' },
              { label: 'Deployment', value: 'Vercel Hobby Plan' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #1e1e2e' }}>
                <span style={{ color: '#666', fontSize: 13 }}>{item.label}</span>
                <span style={{ color: '#e0e0ff', fontSize: 13 }}>{item.value}</span>
              </div>
            ))}

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <a href="https://github.com/prashant998132-cpu/AppleV20" target="_blank" rel="noopener noreferrer"
                style={{ color: '#00d4ff', fontSize: 13, display: 'block', marginBottom: 8 }}>GitHub Repo ↗</a>
              <a href="https://apple-v20.vercel.app" target="_blank" rel="noopener noreferrer"
                style={{ color: '#00d4ff', fontSize: 13 }}>Live App ↗</a>
            </div>
          </div>
        )}

        {/* Automation tab */}
        {(tab as any) === 'automation' && (
          <div>
            <div style={{ color: '#00d4ff', fontWeight: 700, marginBottom: 12 }}>📱 Phone Automation</div>

            {/* MacroDroid */}
            <div style={{ background: '#0e0e1a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ color: '#e0e0ff', fontWeight: 600, marginBottom: 4 }}>🤖 MacroDroid Bridge</div>
              <div style={{ color: '#555', fontSize: 11, marginBottom: 10 }}>JARVIS se phone automate karo — WiFi, Bluetooth, Apps, Alarms</div>
              <label style={{ color: '#444', fontSize: 10, display: 'block', marginBottom: 3 }}>MACRODROID DEVICE ID</label>
              <input
                type="text"
                placeholder="MacroDroid → Menu → Account → Device ID"
                defaultValue={typeof window !== 'undefined' ? localStorage.getItem('jarvis_macrodroid_id') || '' : ''}
                onChange={e => { try { localStorage.setItem('jarvis_macrodroid_id', e.target.value) } catch {} }}
                style={{ width: '100%', background: '#080810', border: '1px solid #1e1e2e', borderRadius: 8, padding: '9px 12px', color: '#e0e0ff', fontSize: 13, outline: 'none', marginBottom: 8 }}
              />
              <div style={{ color: '#444', fontSize: 10, lineHeight: 1.8 }}>
                Setup steps:<br/>
                1. MacroDroid install karo (free, Play Store)<br/>
                2. New Macro → Trigger: Webhook<br/>
                3. Identifier: <code style={{ color: '#00d4ff' }}>jarvis_wifi_on</code><br/>
                4. Action: WiFi Enable<br/>
                5. Apna Device ID yahan paste karo<br/>
                6. JARVIS mein bol: "WiFi on karo" ✅
              </div>
            </div>

            {/* Notifications */}
            <div style={{ background: '#0e0e1a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ color: '#e0e0ff', fontWeight: 600, marginBottom: 4 }}>🔔 Notifications</div>
              <button
                onClick={async () => {
                  const perm = await Notification.requestPermission()
                  if (perm === 'granted') {
                    setToast('✅ Notifications enabled!')
                    new Notification('JARVIS', { body: 'Notifications active! 🤖', icon: '/icons/icon-192.png' })
                  } else {
                    setToast('❌ Permission denied')
                  }
                }}
                style={{ background: 'linear-gradient(135deg,#00d4ff,#0066cc)', border: 'none', borderRadius: 8, color: '#000', padding: '10px 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                Enable Notifications
              </button>
            </div>

            {/* Wake Word */}
            <div style={{ background: '#0e0e1a', border: '1px solid #1e1e2e', borderRadius: 12, padding: 14 }}>
              <div style={{ color: '#e0e0ff', fontWeight: 600, marginBottom: 4 }}>🎙️ Wake Word</div>
              <div style={{ color: '#555', fontSize: 11, marginBottom: 6 }}>Main chat page pe "Hey JARVIS" bol ke activate karo</div>
              <div style={{ color: '#444', fontSize: 10 }}>
                Supported words: <span style={{ color: '#00d4ff' }}>"Hey JARVIS"</span>, <span style={{ color: '#00d4ff' }}>"JARVIS"</span>, <span style={{ color: '#00d4ff' }}>"OK JARVIS"</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
