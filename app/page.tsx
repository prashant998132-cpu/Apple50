'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { loadPuter, puterChat } from '@/lib/providers/puter';
import { checkAndFireReminders } from '@/lib/reminders';
import { checkBatteryAlert, showNotification, vibrate } from '@/lib/automation/bridge';
import { saveMessage, createSession, getMessages, getSessions, updateSessionTitle, type ChatSession } from '@/lib/storage';
import { speakText, stopSpeaking } from '@/lib/tts';
import { ToastContainer, useToast } from '@/components/shared/Toast';
import { usePWA } from '@/lib/hooks/usePWA';
import { learnFromMessage, buildMemoryContext } from '@/lib/memory/proactive';
import { detectAppIntent, executeCommand, compressUserMessage, type CompressLevel } from '@/lib/core/appController';

import { buildSystemPrompt, parseLearnTags, cleanResponse, getTimeSuggestion } from '@/lib/personality';
import { processAndSave } from '@/lib/memory/extractor';
import { checkProactive, trackHabit } from '@/lib/proactive/engine';
import { parseSlashCommand, SLASH_COMMANDS } from '@/lib/chat/slashCommands';
import { initTheme, toggleTheme, getTheme, type Theme } from '@/lib/theme';
import { useOnlineStatus, cacheAIResponse, getOfflineFallback, getStaticOfflineReply } from '@/lib/offline/status';
import { startWakeWord, stopWakeWord } from '@/lib/voice/wakeWord';
import { detectAutomationIntent, triggerMacro, sendLocalNotification } from '@/lib/automation/bridge';
import { saveResult, trackInteraction, getSmartGreeting } from '@/lib/db';
import { getProactiveSuggestion, autoRouteMode } from '@/lib/core/smartRouter';

// Agent intent keywords — yeh queries agent mode mein jayenge
function isAgentIntent(text: string): boolean {
  const t = text.toLowerCase()
  return /study plan|schedule bana|research kar|image bana|generate image|todo list|task list|news summarize|video script|workflow|step by step|automatically kar|auto.*karo/.test(t)
    && t.split(' ').length > 3 // sirf complex queries, 1-2 word nahi
}
const NavDrawer = dynamic(() => import('@/components/shared/NavDrawer'), { ssr: false });
const PinLock   = dynamic(() => import('@/components/shared/PinLock'),   { ssr: false });

type Mode = 'auto' | 'flash' | 'think' | 'deep';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider?: string;
  card?: any;
  timestamp: number;
  widget?: string;
}

// ── Connected Apps config (with/without API key) ──────────────────────────
const CONNECTED_APPS = [
  { id: 'groq',       icon: '⚡', name: 'Groq',       free: true,  envKey: 'GROQ_API_KEY',    color: '#f97316' },
  { id: 'gemini',     icon: '✨', name: 'Gemini',     free: true,  envKey: 'GEMINI_API_KEY',   color: '#4285f4' },
  { id: 'puter',      icon: '🤖', name: 'Puter.js',   free: true,  envKey: null,               color: '#00d4ff' },
  { id: 'pollinations',icon:'🎨', name: 'Pollinations',free: true, envKey: null,               color: '#a855f7' },
  { id: 'together',   icon: '🔗', name: 'Together',   free: true,  envKey: 'TOGETHER_API_KEY', color: '#22c55e' },
  { id: 'cerebras',   icon: '🧠', name: 'Cerebras',   free: true,  envKey: 'CEREBRAS_API_KEY', color: '#ec4899' },
  { id: 'openrouter', icon: '🌐', name: 'OpenRouter', free: true,  envKey: 'OPENROUTER_API_KEY',color: '#f59e0b' },
  { id: 'cohere',     icon: '💬', name: 'Cohere',     free: true,  envKey: 'COHERE_API_KEY',   color: '#06b6d4' },
  { id: 'wttr',       icon: '🌤️', name: 'Weather',    free: true,  envKey: null,               color: '#38bdf8' },
  { id: 'gnews',      icon: '📰', name: 'GNews',      free: true,  envKey: 'GNEWS_API_KEY',    color: '#fb923c' },
];

// ── Helper Components ─────────────────────────────────────────────────────
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
        <img src={card.imageUrl} alt={card.title || ''} className="rich-card-image"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}
      <div className="rich-card-body">
        {card.title    && <div className="rich-card-title">{card.title}</div>}
        {card.subtitle && <div className="rich-card-sub">{card.subtitle}</div>}
        {card.linkUrl  && (
          <a href={card.linkUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: '#00d4ff', fontSize: 12, display: 'inline-block', marginTop: 4 }}>
            Open ↗
          </a>
        )}
      </div>
    </div>
  );
}

function MsgItem({ msg }: { msg: Msg; [key: string]: any }) {
  const isUser = msg.role === 'user';
  return (
    <div className="fade-in" style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 12, padding: '0 12px' }}>
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
          {/* Inline Command Widget */}
          {msg.widget && <CommandWidgetRenderer userText={msg.widget} aiText={msg.content} />}
          <button onClick={() => speakText(msg.content)}
            style={{ background: 'none', border: 'none', color: '#333', fontSize: 12, cursor: 'pointer', padding: '2px 0', marginTop: 2 }}>
            🔊
          </button>
        </div>
      )}
    </div>
  );
}

function CommandWidgetRenderer({ userText, aiText }: { userText: string; aiText: string }) {
  const [widget, setWidget] = React.useState<React.ReactNode>(null);
  React.useEffect(() => {
    import('@/components/chat/CommandWidgets').then(m => {
      setWidget(m.detectWidget(aiText, userText));
    }).catch(() => {});
  }, [userText, aiText]);
  return widget ? <>{widget}</> : null;
}

function PlusPopup({ open, mode, onMode, onClose }: { open: boolean; mode: Mode; onMode: (m: Mode) => void; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  if (!open) return null;
  const MODES: { key: Mode; icon: string; label: string }[] = [
    { key: 'auto', icon: '🤖', label: 'Auto' },
    { key: 'flash', icon: '⚡', label: 'Flash' },
    { key: 'think', icon: '🧠', label: 'Think' },
    { key: 'deep', icon: '🔬', label: 'Deep' },
  ];
  return (
    <div style={{ position: 'fixed', bottom: 80, left: 12, right: 12, zIndex: 9999, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 16, padding: 16 }}>
      <div style={{ color: '#555', fontSize: 11, marginBottom: 8 }}>MODE</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {MODES.map(m => (
          <button key={m.key} onClick={() => { onMode(m.key); onClose(); }}
            style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: mode === m.key ? '1px solid #00d4ff' : '1px solid #2a2a4a', background: mode === m.key ? 'rgba(0,212,255,0.1)' : '#1a1a2e', color: mode === m.key ? '#00d4ff' : '#666', fontSize: 11, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 18 }}>{m.icon}</span>{m.label}
          </button>
        ))}
      </div>
      <div style={{ color: '#555', fontSize: 11, marginBottom: 8 }}>ATTACH</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[{ icon: '📷', label: 'Camera' }, { icon: '🖼️', label: 'Image' }, { icon: '📄', label: 'PDF' }, { icon: '🎵', label: 'Voice' }].map(opt => (
          <button key={opt.label} onClick={() => { fileRef.current?.click(); onClose(); }}
            style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: '1px solid #2a2a4a', background: '#1a1a2e', color: '#666', fontSize: 11, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 18 }}>{opt.icon}</span>{opt.label}
          </button>
        ))}
      </div>
      <input ref={fileRef} type="file" style={{ display: 'none' }} multiple accept="image/*,.pdf" />
    </div>
  );
}

// ── Chat History Sidebar ──────────────────────────────────────────────────
function HistorySidebar({ open, onClose, onSelect, currentId }: {
  open: boolean; onClose: () => void;
  onSelect: (id: string) => void; currentId: string;
}) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  useEffect(() => {
    if (open) getSessions().then(setSessions);
  }, [open]);
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998, background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: '80%', maxWidth: 320, height: '100%', background: '#0d0d16', borderLeft: '1px solid #1e1e2e', overflowY: 'auto', padding: 16 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ color: '#00d4ff', fontWeight: 700 }}>💬 Chat History</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        {sessions.length === 0 && <div style={{ color: '#444', fontSize: 13 }}>Koi history nahi abhi.</div>}
        {sessions.map(s => (
          <button key={s.sessionId} onClick={() => { onSelect(s.sessionId); onClose(); }}
            style={{ width: '100%', background: s.sessionId === currentId ? 'rgba(0,212,255,0.1)' : '#111118', border: s.sessionId === currentId ? '1px solid #00d4ff' : '1px solid #1e1e2e', borderRadius: 10, padding: '10px 12px', marginBottom: 8, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ color: '#e0e0ff', fontSize: 13, marginBottom: 2 }}>{s.title || 'Untitled Chat'}</div>
            <div style={{ color: '#444', fontSize: 10 }}>{s.messageCount} msgs · {new Date(s.updatedAt).toLocaleDateString('en-IN')}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Connected Apps Panel ───────────────────────────────────────────────────
function ConnectedAppsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [usage, setUsage] = useState<Record<string, any>>({});
  useEffect(() => {
    if (open) {
      fetch('/api/usage').then(r => r.json()).then(d => setUsage(d.usage || {})).catch(() => {});
    }
  }, [open]);
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998, background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#0d0d16', borderTop: '1px solid #1e1e2e', borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '70vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ color: '#00d4ff', fontWeight: 700 }}>🔌 Connected Apps</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Without API key (always connected) */}
        <div style={{ color: '#555', fontSize: 10, marginBottom: 8, letterSpacing: 1 }}>✅ ALWAYS CONNECTED (No API Key)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
          {CONNECTED_APPS.filter(a => !a.envKey).map(app => (
            <div key={app.id} style={{ background: '#111118', border: `1px solid ${app.color}33`, borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 22 }}>{app.icon}</div>
              <div style={{ color: app.color, fontSize: 10, marginTop: 3 }}>{app.name}</div>
              <div style={{ color: '#22c55e', fontSize: 9, marginTop: 1 }}>● Live</div>
            </div>
          ))}
        </div>

        {/* With API key */}
        <div style={{ color: '#555', fontSize: 10, marginBottom: 8, letterSpacing: 1 }}>🔑 WITH API KEY</div>
        {CONNECTED_APPS.filter(a => a.envKey).map(app => {
          const u = usage[app.id];
          const pct = u ? u.pct : 0;
          const hasKey = typeof window !== 'undefined' && !!localStorage.getItem(app.id + '_key');
          return (
            <div key={app.id} style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: u ? 6 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{app.icon}</span>
                  <span style={{ color: '#e0e0ff', fontSize: 13 }}>{app.name}</span>
                </div>
                <span style={{ fontSize: 10, color: hasKey ? '#22c55e' : '#ef4444' }}>{hasKey ? '● Connected' : '○ No Key'}</span>
              </div>
              {u && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ color: '#444', fontSize: 10 }}>Daily usage</span>
                    <span style={{ color: pct >= 85 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#22c55e', fontSize: 10 }}>{u.count}/{u.limit} ({pct}%)</span>
                  </div>
                  <div style={{ height: 4, background: '#1a1a2a', borderRadius: 2 }}>
                    <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(pct, 100)}%`, background: pct >= 85 ? '#ef4444' : pct >= 60 ? '#f59e0b' : '#22c55e', transition: 'width 0.4s' }} />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();
  const [msgs, setMsgs]           = useState<Msg[]>([]);
  const [input, setInput]         = useState('');
  const [mode, setMode]           = useState<Mode>('auto');
  const [loading, setLoading]     = useState(false);
  const [navOpen, setNavOpen]     = useState(false);
  const [plusOpen, setPlusOpen]   = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [appsOpen, setAppsOpen]   = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [showPin, setShowPin]     = useState(false);
  const [location, setLocation]   = useState('');
  const [theme, setThemeState]    = useState<Theme>('dark');
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [wakeActive, setWakeActive] = useState(false);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef    = useRef<AbortController | null>(null);

  const { toasts, hideToast, toastOk, toastErr, toastInfo, showToast } = useToast();
  const { canInstall, isIOS, install } = usePWA();
  const { online, reconnected } = useOnlineStatus();

  const effectiveMode = mode === 'auto' ? autoRouteMode(input) : mode;

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    // PIN check
    if (localStorage.getItem('jarvis_pin_hash')) setShowPin(true);

    // Theme init
    initTheme();
    setThemeState(getTheme());

    // Puter preload
    loadPuter().catch(() => {});

    // New session
    createSession('New Chat').then(id => setSessionId(id));

    // Location (GPS → reverse geocode)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
          const d = await res.json();
          const city = d?.address?.city || d?.address?.town || d?.address?.village || '';
          if (city) { setLocation(city); toastInfo(`📍 Location: ${city}`); }
        } catch {}
      }, () => {});
    }

    // Reminders
    const ri = setInterval(() => {
      // Battery alert check
      checkBatteryAlert((msg) => {
        setMsgs(prev => [...prev, {
          id: 'battery_' + Date.now(), role: 'assistant', content: '⚡ ' + msg, timestamp: Date.now(),
        }])
      }).catch(() => {})

      // Request notification permission silently
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {})
      }

      checkAndFireReminders(r => {
        showToast(`⏰ ${r.message}`, 'ok', '⏰');
        speakText(`Reminder: ${r.message}`);
      });
    }, 30000);

    // Proactive check (once on load)
    checkProactive().then(event => {
      if (event?.message) {
        setTimeout(() => {
          setMsgs(prev => [...prev, {
            id: `proactive_${Date.now()}`, role: 'assistant', timestamp: Date.now(),
            content: event.message,
          }]);
        }, 2000);
      }
    }).catch(() => {});

    // Time-based suggestion from personality
    const timeSug = getTimeSuggestion();
    if (timeSug) {
      setTimeout(() => toastInfo(timeSug), 4000);
    }


    // Smart context-aware greeting
    getSmartGreeting().then(smartGreet => {
      const baseWelcome = `Kya haal hai! Main **JARVIS** hun 🤖\n\nHinglish mein bol, main samajh lunga. Slash commands: \`/nasa\` \`/joke\` \`/wiki topic\` \`/shayari\``;
      setMsgs([{
        id: 'welcome', role: 'assistant', timestamp: Date.now(),
        content: smartGreet ? `${smartGreet}\n\n_Kuch naya poochna ho toh bhi bol._` : baseWelcome,
      }]);
    }).catch(() => {
      setMsgs([{
        id: 'welcome', role: 'assistant', timestamp: Date.now(),
        content: `Kya haal hai! Main **JARVIS** hun 🤖\n\nHinglish mein bol, main samajh lunga. \`/nasa\` \`/joke\` \`/wiki topic\` try karo!`,
      }]);
    });

    return () => clearInterval(ri);
  }, []);

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, loading]);

  // ── Load session history ───────────────────────────────────────────────
  const loadSession = useCallback(async (sid: string) => {
    const saved = await getMessages(sid);
    if (saved.length === 0) return;
    setSessionId(sid);
    setMsgs(saved.map(m => ({
      id: `${m.role}_${m.timestamp}`,
      role: m.role,
      content: m.content,
      provider: m.provider,
      card: m.card,
      timestamp: m.timestamp,
    })));
  }, []);

  // ── App Commands — full controller ────────────────────────────────────
  const execAppCommand = useCallback((cmd: string) => {
    executeCommand(cmd, {
      navigate:     (path) => { window.location.href = path; },
      showToast:    (msg, type) => showToast(msg, (type as any) || 'default'),
      clearChat:    () => setMsgs([]),
      openNav:      () => setNavOpen(true),
      closeNav:     () => setNavOpen(false),
      openHistory:  () => setHistoryOpen(true),
      openSettings: () => { window.location.href = '/settings'; },
      openApps:     () => setAppsOpen(true),
      setMode:      (m) => setMode(m as Mode),
      setInput:     (t) => setInput(t),
      stopSpeaking: () => stopSpeaking(),
      newChat:      () => { setMsgs([]); createSession('New Chat').then(id => setSessionId(id)); },
      scrollTop:    () => { document.querySelector('[data-chat]')?.scrollTo(0, 0); },
      scrollBottom: () => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); },
    });
  }, [showToast, stopSpeaking]);

  // ── Session title generation (instant keyword → Groq background) ──────
  const generateTitle = useCallback(async (firstMsg: string, sid: string) => {
    // 1. Instant keyword title
    const instant = generateInstantTitle(firstMsg);
    updateSessionTitle(sid, instant);

    // 2. Background Groq title (silent)
    try {
      const res = await fetch('/api/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: firstMsg }),
      });
      const d = await res.json();
      if (d.title && d.title !== 'New Chat') updateSessionTitle(sid, d.title);
    } catch {}
  }, []);

  function generateInstantTitle(msg: string): string {
    const m = msg.toLowerCase();
    if (/neet|biology|chemistry|physics/.test(m)) return '📚 NEET';
    if (/weather|mausam/.test(m)) return '🌤️ Weather';
    if (/image|generate|draw/.test(m)) return '🎨 AI Image';
    if (/code|program/.test(m)) return '💻 Code';
    if (/crypto|bitcoin|stock/.test(m)) return '💰 Finance';
    if (/news|khabar/.test(m)) return '📰 News';
    return msg.split(' ').slice(0, 4).join(' ') || 'New Chat';
  }

  // ── Send message ──────────────────────────────────────────────────────
  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    setPlusOpen(false);

    // ── JARVIS Chat Command Center ─────────────────────────────
    const t = text.trim().toLowerCase();
    const reply = (msg: string) => {
      setMsgs(prev => [...prev,
        { id: 'u_' + Date.now(), role: 'user', content: text.trim(), timestamp: Date.now() },
        { id: 'a_' + Date.now(), role: 'assistant', content: msg, timestamp: Date.now() },
      ]);
      setInput('');
    };

    // ── GOALS ──────────────────────────────────────────────────
    if (/goals?\s*(dikhao|show|list|kya hai|batao|dekho)/i.test(text) || t === 'goals' || t === 'goal') {
      try {
        const { getAllGoals } = await import('@/lib/db');
        const goals = await getAllGoals();
        const active = goals.filter((g: any) => !g.completed);
        const done = goals.filter((g: any) => g.completed);
        if (goals.length === 0) { reply('Koi goal nahi abhi. "Goal add karo: [kuch bhi]" bolo.'); return; }
        const txt = '🎯 **Tere Goals:**\n\n**Active (' + active.length + '):**\n' +
          active.map((g: any) => '• ' + g.title).join('\n') +
          (done.length ? '\n\n**Done (' + done.length + '):**\n' + done.slice(0,3).map((g: any) => '✅ ' + g.title).join('\n') : '');
        reply(txt); return;
      } catch { reply('Goals load nahi ho sake.'); return; }
    }
    if (/^goals?\s+add[:\s]+(.+)/i.test(text) || /^add\s+goal[:\s]+(.+)/i.test(text) || /^goal[:\s]+(.+)/i.test(text)) {
      const m = text.match(/(?:goals?\s+add|add\s+goal|goal)[:\s]+(.+)/i);
      if (m?.[1]) {
        try {
          const { addGoal } = await import('@/lib/db');
          await addGoal({ title: m[1].trim(), completed: false, priority: 'medium', progress: 0, timestamp: Date.now() });
          reply('✅ Goal add ho gaya: **' + m[1].trim() + '**'); return;
        } catch { reply('Goal save nahi ho saka.'); return; }
      }
    }

    // ── REMINDERS ──────────────────────────────────────────────
    if (/reminders?\s*(dikhao|show|list|kya hai|batao)/i.test(text) || t === 'reminders') {
      try {
        const { getReminders } = await import('@/lib/reminders');
        const rems = getReminders().filter((r: any) => !r.fired && r.fireAt > Date.now()).sort((a: any, b: any) => a.fireAt - b.fireAt);
        if (rems.length === 0) { reply('Koi upcoming reminder nahi. "Remind me: [kya] at [time]" bolo.'); return; }
        const txt = '⏰ **Upcoming Reminders:**\n' + rems.map((r: any) => '• ' + r.message + ' — ' + new Date(r.fireAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })).join('\n');
        reply(txt); return;
      } catch { reply('Reminders load nahi hue.'); return; }
    }
    const remMatch = text.match(/(?:remind|reminder|yaad dilao)[:\s]+(.+?)\s+(?:at|@|baje|ko)\s+(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)/i);
    if (remMatch) {
      try {
        const { addReminder } = await import('@/lib/reminders');
        const [, what, when] = remMatch;
        const d = new Date(); const parts = when.match(/(\d{1,2})(?::(\d{2}))?/);
        if (parts) { d.setHours(parseInt(parts[1]), parseInt(parts[2] || '0'), 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); }
        addReminder(what.trim(), d.getTime());
        reply('⏰ Reminder set: **' + what.trim() + '** at **' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + '**'); return;
      } catch { reply('Reminder set nahi ho saka.'); return; }
    }

    // ── NOTES ──────────────────────────────────────────────────
    if (/^(?:note|save note|note karo|likh lo)[:\s]+(.+)/i.test(text)) {
      const m = text.match(/(?:note|save note|note karo|likh lo)[:\s]+(.+)/i);
      if (m?.[1]) {
        try {
          const { setSetting, getSetting } = await import('@/lib/db');
          const notes = await getSetting('jarvis_quick_notes').catch(() => []) as any[];
          const updated = [{ id: Date.now(), text: m[1].trim(), ts: Date.now() }, ...(Array.isArray(notes) ? notes : [])].slice(0, 50);
          await setSetting('jarvis_quick_notes', updated);
          reply('📝 Note save ho gaya: **' + m[1].trim() + '**'); return;
        } catch { reply('Note save nahi ho saka.'); return; }
      }
    }
    if (/notes?\s*(dikhao|show|list|kya hai)/i.test(text) || t === 'notes') {
      try {
        const { getSetting } = await import('@/lib/db');
        const notes = await getSetting('jarvis_quick_notes').catch(() => []) as any[];
        if (!Array.isArray(notes) || notes.length === 0) { reply('Koi notes nahi. "Note: [kuch bhi]" bolo.'); return; }
        reply('📝 **Recent Notes:**\n' + notes.slice(0, 5).map((n: any) => '• ' + n.text).join('\n')); return;
      } catch { reply('Notes load nahi hue.'); return; }
    }

    // ── BATTERY ────────────────────────────────────────────────
    if (/battery|charge|charging/i.test(t) && /kitna|check|status|level|hai|kya/i.test(t)) {
      try {
        const { getBatteryInfo } = await import('@/lib/automation/bridge');
        const bat = await getBatteryInfo();
        if (!bat) { reply('Battery info available nahi (browser support nahi).'); return; }
        const emoji = bat.level > 60 ? '🟢' : bat.level > 30 ? '🟡' : '🔴';
        reply(emoji + ' Battery: **' + bat.level + '%**' + (bat.charging ? ' ⚡ Charging' : ' (Not charging)') + (bat.level < 20 ? '\n⚠️ Charge lagao jaldi boss!' : '')); return;
      } catch { reply('Battery check nahi ho saka.'); return; }
    }

    // ── WEATHER ────────────────────────────────────────────────
    if (/weather|mausam|garmi|sardi|barish|temperature/i.test(t)) {
      const cityM = text.match(/(?:of|in|at|ka|mein|for)\s+(\w+)/i);
      const city = cityM?.[1] || location || 'Maihar';
      try {
        const res = await fetch('https://wttr.in/' + encodeURIComponent(city) + '?format=j1', { signal: AbortSignal.timeout(5000) });
        const d = await res.json();
        const c = d.current_condition?.[0];
        reply('🌤️ **' + city + '** — ' + c?.temp_C + '°C\n' + c?.weatherDesc?.[0]?.value + '\nHumidity: ' + c?.humidity + '% · Wind: ' + c?.windspeedKmph + ' km/h'); return;
      } catch { reply('Weather data nahi mila. Internet check karo.'); return; }
    }

    // ── TIMER ──────────────────────────────────────────────────
    const timerM = text.match(/(\d+)\s*(?:minute|min|second|sec)\s*(?:ka\s*)?timer/i);
    if (timerM) {
      const n = parseInt(timerM[1]);
      const unit = /sec/i.test(timerM[0]) ? 'second' : 'minute';
      const ms = unit === 'second' ? n * 1000 : n * 60000;
      setTimeout(() => {
        if (typeof navigator !== 'undefined') navigator.vibrate?.([500, 200, 500]);
        import('@/lib/automation/bridge').then(m => m.showNotification('⏱️ Timer Done!', n + ' ' + unit + ' ho gaye boss!'));
      }, ms);
      reply('⏱️ **' + n + ' ' + unit + ' timer** set ho gaya! Baj jaayega.'); return;
    }

    // ── APPS OPEN ──────────────────────────────────────────────
    const appMap: Record<string, string> = {
      whatsapp: 'whatsapp://', wa: 'whatsapp://',
      youtube: 'vnd.youtube:', yt: 'vnd.youtube:',
      camera: 'intent://camera#Intent;scheme=android-app;end',
      maps: 'geo:0,0', map: 'geo:0,0',
      phone: 'tel:', call: 'tel:',
      settings: 'intent://settings#Intent;scheme=android-app;end',
      instagram: 'instagram://', insta: 'instagram://',
      spotify: 'spotify://',
      telegram: 'tg://', tele: 'tg://',
      calculator: 'intent://calculator#Intent;scheme=android-app;end',
    };
    for (const [app, scheme] of Object.entries(appMap)) {
      if (new RegExp('\\b' + app + '\\b.*(?:khol|open|launch|chalu|start)', 'i').test(text) ||
          new RegExp('(?:khol|open|launch).*\\b' + app + '\\b', 'i').test(text)) {
        if (typeof window !== 'undefined') window.location.href = scheme;
        reply('✅ **' + app.charAt(0).toUpperCase() + app.slice(1) + '** khul raha hai...'); return;
      }
    }

    // ── SYSTEM INFO ────────────────────────────────────────────
    if (/system|status|info|sab kuch batao/i.test(t) && /batao|dikhao|check|kya hai/i.test(t)) {
      try {
        const { getAllGoals, getStreak, getTodayChats } = await import('@/lib/db');
        const { getReminders } = await import('@/lib/reminders');
        const { getBatteryInfo } = await import('@/lib/automation/bridge');
        const [goals, streak, todayChats, bat] = await Promise.all([getAllGoals(), Promise.resolve(getStreak()), getTodayChats(), getBatteryInfo()]);
        const rems = getReminders().filter((r: any) => !r.fired && r.fireAt > Date.now());
        reply(
          '🤖 **JARVIS Status**\n\n' +
          '⚡ Battery: ' + (bat ? bat.level + '%' + (bat.charging ? ' charging' : '') : 'N/A') + '\n' +
          '🎯 Goals: ' + goals.filter((g: any) => !g.completed).length + ' active\n' +
          '⏰ Reminders: ' + rems.length + ' upcoming\n' +
          '💬 Chats today: ' + todayChats.length + '\n' +
          '🔥 Streak: ' + streak.current + ' days\n' +
          '📡 Network: ' + (navigator.onLine ? 'Online ✅' : 'Offline ⚠️')
        ); return;
      } catch { /* fall through */ }
    }

    // ── PAGE NAVIGATION ────────────────────────────────────────
    const navMap: [RegExp, string, string][] = [
      [/settings.*jao|settings.*kholo|open.*settings/i, '/settings', 'Settings'],
      [/study.*jao|study.*kholo|neet.*page/i, '/study', 'Study Hub'],
      [/voice.*jao|voice.*kholo|voice.*mode/i, '/voice', 'Voice Mode'],
      [/briefing.*jao|briefing.*dikhao|news.*page/i, '/briefing', 'Briefing'],
      [/tools?.*jao|tools?.*kholo|calculator.*page/i, '/tools', 'Tools'],
      [/notes?.*jao|notes?.*page|notes?.*kholo/i, '/notes', 'Notes'],
      [/reminders?.*page|reminder.*jao/i, '/reminders', 'Reminders'],
      [/goals?.*page|target.*jao/i, '/target', 'Goals'],
      [/media.*jao|media.*page/i, '/media', 'Media Hub'],
      [/camera.*jao|camera.*page/i, '/camera', 'Camera AI'],
      [/india.*jao|india.*hub/i, '/india', 'India Hub'],
      [/system.*page|system.*jao/i, '/system', 'System'],
    ];
    for (const [regex, path, label] of navMap) {
      if (regex.test(text)) {
        router.push(path);
        reply('👉 **' + label + '** pe ja raha hun...'); return;
      }
    }

    // ── AUTOMATION ─────────────────────────────────────────────
    const autoAction = detectAutomationIntent(text);
    if (autoAction) {
      const result = await triggerMacro(autoAction);
      reply(result.ok ? '✅ ' + result.msg : '⚠️ ' + result.msg); return;
    }

    // ── Direct Image Generation — bypass AI refusal ──────────
    const imgMatch = text.match(/(?:image|img|photo|pic|wallpaper|banner|poster|draw|paint|sketch)\s+(?:bana|banao|generate|create|make|de|do|chahiye|of|ki|ka)\s*(.+)/i)
      || text.match(/(.+)\s+(?:ki|ka|ke|wala|wali)\s+image/i)
    if (imgMatch) {
      const imgPrompt = (imgMatch[1] || imgMatch[0]).trim()
      const safePrompt = imgPrompt.replace(/(nude|naked|nsfw|explicit|sex|porn)/gi, 'person')
      const imgUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(safePrompt + ', high quality, detailed') + '?width=1024&height=1024&nologo=true&seed=' + Date.now()
      setMsgs(prev => [...prev,
        { id: 'u_' + Date.now(), role: 'user', content: text.trim(), timestamp: Date.now() },
        { id: 'a_' + Date.now(), role: 'assistant', content: '🎨 Generating: "' + safePrompt + '"...', timestamp: Date.now(),
          card: { type: 'image', imageUrl: imgUrl, title: safePrompt } },
      ])
      setInput('')
      return
    }

    const isFirstMsg = msgs.filter(m => m.role === 'user').length === 0;
    const userMsg: Msg = { id: `u_${Date.now()}`, role: 'user', content: text.trim(), timestamp: Date.now() };

    setMsgs(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Learn + habit tracking (background, silent)
    learnFromMessage(text.trim()).catch(() => {});
    trackHabit(text.trim()).catch(() => {});

    if (sessionId) {
      saveMessage({ sessionId, role: 'user', content: text.trim(), timestamp: Date.now() });
      if (isFirstMsg) generateTitle(text.trim(), sessionId);
    }

    // Rich personality system prompt (Jons Bhai + memory + time context)
    const systemPrompt = await buildSystemPrompt().catch(() =>
      `You are JARVIS — "Jons Bhai". Hinglish mein baat karo. Short answers. Never "As an AI".`
    );

    // Load user-saved API keys from localStorage → send to server
    const clientKeys: Record<string, string> = {}
    if (typeof window !== 'undefined') {
      const keyNames = ['GROQ_API_KEY','GEMINI_API_KEY','CEREBRAS_API_KEY','TOGETHER_API_KEY','MISTRAL_API_KEY','COHERE_API_KEY','FIREWORKS_API_KEY','OPENROUTER_API_KEY','DEEPINFRA_API_KEY','HUGGINGFACE_API_KEY']
      keyNames.forEach(k => { const v = localStorage.getItem(`jarvis_key_${k}`); if (v) clientKeys[k] = v })
    }

    const history = msgs.slice(-8).map(m => ({ role: m.role, content: m.content }));

    // Web search injection — for factual/search queries, fetch real data first
    const searchTrigger = /latest|news|khabar|price|stock|weather|score|result|who is|kya hai|batao|search|find|current|today|2024|2025/.test(text.toLowerCase())
    let searchContext = ''
    if (searchTrigger && text.length > 5) {
      try {
        const sr = await fetch('/api/search?q=' + encodeURIComponent(text.slice(0, 100)), { signal: AbortSignal.timeout(4000) })
        const sd = await sr.json()
        if (sd.results?.length) {
          const topResults = sd.results.slice(0, 3).map((r: any) => '[' + r.source + '] ' + r.title + ': ' + (r.text || '').slice(0, 200)).join(' | ')
          searchContext = ' [SEARCH: ' + topResults + ']'
        }
      } catch {}
    }

    history.push({ role: 'user', content: text.trim() + searchContext });

    const eMode = mode === 'auto' ? autoRouteMode(text) : mode;

    const assistantId = `a_${Date.now()}`;
    let fullText = '', card: any = null, provider = '';

    const _widget = text.trim();
    setMsgs(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now(), widget: _widget }]);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const endpoint = eMode === 'deep' ? '/api/jarvis/deep-stream' : '/api/stream';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, mode: eMode, sessionId, location, systemPrompt, clientKeys }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error('Stream failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.type === 'delta') {
              fullText += d.text;
              setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m));
            } else if (d.type === 'card') {
              card = d.card;
              setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, card } : m));
            } else if (d.type === 'done') {
              provider = d.provider || '';
              setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, provider, content: fullText || m.content } : m));
            } else if (d.type === 'appCommand') {
              execAppCommand(d.command);
            } else if (d.type === 'error') {
              fullText = d.text;
              setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m));
            }
          } catch {}
        }
      }

      // Puter fallback if empty
      if (!fullText || fullText.length < 5) {
        const pt = await puterChat([{ role: 'system', content: 'You are JARVIS, a Hinglish AI assistant.' }, ...history]);
        fullText = pt; provider = 'Puter/GPT-4o-mini';
        setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText, provider } : m));
      }

    } catch (err: any) {
      if (err.name === 'AbortError') { setLoading(false); return; }
      try {
        const pt = await puterChat([{ role: 'system', content: 'You are JARVIS, a helpful Hinglish AI.' }, ...history]);
        fullText = pt; provider = 'Puter/GPT-4o-mini';
        setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText, provider } : m));
      } catch {
        setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, content: 'Network issue. Thodi der mein try karo! 🔄' } : m));
      }
    }

    setLoading(false);
    if (sessionId && fullText) saveMessage({ sessionId, role: 'assistant', content: fullText, timestamp: Date.now(), provider, card });

    // Post-response: [LEARN:] tags + cache for offline + processAndSave + RESULT SAVE
    if (fullText && fullText.length > 10) {
      const clean = cleanResponse(fullText);
      if (clean !== fullText) {
        setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, content: clean } : m));
      }
      cacheAIResponse(text.trim(), clean || fullText, eMode);
      processAndSave(text.trim(), fullText).catch(() => {});
      // Save substantial responses (plans, scripts, research etc) to result storage
      if (fullText.length > 150) {
        saveResult(text.trim(), clean || fullText).catch(() => {});
      }
      // Track user behavior
      trackInteraction(text.trim(), eMode).catch(() => {});
      // Proactive suggestion — JARVIS suggests without being asked
      const suggestion = getProactiveSuggestion(text.trim());
      if (suggestion) {
        setTimeout(() => {
          setMsgs(prev => [...prev, {
            id: `suggest_${Date.now()}`,
            role: 'assistant',
            content: `💡 ${suggestion}`,
            timestamp: Date.now(),
          }]);
        }, 1800);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
    if (e.key === 'Escape') setSlashOpen(false);
    if (e.key === 'Tab' && slashOpen) {
      e.preventDefault();
      const filtered = SLASH_COMMANDS.filter(c => c.cmd.includes(slashFilter));
      if (filtered[0]) { setInput(filtered[0].cmd + ' '); setSlashOpen(false); }
    }
  };
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    // Slash command autocomplete
    if (val.startsWith('/')) {
      setSlashFilter(val.toLowerCase());
      setSlashOpen(true);
    } else {
      setSlashOpen(false);
    }
  };

  if (showPin) return <PinLock onUnlock={() => setShowPin(false)} />;

  return (
    <div className="page-container">

      {/* New Toast System */}
      <ToastContainer toasts={toasts} onClose={hideToast} />

      {/* Nav Drawer */}
      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />

      {/* Plus Popup */}
      {plusOpen && <PlusPopup open={plusOpen} mode={mode} onMode={setMode} onClose={() => setPlusOpen(false)} />}

      {/* Chat History Sidebar */}
      <HistorySidebar open={historyOpen} onClose={() => setHistoryOpen(false)} onSelect={loadSession} currentId={sessionId} />

      {/* Connected Apps Panel */}
      <ConnectedAppsPanel open={appsOpen} onClose={() => setAppsOpen(false)} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #1e1e2e', background: 'var(--bg)' }}>
        {/* J Logo */}
        <button onClick={() => setNavOpen(true)}
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#00d4ff,#0066aa)', border: 'none', color: '#000', fontWeight: 900, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>
          J
        </button>

        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ color: '#00d4ff', fontWeight: 800, fontSize: 17, letterSpacing: 1 }}>
            JARVIS
            {!online && <span style={{ fontSize: 9, color: '#ef4444', marginLeft: 6 }}>● Offline</span>}
            {reconnected && <span style={{ fontSize: 9, color: '#22c55e', marginLeft: 6 }}>● Online</span>}
          </div>
          <div style={{ color: '#444', fontSize: 9, marginTop: 1 }}>
            {location ? '📍 ' + location : 'apple50.vercel.app · ₹0/month'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {/* Wake Word toggle */}
          <button
            onClick={() => {
              if (wakeActive) {
                stopWakeWord();
                setWakeActive(false);
                toastInfo('Wake word off');
              } else {
                const ok = startWakeWord(() => {
                  // Wake word detected — show toast + vibrate + focus
                  toastOk('🎙️ Haan boss, bol!');
                  if (typeof navigator !== 'undefined') navigator.vibrate?.(100);
                  setInput('');
                  textareaRef.current?.focus();
                });
                if (ok) { setWakeActive(true); toastOk('🎙️ Wake word active — "Hey JARVIS" bolo'); }
                else toastErr('Mic permission chahiye');
              }
            }}
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: wakeActive ? '#00d4ff' : '#555', filter: wakeActive ? 'drop-shadow(0 0 4px #00d4ff)' : 'none' }}
            title="Wake Word">🎙️</button>
          {/* Theme toggle */}
          <button onClick={() => { const t = toggleTheme(); setThemeState(t); toastInfo(`Theme: ${t}`); }}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer' }}
            title="Toggle theme">
            {theme === 'dark' ? '🌑' : theme === 'light' ? '☀️' : theme === 'amoled' ? '⬛' : '🌊'}
          </button>
          {/* Chat history */}
          <button onClick={() => setHistoryOpen(true)}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer' }}
            title="Chat History">💬</button>
          {/* Connected Apps */}
          <button onClick={() => setAppsOpen(true)}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer' }}
            title="Connected Apps">🔌</button>
          {/* Stop TTS */}
          <button onClick={() => stopSpeaking()}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer' }}
            title="Stop speaking">🔇</button>
        </div>
      </div>

      {/* PWA Install Banner */}
      {canInstall && (
        <div onClick={async () => {
          if (isIOS) {
            showToast('iOS: Share → "Add to Home Screen" karo 📲', 'info');
          } else {
            const r = await install();
            if (r === 'accepted') toastOk('✅ JARVIS installed!');
          }
        }}
          style={{ background: 'rgba(0,212,255,0.08)', borderBottom: '1px solid rgba(0,212,255,0.2)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <span style={{ fontSize: 20 }}>📲</span>
          <div>
            <div style={{ color: '#00d4ff', fontSize: 12, fontWeight: 600 }}>JARVIS Install karo</div>
            <div style={{ color: '#555', fontSize: 10 }}>Home screen pe add karo — faster, offline ready</div>
          </div>
          <span style={{ marginLeft: 'auto', color: '#00d4ff', fontSize: 12 }}>Install →</span>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {msgs.map(msg => <MsgItem key={msg.id} msg={msg} />)}
        {loading && <div style={{ padding: '0 12px' }}><TypingDots /></div>}
        <div ref={bottomRef} />
      </div>

      {/* Slash Command Autocomplete */}
      {slashOpen && (
        <div style={{ position: 'absolute', bottom: 120, left: 12, right: 12, background: '#0d0d18', border: '1px solid #1e1e2e', borderRadius: 12, zIndex: 9000, maxHeight: 220, overflowY: 'auto', boxShadow: '0 -4px 20px rgba(0,0,0,0.5)' }}>
          <div style={{ padding: '6px 12px', color: '#444', fontSize: 10, borderBottom: '1px solid #1a1a2a' }}>⚡ Slash Commands — Tab se select karo</div>
          {SLASH_COMMANDS.filter(c => c.cmd.startsWith(slashFilter) || c.desc.toLowerCase().includes(slashFilter.slice(1))).slice(0, 8).map(c => (
            <button key={c.cmd}
              onClick={() => { setInput(c.cmd + ' '); setSlashOpen(false); textareaRef.current?.focus(); }}
              style={{ width: '100%', background: 'none', border: 'none', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderBottom: '1px solid #0f0f18', textAlign: 'left' }}>
              <span style={{ fontSize: 16 }}>{c.icon}</span>
              <div>
                <div style={{ color: '#00d4ff', fontSize: 12, fontFamily: 'monospace' }}>{c.cmd}</div>
                <div style={{ color: '#444', fontSize: 10 }}>{c.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Bottom strip — Compress = USER ka typed message compress karo */}
      <div className="bottom-strip">
        <span style={{ fontSize: 11, color: '#555' }}>
          {mode === 'auto'
            ? `🤖 Auto → ${effectiveMode.charAt(0).toUpperCase() + effectiveMode.slice(1)}`
            : `${mode === 'flash' ? '⚡' : mode === 'think' ? '🧠' : '🔬'} ${mode.charAt(0).toUpperCase() + mode.slice(1)}`}
        </span>

        {/* Compress dropdown — input mein likhi hua shorten karo */}
        {input.trim().length > 20 && (
          <div style={{ display: 'flex', gap: 4 }}>
            <span style={{ color: '#444', fontSize: 10, alignSelf: 'center' }}>🗜️</span>
            {(['tiny', 'short', 'medium'] as CompressLevel[]).map(level => (
              <button
                key={level}
                onClick={() => {
                  const compressed = compressUserMessage(input, level);
                  setInput(compressed);
                  toastInfo(`✂️ ${level}: ${compressed.split(' ').length} words`);
                }}
                style={{
                  background: 'none', border: '1px solid #2a2a4a',
                  borderRadius: 6, color: '#555', fontSize: 10,
                  padding: '2px 7px', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {level}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Input Bar v2 — all controls inside chatbox ── */}
      <div style={{ padding: '8px 12px 12px', borderTop: '1px solid #1e1e2e', background: 'var(--bg)' }}>

        {/* Mode pill */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6, paddingLeft: 2 }}>
          {(['auto','flash','think','deep'] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ padding: '2px 10px', borderRadius: 20, border: `1px solid ${mode===m?'#00d4ff':'#1e1e2e'}`, background: mode===m?'rgba(0,212,255,0.12)':'transparent', color: mode===m?'#00d4ff':'#444', fontSize: 10, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s' }}>
              {m==='auto'?'🤖':m==='flash'?'⚡':m==='think'?'🧠':'🔬'} {m}
            </button>
          ))}
          <div style={{ flex:1 }} />
          <div style={{ color: '#333', fontSize: 9, alignSelf: 'center' }}>
            {wakeActive ? '🎙️ listening...' : ''}
          </div>
        </div>

        {/* Main input box */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 0,
          background: '#111118', border: `1px solid ${input.trim() ? '#00d4ff44' : '#2a2a4a'}`,
          borderRadius: 24, padding: '4px 4px 4px 8px',
          transition: 'border-color 0.2s',
          boxShadow: input.trim() ? '0 0 0 1px rgba(0,212,255,0.1)' : 'none',
        }}>

          {/* Plus — attachments / options */}
          <button
            onClick={() => { setPlusOpen(p => !p) }}
            data-plus
            title="Attachments & options"
            style={{ width: 34, height: 34, borderRadius: '50%', background: plusOpen ? 'rgba(0,212,255,0.15)' : 'transparent', border: 'none', color: plusOpen ? '#00d4ff' : '#555', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s', marginRight: 2 }}>
            {plusOpen ? '✕' : '+'}
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={loading ? '⏳ Thinking...' : 'Kuch bhi likho ya bolo...'}
            disabled={loading}
            rows={1}
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#e0e0ff', fontSize: 15, outline: 'none', resize: 'none', minHeight: 34, maxHeight: 120, lineHeight: 1.5, fontFamily: 'inherit', overflowY: 'auto', padding: '6px 4px', opacity: loading ? 0.5 : 1 }}
          />

          {/* Mic button — Voice input */}
          <button
            title="Voice input"
            onClick={() => {
              const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
              if (!SR) { toastErr('Mic nahi chala. Browser support nahi.'); return; }
              const rec = new SR();
              rec.lang = 'hi-IN'; rec.interimResults = false;
              rec.onresult = (e: any) => {
                const t = e.results[0][0].transcript;
                setInput(t);
                setTimeout(() => send(t), 300);
              };
              rec.onerror = () => toastErr('Mic error. Dobara try karo.');
              rec.start();
              toastOk('🎙️ Bol boss...');
            }}
            style={{ width: 34, height: 34, borderRadius: '50%', background: 'transparent', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'color 0.15s' }}>
            🎙️
          </button>

          {/* Send button */}
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            style={{ width: 38, height: 38, borderRadius: '50%', background: input.trim() && !loading ? 'linear-gradient(135deg,#00d4ff,#0088cc)' : '#1a1a2e', border: 'none', color: input.trim() && !loading ? '#000' : '#333', fontSize: 16, cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s', fontWeight: 900, boxShadow: input.trim() && !loading ? '0 2px 8px rgba(0,212,255,0.4)' : 'none' }}>
            {loading ? '⏳' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}
