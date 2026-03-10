'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { loadPuter, puterChat } from '@/lib/providers/puter';
import { autoRouteMode } from '@/lib/tools/intent';
import { checkAndFireReminders } from '@/lib/reminders';
import { saveMessage, createSession, getMessages, getSessions, type ChatMessage, type ChatSession } from '@/lib/storage';
import { speakText, stopSpeaking } from '@/lib/tts';

const NavDrawer = dynamic(() => import('@/components/shared/NavDrawer'), { ssr: false });
const PinLock = dynamic(() => import('@/components/shared/PinLock'), { ssr: false });

type Mode = 'auto' | 'flash' | 'think' | 'deep';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  card?: any;
  timestamp: number;
}

interface Toast {
  msg: string;
  type: 'default' | 'ok' | 'err';
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '8px 0', alignItems: 'center' }}>
      <span style={{ color: '#00d4ff', marginRight: 6, fontSize: 13 }}>JARVIS</span>
      {[0, 1, 2].map(i => (
        <div key={i} className="typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

function RichCard({ card }: { card: any }) {
  if (!card) return null;
  return (
    <div className="rich-card" style={{ marginTop: 8 }}>
      {card.imageUrl && (
        <img
          src={card.imageUrl}
          alt={card.title || ''}
          className="rich-card-image"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="rich-card-body">
        {card.title && <div className="rich-card-title">{card.title}</div>}
        {card.subtitle && <div className="rich-card-sub">{card.subtitle}</div>}
        {card.linkUrl && (
          <a
            href={card.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#00d4ff', fontSize: 12, display: 'inline-block', marginTop: 4 }}
          >
            Open ↗
          </a>
        )}
      </div>
    </div>
  );
}

function MsgItem({ msg }: { msg: Msg }) {
  const isUser = msg.role === 'user';
  return (
    <div
      className="fade-in"
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
        padding: '0 12px',
      }}
    >
      {isUser ? (
        <div className="user-bubble">{msg.content}</div>
      ) : (
        <div style={{ maxWidth: '90%' }}>
          <div style={{ color: '#00d4ff', fontSize: 12, marginBottom: 2, fontWeight: 600 }}>
            JARVIS {msg.provider ? `· ${msg.provider}` : ''}
          </div>
          <div className="jarvis-message">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
          {msg.card && <RichCard card={msg.card} />}
          <button
            onClick={() => speakText(msg.content)}
            style={{
              background: 'none', border: 'none', color: '#444', fontSize: 12,
              cursor: 'pointer', padding: '2px 0', marginTop: 2,
            }}
            title="Speak"
          >
            🔊
          </button>
        </div>
      )}
    </div>
  );
}

function PlusPopup({ open, mode, onMode, onClose }: {
  open: boolean; mode: Mode;
  onMode: (m: Mode) => void; onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  if (!open) return null;
  const MODES: { key: Mode; icon: string; label: string }[] = [
    { key: 'auto', icon: '🤖', label: 'Auto' },
    { key: 'flash', icon: '⚡', label: 'Flash' },
    { key: 'think', icon: '🧠', label: 'Think' },
    { key: 'deep', icon: '🔬', label: 'Deep' },
  ];
  return (
    <div
      style={{
        position: 'fixed', bottom: 80, left: 12, right: 12,
        zIndex: 9999, background: '#111118',
        border: '1px solid #1e1e2e', borderRadius: 16, padding: 16,
      }}
    >
      <div style={{ color: '#555', fontSize: 11, marginBottom: 8 }}>MODE</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => { onMode(m.key); onClose(); }}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 10,
              border: mode === m.key ? '1px solid #00d4ff' : '1px solid #2a2a4a',
              background: mode === m.key ? 'rgba(0,212,255,0.1)' : '#1a1a2e',
              color: mode === m.key ? '#00d4ff' : '#666',
              fontSize: 11, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            }}
          >
            <span style={{ fontSize: 18 }}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>
      <div style={{ color: '#555', fontSize: 11, marginBottom: 8 }}>ATTACH</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { icon: '📷', label: 'Camera' },
          { icon: '🖼️', label: 'Image' },
          { icon: '📄', label: 'PDF' },
          { icon: '🎵', label: 'Voice' },
        ].map(opt => (
          <button
            key={opt.label}
            onClick={() => { fileRef.current?.click(); onClose(); }}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 10,
              border: '1px solid #2a2a4a', background: '#1a1a2e',
              color: '#666', fontSize: 11, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            }}
          >
            <span style={{ fontSize: 18 }}>{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>
      <input ref={fileRef} type="file" style={{ display: 'none' }} multiple accept="image/*,.pdf" />
    </div>
  );
}

export default function Home() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('auto');
  const [loading, setLoading] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [showPin, setShowPin] = useState(false);
  const [compress, setCompress] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Computed effective mode
  const effectiveMode = mode === 'auto' ? autoRouteMode(input) : mode;

  // Init
  useEffect(() => {
    // Check PIN
    const pinHash = localStorage.getItem('jarvis_pin_hash');
    if (pinHash) setShowPin(true);

    // Preload Puter silently
    loadPuter().then(p => {
      if (p) console.log('✅ Puter.js ready');
    });

    // Create/get session
    createSession('New Chat').then(id => setSessionId(id));

    // Check reminders
    const remCheck = setInterval(() => {
      checkAndFireReminders((r) => {
        showToast(`⏰ Reminder: ${r.message}`, 'ok');
        speakText(`Reminder: ${r.message}`);
      });
    }, 30000);

    // Welcome message
    setMsgs([{
      id: 'welcome',
      role: 'assistant',
      content: `Hello! Main **JARVIS** hun 🤖\n\nMain tumhara personal AI assistant hun — NEET preparation se leke news, weather, math aur bahut kuch help kar sakta hun.\n\nKya poochna hai? 💬`,
      timestamp: Date.now(),
    }]);

    return () => clearInterval(remCheck);
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, loading]);

  const showToast = (msg: string, type: 'default' | 'ok' | 'err' = 'default') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Execute app commands from JARVIS response
  const execAppCommand = useCallback((cmd: string) => {
    if (cmd.startsWith('navigate:')) {
      window.location.href = cmd.replace('navigate:', '');
    } else if (cmd.startsWith('toast:')) {
      showToast(cmd.replace('toast:', ''));
    } else if (cmd.startsWith('toastOk:')) {
      showToast(cmd.replace('toastOk:', ''), 'ok');
    } else if (cmd.startsWith('toastErr:')) {
      showToast(cmd.replace('toastErr:', ''), 'err');
    } else if (cmd === 'clearChat') {
      setMsgs([]);
    } else if (cmd === 'openNav') {
      setNavOpen(true);
    } else if (cmd === 'closeNav') {
      setNavOpen(false);
    } else if (cmd.startsWith('setInput:')) {
      setInput(cmd.replace('setInput:', ''));
    }
  }, []);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    setPlusOpen(false);

    const userMsg: Msg = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };

    setMsgs(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Save to DB
    if (sessionId) {
      saveMessage({ sessionId, role: 'user', content: text.trim(), timestamp: Date.now() });
    }

    // Build history for API
    const history = msgs.slice(-8).map(m => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content: text.trim() });

    const eMode = mode === 'auto' ? autoRouteMode(text) : mode;

    const assistantId = `a_${Date.now()}`;
    let fullText = '';
    let card: any = null;
    let provider = '';

    setMsgs(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    }]);

    // Abort previous
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const endpoint = eMode === 'deep' ? '/api/jarvis/deep-stream' : '/api/stream';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, mode: eMode, sessionId }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error('Stream failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'delta') {
              fullText += data.text;
              setMsgs(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: fullText } : m
              ));
            } else if (data.type === 'card') {
              card = data.card;
              setMsgs(prev => prev.map(m =>
                m.id === assistantId ? { ...m, card } : m
              ));
            } else if (data.type === 'done') {
              provider = data.provider || '';
              setMsgs(prev => prev.map(m =>
                m.id === assistantId ? { ...m, provider, content: fullText || m.content } : m
              ));
            } else if (data.type === 'appCommand') {
              execAppCommand(data.command);
            } else if (data.type === 'error') {
              fullText = data.text;
              setMsgs(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: fullText } : m
              ));
            }
          } catch {}
        }
      }

      // Fallback to Puter if stream gave empty response
      if (!fullText || fullText.length < 5) {
        try {
          const puterText = await puterChat([
            { role: 'system', content: 'You are JARVIS, a Hinglish AI assistant. Be helpful and brief.' },
            ...history,
          ]);
          fullText = puterText;
          provider = 'Puter/GPT-4o-mini';
          setMsgs(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: fullText, provider } : m
          ));
        } catch {}
      }

    } catch (err: any) {
      if (err.name === 'AbortError') return;

      // Direct Puter fallback
      try {
        const puterText = await puterChat([
          { role: 'system', content: 'You are JARVIS, a helpful Hinglish AI. Be concise.' },
          ...history,
        ]);
        fullText = puterText;
        provider = 'Puter/GPT-4o-mini';
        setMsgs(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: fullText, provider } : m
        ));
      } catch {
        setMsgs(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: 'Network issue. Thodi der mein try karo! 🔄' } : m
        ));
      }
    }

    setLoading(false);

    // Save assistant response
    if (sessionId && fullText) {
      saveMessage({ sessionId, role: 'assistant', content: fullText, timestamp: Date.now(), provider, card });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  if (showPin) {
    return (
      <PinLock onUnlock={() => setShowPin(false)} />
    );
  }

  return (
    <div className="page-container">
      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type === 'ok' ? 'toast-ok' : toast.type === 'err' ? 'toast-err' : ''}`}>
          {toast.msg}
        </div>
      )}

      {/* Nav Drawer */}
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />

      {/* Plus Popup */}
      {plusOpen && (
        <PlusPopup
          open={plusOpen}
          mode={mode}
          onMode={setMode}
          onClose={() => setPlusOpen(false)}
        />
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px',
        borderBottom: '1px solid #1e1e2e',
        background: 'var(--bg)',
      }}>
        {/* J Logo → NavDrawer */}
        <button
          onClick={() => setNavOpen(true)}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #00d4ff, #0066aa)',
            border: 'none', color: '#000', fontWeight: 900,
            fontSize: 16, cursor: 'pointer', flexShrink: 0,
          }}
        >
          J
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>JARVIS</div>
          <div style={{ color: '#555', fontSize: 10 }}>v20.3 · ₹0/month</div>
        </div>

        <button
          onClick={() => stopSpeaking()}
          style={{
            background: 'none', border: 'none', color: '#555',
            fontSize: 18, cursor: 'pointer',
          }}
          title="Stop speaking"
        >
          🔇
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {msgs.map(msg => <MsgItem key={msg.id} msg={msg} />)}
        {loading && (
          <div style={{ padding: '0 12px' }}>
            <TypingDots />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Bottom strip */}
      <div className="bottom-strip">
        <span>
          {mode === 'auto'
            ? `🤖 Auto → ${effectiveMode.charAt(0).toUpperCase() + effectiveMode.slice(1)}`
            : `${mode === 'flash' ? '⚡' : mode === 'think' ? '🧠' : '🔬'} ${mode.charAt(0).toUpperCase() + mode.slice(1)}`}
        </span>
        <button
          onClick={() => setCompress(!compress)}
          style={{
            background: 'none', border: '1px solid #2a2a4a',
            borderRadius: 6, color: '#555', fontSize: 10,
            padding: '2px 8px', cursor: 'pointer',
          }}
        >
          🗜️ Compress
        </button>
      </div>

      {/* Input bar */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #1e1e2e', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {/* Plus */}
          <button
            onClick={() => {
              setPlusOpen(prev => !prev);
              if (!plusOpen) {
                setTimeout(() => {
                  const close = (e: MouseEvent) => {
                    if (!(e.target as Element).closest('[data-plus]')) {
                      setPlusOpen(false);
                      document.removeEventListener('click', close);
                    }
                  };
                  document.addEventListener('click', close);
                }, 80);
              }
            }}
            data-plus
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: plusOpen ? 'rgba(0,212,255,0.15)' : '#1a1a2e',
              border: '1px solid #2a2a4a',
              color: plusOpen ? '#00d4ff' : '#888',
              fontSize: 22, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all 0.2s',
            }}
          >
            +
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={loading ? 'JARVIS soch raha hai...' : 'JARVIS se kuch bhi pucho...'}
            disabled={loading}
            rows={1}
            style={{
              flex: 1, background: '#111118',
              border: '1px solid #2a2a4a', borderRadius: 20,
              padding: '10px 14px', color: '#e0e0ff',
              fontSize: 15, outline: 'none', resize: 'none',
              minHeight: 40, maxHeight: 120, lineHeight: 1.4,
              fontFamily: 'inherit', overflowY: 'auto',
              opacity: loading ? 0.6 : 1,
            }}
          />

          {/* Send */}
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: input.trim() && !loading ? '#00d4ff' : '#1a1a2e',
              border: 'none',
              color: input.trim() && !loading ? '#000' : '#444',
              fontSize: 18, cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all 0.2s',
              fontWeight: 700,
            }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
