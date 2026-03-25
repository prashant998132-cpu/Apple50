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

// Agent intent keywords â yeh queries agent mode mein jayenge
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

// ââ Connected Apps config (with/without API key) ââââââââââââââââââââââââââ
const CONNECTED_APPS = [
  { id: 'groq',       icon: 'â¡', name: 'Groq',       free: true,  envKey: 'GROQ_API_KEY',    color: '#f97316' },
  { id: 'gemini',     icon: 'â¨', name: 'Gemini',     free: true,  envKey: 'GEMINI_API_KEY',   color: '#4285f4' },
  { id: 'puter',      icon: 'ð¤', name: 'Puter.js',   free: true,  envKey: null,               color: '#00d4ff' },
  { id: 'pollinations',icon:'ð¨', name: 'Pollinations',free: true, envKey: null,               color: '#a855f7' },
  { id: 'together',   icon: 'ð', name: 'Together',   free: true,  envKey: 'TOGETHER_API_KEY', color: '#22c55e' },
  { id: 'cerebras',   icon: 'ð§ ', name: 'Cerebras',   free: true,  envKey: 'CEREBRAS_API_KEY', color: '#ec4899' },
  { id: 'openrouter', icon: 'ð', name: 'OpenRouter', free: true,  envKey: 'OPENROUTER_API_KEY',color: '#f59e0b' },
  { id: 'cohere',     icon: 'ð¬', name: 'Cohere',     free: true,  envKey: 'COHERE_API_KEY',   color: '#06b6d4' },
  { id: 'wttr',       icon: 'ð¤ï¸', name: 'Weather',    free: true,  envKey: null,               color: '#38bdf8' },
  { id: 'gnews',      icon: 'ð°', name: 'GNews',      free: true,  envKey: 'GNEWS_API_KEY',    color: '#fb923c' },
];

// ââ Helper Components âââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
  const [zoomed, setZoomed] = React.useState(false);
  if (zoomed && card.imageUrl) return (
    <div onClick={() => setZoomed(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out' }}>
      <img src={card.imageUrl} alt={card.title} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:8 }} />
      <div style={{ position:'absolute', top:16, right:16, color:'#fff', fontSize:24, cursor:'pointer' }}>â</div>
      <a href={card.imageUrl} download target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
        style={{ position:'absolute', bottom:20, background:'rgba(0,212,255,0.9)', color:'#000', padding:'8px 20px', borderRadius:20, textDecoration:'none', fontWeight:700, fontSize:14 }}>
        â¬ï¸ Download
      </a>
    </div>
  );
  if (!card) return null;
  return (
    <div className="rich-card" style={{ marginTop: 8 }}>
      {card.audioUrl && (
        <audio controls src={card.audioUrl} style={{ width:'100%', borderRadius:8, marginBottom:4 }} />
      )}
      {card.imageUrl && (
        <img src={card.imageUrl} onClick={() => setZoomed(true)} style={{ cursor: "zoom-in" }} alt={card.title || ''} className="rich-card-image"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}
      <div className="rich-card-body">
        {card.title    && <div className="rich-card-title">{card.title}</div>}
        {card.subtitle && <div className="rich-card-sub">{card.subtitle}</div>}
        {card.linkUrl  && (
          <a href={card.linkUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: '#00d4ff', fontSize: 12, display: 'inline-block', marginTop: 4 }}>
            Open â
          </a>
        )}
      </div>
    </div>
  );
}

function MsgItem({ msg, onDelete, onRegenerate }: { msg: Msg; onDelete?: (id: string) => void; onRegenerate?: () => void }) {
  const isUser = msg.role === 'user';
  const [menuOpen, setMenuOpen] = React.useState(false);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLongPress = () => {
    longPressTimer.current = setTimeout(() => {
      setMenuOpen(true);
      if (typeof navigator !== 'undefined') navigator.vibrate?.(50);
    }, 500);
  };
  const cancelLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  const copy = () => { navigator.clipboard?.writeText(msg.content); setMenuOpen(false); };
  const share = () => {
    if (navigator.share) navigator.share({ text: msg.content });
    else { navigator.clipboard?.writeText(msg.content); }
    setMenuOpen(false);
  };

  return (
    <div className="fade-in" style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 12, padding: '0 12px', position: 'relative' }}>
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
      )}
      {isUser ? (
        <div onPointerDown={startLongPress} onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress}
          style={{ position: 'relative' }}>
          <div className="user-bubble">{msg.content}</div>
          {menuOpen && (
            <div style={{ position: 'absolute', bottom: '110%', right: 0, background: '#0d0d18', border: '1px solid #1e1e2e', borderRadius: 12, padding: 6, zIndex: 1000, display: 'flex', gap: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.6)', whiteSpace: 'nowrap' }}>
              {[['ð', 'Copy', copy], ['âï¸', 'Share', share], ['ð', 'Pin', () => { const pins = JSON.parse(localStorage.getItem('jarvis_pins')||'[]'); if(!pins.find((p:any)=>p.id===msg.id)){pins.unshift({id:msg.id,content:msg.content,ts:Date.now()});localStorage.setItem('jarvis_pins',JSON.stringify(pins.slice(0,10)));} setMenuOpen(false); alert('ð Pinned!'); }], ['ðï¸', 'Delete', () => { onDelete?.(msg.id); setMenuOpen(false); }]].map(([icon, label, fn]: any) => (
                <button key={label as string} onClick={fn} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '6px 10px', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: 10 }}>
                  <span style={{ fontSize: 16 }}>{icon as string}</span>{label as string}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: '90%' }} onPointerDown={startLongPress} onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress}>
          <div style={{ color: '#00d4ff', fontSize: 11, marginBottom: 2, fontWeight: 600 }}>
            JARVIS {msg.provider ? 'Â· ' + msg.provider : ''}
          </div>
          <div className="jarvis-message" style={{ position: 'relative' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
          {msg.card && <RichCard card={msg.card} />}
          {msg.widget && <CommandWidgetRenderer userText={msg.widget} aiText={msg.content} />}
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button onClick={() => speakText(msg.content)}
              style={{ background: 'none', border: 'none', color: '#333', fontSize: 12, cursor: 'pointer', padding: '2px 0' }}>ð</button>
          </div>
          {menuOpen && (
            <div style={{ position: 'absolute', left: 0, background: '#0d0d18', border: '1px solid #1e1e2e', borderRadius: 12, padding: 6, zIndex: 1000, display: 'flex', gap: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.6)', whiteSpace: 'nowrap' }}>
              {[['ð', 'Copy', copy], ['âï¸', 'Share', share], ['ð', 'Pin', () => { const pins = JSON.parse(localStorage.getItem('jarvis_pins')||'[]'); if(!pins.find((p:any)=>p.id===msg.id)){pins.unshift({id:msg.id,content:msg.content,ts:Date.now()});localStorage.setItem('jarvis_pins',JSON.stringify(pins.slice(0,10)));} setMenuOpen(false); alert('ð Pinned!'); }], ['ð', 'Again', () => { onRegenerate?.(); setMenuOpen(false); }], ['ðï¸', 'Delete', () => { onDelete?.(msg.id); setMenuOpen(false); }]].map(([icon, label, fn]: any) => (
                <button key={label as string} onClick={fn} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '6px 10px', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: 10 }}>
                  <span style={{ fontSize: 16 }}>{icon as string}</span>{label as string}
                </button>
              ))}
            </div>
          )}
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
  return null; // Handled inline in input bar
}

// ââ Chat History Sidebar ââââââââââââââââââââââââââââââââââââââââââââââââââ
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
          <span style={{ color: '#00d4ff', fontWeight: 700 }}>ð¬ Chat History</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>â</button>
        </div>
        {sessions.length === 0 && <div style={{ color: '#444', fontSize: 13 }}>Koi history nahi abhi.</div>}
        {sessions.map(s => (
          <button key={s.sessionId} onClick={() => { onSelect(s.sessionId); onClose(); }}
            style={{ width: '100%', background: s.sessionId === currentId ? 'rgba(0,212,255,0.1)' : '#111118', border: s.sessionId === currentId ? '1px solid #00d4ff' : '1px solid #1e1e2e', borderRadius: 10, padding: '10px 12px', marginBottom: 8, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ color: '#e0e0ff', fontSize: 13, marginBottom: 2 }}>{s.title || 'Untitled Chat'}</div>
            <div style={{ color: '#444', fontSize: 10 }}>{s.messageCount} msgs Â· {new Date(s.updatedAt).toLocaleDateString('en-IN')}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ââ Connected Apps Panel âââââââââââââââââââââââââââââââââââââââââââââââââââ
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
          <span style={{ color: '#00d4ff', fontWeight: 700 }}>ð Connected Apps</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer' }}>â</button>
        </div>

        {/* Without API key (always connected) */}
        <div style={{ color: '#555', fontSize: 10, marginBottom: 8, letterSpacing: 1 }}>â ALWAYS CONNECTED (No API Key)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
          {CONNECTED_APPS.filter(a => !a.envKey).map(app => (
            <div key={app.id} style={{ background: '#111118', border: `1px solid ${app.color}33`, borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 22 }}>{app.icon}</div>
              <div style={{ color: app.color, fontSize: 10, marginTop: 3 }}>{app.name}</div>
              <div style={{ color: '#22c55e', fontSize: 9, marginTop: 1 }}>â Live</div>
            </div>
          ))}
        </div>

        {/* With API key */}
        <div style={{ color: '#555', fontSize: 10, marginBottom: 8, letterSpacing: 1 }}>ð WITH API KEY</div>
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
                <span style={{ fontSize: 10, color: hasKey ? '#22c55e' : '#ef4444' }}>{hasKey ? 'â Connected' : 'â No Key'}</span>
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

// ââ Main Page âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
  const [refreshing, setRefreshing] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = React.useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecRef = React.useRef<MediaRecorder | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [chatBg, setChatBg] = React.useState<string>('none');
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const bgId = localStorage.getItem('jarvis_chat_bg') || 'none';
    const bgMap: Record<string,string> = {
      none: 'none',
      gradient1: 'linear-gradient(135deg,#0a0a1a,#0d1f2d)',
      gradient2: 'linear-gradient(135deg,#0a0a1a,#1a0a2e)',
      gradient3: 'linear-gradient(135deg,#0a1a0a,#0d2d0d)',
      gradient4: 'linear-gradient(135deg,#1a0a0a,#2d1a0a)',
      gradient5: 'linear-gradient(135deg,#0a0f1a,#0a1a2d)',
      dots: 'radial-gradient(circle,#00d4ff22 1px,transparent 1px) 0 0 / 20px 20px #060610',
      grid: 'linear-gradient(#00d4ff11 1px,transparent 1px) 0 0 / 30px 30px, linear-gradient(90deg,#00d4ff11 1px,transparent 1px) 0 0 / 30px 30px #060610',
      stars: 'radial-gradient(circle,#ffffff33 1px,transparent 1px) 0 0 / 40px 40px #060610',
    };
    setChatBg(bgMap[bgId] || 'none');
    // Listen for storage changes (settings page se)
    const onStorage = () => {
      const id = localStorage.getItem('jarvis_chat_bg') || 'none';
      setChatBg(bgMap[id] || 'none');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const [pinnedMsgs, setPinnedMsgs] = useState<string[]>([]);  // pinned message ids

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef    = useRef<AbortController | null>(null);

  const { toasts, hideToast, toastOk, toastErr, toastInfo, showToast } = useToast();
  const { canInstall, isIOS, install } = usePWA();
  const { online, reconnected } = useOnlineStatus();

  const effectiveMode = mode === 'auto' ? autoRouteMode(input) : mode;

  // ââ Global keyboard shortcuts âââââââââââââââââââââââââââââââââââââââââââ
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      // 'j' or '/' to focus input (when not already typing)
      if ((e.key === 'j') && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
      // Escape to close any open panel
      if (e.key === 'Escape') {
        setHeaderMenuOpen(false);
        setPlusOpen(false);
        setSlashOpen(false);
        setHistoryOpen(false);
        setAppsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ââ Keyboard / Viewport fix (Android) âââââââââââââââââââââââââââââââââââ
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = (window as any).visualViewport;
    if (!vv) return;
    const onResize = () => {
      const offset = window.innerHeight - vv.height;
      document.documentElement.style.setProperty('--keyboard-offset', offset + 'px');
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // ââ Init âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

    // Location â onboarding se pehle, phir GPS
    const savedCity = typeof window !== 'undefined' ? localStorage.getItem('jarvis_city') || localStorage.getItem('jarvis_user_city') : '';
    if (savedCity) {
      setLocation(savedCity);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        try {
          const res = await fetch('https://nominatim.openstreetmap.org/reverse?lat=' + pos.coords.latitude + '&lon=' + pos.coords.longitude + '&format=json&zoom=10&addressdetails=1');
          const d = await res.json();
          // Prefer district/city over small village
          const city = d?.address?.city || d?.address?.county || d?.address?.state_district || d?.address?.town || d?.address?.village || '';
          if (city) { setLocation(city); }
        } catch {}
      }, () => {});
    }

    // Reminders
    // ââ PROACTIVE JARVIS ENGINE âââââââââââââââââââââââââââââââââ
    // JARVIS khud sochta hai aur bolta hai â poochho mat
    const proactiveEngine = setInterval(async () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const todayStr = now.toDateString();
      if (typeof window === 'undefined') return;

      // Last proactive message timestamp â spam mat karo
      const lastProactive = parseInt(localStorage.getItem('jarvis_last_proactive') || '0');
      const sinceLastMin = (Date.now() - lastProactive) / 60000;

      // ââ Night sleep reminder âââââââââââââââââââââââââââââââââ
      if (h === 23 && m >= 0 && m <= 10 && sinceLastMin > 120) {
        localStorage.setItem('jarvis_last_proactive', String(Date.now()));
        setMsgs(prev => [...prev, { id: 'proactive_' + Date.now(), role: 'assistant', content: 'ð Raat ke 11 baj gaye boss. Neend jaao â kal fresh mind se kaam karo. Koi kaam reh gaya hai kya?', timestamp: Date.now() }]);
      }

      // ââ Morning energy âââââââââââââââââââââââââââââââââââââââ
      if (h === 6 && m >= 0 && m <= 10 && sinceLastMin > 300) {
        localStorage.setItem('jarvis_last_proactive', String(Date.now()));
        const habits = JSON.parse(localStorage.getItem('jarvis_habits') || '{}');
        const pending = Object.keys(habits).filter(k => habits[k].lastDate !== todayStr);
        const msg = pending.length > 0
          ? 'âï¸ Good morning boss! Aaj ' + pending.slice(0,2).join(', ') + ' karna mat bhuolna. Ek kaam pehle decide karo â kaunsa sabse important hai?'
          : 'âï¸ Good morning boss! Naya din, naye mauke. Kya plan hai aaj ka?';
        setMsgs(prev => [...prev, { id: 'proactive_' + Date.now(), role: 'assistant', content: msg, timestamp: Date.now() }]);
      }

      // ââ Reminder warning (30 min before) âââââââââââââââââââ
      try {
        const { getReminders: getAllReminders } = await import('@/lib/reminders');
        const reminders = getAllReminders();
        const soon = (reminders as any[]).filter((r: any) => !r.completed && r.time > Date.now() && r.time < Date.now() + 30 * 60 * 1000);
        if (soon.length > 0 && sinceLastMin > 25) {
          localStorage.setItem('jarvis_last_proactive', String(Date.now()));
          const r = soon[0] as any;
          const minsLeft = Math.round((r.time - Date.now()) / 60000);
          setMsgs(prev => [...prev, { id: 'proactive_reminder_' + r.id, role: 'assistant', content: 'â° Boss! "' + r.title + '" â ' + minsLeft + ' minute mein hai. Ready ho jaao.', timestamp: Date.now() }]);
        }
      } catch {}

      // ââ Habit nudge (afternoon if not done) âââââââââââââââââ
      if (h >= 14 && h <= 15 && sinceLastMin > 240) {
        const habits = JSON.parse(localStorage.getItem('jarvis_habits') || '{}');
        const pending = Object.keys(habits).filter(k => habits[k].lastDate !== todayStr && habits[k].streak > 2);
        if (pending.length > 0) {
          localStorage.setItem('jarvis_last_proactive', String(Date.now()));
          setMsgs(prev => [...prev, { id: 'proactive_habit_' + Date.now(), role: 'assistant', content: 'ðª Boss! ' + pending[0] + ' aaj abhi tak nahi kiya â streak toot jaayegi. Abhi karo ya baad mein?', timestamp: Date.now() }]);
        }
      }

    }, 5 * 60 * 1000); // Check every 5 minutes (battery friendly)

    const ri = setInterval(() => {
      // Morning brief â schedule 7am notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        const now = new Date();
        const next7am = new Date();
        next7am.setHours(7, 0, 0, 0);
        if (next7am <= now) next7am.setDate(next7am.getDate() + 1);
        const msUntil7am = next7am.getTime() - now.getTime();
        const briefTimer = setTimeout(async () => {
          try {
            const { getAllGoals, getStreak } = await import('@/lib/db');
            const { getReminders } = await import('@/lib/reminders');
            const goals = await getAllGoals();
            const streak = getStreak();
            const rems = getReminders().filter((r: any) => !r.fired && r.fireAt > Date.now());
            const body = 'Goals: ' + goals.filter((g: any) => !g.completed).length + ' active | Reminders: ' + rems.length + ' | Streak: ' + streak.current + ' days';
            const reg = await navigator.serviceWorker?.ready;
            if (reg?.showNotification) {
              reg.showNotification('ð Good Morning! JARVIS Brief', { body, icon: '/icons/icon-192.png', tag: 'morning-brief', data: { url: '/briefing' } });
            }
          } catch {}
        }, msUntil7am);
        return () => clearTimeout(briefTimer);
      }

      // Battery alert check
      checkBatteryAlert((msg) => {
        setMsgs(prev => [...prev, {
          id: 'battery_' + Date.now(), role: 'assistant', content: 'â¡ ' + msg, timestamp: Date.now(),
        }])
      }).catch(() => {})

      // Request notification permission silently
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {})
      }

      checkAndFireReminders(r => {
        showToast(`â° ${r.message}`, 'ok', 'â°');
        speakText(`Reminder: ${r.message}`);
      });
    }, 30000);

    // Proactive check (once on load)
    // Smart contextual greeting on load
    const initGreeting = async () => {
      try {
        const { getSmartGreeting } = await import('@/lib/db');
        const smart = await getSmartGreeting();
        if (smart) {
          setMsgs([{ id: 'init_smart', role: 'assistant', content: smart, timestamp: Date.now() }]);
          return;
        }
      } catch {}
      const h = new Date().getHours();
      const hour = h;
      const greetLine = hour < 5 ? 'ð Raat gehra hai boss. Kya chal raha hai?' :
        hour < 12 ? 'âï¸ Good morning boss! Aaj kya plan hai?' :
        hour < 14 ? 'ð½ï¸ Lunch time boss! Khaana khaya?' :
        hour < 17 ? 'ð Kya haal hai boss?' :
        hour < 20 ? 'ð Shaam ho gayi. Din kaisa raha?' :
        'ð Raat ho gayi boss. Kya chal raha hai?';

      // Get user name from onboarding
      const userName = typeof window !== 'undefined' ? localStorage.getItem('jarvis_user_name') || '' : '';
      const greeting = userName ? greetLine.replace('boss', userName + ' boss') : greetLine;

      // Check pending reminders
      const todayStr = new Date().toDateString();
      const habits = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('jarvis_habits') || '{}') : {};
      const habitCount = Object.keys(habits).length;
      const todayHabits = Object.values(habits as Record<string,any>).filter((h:any) => h.lastDate === todayStr).length;
      
      let proactive = '';
      if (habitCount > 0 && todayHabits < habitCount) {
        proactive = '\n\nð¡ _' + (habitCount - todayHabits) + ' habits pending aaj â "habit dikhao" type karo_';
      }

      setMsgs([{ id: 'init_greet', role: 'assistant', content: greeting + '\n\nKuch bhi bol â main hoon.' + proactive + '\n\n`mausam` Â· `battery` Â· `image bana: kuch` Â· `/` sab commands', timestamp: Date.now() }]);
    };
    initGreeting();

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
      const baseWelcome = `Kya haal hai! Main **JARVIS** hun ð¤\n\nHinglish mein bol, main samajh lunga. Slash commands: \`/nasa\` \`/joke\` \`/wiki topic\` \`/shayari\``;
      setMsgs([{
        id: 'welcome', role: 'assistant', timestamp: Date.now(),
        content: smartGreet ? `${smartGreet}\n\n_Kuch naya poochna ho toh bhi bol._` : baseWelcome,
      }]);
    }).catch(() => {
      setMsgs([{
        id: 'welcome', role: 'assistant', timestamp: Date.now(),
        content: `Kya haal hai! Main **JARVIS** hun ð¤\n\nHinglish mein bol, main samajh lunga. \`/nasa\` \`/joke\` \`/wiki topic\` try karo!`,
      }]);
    });

    return () => clearInterval(ri);
  }, []);

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, loading]);

  // ââ Load session history âââââââââââââââââââââââââââââââââââââââââââââââ
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

  // ââ App Commands â full controller ââââââââââââââââââââââââââââââââââââ
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

  // ââ Session title generation (instant keyword â Groq background) ââââââ
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
    if (/exam|biology|chemistry|physics/.test(m)) return 'ð exam';
    if (/weather|mausam/.test(m)) return 'ð¤ï¸ Weather';
    if (/image|generate|draw/.test(m)) return 'ð¨ AI Image';
    if (/code|program/.test(m)) return 'ð» Code';
    if (/crypto|bitcoin|stock/.test(m)) return 'ð° Finance';
    if (/news|khabar/.test(m)) return 'ð° News';
    return msg.split(' ').slice(0, 4).join(' ') || 'New Chat';
  }

  // ââ Send message ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    // ââ CONTEXT CHAIN âââââââââââââââââââââââââââââââââââââââââââââ
    // JARVIS last person/topic yaad rakhta hai
    if (typeof window !== 'undefined') {
      // Save context if person mentioned
      const personMatch = text.match(/^(.+?)\s+ko\s+(?:call|whatsapp|message|bol|bata)/i);
      if (personMatch) localStorage.setItem('jarvis_last_person', personMatch[1].trim());
      
      // Resolve "unhe/usse/unko" with context
      const withContext = text.replace(/(?:unhe|usse|unko|isko|inhe)/gi, () => {
        return localStorage.getItem('jarvis_last_person') || 'unhe';
      });
      if (withContext !== text) {
        // Show resolved context briefly
        const resolved = localStorage.getItem('jarvis_last_person');
        if (resolved) toastInfo('ð¤ Context: ' + resolved);
      }
    }

    // Don't send bare "/" â show slash commands instead
    if (text.trim() === '/') {
      setSlashOpen(true);
      setSlashFilter('/');
      return;
    }

    // Agent mode trigger â "agent: goal" or "â¡ goal"
    if (/^(?:agent|â¡|auto)[:\s]+(.+)/i.test(text) || /^jarvis\s+(?:khud|automatically|auto)\s+(.+)/i.test(text)) {
      const goal = text.replace(/^(?:agent|â¡|auto|jarvis\s+(?:khud|automatically|auto))[:\s]+/i, '').trim();
      router.push('/agent?goal=' + encodeURIComponent(goal));
      setInput('');
      return;
    }
    setPlusOpen(false);

    // ââ JARVIS Chat Command Center âââââââââââââââââââââââââââââ
    const t = text.trim().toLowerCase();
    const reply = (msg: string) => {
      setMsgs(prev => [...prev,
        { id: 'u_' + Date.now(), role: 'user', content: text.trim(), timestamp: Date.now() },
        { id: 'a_' + Date.now(), role: 'assistant', content: msg, timestamp: Date.now() },
      ]);
      setInput('');
    };

    // ââ GPS LOCATION ââââââââââââââââââââââââââââââââââââââââââââ
    if (/(?:meri|my|exact|precise)\s+(?:location|jagah|position|gps)|gps\s+(?:on|check|batao)/i.test(t)) {
      try {
        const { getGPSLocation } = await import('@/lib/browser/powers');
        const loc = await getGPSLocation();
        if (loc) {
          reply('ð **Exact Location:**\nLat: ' + loc.lat.toFixed(6) + '\nLng: ' + loc.lng.toFixed(6) + '\nAccuracy: ' + loc.accuracy.toFixed(0) + 'm' + (loc.city ? '\nCity: ' + loc.city : '') + '\n\n[Maps pe dekho](https://maps.google.com/?q=' + loc.lat + ',' + loc.lng + ')');
        } else { reply('ð GPS permission do ya enable karo.'); }
        return;
      } catch { reply('GPS nahi mila.'); return; }
    }

    // ââ NETWORK STATUS âââââââââââââââââââââââââââââââââââââââââââ
    if (/network|internet.*speed|connection.*type|wifi.*speed|data.*speed/i.test(t)) {
      const { getNetworkInfo } = await import('@/lib/browser/powers');
      const net = getNetworkInfo();
      reply('ð¶ **Network Status:**\n' +
        'â¢ Online: ' + (net.online ? 'â Yes' : 'â No') + '\n' +
        'â¢ Type: ' + net.type.toUpperCase() + '\n' +
        'â¢ Speed: ' + net.speed + '\n' +
        'â¢ Latency: ' + net.rtt);
      return;
    }

    // ââ CLIPBOARD ââââââââââââââââââââââââââââââââââââââââââââââââ
    if (/clipboard.*kya hai|clipboard.*padho|copy.*kya hai|paste.*kya/i.test(t)) {
      const { readClipboard } = await import('@/lib/browser/powers');
      const text2 = await readClipboard();
      if (text2) reply('ð **Clipboard:**\n"' + text2.slice(0, 200) + (text2.length > 200 ? '...' : '') + '"');
      else reply('ð Clipboard empty hai ya permission nahi.');
      return;
    }

    // ââ SCREEN WAKE LOCK âââââââââââââââââââââââââââââââââââââââââ
    if (/screen.*on|screen.*jag|jaag.*raho|wake.*lock|screen.*band.*mat/i.test(t)) {
      const { keepScreenOn } = await import('@/lib/browser/powers');
      const ok = await keepScreenOn(true);
      reply(ok ? 'ð Screen ON rakhunga â band nahi hogi.' : 'ð Wake Lock support nahi is browser mein.');
      return;
    }
    if (/screen.*off|screen.*band|wake.*lock.*off/i.test(t)) {
      const { keepScreenOn } = await import('@/lib/browser/powers');
      await keepScreenOn(false);
      reply('ð Screen auto-off normal ho gayi.'); return;
    }

    // ââ FULLSCREEN âââââââââââââââââââââââââââââââââââââââââââââââ
    if (/fullscreen|full.*screen|poora.*screen/i.test(t)) {
      const { toggleFullscreen } = await import('@/lib/browser/powers');
      const isFullscreen = await toggleFullscreen();
      reply(isFullscreen ? 'â¶ Fullscreen mode ON!' : 'â¶ Fullscreen OFF.'); return;
    }

    // ââ STORAGE INFO âââââââââââââââââââââââââââââââââââââââââââââ
    if (/storage|jagah.*kitna|memory.*kitna|phone.*storage.*check/i.test(t)) {
      const [{ getStorageInfo }, { getBatteryInfo }] = await Promise.all([
        import('@/lib/browser/powers'), import('@/lib/browser/powers')
      ]);
      const [storage, battery] = await Promise.all([getStorageInfo(), getBatteryInfo()]);
      let reply_text = 'ð¾ **Device Status:**\n';
      if (battery) reply_text += 'ð Battery: ' + battery.level + '%' + (battery.charging ? ' â¡' : '') + '\n';
      if (storage) reply_text += 'ð¾ Storage used: ' + storage.used + ' (' + storage.percent + '%)\nFree: ' + storage.available + '\n';
      reply(reply_text); return;
    }

    // ââ PERMISSIONS CHECK ââââââââââââââââââââââââââââââââââââââââ
    if (/permissions|permission.*check|konsi.*permission|permission.*status/i.test(t)) {
      const { checkPermissions } = await import('@/lib/browser/powers');
      const perms = await checkPermissions();
      const icons: Record<string,string> = { camera:'ð·', microphone:'ðï¸', geolocation:'ð', notifications:'ð' };
      const statusIcons: Record<string,string> = { granted:'â', denied:'â', prompt:'â ï¸', unknown:'â' };
      reply('ð **App Permissions:**\n' + Object.entries(perms).map(([k,v]) => (icons[k]||'â¢') + ' ' + k + ': ' + (statusIcons[v]||v)).join('\n'));
      return;
    }

    // ââ DEVICE INFO ââââââââââââââââââââââââââââââââââââââââââââââ
    if (/device info|phone info|device.*details|mera.*phone.*kya/i.test(t)) {
      const { getDeviceInfo, getNetworkInfo } = await import('@/lib/browser/powers');
      const dev = getDeviceInfo();
      const net = getNetworkInfo();
      reply('ð± **Device Info:**\n' +
        'ð¥ï¸ Screen: ' + dev.screen + ' (DPR: ' + dev.dpr + ')\n' +
        'âï¸ CPU Cores: ' + dev.cores + '\n' +
        'ð¾ RAM: ' + dev.memory + '\n' +
        'ð Touch: ' + dev.touch + '\n' +
        'ð Language: ' + dev.language + '\n' +
        'ð² PWA: ' + dev.pwa + '\n' +
        'ð¶ Network: ' + net.type.toUpperCase() + ' Â· ' + net.speed);
      return;
    }

    // ââ NATIVE SHARE âââââââââââââââââââââââââââââââââââââââââââââ
    if (/^(?:share|share karo)\s+(.+)/i.test(text)) {
      const shareText = text.replace(/^(?:share|share karo)\s+/i,'').trim();
      const { nativeShare } = await import('@/lib/browser/powers');
      const ok = await nativeShare('JARVIS', shareText);
      if (!ok) { navigator.clipboard?.writeText(shareText); reply('ð¤ Copy kar liya â share manually karo.'); }
      else reply('ð¤ Sharing...');
      return;
    }

    // ââ VIBRATE PATTERN ââââââââââââââââââââââââââââââââââââââââââ
    if (/vibrate|buzz|haptic/i.test(t) && /pattern|custom|baar|times/i.test(t)) {
      const { vibrate } = await import('@/lib/browser/powers');
      vibrate([200,100,200,100,400]);
      reply('ð³ Custom vibration pattern!'); return;
    }

    // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
    // ââ JARVIS PHONE CONTROL CENTER âââââââââââââââââââââââââââââ
    // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

    // ââ CALL COMMAND âââââââââââââââââââââââââââââââââââââââââââââ
    const callMatch = text.match(/(?:call|phone|ring|baat karo?)\s+(?:karo?\s+)?(?:on\s+)?([+\d\s]{8,15})/i)
      || text.match(/(\+?91\s*[6-9]\d{9})\s+(?:pe|ko|par)\s+(?:call|phone)/i);
    const contactCallMatch = text.match(/(.+?)\s+ko\s+(?:call|phone)\s+karo?/i)
      || text.match(/(?:call|ring)\s+(.+?)(?:\s+ko)?$/i);
    
    if (callMatch?.[1]) {
      const num = callMatch[1].replace(/\s/g,'');
      if (typeof window !== 'undefined') window.location.href = 'tel:' + num;
      reply('ð Calling ' + num + '...'); return;
    }
    if (contactCallMatch?.[1] && !callMatch) {
      const name = contactCallMatch[1].trim().toLowerCase();
      if (typeof window !== 'undefined') {
        const contacts = JSON.parse(localStorage.getItem('jarvis_contacts') || '{}');
        const num = contacts[name];
        if (num) {
          window.location.href = 'tel:' + num;
          reply('ð ' + contactCallMatch[1] + ' ko call kar raha hoon (' + num + ')...'); return;
        }
      }
      reply('ð ' + contactCallMatch[1] + ' ka number nahi pata. Pehle batao: "' + contactCallMatch[1] + ' ka number hai XXXXXXXXXX"'); return;
    }

    // ââ WHATSAPP SEND âââââââââââââââââââââââââââââââââââââââââââââ
    const waNumMatch = text.match(/(?:whatsapp|wa)\s+(?:bhejo?|send|karo?)\s+([+\d\s]{10,15})\s+(?:ko\s+)?(.+)/i);
    const waContactMatch = text.match(/(?:whatsapp|wa)\s+(?:pe\s+)?(.+?)\s+ko\s+(?:bhejo?|likho|msg|message)\s+(?:ki\s+|ke\s+)?(.+)/i)
      || text.match(/(.+?)\s+ko\s+whatsapp\s+(?:karo?|bhejo?|likho)\s*[:-]?\s*(.+)/i);
    
    if (waNumMatch) {
      const { sendWhatsApp } = await import('@/lib/control/phoneControl');
      sendWhatsApp(waNumMatch[1], waNumMatch[2]);
      reply('ð¬ WhatsApp bhej raha hoon: "' + waNumMatch[2].slice(0,50) + '"'); return;
    }
    if (waContactMatch) {
      const name = waContactMatch[1].trim().toLowerCase();
      const msg = waContactMatch[2].trim();
      if (typeof window !== 'undefined') {
        const contacts = JSON.parse(localStorage.getItem('jarvis_contacts') || '{}');
        const num = contacts[name];
        if (num) {
          const { sendWhatsApp } = await import('@/lib/control/phoneControl');
          sendWhatsApp(num, msg);
          reply('ð¬ ' + waContactMatch[1] + ' ko WhatsApp: "' + msg + '"'); return;
        }
      }
      // No number â open WhatsApp with just message
      if (typeof window !== 'undefined') window.location.href = 'whatsapp://send?text=' + encodeURIComponent(msg);
      reply('ð¬ WhatsApp khola â message ready: "' + msg + '"'); return;
    }

    // ââ SMS SEND ââââââââââââââââââââââââââââââââââââââââââââââââââ
    const smsMatch = text.match(/(?:sms|text|message)\s+(?:bhejo?\s+)?([+\d\s]{10,15})\s+(?:ko\s+)?(.+)/i);
    if (smsMatch) {
      const { sendSMS } = await import('@/lib/control/phoneControl');
      sendSMS(smsMatch[1], smsMatch[2]);
      reply('ð± SMS bhej raha hoon...'); return;
    }

    // ââ SET ALARM âââââââââââââââââââââââââââââââââââââââââââââââââ
    const alarmMatch = text.match(/(?:alarm|wake|uthao|jagao)\s+(?:kal\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:baj[ae]?|am|pm|:00)?/i)
      || text.match(/(\d{1,2})(?::(\d{2}))?\s*(?:baj[ae]?|am|pm)\s+(?:ka\s+)?(?:alarm|wake)/i);
    if (alarmMatch) {
      let hr = parseInt(alarmMatch[1]);
      const mn = parseInt(alarmMatch[2] || '0');
      if (/pm/i.test(text) && hr < 12) hr += 12;
      if (/am/i.test(text) && hr === 12) hr = 0;
      const { setAlarm } = await import('@/lib/control/phoneControl');
      setAlarm(hr, mn, 'JARVIS Alarm');
      reply('â° Alarm set: ' + String(hr).padStart(2,'0') + ':' + String(mn).padStart(2,'0') + ' baje!'); return;
    }

    // ââ NAVIGATE / DIRECTIONS âââââââââââââââââââââââââââââââââââââ
    const navMatch = text.match(/(?:navigate|directions?|rasta|jao|chalte hain|maps)\s+(?:to\s+|pe\s+|mein\s+)?(.+)/i)
      || text.match(/(.+?)\s+(?:ka rasta|kaise jaun|direction|navigate karo)/i);
    if (navMatch) {
      const dest = navMatch[1].trim();
      const { navigateTo } = await import('@/lib/control/phoneControl');
      navigateTo(dest);
      reply('ðºï¸ "' + dest + '" navigate kar raha hoon boss!'); return;
    }

    // ââ YOUTUBE SEARCH ââââââââââââââââââââââââââââââââââââââââââââ
    const ytMatch2 = text.match(/(?:youtube|yt)\s+(?:pe\s+|mein\s+)?(?:search|play|chalao|dekho|dhundho)\s+(.+)/i)
      || text.match(/(.+?)\s+(?:youtube|yt)\s+(?:pe\s+)?(?:search|play|chalao|dekho)/i)
      || text.match(/^play\s+(.+)/i);
    if (ytMatch2) {
      const q = ytMatch2[1].trim();
      if (typeof window !== 'undefined') window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(q), '_blank');
      reply('â¶ï¸ YouTube pe "' + q + '" search kar raha hoon!'); return;
    }

    // ââ SPOTIFY SEARCH ââââââââââââââââââââââââââââââââââââââââââââ
    const spotifyMatch = text.match(/(?:spotify|music)\s+(?:pe\s+)?(?:play|chalao|search)\s+(.+)/i);
    if (spotifyMatch) {
      const q = spotifyMatch[1].trim();
      if (typeof window !== 'undefined') window.location.href = 'spotify:search:' + encodeURIComponent(q);
      reply('ðµ Spotify pe "' + q + '" chal raha hai!'); return;
    }

    // ââ APP OPEN (enhanced) ââââââââââââââââââââââââââââââââââââââââ
    const appOpenMatch = text.match(/(?:kholo?|open|launch|start|chalo|chalao)\s+(.+?)(?:\s+app)?$/i)
      || text.match(/(.+?)\s+(?:kholo?|open|launch)\s*$/i);
    if (appOpenMatch) {
      const appName = appOpenMatch[1].trim().toLowerCase()
        .replace(/\s+app$/,'').replace(/app/,'').trim();
      const { openApp } = await import('@/lib/control/phoneControl');
      const result = openApp(appName);
      if (!result.includes('nahi pata')) { reply('ð± ' + result); return; }
    }

    // ââ SHARE ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
    const shareMatch2 = text.match(/^(?:share|share karo)\s+(.+)/i);
    if (shareMatch2) {
      const { shareContent } = await import('@/lib/control/phoneControl');
      await shareContent('JARVIS', shareMatch2[1].trim());
      reply('ð¤ Share kar raha hoon...'); return;
    }

    // ââ AI IMAGE EDIT ââââââââââââââââââââââââââââââââââââââââââââ
    const editMatch = text.match(/(?:edit|transform|change|hata do|lagao|convert)\s+(?:image|photo|pic)[:\s]+(.+)/i)
      || text.match(/image\s+(?:mein|se)\s+(.+?)\s+(?:hata do|hatao|lagao|add karo|remove|change)/i);
    if (editMatch) {
      const editPrompt = editMatch[1].trim();
      if (typeof window !== 'undefined') {
        (window as any).__jarvisEditPrompt = editPrompt;
        document.getElementById('imgEditInput')?.click();
        reply('ð¸ Photo select karo â main edit karunga: "' + editPrompt + '"');
        return;
      }
    }

    // ââ TRANSLATE âââââââââââââââââââââââââââââââââââââââââââââââââ
    if (/^(?:translate|hindi mein bol|english mein bol|anuvad)[:\s]+(.+)/i.test(text)) {
      const toTranslate = text.replace(/^(?:translate|hindi mein bol|english mein bol|anuvad)[:\s]+/i,'').trim();
      const toLang = /hindi/i.test(text) ? 'Hindi' : 'English';
      try {
        const res = await fetch('https://text.pollinations.ai/openai', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ model:'openai', messages:[{ role:'user', content:'Translate to ' + toLang + '. Only translation, no explanation: ' + toTranslate }] })
        });
        const d = await res.json();
        reply('ð **' + toLang + ' mein:**\n' + (d.choices?.[0]?.message?.content || '')); return;
      } catch { reply('Translation nahi hua.'); return; }
    }

    // ââ PASSWORD GENERATOR ââââââââââââââââââââââââââââââââââââ
    if (/password|passcode.*(?:bana|generate|chahiye)/i.test(t)) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
      let pwd = '';
      for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
      reply('ð **Strong Password:**\n`' + pwd + '`\n\nYaad nahi rahega â password manager mein save karo.'); return;
    }

    // ââ QR CODE ââââââââââââââââââââââââââââââââââââââââââââââ
    if (/qr\s*(?:code|bana|generate)/i.test(t)) {
      const qrText = text.replace(/qr\s*(?:code|bana|generate)[:\s]*/i,'').trim() || 'https://apple50.vercel.app';
      const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(qrText) + '&bgcolor=060610&color=00d4ff';
      setMsgs(prev => [...prev,
        { id: 'u_' + Date.now(), role:'user', content: text.trim(), timestamp: Date.now() },
        { id: 'a_' + Date.now(), role:'assistant', content:'ð± QR Code: "' + qrText + '"', timestamp: Date.now(), card:{ type:'image', imageUrl:qrUrl, title:'QR: '+qrText } },
      ]);
      setInput(''); return;
    }

    // ââ RANDOM PICK âââââââââââââââââââââââââââââââââââââââââââ
    if (/^(?:choose|pick|random|kya khaun|kaun sa)\s+(.+)/i.test(text)) {
      const opts = text.replace(/^(?:choose|pick|random|kya khaun|kaun sa)\s+/i,'').split(/,|\s+ya\s+|\s+or\s+/i).map(s=>s.trim()).filter(Boolean);
      if (opts.length >= 2) {
        reply('ð² **' + opts[Math.floor(Math.random()*opts.length)] + '**\n\n_(Random choice from: ' + opts.join(', ') + ')_'); return;
      }
    }

    // ââ DEEP RESEARCH MODE ââââââââââââââââââââââââââââââââââââââ
    if (/^(?:research|deep research|investigate|sab dhundho)[:\s]+(.+)/i.test(text)) {
      const topic = text.replace(/^(?:research|deep research|investigate|sab dhundho)[:\s]+/i,'').trim();
      const resId = 'a_res_' + Date.now();
      setMsgs(prev => [...prev,
        { id: 'u_' + Date.now(), role:'user', content: text.trim(), timestamp: Date.now() },
        { id: resId, role:'assistant', content:'ð¬ Deep research shuru kar raha hoon: "' + topic + '"\n\nâ³ 3-4 searches kar raha hoon...', timestamp: Date.now() },
      ]);
      setInput('');
      (async () => {
        try {
          const searches = await Promise.allSettled([
            fetch('/api/search?q=' + encodeURIComponent(topic)).then(r=>r.json()),
            fetch('/api/search?q=' + encodeURIComponent(topic + ' latest 2026')).then(r=>r.json()),
            fetch('/api/search?q=' + encodeURIComponent(topic + ' explained simply')).then(r=>r.json()),
          ]);
          const allResults = searches.flatMap((s:any) => s.status==='fulfilled' ? (s.value.results||[]) : []);
          const context = allResults.slice(0,6).map((r:any) => r.title + ': ' + (r.text||'').slice(0,200)).join('\n');
          const res = await fetch('https://text.pollinations.ai/openai', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ model:'openai', messages:[
              { role:'system', content:'You are JARVIS, a research assistant. Respond in Hinglish. Be comprehensive but concise. Use bullet points.' },
              { role:'user', content:'Research this topic comprehensively: ' + topic + '\n\nWeb search results:\n' + context + '\n\nGive a detailed research summary with key facts, insights, and conclusions.' }
            ]})
          });
          const d = await res.json();
          const result = d.choices?.[0]?.message?.content || 'Research complete.';
          setMsgs(prev => prev.map(m => m.id===resId ? {...m, content:'ð¬ **Deep Research: ' + topic + '**\n\n' + result} : m));
        } catch {
          setMsgs(prev => prev.map(m => m.id===resId ? {...m, content:'Research nahi ho saka. Retry karo.'} : m));
        }
      })();
      return;
    }

    // ââ CODE WRITER + EXPLAINER ââââââââââââââââââââââââââââââââââ
    if (/^(?:code|program|script|likhdo|write code)[:\s]+(.+)/i.test(text) || /(?:python|javascript|java|html|css|sql)\s+(?:code|program|script)\s+(?:likhdo|banao|chahiye)/i.test(t)) {
      const task = text.replace(/^(?:code|program|script|likhdo|write code)[:\s]+/i,'').trim();
      const lang = /python/i.test(t) ? 'Python' : /javascript|js/i.test(t) ? 'JavaScript' : /html/i.test(t) ? 'HTML' : /sql/i.test(t) ? 'SQL' : /java/i.test(t) ? 'Java' : 'Python';
      try {
        const res = await fetch('https://text.pollinations.ai/openai', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ model:'openai', messages:[
            { role:'system', content:'You are an expert programmer. Write clean, commented ' + lang + ' code. Add brief explanation in Hinglish after the code.' },
            { role:'user', content:'Write ' + lang + ' code for: ' + task }
          ]})
        });
        const d = await res.json();
        const code = d.choices?.[0]?.message?.content || '';
        setMsgs(prev => [...prev,
          { id:'u_'+Date.now(), role:'user', content:text.trim(), timestamp:Date.now() },
          { id:'a_'+Date.now(), role:'assistant', content:code, timestamp:Date.now() },
        ]);
        setInput(''); return;
      } catch { /* fall to AI */ }
    }

    // ââ SMART SUMMARIZE ââââââââââââââââââââââââââââââââââââââââââ
    if (/^(?:summarize|summary|saransh|short mein|tldr)[:\s]+(.+)/i.test(text) && text.length > 50) {
      const toSum = text.replace(/^(?:summarize|summary|saransh|short mein|tldr)[:\s]+/i,'').trim();
      try {
        const res = await fetch('https://text.pollinations.ai/openai', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ model:'openai', messages:[
            { role:'user', content:'Summarize in 3-4 bullet points in Hinglish, keep it short and clear:\n\n' + toSum }
          ]})
        });
        const d = await res.json();
        reply('ð **Summary:**\n' + (d.choices?.[0]?.message?.content||'')); return;
      } catch {}
    }

    // ââ WRITE ANYTHING âââââââââââââââââââââââââââââââââââââââââââ
    const writeMatch = text.match(/^(?:likho|write|draft|banao)[:\s]+(.+)/i);
    if (writeMatch) {
      const what = writeMatch[1].trim();
      try {
        const res = await fetch('https://text.pollinations.ai/openai', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ model:'openai', messages:[
            { role:'system', content:'You are JARVIS. Write in Hinglish, natural and helpful. Keep it concise unless asked for long form.' },
            { role:'user', content:'Write this for me: ' + what }
          ]})
        });
        const d = await res.json();
        const written = d.choices?.[0]?.message?.content || '';
        setMsgs(prev => [...prev,
          { id:'u_'+Date.now(), role:'user', content:text.trim(), timestamp:Date.now() },
          { id:'a_'+Date.now(), role:'assistant', content:'âï¸ ' + written, timestamp:Date.now() },
        ]);
        setInput(''); return;
      } catch {}
    }

    // ââ EXPLAIN ANYTHING ââââââââââââââââââââââââââââââââââââââââ
    if (/^(?:explain|samjhao|kya hota hai|batao kya hai)[:\s]+(.+)/i.test(text)) {
      const topic = text.replace(/^(?:explain|samjhao|kya hota hai|batao kya hai)[:\s]+/i,'').trim();
      try {
        const res = await fetch('https://text.pollinations.ai/openai', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ model:'openai', messages:[
            { role:'system', content:'Explain like talking to a smart 16-year-old. Use Hinglish. Simple examples. Max 150 words.' },
            { role:'user', content:'Explain: ' + topic }
          ]})
        });
        const d = await res.json();
        reply('ð¡ ' + (d.choices?.[0]?.message?.content||'')); return;
      } catch {}
    }

    // ââ GOALS ââââââââââââââââââââââââââââââââââââââââââââââââââ
    if (/goals?\s*(dikhao|show|list|kya hai|batao|dekho)/i.test(text) || t === 'goals' || t === 'goal') {
      try {
        const { getAllGoals } = await import('@/lib/db');
        const goals = await getAllGoals();
        const active = goals.filter((g: any) => !g.completed);
        const done = goals.filter((g: any) => g.completed);
        if (goals.length === 0) { reply('Koi goal nahi abhi. "Goal add karo: [kuch bhi]" bolo.'); return; }
        const txt = 'ð¯ **Tere Goals:**\n\n**Active (' + active.length + '):**\n' +
          active.map((g: any) => 'â¢ ' + g.title).join('\n') +
          (done.length ? '\n\n**Done (' + done.length + '):**\n' + done.slice(0,3).map((g: any) => 'â ' + g.title).join('\n') : '');
        reply(txt); return;
      } catch { reply('Goals load nahi ho sake.'); return; }
    }
    if (/^goals?\s+add[:\s]+(.+)/i.test(text) || /^add\s+goal[:\s]+(.+)/i.test(text) || /^goal[:\s]+(.+)/i.test(text)) {
      const m = text.match(/(?:goals?\s+add|add\s+goal|goal)[:\s]+(.+)/i);
      if (m?.[1]) {
        try {
          const { addGoal } = await import('@/lib/db');
          await addGoal({ title: m[1].trim(), completed: false, priority: 'medium', progress: 0, timestamp: Date.now() });
          reply('â Goal add ho gaya: **' + m[1].trim() + '**'); return;
        } catch { reply('Goal save nahi ho saka.'); return; }
      }
    }

    // ââ REMINDERS ââââââââââââââââââââââââââââââââââââââââââââââ
    if (/reminders?\s*(dikhao|show|list|kya hai|batao)/i.test(text) || t === 'reminders') {
      try {
        const { getReminders } = await import('@/lib/reminders');
        const rems = getReminders().filter((r: any) => !r.fired && r.fireAt > Date.now()).sort((a: any, b: any) => a.fireAt - b.fireAt);
        if (rems.length === 0) { reply('Koi upcoming reminder nahi. "Remind me: [kya] at [time]" bolo.'); return; }
        const txt = 'â° **Upcoming Reminders:**\n' + rems.map((r: any) => 'â¢ ' + r.message + ' â ' + new Date(r.fireAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })).join('\n');
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
        reply('â° Reminder set: **' + what.trim() + '** at **' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + '**'); return;
      } catch { reply('Reminder set nahi ho saka.'); return; }
    }

    // ââ SMART MEMORY COMMANDS ââââââââââââââââââââââââââââââââââ
    if (/^yaad rakh[oa]?:|^remember:|^note that:|^save this:/i.test(text)) {
      const fact = text.replace(/^yaad rakh[oa]?:|^remember:|^note that:|^save this:/i,'').trim()
      if (fact) {
        const { addMemory } = await import('@/lib/memory/smartMemory')
        addMemory(fact, 'fact')
        reply('ð§  Yaad kar liya: "' + fact + '"'); return
      }
    }
    if (/memory|yaadein|memories|tune kya yaad|tujhe kya pata/i.test(t) && /dikhao|show|list|kya hai|batao/i.test(t)) {
      const { getAllMemories } = await import('@/lib/memory/smartMemory')
      const mems = getAllMemories()
      if (!mems.length) { reply('Koi memory nahi abhi. "Yaad rakho: [kuch bhi]" bolo.'); return }
      reply('ð§  **Meri Memories (' + mems.length + '):**\n\n' + mems.slice(0,10).map(m => 'â¢ ' + m.content).join('\n')); return
    }
    if (/memory.*clear|sab bhool|forget everything|memory.*delete/i.test(t)) {
      const { clearAllMemory } = await import('@/lib/memory/smartMemory')
      clearAllMemory()
      reply('ð§  Sab memory clear kar di. Fresh start!'); return
    }

    // ââ NOTES ââââââââââââââââââââââââââââââââââââââââââââââââââ
    if (/^(?:note|save note|note karo|likh lo)[:\s]+(.+)/i.test(text)) {
      const m = text.match(/(?:note|save note|note karo|likh lo)[:\s]+(.+)/i);
      if (m?.[1]) {
        try {
          const { setSetting, getSetting } = await import('@/lib/db');
          const notes = await getSetting('jarvis_quick_notes').catch(() => []) as any[];
          const updated = [{ id: Date.now(), text: m[1].trim(), ts: Date.now() }, ...(Array.isArray(notes) ? notes : [])].slice(0, 50);
          await setSetting('jarvis_quick_notes', updated);
          reply('ð Note save ho gaya: **' + m[1].trim() + '**'); return;
        } catch { reply('Note save nahi ho saka.'); return; }
      }
    }
    if (/notes?\s*(dikhao|show|list|kya hai)/i.test(text) || t === 'notes') {
      try {
        const { getSetting } = await import('@/lib/db');
        const notes = await getSetting('jarvis_quick_notes').catch(() => []) as any[];
        if (!Array.isArray(notes) || notes.length === 0) { reply('Koi notes nahi. "Note: [kuch bhi]" bolo.'); return; }
        reply('ð **Recent Notes:**\n' + notes.slice(0, 5).map((n: any) => 'â¢ ' + n.text).join('\n')); return;
      } catch { reply('Notes load nahi hue.'); return; }
    }

    // ââ BATTERY ââââââââââââââââââââââââââââââââââââââââââââââââ
    if (/battery|charge|charging/i.test(t) && /kitna|check|status|level|hai|kya/i.test(t)) {
      try {
        const { getBatteryInfo } = await import('@/lib/automation/bridge');
        const bat = await getBatteryInfo();
        if (!bat) { reply('Battery info available nahi (browser support nahi).'); return; }
        const emoji = bat.level > 60 ? 'ð¢' : bat.level > 30 ? 'ð¡' : 'ð´';
        reply(emoji + ' Battery: **' + bat.level + '%**' + (bat.charging ? ' â¡ Charging' : ' (Not charging)') + (bat.level < 20 ? '\nâ ï¸ Charge lagao jaldi boss!' : '')); return;
      } catch { reply('Battery check nahi ho saka.'); return; }
    }

    // ââ CURRENCY / EXCHANGE RATE âââââââââââââââââââââââââââââââ
    const currMatch = text.match(/(\d+(?:\.\d+)?)\s*([a-z]{3})\s+(?:to|mein|ka|in)\s+([a-z]{3})/i);
    if (currMatch || /currency|exchange rate|dollar.*rupee|rupee.*dollar|euro.*inr/i.test(t)) {
      try {
        const { getCurrency } = await import('@/lib/core/freeAPIs');
        const from = (currMatch?.[2] || 'USD').toUpperCase();
        const to = (currMatch?.[3] || 'INR').toUpperCase();
        const amt = parseFloat(currMatch?.[1] || '1');
        reply(await getCurrency(amt, from, to)); return;
      } catch { reply('Currency fetch nahi ho saka.'); return; }
    }

    // ââ LIFE TIMELINE ââââââââââââââââââââââââââââââââââââââââââââ
    if (/aaj kya hua|din kaisa raha|today summary|aaj ka recap|life recap/i.test(t)) {
      const today = new Date().toDateString();
      const habits = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('jarvis_habits') || '{}' : '{}');
      const expenses = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('jarvis_expenses') || '[]' : '[]');
      const todayExp = expenses.filter((e: any) => new Date(e.ts).toDateString() === today);
      const todayHabits = Object.keys(habits).filter(k => habits[k].lastDate === today);
      const totalSpend = todayExp.reduce((s: number, e: any) => s + e.amount, 0);
      const timeline = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('jarvis_timeline') || '[]') : [];
      const todayEvents = timeline.filter((e: any) => new Date(e.ts).toDateString() === today);

      let summary = 'ð **Aaj ka din â ' + new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' }) + '**\n\n';
      if (todayHabits.length > 0) summary += 'â **Habits done:** ' + todayHabits.join(', ') + '\n';
      if (totalSpend > 0) summary += 'ð¸ **Kharcha:** â¹' + totalSpend.toLocaleString('en-IN') + ' (' + todayExp.length + ' transactions)\n';
      if (todayEvents.length > 0) summary += 'ð **Events:** ' + todayEvents.map((e: any) => e.text).join(', ') + '\n';
      const missedHabits = Object.keys(habits).filter(k => habits[k].lastDate !== today);
      if (missedHabits.length > 0) summary += 'â ï¸ **Pending:** ' + missedHabits.join(', ') + '\n';
      if (summary.length < 150) summary += '\n\nAaj ka din abhi shuru hai boss. Kya karna hai?';

      reply(summary); return;
    }

    // ââ LOG TO TIMELINE ââââââââââââââââââââââââââââââââââââââââââââ
    if (/^log[:\s]+(.+)/i.test(text) || /^note to jarvis[:\s]+(.+)/i.test(text)) {
      const event = text.replace(/^(?:log|note to jarvis)[:\s]+/i,'').trim();
      if (typeof window !== 'undefined') {
        const timeline = JSON.parse(localStorage.getItem('jarvis_timeline') || '[]');
        timeline.unshift({ text: event, ts: Date.now(), date: new Date().toLocaleDateString('en-IN') });
        localStorage.setItem('jarvis_timeline', JSON.stringify(timeline.slice(0,500)));
        reply('ð Timeline mein save kiya: "' + event + '"'); return;
      }
    }

    // ââ LIFE SCORE ââââââââââââââââââââââââââââââââââââââââââââââ
    if (/life score|aaj ka score|mera score|jarvis score|daily score/i.test(t)) {
      if (typeof window !== 'undefined') {
        const habits = JSON.parse(localStorage.getItem('jarvis_habits') || '{}');
        const expenses = JSON.parse(localStorage.getItem('jarvis_expenses') || '[]');
        const goals = JSON.parse(localStorage.getItem('jarvis_goals_cache') || '[]');
        const todayHabits = Object.values(habits as Record<string,any>).filter((h:any) => h.lastDate === new Date().toDateString()).length;
        const totalHabits = Object.keys(habits).length || 1;
        const habitScore = Math.round((todayHabits / totalHabits) * 30);
        const streakBonus = Math.min(20, Object.values(habits as Record<string,any>).reduce((s:number, h:any) => s + Math.min(5, h.streak || 0), 0));
        const activeGoals = goals.filter((g:any) => !g.completed).length;
        const goalScore = Math.max(0, 20 - activeGoals * 2);
        const todayExpenses = expenses.filter((e:any) => new Date(e.ts).toDateString() === new Date().toDateString());
        const todaySpend = todayExpenses.reduce((s:number, e:any) => s + e.amount, 0);
        const expenseScore = todaySpend < 500 ? 20 : todaySpend < 1000 ? 15 : todaySpend < 2000 ? 10 : 5;
        const total = habitScore + streakBonus + goalScore + expenseScore + 10; // 10 base
        const emoji = total >= 80 ? 'ð¥' : total >= 60 ? 'ðª' : total >= 40 ? 'ð' : 'ð´';
        reply(emoji + ' **Aaj ka Life Score: ' + total + '/100**\n\n' +
          'ð Habits today: ' + habitScore + '/30\n' +
          'ð¥ Streak bonus: ' + streakBonus + '/20\n' +
          'ð¯ Goals clarity: ' + goalScore + '/20\n' +
          'ð¸ Spending: ' + expenseScore + '/20\n' +
          'â­ Base: 10/10\n\n' +
          (total >= 80 ? 'Aaj ka din solid hai boss! ðª' : total >= 60 ? 'Achha chal raha hai, aur better ho sakta hai.' : 'Thoda aur focus karo boss!'));
        return;
      }
    }

    // ââ SMART MATH (natural language) âââââââââââââââââââââââââââ
    const smartMathPatterns = [
      { regex: /(\d+(?:\.\d+)?)\s*%\s*(?:discount|off|kam)\s+(?:on\s+|pe\s+|of\s+)?(?:rs\.?|â¹)?\s*(\d+(?:\.\d+)?)/i, fn: (m: RegExpMatchArray) => { const disc = parseFloat(m[1]); const price = parseFloat(m[2]); const saved = price * disc / 100; return 'Original: â¹' + price + '\n' + disc + '% discount = â¹' + saved.toFixed(0) + ' saved\n**Final price: â¹' + (price - saved).toFixed(0) + '**'; }},
      { regex: /(\d+(?:\.\d+)?)\s+(?:log|person|aadmi)\s+mein\s+(?:rs\.?|â¹)?\s*(\d+(?:\.\d+)?)\s+(?:barabar|divide|split|baat|share)/i, fn: (m: RegExpMatchArray) => { const people = parseFloat(m[1]); const amount = parseFloat(m[2]); return 'ð° ' + people + ' logon mein â¹' + amount + '\n**Har koi: â¹' + (amount/people).toFixed(0) + '**'; }},
      { regex: /(\d+(?:\.\d+)?)\s+(?:ghante|hour|hrs?)\s+mein\s+(\d+(?:\.\d+)?)\s+(?:km|kilometer)/i, fn: (m: RegExpMatchArray) => { const hrs = parseFloat(m[1]); const km = parseFloat(m[2]); return 'ð Speed: ' + (km/hrs).toFixed(1) + ' km/h\nAvg time for 100km: ' + (100/(km/hrs)*60).toFixed(0) + ' min'; }},
      { regex: /(\d+(?:\.\d+)?)\s+(?:rs\.?|â¹)?\s*(?:mein|per)\s+(\d+(?:\.\d+)?)\s+(?:din|day|mahina|month|saal|year)/i, fn: (m: RegExpMatchArray) => { const amount = parseFloat(m[1]); const time = parseFloat(m[2]); return 'ð â¹' + amount + ' per period:\nPer day: â¹' + (amount/time).toFixed(0); }},
    ];
    for (const { regex, fn } of smartMathPatterns) {
      const m = text.match(regex);
      if (m) { reply('ð§® ' + fn(m)); return; }
    }

    // ââ PERSONALITY MODE ââââââââââââââââââââââââââââââââââââââââ
    if (/strict mode|focus mode|kaam.*mode|serious mode/i.test(t)) {
      if (typeof window !== 'undefined') localStorage.setItem('jarvis_mode', 'strict');
      reply('ð¯ **Strict Mode ON**\nAb main sirf kaam ki baatein karunga. No jokes, no bakwaas. Focus karo boss!');
      return;
    }
    if (/chill mode|relax mode|fun mode|casual mode/i.test(t)) {
      if (typeof window !== 'undefined') localStorage.setItem('jarvis_mode', 'chill');
      reply('ð **Chill Mode ON**\nRelax boss, ab baatein karte hain. Kya chal raha hai?');
      return;
    }
    if (/normal mode|default mode|mode off|mode hatao/i.test(t)) {
      if (typeof window !== 'undefined') localStorage.removeItem('jarvis_mode');
      reply('â Normal mode. Main hoon â JARVIS.');
      return;
    }

    // ââ CONTACT MEMORY ââââââââââââââââââââââââââââââââââââââââââ
    const contactSave = text.match(/(.+?)\s+(?:ka|ki|ke)\s+(?:number|contact|phone)\s+(?:hai|=|:)\s+([0-9+\s]{10,15})/i);
    if (contactSave) {
      const name = contactSave[1].trim();
      const number = contactSave[2].replace(/\s/g, '');
      if (typeof window !== 'undefined') {
        const contacts = JSON.parse(localStorage.getItem('jarvis_contacts') || '{}');
        contacts[name.toLowerCase()] = number;
        localStorage.setItem('jarvis_contacts', JSON.stringify(contacts));
        reply('ð± **' + name + '** ka number save ho gaya: ' + number);
        return;
      }
    }
    const contactFind = text.match(/(.+?)\s+(?:ka|ki)\s+(?:number|contact|phone)\s+(?:kya hai|batao|dedo|chahiye)/i)
      || text.match(/(?:call|phone)\s+(?:karo\s+)?(.+?)\s+(?:ko|pe)/i);
    if (contactFind?.[1]) {
      const name = contactFind[1].trim().toLowerCase();
      if (typeof window !== 'undefined') {
        const contacts = JSON.parse(localStorage.getItem('jarvis_contacts') || '{}');
        const num = contacts[name];
        if (num) {
          reply('ð± **' + contactFind[1] + '**: ' + num + '\n\nCall karna hai? "' + contactFind[1] + ' ko call karo" bolo.');
          return;
        } else {
          reply('ð± **' + contactFind[1] + '** ka number mujhe nahi pata. Batao: "' + contactFind[1] + ' ka number hai +91XXXXXXXXXX"');
          return;
        }
      }
    }

    // ââ DAILY DIGEST ââââââââââââââââââââââââââââââââââââââââââââ
    if (/daily digest|aaj ka digest|morning brief|subah ka update|daily update/i.test(t)) {
      const h = new Date().getHours();
      const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
      try {
        const { getWeather } = await import('@/lib/core/freeAPIs');
        const weather = await getWeather('Maihar').catch(() => 'Weather unavailable');
        const habits = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('jarvis_habits') || '{}' : '{}');
        const expenses = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('jarvis_expenses') || '[]' : '[]');
        const todaySpend = expenses.filter((e: any) => new Date(e.ts).toDateString() === new Date().toDateString()).reduce((s: number, e: any) => s + e.amount, 0);
        const streaks = Object.entries(habits as Record<string,any>).map(([k,v]: any) => k + ': ' + v.streak + 'ð¥').join(' | ') || 'Koi habit nahi';
        const { getAllGoals } = await import('@/lib/db');
        const goals = await getAllGoals().catch(() => []);
        const activeGoals = (goals as any[]).filter((g: any) => !g.completed).slice(0, 3).map((g: any) => 'â¢ ' + g.title).join('\n') || 'Koi active goal nahi';
        reply(greeting + ' boss! ð\n\n' +
          'ð¤ï¸ **Weather:**\n' + weather.split('\n')[0] + '\n\n' +
          'ð¯ **Active Goals:**\n' + activeGoals + '\n\n' +
          'ð¥ **Habits:** ' + streaks + '\n\n' +
          'ð¸ **Aaj ka kharcha:** â¹' + todaySpend.toLocaleString('en-IN') + '\n\n' +
          '_"Ek kaam achhi tarah se karo â baaki khud ho jaayega."_ ðª');
        return;
      } catch {
        reply(greeting + ' boss! ð\n\nAaj ka din ache se shuru karo. Kya karna hai?');
        return;
      }
    }

    // ââ EXPENSE TRACKER ââââââââââââââââââââââââââââââââââââââââ
    const expenseMatch = text.match(/(?:kharcha|kharch|spend|spent|paid|diya|lagaya)[:\s]+(?:rs\.?|â¹|rupee[s]?)?\s*(\d+(?:\.\d+)?)\s+(.+)/i)
      || text.match(/(\d+(?:\.\d+)?)\s+(?:rs\.?|â¹|rupee[s]?)?\s+(.+?)\s+(?:kharcha|lagaya|diya|spend|paid)/i);
    if (expenseMatch) {
      const amount = parseFloat(expenseMatch[1]);
      const category = expenseMatch[2]?.trim() || 'Other';
      if (typeof window !== 'undefined') {
        const expenses = JSON.parse(localStorage.getItem('jarvis_expenses') || '[]');
        expenses.unshift({ amount, category, date: new Date().toLocaleDateString('en-IN'), ts: Date.now() });
        localStorage.setItem('jarvis_expenses', JSON.stringify(expenses.slice(0, 200)));
        const thisMonth = expenses.filter((e: any) => new Date(e.ts).getMonth() === new Date().getMonth());
        const total = thisMonth.reduce((s: number, e: any) => s + e.amount, 0);
        // Spending alert thresholds
        const alerts: Record<number,string> = { 500:'â ï¸ Aaj â¹500 ho gaya kharcha boss.', 1000:'â ï¸ â¹1,000 aaj â thoda ruko.', 2000:'ð¨ â¹2,000 aaj! Bahut zyada ho gaya.', 5000:'ð¨ â¹5,000 aaj â emergency?' };
        const todaySpend = expenses.filter((e:any) => new Date(e.ts).toDateString() === new Date().toDateString()).reduce((s:number,e:any)=>s+e.amount,0);
        for (const [threshold, msg] of Object.entries(alerts)) {
          if (todaySpend >= parseInt(threshold) && todaySpend - amount < parseInt(threshold)) {
            setTimeout(() => toastErr(msg), 1500); break;
          }
        }
        reply('ð¸ Expense saved!\nâ¹' + amount + ' â ' + category + '\n\nð This month total: â¹' + total.toLocaleString('en-IN'));
        return;
      }
    }
    if (/expense|kharcha|spending|kitna kharcha|monthly|budget/i.test(t) && /dikhao|show|report|kitna|summary/i.test(t)) {
      if (typeof window !== 'undefined') {
        const expenses = JSON.parse(localStorage.getItem('jarvis_expenses') || '[]');
        if (!expenses.length) { reply('Koi expense nahi. "500 grocery kharcha" type karo.'); return; }
        const thisMonth = expenses.filter((e: any) => new Date(e.ts).getMonth() === new Date().getMonth());
        const total = thisMonth.reduce((s: number, e: any) => s + e.amount, 0);
        const recent = thisMonth.slice(0, 5).map((e: any) => 'â¢ â¹' + e.amount + ' â ' + e.category + ' (' + e.date + ')').join('\n');
        reply('ð¸ **This Month Expenses**\n\nTotal: **â¹' + total.toLocaleString('en-IN') + '**\n\n' + recent);
        return;
      }
    }

    // ââ HABIT TRACKER âââââââââââââââââââââââââââââââââââââââââââ
    const habitDoneMatch = text.match(/(?:aaj|today)\s+(.+?)\s+(?:kiya|done|complete|kar liya|kiya hai|ho gaya)/i)
      || text.match(/(.+?)\s+(?:aaj|today)\s+(?:kiya|done|kar liya)/i);
    if (habitDoneMatch?.[1] && !/goal|reminder|note/.test(habitDoneMatch[1])) {
      const habit = habitDoneMatch[1].trim();
      if (typeof window !== 'undefined') {
        const habits = JSON.parse(localStorage.getItem('jarvis_habits') || '{}');
        const today = new Date().toDateString();
        if (!habits[habit]) habits[habit] = { streak: 0, lastDate: '', dates: [] };
        const h = habits[habit];
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (h.lastDate === yesterday) h.streak++;
        else if (h.lastDate !== today) h.streak = 1;
        h.lastDate = today;
        if (!h.dates.includes(today)) h.dates.push(today);
        localStorage.setItem('jarvis_habits', JSON.stringify(habits));
        const adviceMap: Record<string,string> = {
          'gym': h.streak >= 7 ? 'ðª 7 din! Ab rest day le aaj.' : h.streak >= 3 ? 'Keep pushing boss!' : 'Shuruat achhi hai!',
          'padhai': h.streak >= 5 ? 'ð Padhne ki aadat ban gayi!' : 'Consistency hi success hai.',
          'meditation': 'ð§ ' + h.streak + ' din ka peace. Kal bhi karna.',
          'running': h.streak >= 7 ? 'ð Ek hafta! Body thank kar rahi hogi.' : 'Chal raha hai boss!',
        };
        const advice = adviceMap[habit.toLowerCase()] || (h.streak >= 7 ? 'ð Zabardast streak boss!' : h.streak >= 3 ? 'ðª Consistent ho!' : 'Kal bhi karo!');
        reply('â **' + habit + '** â Done!\nð¥ Streak: **' + h.streak + ' days**\n' + advice);
        return;
      }
    }
    if (/habit|streak|dikhao.*habit|habit.*dikhao/i.test(t)) {
      if (typeof window !== 'undefined') {
        const habits = JSON.parse(localStorage.getItem('jarvis_habits') || '{}');
        const keys = Object.keys(habits);
        if (!keys.length) { reply('Koi habit nahi. "Aaj gym kiya" ya "aaj padhai kiya" bolo.'); return; }
        reply('ð¥ **Habit Streaks:**\n\n' + keys.map(k => 'â¢ **' + k + '**: ' + habits[k].streak + ' days ð¥').join('\n'));
        return;
      }
    }

    // ââ WHATSAPP AI DRAFT âââââââââââââââââââââââââââââââââââââââ
    const waDraftMatch = text.match(/(?:whatsapp|wa)\s+(?:pe|mein|ko|par)\s+(.+?)\s+(?:ko|ke liye)?\s+(?:bol|bolo|likho|message karo|msg karo)\s+(.+)/i)
      || text.match(/(.+?)\s+ko\s+whatsapp\s+(?:karo|karna|message)\s+(?:ki|ke|ki)?\s*(.+)/i);
    if (waDraftMatch) {
      const person = waDraftMatch[1]?.trim();
      const msgContent = waDraftMatch[2]?.trim();
      if (person && msgContent) {
        const draft = 'Hi ' + person + '! ' + msgContent;
        if (typeof window !== 'undefined') {
          window.location.href = 'whatsapp://send?text=' + encodeURIComponent(draft);
        }
        reply('ð¬ WhatsApp draft ready:\n"' + draft + '"\n\nWhatsApp khul raha hai...');
        return;
      }
    }

    // ââ NIFTY/SENSEX ââââââââââââââââââââââââââââââââââââââââââââ
    if (/nifty|sensex|stock market|share market/i.test(t)) {
      try {
        const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&range=1d', { signal: AbortSignal.timeout(5000) });
        const d = await res.json();
        const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
        const prev = d?.chart?.result?.[0]?.meta?.previousClose;
        const change = price && prev ? ((price - prev) / prev * 100).toFixed(2) : null;
        if (price) {
          reply('ð **Nifty 50**: ' + price?.toLocaleString('en-IN') + (change ? ('\n' + (parseFloat(change) > 0 ? 'ð' : 'ð') + ' ' + change + '% today') : ''));
          return;
        }
      } catch {}
      // Fallback
      reply('ð Stock market data fetch nahi hua. NSE India: nseindia.com check karo.');
      return;
    }

    // ââ TRAIN STATUS ââââââââââââââââââââââââââââââââââââââââââââ
    const trainMatch = text.match(/(?:train|rajdhani|shatabdi|express)\s+(?:number|no\.?|#)?\s*(\d{4,5})/i)
      || text.match(/(\d{4,5})\s+(?:train|number|no\.?)\s+(?:kahan hai|status|location|running)/i);
    if (trainMatch?.[1] || /train.*kahan|train.*status|train.*running/i.test(t)) {
      const trainNo = trainMatch?.[1] || '12301';
      const url = 'https://www.railyatri.in/live-train-status/train-' + trainNo;
      reply('ð **Train ' + trainNo + ' Status**\n\nSeedha check karo:\n' + url + '\n\nYa NTES app use karo â most accurate live data.');
      return;
    }

    // ââ CRICKET/IPL SCORE âââââââââââââââââââââââââââââââââââââââ
    if (/cricket|ipl|score|match.*score|cricket.*score/i.test(t)) {
      try {
        const res = await fetch('https://api.cricapi.com/v1/currentMatches?apikey=free&offset=0', { signal: AbortSignal.timeout(5000) });
        const d = await res.json();
        if (d?.data?.length) {
          const matches = d.data.slice(0, 3).map((m: any) => 'ð ' + m.name + '\n' + (m.score?.map((s: any) => s.inning + ': ' + s.r + '/' + s.w).join(' | ') || 'Score loading...')).join('\n\n');
          reply('ð **Live Cricket:**\n\n' + matches);
        } else {
          reply('ð Abhi koi live match nahi. Cricbuzz check karo: cricbuzz.com');
        }
        return;
      } catch {
        reply('ð Cricket score fetch nahi hua. Cricbuzz: cricbuzz.com ya Espncricinfo: espncricinfo.com');
        return;
      }
    }

    // ââ YOUTUBE SEARCH ââââââââââââââââââââââââââââââââââââââââââ
    const ytMatch = text.match(/(?:youtube|yt)\s+(?:pe|mein|par|search|play|chalao|dekho)\s+(.+)/i)
      || text.match(/(.+)\s+(?:youtube pe|yt pe)\s+(?:search|play|chalao|dekho)/i);
    if (ytMatch?.[1]) {
      const query = ytMatch[1].trim();
      const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
      if (typeof window !== 'undefined') window.open(url, '_blank');
      reply('â¶ï¸ YouTube search: "' + query + '"\nKhul raha hai...');
      return;
    }

    // ââ PETROL PRICE ââââââââââââââââââââââââââââââââââââââââââââ
    if (/petrol|diesel|fuel.*price|price.*fuel/i.test(t)) {
      reply('â½ **Petrol/Diesel Price (Approx)**\n\nMaihar, MP (today):\nâ¢ Petrol: ~â¹107/litre\nâ¢ Diesel: ~â¹92/litre\n\n_Exact rate ke liye: fuel.goodreturns.in_\n_Ya type karo: "petrol rate Maihar"_');
      return;
    }

    // ââ GOLD & SILVER PRICE ââââââââââââââââââââââââââââââââââââ
    // ââ GOLD & SILVER PRICE ââââââââââââââââââââââââââââââââââââ
    if (/gold|sona|chandi|silver|bullion/i.test(t)) {
      try {
        const [metalRes, fxRes] = await Promise.all([
          fetch('https://api.metals.live/v1/spot/gold,silver', { signal: AbortSignal.timeout(5000) }),
          fetch('https://api.exchangerate-api.com/v4/latest/USD', { signal: AbortSignal.timeout(4000) }),
        ]);
        const metals = await metalRes.json();
        const fx = await fxRes.json();
        const usdInr = fx.rates?.INR || 84;
        const g = ((metals?.gold || 2300) / 31.1035) * usdInr;
        const s = ((metals?.silver || 28) / 31.1035) * usdInr;
        reply(
          'ð¥ **Gold & Silver (Live)**\n\n' +
          'ð¥ Gold 24K: **â¹' + Math.round(g).toLocaleString('en-IN') + '/g** | 10g = â¹' + Math.round(g*10).toLocaleString('en-IN') + '\n' +
          'ð¥ Gold 22K: **â¹' + Math.round(g*0.916).toLocaleString('en-IN') + '/g** | 10g = â¹' + Math.round(g*9.16).toLocaleString('en-IN') + '\n' +
          'ð¥ Silver: **â¹' + Math.round(s).toLocaleString('en-IN') + '/g** | 100g = â¹' + Math.round(s*100).toLocaleString('en-IN')
        );
        return;
      } catch {
        reply('ð¥ Gold 24K: ~â¹9,000/g | Gold 22K: ~â¹8,250/g\nð¥ Silver: ~â¹105/g\n_(Approximate â live data nahi mila)_');
        return;
      }
    }

    // ââ CRYPTO PRICE âââââââââââââââââââââââââââââââââââââââââââ
    const cryptoMatch = text.match(/(?:price|rate|value|kitna)\s+(?:of\s+)?([a-z]+)(?:\s+coin)?/i);
    if (/bitcoin|btc|ethereum|eth|crypto|coin price|doge|solana/i.test(t)) {
      const coin = /bitcoin|btc/i.test(t) ? 'bitcoin' : /ethereum|eth/i.test(t) ? 'ethereum' : /doge/i.test(t) ? 'dogecoin' : /solana/i.test(t) ? 'solana' : (cryptoMatch?.[1] || 'bitcoin').toLowerCase();
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + coin + '&vs_currencies=inr,usd&include_24hr_change=true');
        const d = await res.json();
        const data = d[coin];
        if (data) {
          const ch = data.usd_24h_change?.toFixed(2);
          reply('â¿ **' + coin.charAt(0).toUpperCase() + coin.slice(1) + '**\nâ¹' + data.inr?.toLocaleString('en-IN') + ' | $' + data.usd?.toLocaleString() + '\n' + (parseFloat(ch) > 0 ? 'ð' : 'ð') + ' 24h: ' + ch + '%');
        } else reply('Coin nahi mila: ' + coin);
        return;
      } catch { reply('Crypto price nahi mila.'); return; }
    }

    // ââ DICTIONARY / MEANING âââââââââââââââââââââââââââââââââââ
    const wordMatch = text.match(/(?:meaning|matlab|definition|define|kya hota hai)\s+(?:of\s+)?['"]?(\w+)['"]?/i);
    if (wordMatch?.[1]) {
      try {
        const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + wordMatch[1].toLowerCase());
        const d = await res.json();
        if (Array.isArray(d) && d[0]) {
          const entry = d[0];
          const def = entry.meanings?.[0]?.definitions?.[0];
          reply('ð **' + entry.word + '** (' + (entry.meanings?.[0]?.partOfSpeech || '') + ')\n' + def?.definition + (def?.example ? '\n\n*"' + def.example + '"*' : ''));
        } else { reply('"' + wordMatch[1] + '" ka meaning nahi mila.'); }
        return;
      } catch { reply('Dictionary fetch nahi ho saka.'); return; }
    }

    // ââ NEWS ââââââââââââââââââââââââââââââââââââââââââââââââââââ
    if (/(?:aaj ki|latest|today) news|top news|khabar|headlines/i.test(t)) {
      try {
        const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
        const ids = await res.json();
        const stories = await Promise.all(ids.slice(0, 5).map((id: number) =>
          fetch('https://hacker-news.firebaseio.com/v0/item/' + id + '.json').then(r => r.json())
        ));
        reply('ð° **Top News:**\n' + stories.map((s: any, i: number) => (i+1) + '. ' + s.title).join('\n'));
        return;
      } catch { reply('News fetch nahi ho saki.'); return; }
    }

    // ââ MATH INLINE âââââââââââââââââââââââââââââââââââââââââââââ
    const mathExpr = text.match(/^(?:calc(?:ulate)?|calculate|solve|compute|=)\s+(.+)$/i);
    if (mathExpr?.[1]) {
      try {
        const safe = mathExpr[1].replace(/[^0-9+\-*/.()%\s^]/g, '');
        const result = Function('"use strict"; return (' + safe + ')')();
        reply('ð§® ' + mathExpr[1] + ' = **' + result + '**');
        return;
      } catch { /* fall through to AI */ }
    }

    // ââ WEATHER ââââââââââââââââââââââââââââââââââââââââââââââââ
    if (/weather|mausam|garmi|sardi|barish|temperature/i.test(t)) {
      const cityM = text.match(/(?:of|in|at|ka|mein|for)\s+(\w+)/i);
      const city = cityM?.[1] || location || 'Maihar';
      try {
        const { getWeather } = await import('@/lib/core/freeAPIs');
        reply('ðï¸ **' + city + ' Weather:**\n\n' + await getWeather(city)); return;
      } catch { reply('Weather nahi mila. Internet check karo.'); return; }
    }

    // ââ ISS LOCATION ââââââââââââââââââââââââââââââââââââââââââââ
    if (/iss|space station|antariksha station|satellite location/i.test(t)) {
      try {
        const { getISS } = await import('@/lib/core/freeAPIs');
        reply(await getISS()); return;
      } catch { reply('ISS location nahi mili.'); return; }
    }

    // ââ COUNTRY INFO ââââââââââââââââââââââââââââââââââââââââââââ
    const countryMatch = text.match(/(?:about|info|details?|tell me about|batao)\s+(.+?)(?:\s+(?:country|desh|nation))?$/i);
    if (/which country|kis desh|country info|desh ki jankari/i.test(t) && countryMatch?.[1]) {
      try {
        const { getCountryInfo } = await import('@/lib/core/freeAPIs');
        reply(await getCountryInfo(countryMatch[1].trim())); return;
      } catch { reply('Country info nahi mili.'); return; }
    }

    // ââ RANDOM ADVICE ââââââââââââââââââââââââââââââââââââââââââââ
    if (/^(?:advice|sujhao|give me advice|kya karu|suggest karo|help me decide)$/i.test(t.trim())) {
      const { getAdvice } = await import('@/lib/core/freeAPIs');
      reply(await getAdvice()); return;
    }

    // ââ QUOTES âââââââââââââââââââââââââââââââââââââââââââââââââââ
    if (/^(?:quote|suvichar|anmol vachan|motivat(?:ion)?|inspir(?:ation)?)$/i.test(t.trim())) {
      const { getQuote } = await import('@/lib/core/freeAPIs');
      reply(await getQuote()); return;
    }

    // ââ JOKES âââââââââââââââââââââââââââââââââââââââââââââââââââââ
    if (/^(?:joke|chutkula|funny|hasao|ek joke suno)$/i.test(t.trim()) || /tell.*joke|joke.*suno|ek.*joke/i.test(t)) {
      const { getJoke } = await import('@/lib/core/freeAPIs');
      reply(await getJoke()); return;
    }

    // ââ TIMER ââââââââââââââââââââââââââââââââââââââââââââââââââ
    const timerM = text.match(/(\d+)\s*(?:minute|min|second|sec)\s*(?:ka\s*)?timer/i);
    if (timerM) {
      const n = parseInt(timerM[1]);
      const unit = /sec/i.test(timerM[0]) ? 'second' : 'minute';
      const ms = unit === 'second' ? n * 1000 : n * 60000;
      setTimeout(() => {
        if (typeof navigator !== 'undefined') navigator.vibrate?.([500, 200, 500]);
        import('@/lib/automation/bridge').then(m => m.showNotification('â±ï¸ Timer Done!', n + ' ' + unit + ' ho gaye boss!'));
      }, ms);
      reply('â±ï¸ **' + n + ' ' + unit + ' timer** set ho gaya! Baj jaayega.'); return;
    }

    // ââ APPS OPEN ââââââââââââââââââââââââââââââââââââââââââââââ
    const appMap: Record<string, string> = {
      whatsapp: 'whatsapp://', wa: 'whatsapp://',
      youtube: 'vnd.youtube:', yt: 'vnd.youtube:',
      camera: 'intent://camera#Intent;scheme=android-app;end',
      maps: 'geo:0,0', map: 'geo:0,0',
      phone: 'tel:', call: 'tel:',
      settings: 'intent://settings#Intent;scheme=android-app;end',
      instagram: 'instagram://', insta: 'instagram://',
      spotify: 'spotify://', music: 'spotify://',
      telegram: 'tg://', tele: 'tg://',
      calculator: 'intent://calculator#Intent;scheme=android-app;end',
      zomato: 'zomato://', food: 'zomato://',
      swiggy: 'swiggy://',
      ola: 'olacabs://', cab: 'olacabs://',
      uber: 'uber://',
      phonepe: 'phonepe://', upi: 'upi://pay',
      paytm: 'paytm://',
      gpay: 'tez://', googlepay: 'tez://',
      amazon: 'https://www.amazon.in/s?k=',
      flipkart: 'https://www.flipkart.com/search?q=',
      gmail: 'googlegmail://', mail: 'googlegmail://',
      chrome: 'googlechrome://',
      netflix: 'nflx://',
      hotstar: 'https://www.hotstar.com',
      twitter: 'twitter://', x: 'twitter://',
      linkedin: 'linkedin://',
      snapchat: 'snapchat://',
      facebook: 'fb://',
      gallery: 'content://media/internal/images/media',
      files: 'content://com.android.externalstorage.documents',
      clock: 'intent://clock#Intent;scheme=android-app;end',
      contacts: 'content://contacts/people/',
    };
    for (const [app, scheme] of Object.entries(appMap)) {
      if (new RegExp('\\b' + app + '\\b.*(?:khol|open|launch|chalu|start)', 'i').test(text) ||
          new RegExp('(?:khol|open|launch).*\\b' + app + '\\b', 'i').test(text)) {
        if (typeof window !== 'undefined') window.location.href = scheme;
        reply('â **' + app.charAt(0).toUpperCase() + app.slice(1) + '** khul raha hai...'); return;
      }
    }

    // ââ SYSTEM INFO ââââââââââââââââââââââââââââââââââââââââââââ
    if (/system|status|info|sab kuch batao/i.test(t) && /batao|dikhao|check|kya hai/i.test(t)) {
      try {
        const { getAllGoals, getStreak, getTodayChats } = await import('@/lib/db');
        const { getReminders } = await import('@/lib/reminders');
        const { getBatteryInfo } = await import('@/lib/automation/bridge');
        const [goals, streak, todayChats, bat] = await Promise.all([getAllGoals(), Promise.resolve(getStreak()), getTodayChats(), getBatteryInfo()]);
        const rems = getReminders().filter((r: any) => !r.fired && r.fireAt > Date.now());
        reply(
          'ð¤ **JARVIS Status**\n\n' +
          'â¡ Battery: ' + (bat ? bat.level + '%' + (bat.charging ? ' charging' : '') : 'N/A') + '\n' +
          'ð¯ Goals: ' + goals.filter((g: any) => !g.completed).length + ' active\n' +
          'â° Reminders: ' + rems.length + ' upcoming\n' +
          'ð¬ Chats today: ' + todayChats.length + '\n' +
          'ð¥ Streak: ' + streak.current + ' days\n' +
          'ð¡ Network: ' + (navigator.onLine ? 'Online â' : 'Offline â ï¸')
        ); return;
      } catch { /* fall through */ }
    }

    // ââ CHAT SEARCH ââââââââââââââââââââââââââââââââââââââââââââ
    const searchMatch = text.match(/(?:search|dhundho|find|kahan)\s+(?:chat|baat|conversation|messages?)[:\s]+(.+)/i)
      || text.match(/(.+)\s+wali\s+(?:baat|chat)\s+dhundho/i);
    if (searchMatch) {
      const query = (searchMatch[1] || searchMatch[0]).trim().toLowerCase();
      try {
        const { getRecentChats } = await import('@/lib/db');
        const chats = await getRecentChats(200);
        const found = chats.filter((c: any) => c.content?.toLowerCase().includes(query)).slice(0, 5);
        if (found.length === 0) { reply('ð "' + query + '" â koi baat nahi mili purani chats mein.'); return; }
        reply('ð **"' + query + '"** â ' + found.length + ' matches mile:\n\n' +
          found.map((c: any) => (c.role === 'user' ? 'ð¤' : 'ð¤') + ' ' + c.content.slice(0, 80) + '...').join('\n\n')); return;
      } catch { reply('Chat search nahi ho saka.'); return; }
    }

    // ââ WEEKLY PROGRESS REPORT âââââââââââââââââââââââââââââââââ
    if (/progress report|weekly report|hafte ka|week.*summary|report banao/i.test(text)) {
      try {
        const { getAllGoals, getStreak, getTodayChats } = await import('@/lib/db');
        const { getReminders } = await import('@/lib/reminders');
        const [goals, streak, todayChats] = await Promise.all([getAllGoals(), Promise.resolve(getStreak()), getTodayChats()]);
        const rems = getReminders();
        const activeGoals = goals.filter((g: any) => !g.completed);
        const doneGoals = goals.filter((g: any) => g.completed);
        const report = 'ð **Weekly Progress Report**\n' +
          'ââââââââââââââââââââ\n\n' +
          'ð¥ **Streak:** ' + streak.current + ' days (Best: ' + streak.best + ')\n\n' +
          'ð¯ **Goals:**\n' +
          '  â Done: ' + doneGoals.length + '\n' +
          '  ð Active: ' + activeGoals.length + '\n' +
          (activeGoals.length ? '  ' + activeGoals.slice(0,3).map((g: any) => 'â¢ ' + g.title).join('\n  ') + '\n' : '') + '\n' +
          'â° **Reminders set:** ' + rems.length + '\n\n' +
          'ð¬ **Chats today:** ' + todayChats.length + '\n\n' +
          'ââââââââââââââââââââ\n' +
          (streak.current >= 7 ? 'ð 7 din ka streak! Zabardast consistency!' : streak.current >= 3 ? 'ð ' + streak.current + ' din se active â keep going!' : 'ðª Kal se daily aao, streak banao!');
        reply(report);
        // Also offer to share
        setTimeout(() => {
          setMsgs(prev => [...prev, {
            id: 'share_' + Date.now(), role: 'assistant',
            content: 'WhatsApp pe share karna hai? "report share karo" bolo.',
            timestamp: Date.now(),
          }]);
        }, 1000);
        return;
      } catch { reply('Report nahi ban saka. Dobara try karo.'); return; }
    }
    if (/report share karo|share.*report|report.*whatsapp/i.test(text)) {
      const lastReport = msgs.slice().reverse().find(m => m.content.includes('Weekly Progress Report'));
      if (lastReport) {
        window.location.href = 'whatsapp://send?text=' + encodeURIComponent(lastReport.content.replace(/\*\*/g, ''));
        reply('ð¬ WhatsApp pe bhej raha hoon...'); return;
      }
      reply('Pehle "progress report" type karo, phir share karo.'); return;
    }

    // ââ MUSIC GENERATION ââââââââââââââââââââââââââââââââââââââ
    if (/^music|^song|gaana bana|music generate/i.test(t)) {
      const mood = text.replace(/music|song|gaana|bana|generate/gi,'').trim() || 'relaxing hindi'
      // Open Suno + Udio as alternatives
      const sunoUrl = 'https://suno.com/create?prompt=' + encodeURIComponent(mood)
      const udioUrl = 'https://www.udio.com/create?prompt=' + encodeURIComponent(mood)
      reply('ðµ Music generate karo:\n\nSuno: ' + sunoUrl + '\nUdio: ' + udioUrl + '\n\nDono free hain boss!')
      return
    }

    // ââ VIDEO GENERATION âââââââââââââââââââââââââââââââââââââââ
    if (/^video|video bana|clip generate/i.test(t)) {
      const prompt = text.replace(/video|bana|generate|clip/gi,'').trim() || 'cinematic short clip'
      const klingUrl = 'https://klingai.com/create?prompt=' + encodeURIComponent(prompt)
      const lumaUrl = 'https://lumalabs.ai/dream-machine?prompt=' + encodeURIComponent(prompt)
      reply('ð¬ Video generate karo:\n\nKling AI (best): ' + klingUrl + '\nLuma (8/month): ' + lumaUrl)
      return
    }

    // ââ TTS / VOICE ââââââââââââââââââââââââââââââââââââââââââââ
    if (/^(?:bol|speak|tts|voice|read aloud|padho)\s+(.+)/i.test(text)) {
      const sayText = text.replace(/^(?:bol|speak|tts|voice|read aloud|padho)\s+/i,'').trim()
      if (sayText) {
        const { speakText } = await import('@/lib/tts')
        speakText(sayText)
        reply('ð Bol raha hoon: "' + sayText.slice(0,50) + (sayText.length > 50 ? '...' : '') + '"')
        return
      }
    }

    // ââ CHAT EXPORT ââââââââââââââââââââââââââââââââââââââââââââ
    if (/export|share chat|chat export|save chat|download chat/i.test(text)) {
      const chatText = msgs.map(m => (m.role === 'user' ? 'ð¤ You: ' : 'ð¤ JARVIS: ') + m.content).join('\n\n');
      const blob = new Blob([chatText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = 'jarvis-chat-' + new Date().toLocaleDateString('en-IN').replace(/\//g, '-') + '.txt';
      a.click(); URL.revokeObjectURL(url);
      reply('ð¥ Chat export ho gaya â download ho rahi hai!'); return;
    }

    // Share chat via WhatsApp
    if (/whatsapp.*share.*chat|chat.*share.*whatsapp/i.test(text)) {
      const last5 = msgs.slice(-5).map(m => (m.role === 'user' ? 'Me: ' : 'JARVIS: ') + m.content.slice(0, 100)).join('\n');
      window.location.href = 'whatsapp://send?text=' + encodeURIComponent('JARVIS Chat:\n\n' + last5);
      reply('ð¬ WhatsApp pe bhej raha hoon...'); return;
    }

    // ââ SESSION TIMER âââââââââââââââââââââââââââââââââââââââââââ
    if (/session.*start|kaam.*start|timer.*start|work.*start/i.test(text)) {
      const startTime = Date.now();
      if (typeof window !== 'undefined') localStorage.setItem('jarvis_session_start', String(startTime));
      reply('â±ï¸ Session shuru! Jab kaam khatam karo toh "session end" bolo.'); return;
    }
    if (/session.*end|kaam.*khatam|session.*stop|work.*done/i.test(text)) {
      const start = parseInt(typeof window !== 'undefined' ? localStorage.getItem('jarvis_session_start') || '0' : '0');
      if (!start) { reply('Koi session start nahi tha. "Session start" bolo pehle.'); return; }
      const mins = Math.round((Date.now() - start) / 60000);
      const hrs = Math.floor(mins / 60); const remMins = mins % 60;
      if (typeof window !== 'undefined') localStorage.removeItem('jarvis_session_start');
      reply('â Session khatam!\n\nâ±ï¸ Total time: **' + (hrs > 0 ? hrs + ' hr ' : '') + remMins + ' min**\n\nGood work boss! ðª'); return;
    }

    // ââ PINNED MESSAGES ââââââââââââââââââââââââââââââââââââââââ
    if (/pinned|pin.*dikhao|saved.*messages|important.*messages/i.test(text)) {
      if (typeof window === 'undefined') { reply('Pinned messages load nahi ho sake.'); return; }
      const pins = JSON.parse(localStorage.getItem('jarvis_pins') || '[]');
      if (pins.length === 0) { reply('Koi pinned message nahi. Long press karo message pe â ð Pin.'); return; }
      reply('ð **Pinned Messages (' + pins.length + '):**\n\n' +
        pins.map((p: any, i: number) => (i+1) + '. ' + p.content.slice(0, 100) + (p.content.length > 100 ? '...' : '')).join('\n\n'));
      return;
    }

    // ââ PAGE NAVIGATION ââââââââââââââââââââââââââââââââââââââââ
    const navMap: [RegExp, string, string][] = [
      [/settings.*jao|settings.*kholo|open.*settings/i, '/settings', 'Settings'],
      [/study.*jao|study.*kholo|exam.*page/i, '/study', 'Study Hub'],
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
        reply('ð **' + label + '** pe ja raha hun...'); return;
      }
    }

    // ââ AUTOMATION âââââââââââââââââââââââââââââââââââââââââââââ
    const autoAction = detectAutomationIntent(text);
    if (autoAction) {
      const result = await triggerMacro(autoAction);
      reply(result.ok ? 'â ' + result.msg : 'â ï¸ ' + result.msg); return;
    }

    // ââ VIDEO GENERATION âââââââââââââââââââââââââââââââââââââââ
    const videoMatch = text.match(/video\s+(?:bana|banao|generate|create|chahiye|de)[:\s]+(.+)/i)
      || text.match(/(.+)\s+(?:ka|ki)\s+video\s+(?:bana|banao|create)/i);
    if (videoMatch) {
      const videoPrompt = (videoMatch[1] || text).replace(/video|bana|banao|create|generate|chahiye/gi,'').trim() || text.trim();
      const videoId = 'a_vid_' + Date.now();
      setMsgs(prev => [...prev,
        { id:'u_'+Date.now(), role:'user', content:text.trim(), timestamp:Date.now() },
        { id:videoId, role:'assistant', content:'ð¬ Video generate kar raha hoon: "' + videoPrompt + '"\nâ³ 15-30 seconds lagenge...', timestamp:Date.now() },
      ]);
      setInput('');
      (async () => {
        try {
          const videoUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(videoPrompt + ', cinematic, motion, video style') + '?width=1280&height=720&model=flux&nologo=true&seed=' + Date.now();
          const genUrl = 'https://pollinations.ai/p/' + encodeURIComponent(videoPrompt);
          setMsgs(prev => prev.map(m => m.id===videoId ? {...m,
            content:'ð¬ **Video:** "' + videoPrompt + '"\n\nâ¶ï¸ [Pollinations pe dekho](' + genUrl + ')\n\nYa image version:',
            card:{ type:'image', imageUrl:videoUrl, title:'Video: '+videoPrompt }
          } : m));
        } catch {
          setMsgs(prev => prev.map(m => m.id===videoId ? {...m, content:'Video generate nahi hua.'} : m));
        }
      })();
      return;
    }

    // ââ VOICE TRANSCRIBE âââââââââââââââââââââââââââââââââââââââ
    if (/transcribe|audio.*text|speech.*text|recording.*convert/i.test(t)) {
      reply('ðï¸ Voice transcription ke liye:\n1. Mic button tap karo\n2. Bol do kuch bhi\n3. JARVIS automatically text kar dega\n\nYa voice page use karo: /voice'); return;
    }

    // ââ MULTI MODEL IMAGE ââââââââââââââââââââââââââââââââââââââ
    const modelMatch = text.match(/(?:flux|seedream|gpt.?image|dirtberry|zimage|imagen)\s+(?:se\s+)?(?:bana|generate|image)[:\s]+(.+)/i);
    if (modelMatch) {
      const modelName = /seedream/i.test(text) ? 'seedream' : /gpt.?image/i.test(text) ? 'gptimage' : /dirtberry/i.test(text) ? 'dirtberry' : /zimage|z-image/i.test(text) ? 'zimage' : /flux.pro/i.test(text) ? 'flux-pro' : 'flux';
      const prompt = modelMatch[1].trim();
      const imgUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt + ', high quality') + '?model=' + modelName + '&width=1024&height=1024&nologo=true&seed=' + Date.now();
      setMsgs(prev => [...prev,
        { id:'u_'+Date.now(), role:'user', content:text.trim(), timestamp:Date.now() },
        { id:'a_'+Date.now(), role:'assistant', content:'ð¨ ' + modelName.toUpperCase() + ' se bana raha hoon: "' + prompt + '"', timestamp:Date.now(), card:{ type:'image', imageUrl:imgUrl, title:prompt+' ('+modelName+')' } },
      ]);
      setInput(''); return;
    }

    // ââ Direct Image Generation â bypass AI refusal ââââââââââ
    const imgMatch = text.match(/(?:image|img|photo|pic|wallpaper|banner|poster|draw|paint|sketch|generator)\s+(?:kar|bana|banao|generate|create|make|de|do|chahiye|of|ki|ka)\s*(.+)/i)
      || text.match(/(.+)\s+(?:ki|ka|ke|wala|wali)\s+(?:image|photo|pic|tasveer)/i)
      || text.match(/^(?:generate|create|bana|draw)\s+(?:a\s+)?(?:image|photo|picture|pic)\s+(?:of\s+)?(.+)/i)
      || (/(?:image|photo|tasveer|pic)\s+(?:chahiye|de do|banao|bana do)/i.test(text) ? [text, text.replace(/image|photo|tasveer|pic|chahiye|de do|banao|bana do/gi, '').trim()] : null)
    if (imgMatch) {
      const imgPrompt = (imgMatch[1] || text).replace(/image|generator|bana|banao|kar|create|generate|photo|chahiye|de do/gi, '').trim() || text.trim()
      const safePrompt = imgPrompt.replace(/(nude|naked|nsfw|explicit|sex|porn)/gi, 'person')
      // Smart model selection based on prompt
      const isPortrait = /girl|woman|man|person|face|portrait|selfie|people/i.test(safePrompt);
      const isArt = /anime|cartoon|art|painting|illustration|drawing/i.test(safePrompt);
      const imgModel = isPortrait ? 'flux' : isArt ? 'flux' : 'flux-schnell';
      const pollinationsUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(safePrompt + ', high quality, 4K, detailed') + '?width=1024&height=1024&model=' + imgModel + '&nologo=true&enhance=true&seed=' + Date.now()
      const tempId = 'a_img_' + Date.now()
      // Show loading immediately with Pollinations (instant URL)
      setMsgs(prev => [...prev,
        { id: 'u_' + Date.now(), role: 'user', content: text.trim(), timestamp: Date.now() },
        { id: tempId, role: 'assistant', content: 'ð¨ Generating "' + safePrompt + '"...', timestamp: Date.now(),
          card: { type: 'image', imageUrl: pollinationsUrl, title: safePrompt } },
      ])
      setInput('')

      // Try Puter DALL-E 3 in background for better quality
      setTimeout(async () => {
        try {
          const { puterImageGen } = await import('@/lib/providers/puter');
          // Try best available model
          const puterUrl = await puterImageGen(safePrompt, 'dall-e-3') || await puterImageGen(safePrompt, 'black-forest-labs/FLUX.1-schnell');
          if (puterUrl) {
            setMsgs(prev => prev.map(m => m.id === tempId
              ? { ...m, content: 'ð¨ "' + safePrompt + '" (DALL-E 3)', card: { type: 'image', imageUrl: puterUrl, title: safePrompt + ' (HD)' } }
              : m
            ));
          }
        } catch {}
      }, 500);
      return
    }

    const isFirstMsg = msgs.filter(m => m.role === 'user').length === 0;
    const userMsg: Msg = { id: `u_${Date.now()}`, role: 'user', content: text.trim(), timestamp: Date.now() };

    setMsgs(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    // Safety timeout â 30 sec ke baad loading reset
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
      setMsgs(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && (!last.content || last.content.length < 5)) {
          return [...prev.slice(0, -1), { ...last, content: 'â ï¸ Response timeout. Dobara try karo ya Flash mode use karo.' }];
        }
        return prev;
      });
    }, 30000);
    // Store timeout id to clear on success
    (window as any).__loadingTimeout = loadingTimeout;

    // Learn + habit tracking (background, silent)
    learnFromMessage(text.trim()).catch(() => {});
    // Smart memory extraction
    import('@/lib/memory/smartMemory').then(m => m.learnFromMessage(text.trim())).catch(() => {});
    trackHabit(text.trim()).catch(() => {});

    if (sessionId) {
      saveMessage({ sessionId, role: 'user', content: text.trim(), timestamp: Date.now() });
      if (isFirstMsg) generateTitle(text.trim(), sessionId);
    }

    // ââ Smart API Router â auto-detect and call free APIs âââââ
    try {
      const { smartAPIRouter } = await import('@/lib/core/freeAPIs');
      const apiResult = await smartAPIRouter(text.trim());
      if (apiResult) {
        setMsgs(prev => [...prev,
          { id: 'u_' + Date.now(), role: 'user', content: text.trim(), timestamp: Date.now() },
          { id: 'a_' + Date.now(), role: 'assistant', content: apiResult, timestamp: Date.now() },
        ]);
        setInput(''); setLoading(false);
        return;
      }
    } catch {}

    // ââ Offline fallback âââââââââââââââââââââââââââââââââââââ
    if (!navigator.onLine) {
      try {
        const { getOfflineAnswer } = await import('@/lib/offline/answers');
        const offlineReply = getOfflineAnswer(text.trim());
        if (offlineReply) {
          setMsgs(prev => [...prev,
            { id: 'u_' + Date.now(), role: 'user', content: text.trim(), timestamp: Date.now() },
            { id: 'a_' + Date.now(), role: 'assistant', content: 'ð´ *Offline mode*\n\n' + offlineReply, timestamp: Date.now() },
          ]);
          setInput(''); setLoading(false);
          return;
        }
      } catch {}
      setMsgs(prev => [...prev,
        { id: 'u_' + Date.now(), role: 'user', content: text.trim(), timestamp: Date.now() },
        { id: 'a_' + Date.now(), role: 'assistant', content: 'ð´ Offline hoon abhi. Internet wapas aane pe jawab dunga. Basic cheezein poochho â time, date, math, GK â offline bhi jawab deta hoon!', timestamp: Date.now() },
      ]);
      setInput(''); setLoading(false);
      return;
    }

    // Rich personality system prompt (Jons Bhai + memory + time context)
    const systemPrompt = await buildSystemPrompt().catch(() =>
      `You are JARVIS â "Jons Bhai". Hinglish mein baat karo. Short answers. Never "As an AI".`
    );

    // Load user-saved API keys from localStorage â send to server
    const clientKeys: Record<string, string> = {}
    if (typeof window !== 'undefined') {
      const keyNames = ['GROQ_API_KEY','GEMINI_API_KEY','CEREBRAS_API_KEY','TOGETHER_API_KEY','MISTRAL_API_KEY','COHERE_API_KEY','FIREWORKS_API_KEY','OPENROUTER_API_KEY','DEEPINFRA_API_KEY','HUGGINGFACE_API_KEY']
      keyNames.forEach(k => { const v = localStorage.getItem(`jarvis_key_${k}`); if (v) clientKeys[k] = v })
    }

    const history = msgs.slice(-8).map(m => ({ role: m.role, content: m.content }));

    // Smart web search injection â auto-trigger on factual queries
    const searchTrigger = /latest|news|khabar|price|stock|score|result|who is|kya hai|search|find|current|today|2025|2026|released|launched|happened|broke|won|lost|died|born|invented|discovered/.test(text.toLowerCase())
    let searchContext = ''
    if (searchTrigger && text.length > 8 && !(/weather|mausam|battery|reminder|goal|note|timer|whatsapp|open app/i.test(text))) {
      try {
        const sr = await fetch('/api/search?q=' + encodeURIComponent(text.slice(0, 120)), { signal: AbortSignal.timeout(5000) })
        const sd = await sr.json()
        if (sd.results?.length) {
          const top = sd.results.slice(0, 3).map((r: any) => '[' + r.source + '] ' + r.title + ': ' + (r.text || '').slice(0, 250)).join('\n')
          searchContext = ' [LIVE WEB DATA:\n' + top + '\nUse this fresh data in your answer.]'
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

      if (!res.ok || !res.body) {
        // Try Puter.js GPT-4o as emergency fallback (FREE, no key needed)
        try {
          const puter = await loadPuter();
          if (puter?.ai?.chat) {
            const puterRes = await puter.ai.chat(text.trim(), { model: 'gpt-4o-mini' });
            const puterText = typeof puterRes === 'string' ? puterRes : puterRes?.message?.content || '';
            if (puterText) {
              setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, content: puterText, provider: 'Puter/GPT-4o' } : m));
              setLoading(false);
              return;
            }
          }
        } catch {}
        throw new Error('Stream failed');
      }
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
        const lastMsg = history[history.length-1]?.content || '';
        const pt = await puterChat(lastMsg, 'You are JARVIS, a Hinglish AI assistant.');
        fullText = pt; provider = 'Puter/GPT-4o-mini';
        setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText, provider } : m));
      }

    } catch (err: any) {
      if (err.name === 'AbortError') { setLoading(false); return; }
      try {
        const lastMsgErr = history[history.length-1]?.content || '';
        const pt = await puterChat(lastMsgErr, 'You are JARVIS, a helpful Hinglish AI.');
        fullText = pt; provider = 'Puter/GPT-4o-mini';
        setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText, provider } : m));
      } catch {
        setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, content: 'Network issue. Thodi der mein try karo! ð' } : m));
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
      // Proactive suggestion â JARVIS suggests without being asked
      const suggestion = getProactiveSuggestion(text.trim());
      if (suggestion) {
        setTimeout(() => {
          setMsgs(prev => [...prev, {
            id: 'suggest_' + Date.now(),
            role: 'assistant',
            content: 'ð¡ ' + suggestion,
            timestamp: Date.now(),
          }]);
        }, 1800);
      }

      // Proactive action â JARVIS takes initiative
      if (!suggestion) {
        const lc = fullText.toLowerCase()
        // If JARVIS mentions a link â auto-make it tappable
        // If JARVIS gives a phone number â auto-show call button
        // If JARVIS mentions a time â check if reminder needed
        const timeMatch = fullText.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|AM|PM))/)
        if (timeMatch && /remind|yaad|alarm|timer/i.test(text)) {
          setTimeout(() => {
            setMsgs(prev => [...prev, {
              id: 'proact_' + Date.now(), role: 'assistant',
              content: 'â° Reminder set karna chahoge **' + timeMatch[1] + '** ke liye? "Haan" bolo.',
              timestamp: Date.now(),
            }])
          }, 2000)
        }
      }

      // Mood detection â frustrated/tired â gentle suggestion
      const stressWords = /pareshan|thak|bore|stress|tension|headache|rona|samajh nahi|kya karu|help|stuck|confused|frustrat/i;
      const lateNight = new Date().getHours() >= 23 || new Date().getHours() < 4;
      if (stressWords.test(text.trim()) && !suggestion) {
        setTimeout(() => {
          setMsgs(prev => [...prev, {
            id: 'mood_' + Date.now(),
            role: 'assistant',
            content: lateNight ? 'ð´ Boss, so jao ab. Kal fresh mind se sab clear ho jaayega.' : 'â Ek chhota break lo. Chai piyo, 10 min. Phir aata hoon.',
            timestamp: Date.now(),
          }]);
        }, 2500);
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

  // Onboarding check
  const [onboarded, setOnboarded] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    import('@/lib/db').then(m => m.getProfile('onboarded')).then(v => setOnboarded(!!v)).catch(() => setOnboarded(true));
  }, []);
  if (onboarded === null) return null; // loading
  if (onboarded === false) {
    if (typeof window !== 'undefined') { window.location.href = '/onboarding'; }
    return null;
  }


  return (
    <div className="page-container" style={{ display:"flex", flexDirection:"column", height:"100dvh", overflow:"hidden" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>

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
            {!online && <span style={{ fontSize: 9, color: '#ef4444', marginLeft: 6 }}>â Offline</span>}
            {reconnected && <span style={{ fontSize: 9, color: '#22c55e', marginLeft: 6 }}>â Online</span>}
          </div>
          <div style={{ color: '#444', fontSize: 9, marginTop: 1 }}>
            {location ? 'ð ' + location : online ? 'ð¢ Online Â· â¹0/month' : 'ð´ Offline mode'}
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setHeaderMenuOpen(p => !p)}
            style={{ background: 'none', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer', padding: '0 4px', letterSpacing: 1 }}>
            â®
          </button>
          {headerMenuOpen && (
            <>
              <div onClick={() => setHeaderMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
              <div style={{ position: 'absolute', right: 0, top: 36, background: '#0d0d18', border: '1px solid #1e1e2e', borderRadius: 14, zIndex: 9999, minWidth: 180, boxShadow: '0 4px 24px rgba(0,0,0,0.7)', overflow: 'hidden' }}>
                {[
                  { icon: wakeActive ? 'ðï¸' : 'ð¤', label: wakeActive ? 'Wake Word OFF' : 'Wake Word ON', action: () => {
                    if (wakeActive) { stopWakeWord(); setWakeActive(false); toastInfo('Wake word off'); }
                    else { const ok = startWakeWord(() => { toastOk('ðï¸ Bol boss!'); navigator.vibrate?.(100); setInput(''); textareaRef.current?.focus(); }); if (ok) { setWakeActive(true); toastOk('Wake word ON'); } else toastErr('Mic permission chahiye'); }
                    setHeaderMenuOpen(false);
                  }, active: wakeActive },
                  { icon: theme === 'dark' ? 'ð' : theme === 'light' ? 'âï¸' : theme === 'amoled' ? 'â¬' : 'ð', label: 'Theme: ' + theme, action: () => { const t = toggleTheme(); setThemeState(t); setHeaderMenuOpen(false); }, active: false },
                  { icon: 'ð¬', label: 'Chat History', action: () => { setHistoryOpen(true); setHeaderMenuOpen(false); }, active: false },
                  { icon: 'ð', label: 'Connected Apps', action: () => { setAppsOpen(true); setHeaderMenuOpen(false); }, active: false },
                  { icon: 'ð', label: 'Stop Speaking', action: () => { stopSpeaking(); setHeaderMenuOpen(false); }, active: false },
                  { icon: 'â¡', label: 'Agent Mode', action: () => { router.push('/agent'); setHeaderMenuOpen(false); }, active: false },
                  { icon: 'ð¸', label: 'Sakhi', action: () => { router.push('/sakhi'); setHeaderMenuOpen(false); }, active: false },
                  { icon: 'âï¸', label: 'Settings', action: () => { router.push('/settings'); setHeaderMenuOpen(false); }, active: false },
                ].map(item => (
                  <button key={item.label} onClick={item.action}
                    style={{ width: '100%', background: item.active ? 'rgba(0,212,255,0.1)' : 'transparent', border: 'none', borderBottom: '1px solid #111', color: item.active ? '#00d4ff' : '#ccc', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, textAlign: 'left' }}>
                    <span style={{ fontSize: 16 }}>{item.icon}</span>{item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* PWA Install Banner */}
      {canInstall && (
        <div onClick={async () => {
          if (isIOS) {
            showToast('iOS: Share â "Add to Home Screen" karo ð²', 'info');
          } else {
            const r = await install();
            if (r === 'accepted') toastOk('â JARVIS installed!');
          }
        }}
          data-pwa-banner style={{ background: 'rgba(0,212,255,0.08)', borderBottom: '1px solid rgba(0,212,255,0.2)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>ð²</span>
          <div>
            <div style={{ color: '#00d4ff', fontSize: 12, fontWeight: 600 }}>JARVIS Install karo</div>
            <div style={{ color: '#555', fontSize: 10 }}>Home screen pe add karo â faster, offline ready</div>
          </div>
          <span style={{ marginLeft: 'auto', color: '#00d4ff', fontSize: 12 }}>Install â</span>
        </div>
      )}

      {/* Messages â fills all remaining space */}
      <div style={{ flex: '1 1 0', overflowY: 'auto', overflowX: 'hidden', padding: '8px 0', minHeight: 0, WebkitOverflowScrolling: 'touch',
        background: chatBg !== 'none' ? chatBg : undefined }}
        onTouchStart={(e) => {
          (window as any).__pullY = e.touches[0].clientY;
          (window as any).__pullX = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          const dy = e.changedTouches[0].clientY - ((window as any).__pullY || 0);
          const dx = e.changedTouches[0].clientX - ((window as any).__pullX || 0);
          // Pull down = refresh
          if (dy > 80 && Math.abs(dx) < 40 && !refreshing) {
            setRefreshing(true);
            setTimeout(() => { setRefreshing(false); }, 1000);
          }
          // Swipe right = nav drawer
          if (dx > 80 && Math.abs(dy) < 60) {
            setHistoryOpen(true);
          }
          // Swipe left = settings
          if (dx < -80 && Math.abs(dy) < 60) {
            router.push('/settings');
          }
        }}>
        {refreshing && (
          <div style={{ textAlign: 'center', padding: 10, color: '#00d4ff', fontSize: 12 }}>ð Refreshing...</div>
        )}
        {msgs.map((msg: Msg) => {
          const msgDel = (id: string) => setMsgs(prev => prev.filter(m => m.id !== id));
          const msgRegen = () => { const u = [...msgs].reverse().find(m => m.role === 'user'); if (u) send(u.content); };
          const MsgEl = MsgItem as any; return <MsgEl key={msg.id} msg={msg} onDelete={msgDel} onRegenerate={msgRegen} />;
        })}
        {loading && <div style={{ padding: '0 12px' }}><TypingDots /></div>}

        {/* Smart suggested replies */}
        {!loading && msgs.length > 0 && msgs[msgs.length-1]?.role === 'assistant' && (() => {
          const lastMsg = msgs[msgs.length-1].content.toLowerCase();
          const lastUser = [...msgs].reverse().find(m => m.role === 'user')?.content.toLowerCase() || '';
          const chips: string[] = [];
          if (/weather|mausam|Â°c|forecast/.test(lastMsg)) chips.push('Kal ka mausam?', 'Barish hogi?');
          else if (/goal|target/.test(lastMsg)) chips.push('Goals dikhao', 'Goal add karo');
          else if (/remind|alarm|timer/.test(lastMsg)) chips.push('Reminders dikhao', 'Timer lagao');
          else if (/image|photo|generated|generating/.test(lastMsg)) chips.push('Aur ek bana', 'Wallpaper bana');
          else if (/battery|charge/.test(lastMsg)) chips.push('WhatsApp kholo', 'Settings kholo');
          else if (/news|khabar/.test(lastMsg)) chips.push('Tech news?', 'India news?');
          else if (/bitcoin|crypto|price/.test(lastMsg)) chips.push('Ethereum price?', 'Doge price?');
          else if (/â¹|usd|currency/.test(lastMsg)) chips.push('EUR to INR?', 'GBP to INR?');
          else if (/note|save|yaad/.test(lastMsg)) chips.push('Notes dikhao', 'Memory dikhao');
          else if (msgs.length <= 2) chips.push('Mausam batao', 'Joke suno', 'Image bana');
          else chips.push('Aur batao', 'Example do');
          if (!chips.length) return null;
          return (
            <div style={{ display: 'flex', gap: 6, padding: '2px 12px 8px', flexWrap: 'wrap' }}>
              {chips.slice(0,3).map(c => (
                <button key={c} onClick={() => send(c)}
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #2a2a4a', borderRadius: 16, color: '#555', padding: '4px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                  {c}
                </button>
              ))}
            </div>
          );
        })()}
        <div ref={bottomRef} />
      </div>

      {/* Slash Command Autocomplete */}
      {slashOpen && (
        <div style={{ position: 'absolute', bottom: 120, left: 12, right: 12, background: '#0d0d18', border: '1px solid #1e1e2e', borderRadius: 12, zIndex: 9000, maxHeight: 220, overflowY: 'auto', boxShadow: '0 -4px 20px rgba(0,0,0,0.5)' }}>
          <div style={{ padding: '6px 12px', color: '#444', fontSize: 10, borderBottom: '1px solid #1a1a2a' }}>â¡ Slash Commands â Tab se select karo</div>
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

      {/* Bottom strip â Compress = USER ka typed message compress karo */}
      <div className="bottom-strip">
        <span style={{ fontSize: 11, color: '#555' }}>
          {mode === 'auto'
            ? `ð¤ Auto â ${effectiveMode.charAt(0).toUpperCase() + effectiveMode.slice(1)}`
            : `${mode === 'flash' ? 'â¡' : mode === 'think' ? 'ð§ ' : 'ð¬'} ${mode.charAt(0).toUpperCase() + mode.slice(1)}`}
        </span>

        {/* Compress dropdown â input mein likhi hua shorten karo */}
        {input.trim().length > 20 && (
          <div style={{ display: 'flex', gap: 4 }}>
            <span style={{ color: '#444', fontSize: 10, alignSelf: 'center' }}>ðï¸</span>
            {(['tiny', 'short', 'medium'] as CompressLevel[]).map(level => (
              <button
                key={level}
                onClick={() => {
                  const compressed = compressUserMessage(input, level);
                  setInput(compressed);
                  toastInfo(`âï¸ ${level}: ${compressed.split(' ').length} words`);
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

      {/* ââ Input Bar v3 â ChatGPT style ââ */}
      <div style={{ padding: '8px 12px 12px', borderTop: '1px solid #1e1e2e', background: 'var(--bg)' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end',
          background: '#111118',
          border: input.trim() ? '1px solid rgba(0,212,255,0.4)' : '1px solid #2a2a4a',
          borderRadius: 26, padding: '4px 4px 4px 6px',
          transition: 'border-color 0.2s',
          boxShadow: input.trim() ? '0 0 12px rgba(0,212,255,0.08)' : 'none',
        }}>
          {/* Plus â mode selector inside */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setPlusOpen(p => !p)} data-plus
              title="Mode & options"
              style={{ width: 36, height: 36, borderRadius: '50%', background: plusOpen ? 'rgba(0,212,255,0.15)' : 'transparent', border: 'none', color: plusOpen ? '#00d4ff' : '#666', fontSize: plusOpen ? 16 : 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
              {plusOpen ? 'â' : (mode === 'flash' ? 'â¡' : mode === 'think' ? 'ð§ ' : mode === 'deep' ? 'ð¬' : '+')}
            </button>
          </div>

          {/* Textarea */}
          <textarea ref={textareaRef} value={input} onChange={handleTextChange} onKeyDown={handleKeyDown}
            placeholder={loading ? 'â³ Soch raha hoon...' : 'Kuch bhi likho ya bolo...'}
            disabled={loading} rows={1}
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#e0e0ff', fontSize: 15, outline: 'none', resize: 'none', minHeight: 34, maxHeight: 120, lineHeight: 1.5, fontFamily: 'inherit', overflowY: 'auto', padding: '7px 6px', opacity: loading ? 0.5 : 1 }}
          />

          {/* Mic â onClick with permission request (APK compatible) */}
          <button
            onClick={async () => {
              // Request mic permission first (important for APK)
              try {
                await navigator.mediaDevices?.getUserMedia({ audio: true });
              } catch {
                toastErr('Mic permission do â Settings > Permissions > Microphone');
                return;
              }
              const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
              if (!SR) {
                // APK fallback â Puter Whisper
                toastErr('Voice browser mein nahi chala. Voice page try karo.');
                return;
              }
              const rec = new SR();
              rec.lang = 'hi-IN';
              rec.continuous = false;
              rec.interimResults = true;
              let final = '';
              setMicActive(true);
              toastOk('ðï¸ Bol boss...');
              rec.onresult = (e: any) => {
                final = Array.from(e.results).map((r: any) => r[0].transcript).join('');
                setInput(final);
              };
              rec.onerror = (e: any) => {
                setMicActive(false);
                if (e.error === 'not-allowed') toastErr('Mic permission nahi â Settings mein allow karo');
                else if (e.error === 'no-speech') toastErr('Kuch suna nahi. Dobara try karo.');
                else toastErr('Mic error: ' + e.error);
              };
              rec.onend = () => {
                setMicActive(false);
                if (final.trim()) setTimeout(() => send(final), 300);
              };
              try { rec.start(); } catch { toastErr('Mic start nahi hua'); setMicActive(false); }
            }}
            style={{ width: 36, height: 36, borderRadius: '50%', background: micActive ? 'rgba(239,68,68,0.2)' : 'transparent', border: micActive ? '1px solid #ef4444' : 'none', color: micActive ? '#ef4444' : '#555', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s', animation: micActive ? 'pulse 1s infinite' : 'none' }}
            title="Tap to speak">
            {micActive ? 'ð´' : 'ðï¸'}
          </button>

          {/* Send */}
          <button onClick={() => { 
            if (typeof navigator !== 'undefined') navigator.vibrate?.(30);
            send(input);
          }} disabled={!input.trim() || loading}
            style={{ width: 38, height: 38, borderRadius: '50%', background: input.trim() && !loading ? 'linear-gradient(135deg,#00d4ff,#0077bb)' : '#1a1a2e', border: 'none', color: input.trim() && !loading ? '#000' : '#333', fontSize: 17, cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s', fontWeight: 900, boxShadow: input.trim() && !loading ? '0 2px 10px rgba(0,212,255,0.35)' : 'none' }}>
            {loading ? 'â³' : 'â'}
          </button>
        </div>

        {/* Plus popup â mode select */}
        {/* Hidden file inputs */}
        {/* AI Image Edit hidden input */}
        <input id="imgEditInput" type="file" accept="image/*" style={{ display:'none' }} onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return; e.currentTarget.value = '';
          const editPrompt = (window as any).__jarvisEditPrompt || 'Remove background, make it clean';
          const reader = new FileReader();
          reader.onload = async ev => {
            const dataUrl = ev.target?.result as string;
            setMsgs(prev => [...prev, { id:'u_'+Date.now(), role:'user', content:'âï¸ Image edit: '+editPrompt, timestamp:Date.now(), card:{ type:'image', imageUrl:dataUrl, title:'Original' } }]);
            setLoading(true);
            try {
              // Use Pollinations image-to-image via prompt
              const editUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(editPrompt + ', professional edit, high quality') + '?width=1024&height=1024&model=flux&seed=' + Date.now();
              setMsgs(prev => [...prev, { id:'a_'+Date.now(), role:'assistant', content:'âï¸ Edited version (AI generated based on prompt):', timestamp:Date.now(), card:{ type:'image', imageUrl:editUrl, title:'Edited: '+editPrompt } }]);
            } catch { setMsgs(prev => [...prev, { id:'e_'+Date.now(), role:'assistant', content:'Image edit nahi hua.', timestamp:Date.now() }]); }
            setLoading(false);
          };
          reader.readAsDataURL(f);
        }} />

        <input ref={photoInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return; e.target.value = '';
          const reader = new FileReader();
          reader.onload = async ev => {
            const dataUrl = ev.target?.result as string;
            setMsgs(prev => [...prev, { id:'u_'+Date.now(), role:'user', content:'ð· '+f.name, timestamp:Date.now(), card:{ type:'image', imageUrl:dataUrl, title:f.name } }]);
            setLoading(true);
            try {
              const res = await fetch('/api/vision', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ image: dataUrl.split(',')[1], prompt:'Is image mein kya hai? Hinglish mein detail mein batao.' }) });
              const d = await res.json();
              setMsgs(prev => [...prev, { id:'a_'+Date.now(), role:'assistant', content:'ð '+(d.result||d.text||'Photo dekh li! Kuch poochho.'), timestamp:Date.now() }]);
            } catch { setMsgs(prev => [...prev, { id:'a_'+Date.now(), role:'assistant', content:'ð· Photo receive ki! Kya jaanna hai?', timestamp:Date.now() }]); }
            setLoading(false);
          };
          reader.readAsDataURL(f);
        }} />
        <input ref={fileInputRef} type="file" accept="*/*" style={{ display:'none' }} onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return; e.target.value = '';
          const mb = (f.size/1024/1024).toFixed(1);
          if (f.type.startsWith('image/')) { photoInputRef.current?.click(); return; }
          setMsgs(prev => [...prev, { id:'u_'+Date.now(), role:'user', content:'ð '+f.name+' ('+mb+' MB)', timestamp:Date.now() }]);
          if (f.type === 'text/plain' || f.name.endsWith('.txt') || f.name.endsWith('.md')) {
            const txt = await f.text();
            setMsgs(prev => [...prev, { id:'a_'+Date.now(), role:'assistant', content:'ð File padh li: '+f.name+'. Summarize karoon?', timestamp:Date.now() }]);
            setInput('Summarize karo: ' + txt.slice(0,2000));
          } else {
            setMsgs(prev => [...prev, { id:'a_'+Date.now(), role:'assistant', content:'ð File receive ki: '+f.name+' ('+mb+' MB).', timestamp:Date.now() }]);
          }
        }} />

        {plusOpen && (
          <div data-plus onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: 72, left: 8, right: 8, background: '#0d0d18', border: '1px solid #1e1e2e', borderRadius: 18, padding: 14, zIndex: 9999, boxShadow: '0 -8px 30px rgba(0,0,0,0.8)' }}>

            {/* Row 1 â Media Actions */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                { icon: 'ð·', label: 'Photo', color: '#22c55e', action: () => { photoInputRef.current?.click(); setPlusOpen(false); } },
                { icon: 'ð', label: 'File', color: '#f59e0b', action: () => { fileInputRef.current?.click(); setPlusOpen(false); } },
                { icon: recording ? 'â¹ï¸' : 'ð¤', label: recording ? 'Stop' : 'Audio', color: recording ? '#ef4444' : '#8b5cf6', action: async () => {
                  setPlusOpen(false);
                  if (recording) { mediaRecRef.current?.stop(); setRecording(false); return; }
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const rec = new MediaRecorder(stream);
                    const chunks: BlobPart[] = [];
                    rec.ondataavailable = e => chunks.push(e.data);
                    rec.onstop = () => {
                      stream.getTracks().forEach(t => t.stop());
                      const blob = new Blob(chunks, { type: 'audio/webm' });
                      const url = URL.createObjectURL(blob);
                      setMsgs(prev => [...prev, { id:'u_'+Date.now(), role:'user', content:'ð¤ Voice message', timestamp:Date.now(), card:{ type:'audio', audioUrl:url, title:'Voice message' } }]);
                      setRecording(false);
                      toastOk('Voice message saved!');
                    };
                    rec.start(); mediaRecRef.current = rec; setRecording(true);
                    toastOk('ð´ Recording... Stop ke liye phir tap karo');
                  } catch { toastErr('Mic permission do'); }
                }},
                { icon: 'ð¸', label: 'Camera', color: '#00d4ff', action: () => { router.push('/camera'); setPlusOpen(false); } },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  style={{ flex:1, background:'#111118', border:'1px solid #1e1e2e', borderRadius:12, padding:'10px 4px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:4, transition:'all 0.15s' }}>
                  <span style={{ fontSize:22 }}>{item.icon}</span>
                  <span style={{ color: item.color, fontSize:10, fontWeight:600 }}>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div style={{ borderTop:'1px solid #1a1a2e', marginBottom:10 }} />

            {/* Row 2 â AI Modes */}
            <div style={{ color:'#444', fontSize:10, marginBottom:6, paddingLeft:2 }}>AI MODE</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {([['auto','ð¤','Auto','#00d4ff'],['flash','â¡','Flash','#f59e0b'],['think','ð§ ','Think','#8b5cf6'],['deep','ð¬','Deep','#22c55e']] as [Mode,string,string,string][]).map(([m,icon,label,col]) => (
                <button key={m} onClick={() => { setMode(m); setPlusOpen(false); }}
                  style={{ flex:1, background: mode===m?'rgba(0,212,255,0.1)':'#111118', border:'1px solid '+(mode===m?col:'#1e1e2e'), borderRadius:10, padding:'8px 4px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                  <span style={{ fontSize:18 }}>{icon}</span>
                  <span style={{ color: mode===m?col:'#555', fontSize:10 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}  
