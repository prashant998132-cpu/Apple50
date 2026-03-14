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

    // 0. Phone automation check (MacroDroid bridge)
    const autoAction = detectAutomationIntent(text);
    if (autoAction) {
      const result = await triggerMacro(autoAction);
      setMsgs(prev => [...prev,
        { id: `u_${Date.now()}`, role: 'user', content: text.trim(), timestamp: Date.now() },
        { id: `a_${Date.now()}`, role: 'assistant', content: result.msg, timestamp: Date.now() },
      ]);
      setInput('');
      return;
    }

    // 0.5 Agent mode — complex multi-step tasks
    if (isAgentIntent(text)) {
      setMsgs(prev => [...prev,
        { id: `u_${Date.now()}`, role: 'user', content: text.trim(), timestamp: Date.now() },
        { id: `a_${Date.now()}`, role: 'assistant', content: `⚡ **Agent Mode** activate ho raha hai...\n\n"${text.trim().slice(0,60)}" — yeh ek multi-step task hai. Main Agent page pe execute karunga.\n\n[👉 Agent page pe dekho →](/agent)`, timestamp: Date.now() },
      ]);
      setInput('');
      setTimeout(() => router.push(`/agent?goal=${encodeURIComponent(text.trim())}`), 1200);
      return;
    }
    const appCmd = detectAppIntent(text);
    if (appCmd) {
      execAppCommand(appCmd);
      setMsgs(prev => [...prev,
        { id: `u_${Date.now()}`, role: 'user', content: text.trim(), timestamp: Date.now() },
        { id: `a_${Date.now()}`, role: 'assistant', content: '✅ Done!', timestamp: Date.now() },
      ]);
      setInput('');
      return;
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
          <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>
            JARVIS {!online && <span style={{ fontSize: 10, color: '#ef4444', marginLeft: 4 }}>● Offline</span>}
            {reconnected && <span style={{ fontSize: 10, color: '#22c55e', marginLeft: 4 }}>● Back online</span>}
          </div>
          <div style={{ color: '#444', fontSize: 9 }}>
            {location ? `📍 ${location}` : 'v20.8 · ₹0/month'}
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

      {/* Input bar */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #1e1e2e', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <button
            onClick={() => {
              setPlusOpen(prev => !prev);
              if (!plusOpen) {
                setTimeout(() => {
                  const close = (e: MouseEvent) => {
                    if (!(e.target as Element).closest('[data-plus]')) { setPlusOpen(false); document.removeEventListener('click', close); }
                  };
                  document.addEventListener('click', close);
                }, 80);
              }
            }}
            data-plus
            style={{ width: 40, height: 40, borderRadius: '50%', background: plusOpen ? 'rgba(0,212,255,0.15)' : '#1a1a2e', border: '1px solid #2a2a4a', color: plusOpen ? '#00d4ff' : '#888', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
            +
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={loading ? 'JARVIS soch raha hai...' : 'JARVIS se kuch bhi pucho...'}
            disabled={loading}
            rows={1}
            style={{ flex: 1, background: '#111118', border: '1px solid #2a2a4a', borderRadius: 20, padding: '10px 14px', color: '#e0e0ff', fontSize: 15, outline: 'none', resize: 'none', minHeight: 40, maxHeight: 120, lineHeight: 1.4, fontFamily: 'inherit', overflowY: 'auto', opacity: loading ? 0.6 : 1 }}
          />

          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            style={{ width: 40, height: 40, borderRadius: '50%', background: input.trim() && !loading ? '#00d4ff' : '#1a1a2e', border: 'none', color: input.trim() && !loading ? '#000' : '#444', fontSize: 18, cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s', fontWeight: 700 }}>
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
