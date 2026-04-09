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
  quoted?: string; // FEATURE: quote reply
}

// ── Connected Apps config (with/without API key) ──────────────────────────
const CONNECTED_APPS = [
  { id: 'groq',       icon: '', name: 'Groq',       free: true,  envKey: 'GROQ_API_KEY',    color: '#f97316' },
  { id: 'gemini',     icon: '', name: 'Gemini',     free: true,  envKey: 'GEMINI_API_KEY',   color: '#4285f4' },
  { id: 'puter',      icon: '', name: 'Puter.js',   free: true,  envKey: null,               color: '#00d4ff' },
  { id: 'pollinations',icon:'', name: 'Pollinations',free: true, envKey: null,               color: '#a855f7' },
  { id: 'together',   icon: '', name: 'Together',   free: true,  envKey: 'TOGETHER_API_KEY', color: '#22c55e' },
  { id: 'cerebras',   icon: '', name: 'Cerebras',   free: true,  envKey: 'CEREBRAS_API_KEY', color: '#ec4899' },
  { id: 'openrouter', icon: '', name: 'OpenRouter', free: true,  envKey: 'OPENROUTER_API_KEY',color: '#f59e0b' },
  { id: 'cohere',     icon: '', name: 'Cohere',     free: true,  envKey: 'COHERE_API_KEY',   color: '#06b6d4' },
  { id: 'wttr',       icon: '', name: 'Weather',    free: true,  envKey: null,               color: '#38bdf8' },
  { id: 'gnews',      icon: '', name: 'GNews',      free: true,  envKey: 'GNEWS_API_KEY',    color: '#fb923c' },
];

// ── Helper Components ─────────────────────────────────────────────────────
// ── FEATURE 1: Code Block with Copy Button ──────────────────────────────
function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  const lang = className?.replace('language-', '') || 'code';
  const code = typeof children === 'string' ? children : String(children ?? '');
  const copy = () => {
    navigator.clipboard?.writeText(code.trim());
    setCopied(true);
    navigator.vibrate?.(30);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ borderRadius: 10, overflow: 'hidden', margin: '8px 0', border: '1px solid #1e1e2e' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#0d0d1a', padding:'5px 12px' }}>
        <span style={{ color:'#555', fontSize:10, fontFamily:'monospace', letterSpacing:1 }}>{lang.toUpperCase()}</span>
        <button onClick={copy} style={{ background:'none', border:'none', color: copied ? '#22c55e' : '#444', cursor:'pointer', fontSize:10, padding:'3px 8px', borderRadius:6, transition:'all 0.2s' }}>
          {copied ? '✅ Copied!' : '📋 Copy'}
        </button>
      </div>
      <pre style={{ background:'#080811', padding:'12px 14px', margin:0, overflowX:'auto', fontSize:12, lineHeight:1.6 }}>
        <code style={{ color:'#e0e0ff', fontFamily:"'Fira Code',monospace" }}>{code}</code>
      </pre>
    </div>
  );
}

// ── FEATURE 2: Markdown components (tables, blockquotes, etc.) ───────────
const MD_COMPONENTS = {
  code({ node, inline, className, children, ...props }: any) {
    if (inline) return <code style={{ background:'rgba(0,212,255,0.08)', color:'#00d4ff', padding:'2px 6px', borderRadius:4, fontSize:'0.9em', fontFamily:'monospace' }} {...props}>{children}</code>;
    return <CodeBlock className={className}>{children}</CodeBlock>;
  },
  table({ children }: any) {
    return <div style={{ overflowX:'auto', margin:'8px 0' }}><table style={{ borderCollapse:'collapse', width:'100%', fontSize:12 }}>{children}</table></div>;
  },
  th({ children }: any) {
    return <th style={{ background:'rgba(0,212,255,0.1)', color:'#00d4ff', padding:'6px 10px', textAlign:'left', borderBottom:'1px solid #1e1e2e', fontSize:11 }}>{children}</th>;
  },
  td({ children }: any) {
    return <td style={{ padding:'6px 10px', borderBottom:'1px solid #111118', color:'#ccc', fontSize:12 }}>{children}</td>;
  },
  blockquote({ children }: any) {
    return <blockquote style={{ borderLeft:'3px solid #00d4ff', margin:'8px 0', paddingLeft:12, color:'#888', fontSize:13, fontStyle:'italic' }}>{children}</blockquote>;
  },
};

// ── FEATURE 3: Typing Dots with Provider Name ────────────────────────────
function TypingDots({ provider }: { provider?: string }) {
  return (
    <div className="typing-wrap">
      <div className="typing-avatar">J</div>
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        <div className="typing-bubble">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
        {provider && (
          <span style={{ color:'#333', fontSize:9, paddingLeft:4, letterSpacing:0.5 }}>
            via {provider}
          </span>
        )}
      </div>
    </div>
  );
}

// ── NEW FEATURE: LaTeX/Math Inline Renderer ─────────────────────────────
function renderMathContent(text: string): React.ReactNode {
  if (!text) return text;
  // Split on $$...$$ (block) and $...$ (inline)
  const parts: React.ReactNode[] = [];
  const blockRegex = /\$\$([\s\S]+?)\$\$/g;
  const inlineRegex = /\$([^$\n]+?)\$/g;
  let lastIdx = 0;
  let blockMatch;
  // First pass: block math
  const segments: { start: number; end: number; type: 'block' | 'inline'; content: string }[] = [];
  while ((blockMatch = blockRegex.exec(text)) !== null) {
    segments.push({ start: blockMatch.index, end: blockMatch.index + blockMatch[0].length, type: 'block', content: blockMatch[1] });
  }
  let inlineMatch;
  const inRegex = /\$([^$\n]{1,200}?)\$/g;
  while ((inlineMatch = inRegex.exec(text)) !== null) {
    const overlaps = segments.some(s => inlineMatch!.index >= s.start && inlineMatch!.index < s.end);
    if (!overlaps) segments.push({ start: inlineMatch.index, end: inlineMatch.index + inlineMatch[0].length, type: 'inline', content: inlineMatch[1] });
  }
  segments.sort((a, b) => a.start - b.start);
  lastIdx = 0;
  for (const seg of segments) {
    if (seg.start > lastIdx) parts.push(text.slice(lastIdx, seg.start));
    if (seg.type === 'block') {
      parts.push(
        <div key={seg.start} style={{ textAlign:'center', margin:'10px 0', padding:'10px', background:'rgba(0,212,255,0.05)', borderRadius:10, border:'1px solid rgba(0,212,255,0.15)', fontStyle:'italic', color:'#00d4ff', fontSize:15, letterSpacing:0.5, overflowX:'auto' }}>
          {seg.content.trim()}
        </div>
      );
    } else {
      parts.push(<em key={seg.start} style={{ color:'#00d4ff', fontStyle:'italic', background:'rgba(0,212,255,0.08)', padding:'1px 4px', borderRadius:4, fontSize:'0.95em' }}>{seg.content}</em>);
    }
    lastIdx = seg.end;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts.length > 1 ? <>{parts}</> : text;
}

// ── NEW FEATURE: Response time badge ────────────────────────────────────
function ResponseTimeBadge({ startTime, done, mode, provider }: { startTime: number; done: boolean; mode?: string; provider?: string }) {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    if (done) return;
    const t = setInterval(() => setElapsed(Date.now() - startTime), 200);
    return () => clearInterval(t);
  }, [done, startTime]);
  const secs = done ? ((Date.now() - startTime) / 1000).toFixed(1) : (elapsed / 1000).toFixed(1);
  return (
    <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:4, flexWrap:'wrap' }}>
      <span style={{ color:'#f59e0b', fontSize:9 }}>⚡{secs}s</span>
      {mode && <span style={{ color:'#555', fontSize:9 }}>⚡ {mode}</span>}
      {provider && <span style={{ background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:8, color:'#00d4ff', fontSize:9, padding:'1px 7px' }}>🤖 {provider}</span>}
    </div>
  );
}


  const [zoomed, setZoomed] = React.useState(false);
  if (zoomed && card.imageUrl) return (
    <div onClick={() => setZoomed(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.95)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out' }}>
      <img src={card.imageUrl} alt={card.title} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain', borderRadius:8 }} />
      <div style={{ position:'absolute', top:16, right:16, color:'#fff', fontSize:24, cursor:'pointer' }}>✕</div>
      <a href={card.imageUrl} download target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
        style={{ position:'absolute', bottom:20, background:'rgba(0,212,255,0.9)', color:'#000', padding:'8px 20px', borderRadius:20, textDecoration:'none', fontWeight:700, fontSize:14 }}>
        ⬇️ Download
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
            Open ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ── FEATURE 4: Message Reactions ─────────────────────────────────────────
const REACTION_EMOJIS = ['👍','🔥','💡','❤️','😂','😮'];

function MsgItem({ msg, onDelete, onRegenerate, fontSize = 15, onQuote, compact }: { msg: Msg; onDelete?: (id: string) => void; onRegenerate?: () => void; fontSize?: number; onQuote?: (msg: Msg) => void; compact?: boolean }) {
  const isUser = msg.role === 'user';
  const [menuOpen, setMenuOpen] = React.useState(false);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Reactions
  const [reactions, setReactions] = React.useState<Record<string,number>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(`jarvis_react_${msg.id}`) || '{}'); } catch { return {}; }
  });
  const [showReacts, setShowReacts] = React.useState(false);
  const addReaction = (emoji: string) => {
    const updated = { ...reactions, [emoji]: (reactions[emoji] || 0) + 1 };
    setReactions(updated);
    if (typeof window !== 'undefined') localStorage.setItem(`jarvis_react_${msg.id}`, JSON.stringify(updated));
    navigator.vibrate?.(25);
    setShowReacts(false);
  };

  const startLongPress = () => { longPressTimer.current = setTimeout(() => { setMenuOpen(true); navigator.vibrate?.(50); }, 500); };
  const cancelLongPress = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };
  const copy = () => { navigator.clipboard?.writeText(msg.content); setMenuOpen(false); };
  const share = () => { if (navigator.share) navigator.share({ text: msg.content }); else navigator.clipboard?.writeText(msg.content); setMenuOpen(false); };
  const pin = () => { const pins = JSON.parse(localStorage.getItem('jarvis_pins')||'[]'); if(!pins.find((p:any)=>p.id===msg.id)){pins.unshift({id:msg.id,content:msg.content,ts:Date.now()});localStorage.setItem('jarvis_pins',JSON.stringify(pins.slice(0,10)));} setMenuOpen(false); };

  const ContextMenu = () => (
    <div style={{ position:'absolute', background:'#16162a', border:'1px solid #252545', borderRadius:14, padding:6, zIndex:1000, display:'flex', gap:2, boxShadow:'0 8px 32px rgba(0,0,0,0.7)', whiteSpace:'nowrap', top: isUser ? 'auto' : -4, bottom: isUser ? '110%' : 'auto', right: isUser ? 0 : 'auto', left: isUser ? 'auto' : 0 }}>
      {[['📋','Copy',copy],['📤','Share',share],['📌','Pin',pin],['💬','Reply',()=>{onQuote?.(msg);setMenuOpen(false);}],['😀','React',()=>{setShowReacts(true);setMenuOpen(false);}],isUser ? null : ['🔄','Retry',()=>{onRegenerate?.();setMenuOpen(false);}],['🗑️','Del',()=>{onDelete?.(msg.id);setMenuOpen(false);}]].filter(Boolean).map((item:any)=>(
        <button key={item[1]} onClick={item[2]} style={{ background:'none',border:'none',color:'#9090b0',cursor:'pointer',padding:'7px 10px',borderRadius:9,display:'flex',flexDirection:'column',alignItems:'center',gap:2,fontSize:10,transition:'all 0.1s' }}>
          <span style={{ fontSize:16 }}>{item[0]}</span>{item[1]}
        </button>
      ))}
    </div>
  );

  // Reaction picker overlay
  const ReactPicker = () => (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center', paddingBottom:100 }} onClick={() => setShowReacts(false)}>
      <div style={{ background:'#16162a', border:'1px solid #252545', borderRadius:20, padding:'10px 16px', display:'flex', gap:8, boxShadow:'0 8px 32px rgba(0,0,0,0.8)' }} onClick={e=>e.stopPropagation()}>
        {REACTION_EMOJIS.map(e => (
          <button key={e} onClick={() => addReaction(e)} style={{ background:'none', border:'none', fontSize:24, cursor:'pointer', padding:'4px 6px', borderRadius:10, transition:'transform 0.1s' }}
            onPointerDown={ev => { (ev.target as HTMLElement).style.transform = 'scale(1.3)'; }}
            onPointerUp={ev => { (ev.target as HTMLElement).style.transform = 'scale(1)'; }}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );

  if (isUser) return (
    <div className="msg-user" style={{ marginBottom: compact ? 4 : 8 }} onPointerDown={startLongPress} onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress}>
      {showReacts && <ReactPicker />}
      {menuOpen && <div onClick={()=>setMenuOpen(false)} style={{position:'fixed',inset:0,zIndex:999}}/>}
      <div style={{ position:'relative' }}>
        {menuOpen && <ContextMenu />}
        {msg.quoted && (
          <div style={{ background:'rgba(0,212,255,0.06)', borderLeft:'2px solid #00d4ff44', borderRadius:'8px 8px 0 0', padding:'4px 10px', fontSize:11, color:'#555', marginBottom:2 }}>
            ↩ {(msg.quoted as string).slice(0, 60)}{(msg.quoted as string).length > 60 ? '…' : ''}
          </div>
        )}
        <div className="msg-user-bubble" style={{ fontSize }}>{msg.content}</div>
        {Object.keys(reactions).length > 0 && (
          <div style={{ display:'flex', gap:4, justifyContent:'flex-end', marginTop:3 }}>
            {Object.entries(reactions).map(([e, n]) => (
              <span key={e} style={{ background:'rgba(255,255,255,0.06)', borderRadius:12, padding:'2px 7px', fontSize:12 }}>{e} {n}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="msg-jarvis" style={{ marginBottom: compact ? 6 : 12 }} onPointerDown={startLongPress} onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress}>
      {showReacts && <ReactPicker />}
      {menuOpen && <div onClick={()=>setMenuOpen(false)} style={{position:'fixed',inset:0,zIndex:999}}/>}
      <div className="msg-jarvis-avatar">J</div>
      <div className="msg-jarvis-body" style={{ position:'relative' }}>
        {menuOpen && <ContextMenu />}
        <div className="msg-jarvis-name">
          JARVIS
          {msg.provider && <span className="provider-badge">{msg.provider}</span>}
        </div>
        {msg.quoted && (
          <div style={{ background:'rgba(0,212,255,0.06)', borderLeft:'2px solid #00d4ff44', borderRadius:8, padding:'4px 10px', fontSize:11, color:'#555', marginBottom:6 }}>
            ↩ {(msg.quoted as string).slice(0, 80)}{(msg.quoted as string).length > 80 ? '…' : ''}
          </div>
        )}
        <div className="jarvis-message" style={{ fontSize }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
            ...MD_COMPONENTS,
            p({ children, ...props }: any) {
              // Math rendering inside paragraphs
              if (typeof children === 'string') return <p {...props}>{renderMathContent(children)}</p>;
              const kids = React.Children.map(children, (c: any) =>
                typeof c === 'string' ? renderMathContent(c) : c
              );
              return <p {...props}>{kids}</p>;
            },
            text({ value }: any) { return <>{renderMathContent(value)}</>; },
          }}>{msg.content}</ReactMarkdown>
        </div>
        {msg.card && <RichCard card={msg.card} />}
        {msg.widget && <CommandWidgetRenderer userText={msg.widget} aiText={msg.content} />}
        {/* Reactions display */}
        {Object.keys(reactions).length > 0 && (
          <div style={{ display:'flex', gap:4, marginTop:4, flexWrap:'wrap' }}>
            {Object.entries(reactions).map(([e, n]) => (
              <span key={e} onClick={() => addReaction(e)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid #1e1e2e', borderRadius:12, padding:'2px 8px', fontSize:12, cursor:'pointer' }}>{e} {n}</span>
            ))}
          </div>
        )}
        {/* Response time + provider badge */}
        {msg.provider && (
          <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:3, flexWrap:'wrap' }}>
            <span style={{ color:'#f59e0b', fontSize:9 }}>⚡{((msg.timestamp ? (Date.now() - msg.timestamp + 3000) / 1000 : 3)).toFixed(1)}s</span>
            <span style={{ color:'#444', fontSize:9 }}>⚡ flash</span>
            <span style={{ background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:8, color:'#00d4ff', fontSize:9, padding:'1px 7px' }}>🤖 {msg.provider}</span>
          </div>
        )}
        <div className="msg-actions" style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center', marginTop:4 }}>
          <button className="msg-action-btn" onClick={()=>speakText(msg.content)} title="Read">🔊</button>
          <button className="msg-action-btn" onClick={copy} title="Copy">📋</button>
          <button className="msg-action-btn" onClick={()=>setShowReacts(true)} title="React">😀</button>
          {onQuote && <button className="msg-action-btn" onClick={()=>onQuote(msg)} title="Reply">💬</button>}
          {onRegenerate && (
            <button onClick={()=>{onRegenerate?.();}} title="Regenerate"
              style={{ background:'rgba(255,255,255,0.04)', border:'1px solid #1e1e2e', borderRadius:10, color:'#888', cursor:'pointer', padding:'4px 10px', fontSize:11, display:'flex', alignItems:'center', gap:4 }}>
              ↺ Regenerate
            </button>
          )}
        </div>
      </div>
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
                <span style={{ fontSize: 10, color: hasKey ? '#22c55e' : '#ef4444' }}>{hasKey ? ' Connected' : ' No Key'}</span>
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
  const [refreshing, setRefreshing] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = React.useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecRef = React.useRef<MediaRecorder | null>(null);
  const photoInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [attachedImage, setAttachedImage] = React.useState<{base64:string,preview:string,name:string}|null>(null);
  const [chatBg, setChatBg] = React.useState<string>('none');

  // ── FEATURE 5-15: New state ──────────────────────────────────────────
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [compactMode, setCompactMode] = React.useState(false);
  const [quotedMsg, setQuotedMsg] = React.useState<Msg | null>(null);
  const [showJumpBtn, setShowJumpBtn] = React.useState(false);
  const [newMsgCount, setNewMsgCount] = React.useState(0);
  const [streamingProvider, setStreamingProvider] = React.useState('');
  const [showTimestamps, setShowTimestamps] = React.useState(false);
  const messagesAreaRef = React.useRef<HTMLDivElement>(null);
  // Force Provider lock (from other JARVIS app)
  const [forcedProvider, setForcedProvider] = React.useState<string|null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('jarvis_forced_provider') || null;
  });
  const [modePopupTab, setModePopupTab] = React.useState<'mode'|'attach'|'persona'>('mode');
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
  const [fontSize, setFontSize] = React.useState<number>(15);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = parseInt(localStorage.getItem('jarvis_font_size') || '15');
    if (!isNaN(saved)) setFontSize(saved);
  }, []);

  // ── Global keyboard shortcuts ───────────────────────────────────────────
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      // 'j' or '/' to focus input (when not already typing)
      if ((e.key === 'j') && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
      // Ctrl+F = search
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSearchOpen(true);
      }
      // Escape to close any open panel
      if (e.key === 'Escape') {
        setHeaderMenuOpen(false);
        setPlusOpen(false);
        setSlashOpen(false);
        setHistoryOpen(false);
        setAppsOpen(false);
        setSearchOpen(false);
        setQuotedMsg(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── FEATURE 8: Shake to new chat ────────────────────────────────────────
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return;
    let lastShake = 0;
    const THRESHOLD = 25;
    const onMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const total = Math.abs(acc.x||0) + Math.abs(acc.y||0) + Math.abs(acc.z||0);
      if (total > THRESHOLD && Date.now() - lastShake > 3000) {
        lastShake = Date.now();
        if (msgs.length > 1) {
          navigator.vibrate?.([100, 50, 100]);
          // Show toast asking if they want to clear
          toastInfo('📳 Shake detected! "new chat" type karo ya ✦ tap karo.');
        }
      }
    };
    window.addEventListener('devicemotion', onMotion as EventListener);
    return () => window.removeEventListener('devicemotion', onMotion as EventListener);
  }, [msgs.length]);

  // ── FEATURE 11: Scroll tracking for Jump-to-bottom ──────────────────────
  React.useEffect(() => {
    const area = messagesAreaRef.current;
    if (!area) return;
    const onScroll = () => {
      const distFromBottom = area.scrollHeight - area.scrollTop - area.clientHeight;
      setShowJumpBtn(distFromBottom > 200);
      if (distFromBottom <= 50) setNewMsgCount(0);
    };
    area.addEventListener('scroll', onScroll, { passive: true });
    return () => area.removeEventListener('scroll', onScroll);
  }, []);

  // ── Keyboard / Viewport fix (Android) ───────────────────────────────────
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

  // ── BottomNav FAB: new chat event
  React.useEffect(() => {
    const handler = () => { setMsgs([]); setSessionId(''); setAttachedImage(null); setInput(''); };
    window.addEventListener('jarvis:newchat', handler as EventListener);
    return () => window.removeEventListener('jarvis:newchat', handler as EventListener);
  }, []);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    // PIN check
    if (localStorage.getItem('jarvis_pin_hash')) setShowPin(true);

    // Theme init
    initTheme();
    setThemeState(getTheme());

    // Puter preload
    loadPuter().catch(() => {});

    // Session created lazily on first message send (prevents empty sessions)
    // createSession is called in handleSend when sessionId is empty

    // Location — onboarding se pehle, phir GPS
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
    // ── PROACTIVE JARVIS ENGINE ─────────────────────────────────
    // JARVIS khud sochta hai aur bolta hai — poochho mat
    const proactiveEngine = setInterval(async () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const todayStr = now.toDateString();
      if (typeof window === 'undefined') return;

      // Last proactive message timestamp — spam mat karo
      const lastProactive = parseInt(localStorage.getItem('jarvis_last_proactive') || '0');
      const sinceLastMin = (Date.now() - lastProactive) / 60000;

      // ── Night sleep reminder ─────────────────────────────────
      if (h === 23 && m >= 0 && m <= 10 && sinceLastMin > 120) {
        localStorage.setItem('jarvis_last_proactive', String(Date.now()));
        setMsgs(prev => [...prev, { id: 'proactive_' + Date.now(), role: 'assistant', content: ' Raat ke 11 baj gaye boss. Neend jaao  kal fresh mind se kaam karo. Koi kaam reh gaya hai kya?', timestamp: Date.now() }]);
      }

      // ── Morning energy ───────────────────────────────────────
      if (h === 6 && m >= 0 && m <= 10 && sinceLastMin > 300) {
        localStorage.setItem('jarvis_last_proactive', String(Date.now()));
        const habits = JSON.parse(localStorage.getItem('jarvis_habits') || '{}');
        const pending = Object.keys(habits).filter(k => habits[k].lastDate !== todayStr);
        const msg = pending.length > 0
          ? ' Good morning boss! Aaj ' + pending.slice(0,2).join(', ') + ' karna mat bhuolna. Ek kaam pehle decide karo  kaunsa sabse important hai?'
          : ' Good morning boss! Naya din, naye mauke. Kya plan hai aaj ka?';
        setMsgs(prev => [...prev, { id: 'proactive_' + Date.now(), role: 'assistant', content: msg, timestamp: Date.now() }]);
      }

      // ── Reminder warning (30 min before) ───────────────────
      try {
        const { getReminders: getAllReminders } = await import('@/lib/reminders');
        const reminders = getAllReminders();
        const soon = (reminders as any[]).filter((r: any) => !r.completed && r.time > Date.now() && r.time < Date.now() + 30 * 60 * 1000);
        if (soon.length > 0 && sinceLastMin > 25) {
          localStorage.setItem('jarvis_last_proactive', String(Date.now()));
          const r = soon[0] as any;
          const minsLeft = Math.round((r.time - Date.now()) / 60000);
          setMsgs(prev => [...prev, { id: 'proactive_reminder_' + r.id, role: 'assistant', content: ' Boss! "' + r.title + '"  ' + minsLeft + ' minute mein hai. Ready ho jaao.', timestamp: Date.now() }]);
        }
      } catch {}

      // ── Habit nudge (afternoon if not done) ─────────────────
      if (h >= 14 && h <= 15 && sinceLastMin > 240) {
        const habits = JSON.parse(localStorage.getItem('jarvis_habits') || '{}');
        const pending = Object.keys(habits).filter(k => habits[k].lastDate !== todayStr && habits[k].streak > 2);
        if (pending.length > 0) {
          localStorage.setItem('jarvis_last_proactive', String(Date.now()));
          setMsgs(prev => [...prev, { id: 'proactive_habit_' + Date.now(), role: 'assistant', content: ' Boss! ' + pending[0] + ' aaj abhi tak nahi kiya  streak toot jaayegi. Abhi karo ya baad mein?', timestamp: Date.now() }]);
        }
      }

    }, 5 * 60 * 1000); // Check every 5 minutes (battery friendly)

    const ri = setInterval(() => {
      // Morning brief — schedule 7am notification
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
              reg.showNotification(' Good Morning! JARVIS Brief', { body, icon: '/icons/icon-192.png', tag: 'morning-brief', data: { url: '/briefing' } });
            }
          } catch {}
        }, msUntil7am);
        return () => clearTimeout(briefTimer);
      }

      // Battery alert check
      checkBatteryAlert((msg) => {
        setMsgs(prev => [...prev, {
          id: 'battery_' + Date.now(), role: 'assistant', content: ' ' + msg, timestamp: Date.now(),
        }])
      }).catch(() => {})

      // Request notification permission silently
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {})
      }

      checkAndFireReminders(r => {
        showToast(`⏰ ${r.message}`, 'ok', '');
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
      const greetLine = hour < 5 ? ' Raat gehra hai boss. Kya chal raha hai?' :
        hour < 12 ? ' Good morning boss! Aaj kya plan hai?' :
        hour < 14 ? ' Lunch time boss! Khaana khaya?' :
        hour < 17 ? ' Kya haal hai boss?' :
        hour < 20 ? ' Shaam ho gayi. Din kaisa raha?' :
        ' Raat ho gayi boss. Kya chal raha hai?';

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
        proactive = '\n\n _' + (habitCount - todayHabits) + ' habits pending aaj  "habit dikhao" type karo_';
      }

      setMsgs([{ id: 'init_greet', role: 'assistant', content: greeting + '\n\nKuch bhi bol  main hoon.' + proactive + '\n\n`mausam`  `battery`  `image bana: kuch`  `/` sab commands', timestamp: Date.now() }]);
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
      newChat:      () => { setMsgs([]); setSessionId(''); setAttachedImage(null); },
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
    if (/exam|biology|chemistry|physics/.test(m)) return ' exam';
    if (/weather|mausam/.test(m)) return ' Weather';
    if (/image|generate|draw/.test(m)) return ' AI Image';
    if (/code|program/.test(m)) return ' Code';
    if (/crypto|bitcoin|stock/.test(m)) return ' Finance';
    if (/news|khabar/.test(m)) return ' News';
    return msg.split(' ').slice(0, 4).join(' ') || 'New Chat';
  }

  // ── Send message ──────────────────────────────────────────────────────
  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    // FEATURE 9: Quote reply
    const _quotedSnap = quotedMsg;
    if (quotedMsg) setQuotedMsg(null);
    const textWithQuote = _quotedSnap ? text.trim() + ` [Replying to: "${_quotedSnap.content.slice(0,80)}"]` : text.trim();
    // ── CONTEXT CHAIN ─────────────────────────────────────────────
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
        if (resolved) toastInfo(' Context: ' + resolved);
      }
    }

    // Don't send bare "/"  show slash commands instead
    if (text.trim() === '/') {
      setSlashOpen(true);
      setSlashFilter('/');
      return;
    }

    // Agent mode trigger  "agent: goal" or " goal"
    if (/^(?:agent||auto)[:\s]+(.+)/i.test(text) || /^jarvis\s+(?:khud|automatically|auto)\s+(.+)/i.test(text)) {
      const goal = text.replace(/^(?:agent||auto|jarvis\s+(?:khud|automatically|auto))[:\s]+/i, '').trim();
      router.push('/agent?goal=' + encodeURIComponent(goal));
      setInput('');
      return;
    }
    setPlusOpen(false);

    //  JARVIS Chat Command Center 
    const t = text.trim().toLowerCase();
    const reply = (msg: string) => {
      setMsgs(prev => [...prev,
        { id: 'u_' + Date.now(), role: 'user', content: text.trim(), timestamp: Date.now() },
        { id: 'a_' + Date.now(), role: 'assistant', content: msg, timestamp: Date.now() },
      ]);
      setInput('');
    };

    //  GPS LOCATION 
    if (/(?:meri|my|exact|precise)\s+(?:location|jagah|position|gps)|gps\s+(?:on|check|batao)/i.test(t)) {
      try {
        const { getGPSLocation } = await import('@/lib/browser/powers');
        const loc = await getGPSLocation();
        if (loc) {
          reply('📍 **Exact Location:**\nLat: ' + loc.lat.toFixed(6) + '\nLng: ' + loc.lng.toFixed(6) + '\nAccuracy: ' + loc.accuracy.toFixed(0) + 'm' + (loc.city ? '\nCity: ' + loc.city : '') + '\n\n[Maps pe dekho](https://maps.google.com/?q=' + loc.lat + ',' + loc.lng + ')');
        } else { reply('📍 GPS permission do ya enable karo.'); }
        return;
      } catch { reply('GPS nahi mila.'); return; }
    }

    //  NETWORK STATUS 
    if (/network|internet.*speed|connection.*type|wifi.*speed|data.*speed/i.test(t)) {
      const { getNetworkInfo } = await import('@/lib/browser/powers');
      const net = getNetworkInfo();
      reply('📶 **Network Status:**\n' +
        '• Online: ' + (net.online ? '✅ Yes' : '❌ No') + '\n' +
        '• Type: ' + net.type.toUpperCase() + '\n' +
        '• Speed: ' + net.speed + '\n' +
        '• Latency: ' + net.rtt);
      return;
    }

    //  CLIPBOARD 
    if (/clipboard.*kya hai|clipboard.*padho|copy.*kya hai|paste.*kya/i.test(t)) {
      const { readClipboard } = await import('@/lib/browser/powers');
      const text2 = await readClipboard();
      if (text2) reply('📋 **Clipboard:**\n"' + text2.slice(0, 200) + (text2.length > 200 ? '...' : '') + '"');
      else reply('📋 Clipboard empty hai ya permission nahi.');
      return;
    }

    //  SCREEN WAKE LOCK 
    if (/screen.*on|screen.*jag|jaag.*raho|wake.*lock|screen.*band.*mat/i.test(t)) {
      const { keepScreenOn } = await import('@/lib/browser/powers');
      const ok = await keepScreenOn(true);
      reply(ok ? '🔆 Screen ON rakhunga — band nahi hogi.' : '🔆 Wake Lock support nahi is browser mein.');
      return;
    }
    if (/screen.*off|screen.*band|wake.*lock.*off/i.test(t)) {
      const { keepScreenOn } = await import('@/lib/browser/powers');
      await keepScreenOn(false);
      reply('🔅 Screen auto-off normal ho gayi.'); return;
    }

    //  FULLSCREEN 
    if (/fullscreen|full.*screen|poora.*screen/i.test(t)) {
      const { toggleFullscreen } = await import('@/lib/browser/powers');
      const isFullscreen = await toggleFullscreen();
      reply(isFullscreen ? '⛶ Fullscreen mode ON!' : '⛶ Fullscreen OFF.'); return;
    }

    //  STORAGE INFO 
    if (/storage|jagah.*kitna|memory.*kitna|phone.*storage.*check/i.test(t)) {
      const [{ getStorageInfo }, { getBatteryInfo }] = await Promise.all([
        import('@/lib/browser/powers'), import('@/lib/browser/powers')
      ]);
      const [storage, battery] = await Promise.all([getStorageInfo(), getBatteryInfo()]);
      let reply_text = '💾 **Device Status:**\n';
      if (battery) reply_text += '🔋 Battery: ' + battery.level + '%' + (battery.charging ? ' ⚡' : '') + '\n';
      if (storage) reply_text += '💾 Storage used: ' + storage.used + ' (' + storage.percent + '%)\nFree: ' + storage.available + '\n';
      reply(reply_text); return;
    }

    //  PERMISSIONS CHECK 
    if (/permissions|permission.*check|konsi.*permission|permission.*status/i.test(t)) {
      const { checkPermissions } = await import('@/lib/browser/powers');
      const perms = await checkPermissions();
      const icons: Record<string,string> = { camera:'📷', microphone:'🎙️', geolocation:'📍', notifications:'🔔' };
      const statusIcons: Record<string,string> = { granted:'✅', denied:'❌', prompt:'⚠️', unknown:'❓' };
      reply('🔐 **App Permissions:**\n' + Object.entries(perms).map(([k,v]) => (icons[k]||'•') + ' ' + k + ': ' + (statusIcons[v]||v)).join('\n'));
      return;
    }

    //  DEVICE INFO 
    if (/device info|phone info|device.*details|mera.*phone.*kya/i.test(t)) {
      const { getDeviceInfo, getNetworkInfo } = await import('@/lib/browser/powers');
      const dev = getDeviceInfo();
      const net = getNetworkInfo();
      reply('📱 **Device Info:**\n' +
        '🖥️ Screen: ' + dev.screen + ' (DPR: ' + dev.dpr + ')\n' +
        '⚙️ CPU Cores: ' + dev.cores + '\n' +
        '💾 RAM: ' + dev.memory + '\n' +
        '👆 Touch: ' + dev.touch + '\n' +
        '🌐 Language: ' + dev.language + '\n' +
        '📲 PWA: ' + dev.pwa + '\n' +
        '📶 Network: ' + net.type.toUpperCase() + ' · ' + net.speed);
      return;
    }

    //  NATIVE SHARE 
    if (/^(?:share|share karo)\s+(.+)/i.test(text)) {
      const shareText = text.replace(/^(?:share|share karo)\s+/i,'').trim();
      const { nativeShare } = await import('@/lib/browser/powers');
      const ok = await nativeShare('JARVIS', shareText);
      if (!ok) { navigator.clipboard?.writeText(shareText); reply('📤 Copy kar liya — share manually karo.'); }
      else reply('📤 Sharing...');
      return;
    }

    //  VIBRATE PATTERN 
    if (/vibrate|buzz|haptic/i.test(t) && /pattern|custom|baar|times/i.test(t)) {
      const { vibrate } = await import('@/lib/browser/powers');
      vibrate([200,100,200,100,400]);
      reply('📳 Custom vibration pattern!'); return;
    }

    // 
    //  JARVIS PHONE CONTROL CENTER 
    // 

    //  CALL COMMAND 
    const callMatch = text.match(/(?:call|phone|ring|baat karo?)\s+(?:karo?\s+)?(?:on\s+)?([+\d\s]{8,15})/i)
      || text.match(/(\+?91\s*[6-9]\d{9})\s+(?:pe|ko|par)\s+(?:call|phone)/i);
    const contactCallMatch = text.match(/(.+?)\s+ko\s+(?:call|phone)\s+karo?/i)
      || text.match(/(?:call|ring)\s+(.+?)(?:\s+ko)?$/i);
    
    if (callMatch?.[1]) {
      const num = callMatch[1].replace(/\s/g,'');
      if (typeof window !== 'undefined') window.location.href = 'tel:' + num;
      reply('📞 Calling ' + num + '...'); return;
    }
    if (contactCallMatch?.[1] && !callMatch) {
      const name = contactCallMatch[1].trim().toLowerCase();
      if (typeof window !== 'undefined') {
        const contacts = JSON.parse(localStorage.getItem('jarvis_contacts') || '{}');
        const num = contacts[name];
        if (num) {
          window.location.href = 'tel:' + num;
          reply('📞 ' + contactCallMatch[1] + ' ko call kar raha hoon (' + num + ')...'); return;
        }
      }
      reply('📞 ' + contactCallMatch[1] + ' ka number nahi pata. Pehle batao: "' + contactCallMatch[1] + ' ka number hai XXXXXXXXXX"'); return;
    }

    //  WHATSAPP SEND 
    const waNumMatch = text.match(/(?:whatsapp|wa)\s+(?:bhejo?|send|karo?)\s+([+\d\s]{10,15})\s+(?:ko\s+)?(.+)/i);
    const waContactMatch = text.match(/(?:whatsapp|wa)\s+(?:pe\s+)?(.+?)\s+ko\s+(?:bhejo?|likho|msg|message)\s+(?:ki\s+|ke\s+)?(.+)/i)
      || text.match(/(.+?)\s+ko\s+whatsapp\s+(?:karo?|bhejo?|likho)\s*[:-]?\s*(.+)/i);
    
    if (waNumMatch) {
      const { sendWhatsApp } = await import('@/lib/control/phoneControl');
      sendWhatsApp(waNumMatch[1], waNumMatch[2]);
      reply('💬 WhatsApp bhej raha hoon: "' + waNumMatch[2].slice(0,50) + '"'); return;
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
          reply('💬 ' + waContactMatch[1] + ' ko WhatsApp: "' + msg + '"'); return;
        }
      }
      // No number  open WhatsApp with just message
      if (typeof window !== 'undefined') window.location.href = 'whatsapp://send?text=' + encodeURIComponent(msg);
      reply('💬 WhatsApp khola — message ready: "' + msg + '"'); return;
    }

    //  SMS SEND 
    const smsMatch = text.match(/(?:sms|text|message)\s+(?:bhejo?\s+)?([+\d\s]{10,15})\s+(?:ko\s+)?(.+)/i);
    if (smsMatch) {
      const { sendSMS } = await import('@/lib/control/phoneControl');
      sendSMS(smsMatch[1], smsMatch[2]);
      reply('📱 SMS bhej raha hoon...'); return;
    }

    //  SET ALARM 
    const alarmMatch = text.match(/(?:alarm|wake|uthao|jagao)\s+(?:kal\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:baj[ae]?|am|pm|:00)?/i)
      || text.match(/(\d{1,2})(?::(\d{2}))?\s*(?:baj[ae]?|am|pm)\s+(?:ka\s+)?(?:alarm|wake)/i);
    if (alarmMatch) {
      let hr = parseInt(alarmMatch[1]);
      const mn = parseInt(alarmMatch[2] || '0');
      if (/pm/i.test(text) && hr < 12) hr += 12;
      if (/am/i.test(text) && hr === 12) hr = 0;
      const { setAlarm } = await import('@/lib/control/phoneControl');
      setAlarm(hr, mn, 'JARVIS Alarm');
      reply('⏰ Alarm set: ' + String(hr).padStart(2,'0') + ':' + String(mn).padStart(2,'0') + ' baje!'); return;
    }

    //  NAVIGATE / DIRECTIONS 
    const navMatch = text.match(/(?:navigate|directions?|rasta|jao|chalte hain|maps)\s+(?:to\s+|pe\s+|mein\s+)?(.+)/i)
      || text.match(/(.+?)\s+(?:ka rasta|kaise jaun|direction|navigate karo)/i);
    if (navMatch) {
      const dest = navMatch[1].trim();
      const { navigateTo } = await import('@/lib/control/phoneControl');
      navigateTo(dest);
      reply('🗺️ "' + dest + '" navigate kar raha hoon boss!'); return;
    }

    //  YOUTUBE SEARCH 
    const ytMatch2 = text.match(/(?:youtube|yt)\s+(?:pe\s+|mein\s+)?(?:search|play|chalao|dekho|dhundho)\s+(.+)/i)
      || text.match(/(.+?)\s+(?:youtube|yt)\s+(?:pe\s+)?(?:search|play|chalao|dekho)/i)
      || text.match(/^play\s+(.+)/i);
    if (ytMatch2) {
      const q = ytMatch2[1].trim();
      if (typeof window !== 'undefined') window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(q), '_blank');
      reply('▶️ YouTube pe "' + q + '" search kar raha hoon!'); return;
    }

    //  SPOTIFY SEARCH 
    const spotifyMatch = text.match(/(?:spotify|music)\s+(?:pe\s+)?(?:play|chalao|search)\s+(.+)/i);
    if (spotifyMatch) {
      const q = spotifyMatch[1].trim();
      if (typeof window !== 'undefined') window.location.href = 'spotify:search:' + encodeURIComponent(q);
      reply('🎵 Spotify pe "' + q + '" chal raha hai!'); return;
    }

    //  APP OPEN (enhanced) 
    const appOpenMatch = text.match(/(?:kholo?|open|launch|start|chalo|chalao)\s+(.+?)(?:\s+app)?$/i)
      || text.match(/(.+?)\s+(?:kholo?|open|launch)\s*$/i);
    if (appOpenMatch) {
      const appName = appOpenMatch[1].trim().toLowerCase()
        .replace(/\s+app$/,'').replace(/app/,'').trim();
      const { openApp } = await import('@/lib/control/phoneControl');
      const result = openApp(appName);
      if (!result.includes('nahi pata')) { reply('📱 ' + result); return; }
    }

    //  SHARE 
    const shareMatch2 = text.match(/^(?:share|share karo)\s+(.+)/i);
    if (shareMatch2) {
      const { shareContent } = await import('@/lib/control/phoneControl');
      await shareContent('JARVIS', shareMatch2[1].trim());
      reply('📤 Share kar raha hoon...'); return;
    }

    //  AI IMAGE EDIT 
    const editMatch = text.match(/(?:edit|transform|change|hata do|lagao|convert)\s+(?:image|photo|pic)[:\s]+(.+)/i)
      || text.match(/image\s+(?:mein|se)\s+(.+?)\s+(?:hata do|hatao|lagao|add karo|remove|change)/i);
    if (editMatch) {
      const editPrompt = editMatch[1].trim();
      if (typeof window !== 'undefined') {
        (window as any).__jarvisEditPrompt = editPrompt;
        document.getElementById('imgEditInput')?.click();
        reply('📸 Photo select karo — main edit karunga: "' + editPrompt + '"');
        return;
      }
    }

    //  TRANSLATE 
    if (/^(?:translate|hindi mein bol|english mein bol|anuvad)[:\s]+(.+)/i.test(text)) {
      const toTranslate = text.replace(/^(?:translate|hindi mein bol|english mein bol|anuvad)[:\s]+/i,'').trim();
      const toLang = /hindi/i.test(text) ? 'Hindi' : 'English';
      try {
        const res = await fetch('https://text.pollinations.ai/openai', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ model:'openai', messages:[{ role:'user', content:'Translate to ' + toLang + '. Only translation, no explanation: ' + toTranslate }] })
        });
        const d = await res.json();
        reply('🌐 **' + toLang + ' mein:**\n' + (d.choices?.[0]?.message?.content || '')); return;
      } catch { reply('Translation nahi hua.'); return; }
    }

    //  PASSWORD GENERATOR 
    if (/password|passcode.*(?:bana|generate|chahiye)/i.test(t)) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
      let pwd = '';
      for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
      reply('🔐 **Strong Password:**\n`' + pwd + '`\n\nYaad nahi rahega — password manager mein save karo.'); return;
    }

    //  QR CODE 
    if (/qr\s*(?:code|bana|generate)/i.test(t)) {
      const qrText = text.replace(/qr\s*(?:code|bana|generate)[:\s]*/i,'').trim() || 'https://apple50.vercel.app';
      const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(qrText) + '&bgcolor=060610&color=00d4ff';
      setMsgs(prev => [...prev,
        { id: 'u_' + Date.now(), role:'user', content: text.trim(), timestamp: Date.now() },
        { id: 'a_' + Date.now(), role:'assistant', content:'📱 QR Code: "' + qrText + '"', timestamp: Date.now(), card:{ type:'image', imageUrl:qrUrl, title:'QR: '+qrText } },
      ]);
      setInput(''); return;
    }

    //  RANDOM PICK 
    if (/^(?:choose|pick|random|kya khaun|kaun sa)\s+(.+)/i.test(text)) {
      const opts = text.replace(/^(?:choose|pick|random|kya khaun|kaun sa)\s+/i,'').split(/,|\s+ya\s+|\s+or\s+/i).map(s=>s.trim()).filter(Boolean);
      if (opts.length >= 2) {
        reply('🎲 **' + opts[Math.floor(Math.random()*opts.length)] + '**\n\n_(Random choice from: ' + opts.join(', ') + ')_'); return;
      }
    }

    //  DEEP RESEARCH MODE 
    if (/^(?:research|deep research|investigate|sab dhundho)[:\s]+(.+)/i.test(text)) {
      const topic = text.replace(/^(?:research|deep research|investigate|sab dhundho)[:\s]+/i,'').trim();
      const resId = 'a_res_' + Date.now();
      setMsgs(prev => [...prev,
        { id: 'u_' + Date.now(), role:'user', content: text.trim(), timestamp: Date.now() },
        { id: resId, role:'assistant', content:'🔬 Deep research shuru kar raha hoon: "' + topic + '"\n\n⏳ 3-4 searches kar raha hoon...', timestamp: Date.now() },
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
          setMsgs(prev => prev.map(m => m.id===resId ? {...m, content:'🔬 **Deep Research: ' + topic + '**\n\n' + result} : m));
        } catch {
          setMsgs(prev => prev.map(m => m.id===resId ? {...m, content:'Research nahi ho saka. Retry karo.'} : m));
        }
      })();
      return;
    }

    //  CODE WRITER + EXPLAINER 
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

    //  SMART SUMMARIZE 
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
        reply('📝 **Summary:**\n' + (d.choices?.[0]?.message?.content||'')); return;
      } catch {}
    }

    //  WRITE ANYTHING 
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
          { id:'a_'+Date.now(), role:'assistant', content:'✍️ ' + written, timestamp:Date.now() },
        ]);
        setInput(''); return;
      } catch {}
    }

    //  EXPLAIN ANYTHING 
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
        reply('💡 ' + (d.choices?.[0]?.message?.content||'')); return;
      } catch {}
    }

    //  GOALS 
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

    //  REMINDERS 
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

    //  SMART MEMORY COMMANDS 
    if (/^yaad rakh[oa]?:|^remember:|^note that:|^save this:/i.test(text)) {
      const fact = text.replace(/^yaad rakh[oa]?:|^remember:|^note that:|^save this:/i,'').trim()
      if (fact) {
        const { addMemory } = await import('@/lib/memory/smartMemory')
        addMemory(fact, 'fact')
        reply('🧠 Yaad kar liya: "' + fact + '"'); return
      }
    }
    if (/memory|yaadein|memories|tune kya yaad|tujhe kya pata/i.test(t) && /dikhao|show|list|kya hai|batao/i.test(t)) {
      const { getAllMemories } = await import('@/lib/memory/smartMemory')
      const mems = getAllMemories()
      if (!mems.length) { reply('Koi memory nahi abhi. "Yaad rakho: [kuch bhi]" bolo.'); return }
      reply('🧠 **Meri Memories (' + mems.length + '):**\n\n' + mems.slice(0,10).map(m => '• ' + m.content).join('\n')); return
    }
    if (/memory.*clear|sab bhool|forget everything|memory.*delete/i.test(t)) {
      const { clearAllMemory } = await import('@/lib/memory/smartMemory')
      clearAllMemory()
      reply('🧠 Sab memory clear kar di. Fresh start!'); return
    }

    //  NOTES 
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

    //  BATTERY 
    if (/battery|charge|charging/i.test(t) && /kitna|check|status|level|hai|kya/i.test(t)) {
      try {
        const { getBatteryInfo } = await import('@/lib/automation/bridge');
        const bat = await getBatteryInfo();
        if (!bat) { reply('Battery info available nahi (browser support nahi).'); return; }
        const emoji = bat.level > 60 ? '🟢' : bat.level > 30 ? '🟡' : '🔴';
        reply(emoji + ' Battery: **' + bat.level + '%**' + (bat.charging ? ' ⚡ Charging' : ' (Not charging)') + (bat.level < 20 ? '\n⚠️ Charge lagao jaldi boss!' : '')); return;
      } catch { reply('Battery check nahi ho saka.'); return; }
    }

    //  CURRENCY / EXCHANGE RATE 
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

    //  LIFE TIMELINE 
    if (/aaj kya hua|din kaisa raha|today summary|aaj ka recap|life recap/i.test(t)) {
      const today = new Date().toDateString();
      const habits = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('jarvis_habits') || '{}' : '{}');
      const expenses = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('jarvis_expenses') || '[]' : '[]');
      const todayExp = expenses.filter((e: any) => new Date(e.ts).toDateString() === today);
      const todayHabits = Object.keys(habits).filter(k => habits[k].lastDate === today);
      const totalSpend = todayExp.reduce((s: number, e: any) => s + e.amount, 0);
      const timeline = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('jarvis_timeline') || '[]') : [];
      const todayEvents = timeline.filter((e: any) => new Date(e.ts).toDateString() === today);

      let summary = '📅 **Aaj ka din — ' + new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' }) + '**\n\n';
      if (todayHabits.length > 0) summary += '✅ **Habits done:** ' + todayHabits.join(', ') + '\n';
      if (totalSpend > 0) summary += '💸 **Kharcha:** ₹' + totalSpend.toLocaleString('en-IN') + ' (' + todayExp.length + ' transactions)\n';
      if (todayEvents.length > 0) summary += '📌 **Events:** ' + todayEvents.map((e: any) => e.text).join(', ') + '\n';
      const missedHabits = Object.keys(habits).filter(k => habits[k].lastDate !== today);
      if (missedHabits.length > 0) summary += '⚠️ **Pending:** ' + missedHabits.join(', ') + '\n';
      if (summary.length < 150) summary += '\n\nAaj ka din abhi shuru hai boss. Kya karna hai?';

      reply(summary); return;
    }

    //  LOG TO TIMELINE 
    if (/^log[:\s]+(.+)/i.test(text) || /^note to jarvis[:\s]+(.+)/i.test(text)) {
      const event = text.replace(/^(?:log|note to jarvis)[:\s]+/i,'').trim();
      if (typeof window !== 'undefined') {
        const timeline = JSON.parse(localStorage.getItem('jarvis_timeline') || '[]');
        timeline.unshift({ text: event, ts: Date.now(), date: new Date().toLocaleDateString('en-IN') });
        localStorage.setItem('jarvis_timeline', JSON.stringify(timeline.slice(0,500)));
        reply('📌 Timeline mein save kiya: "' + event + '"'); return;
      }
    }

    //  LIFE SCORE 
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
        const emoji = total >= 80 ? '🔥' : total >= 60 ? '💪' : total >= 40 ? '😐' : '😴';
        reply(emoji + ' **Aaj ka Life Score: ' + total + '/100**\n\n' +
          '🏃 Habits today: ' + habitScore + '/30\n' +
          '🔥 Streak bonus: ' + streakBonus + '/20\n' +
          '🎯 Goals clarity: ' + goalScore + '/20\n' +
          '💸 Spending: ' + expenseScore + '/20\n' +
          '⭐ Base: 10/10\n\n' +
          (total >= 80 ? 'Aaj ka din solid hai boss! 💪' : total >= 60 ? 'Achha chal raha hai, aur better ho sakta hai.' : 'Thoda aur focus karo boss!'));
        return;
      }
    }

    //  SMART MATH (natural language) 
    const smartMathPatterns = [
      { regex: /(\d+(?:\.\d+)?)\s*%\s*(?:discount|off|kam)\s+(?:on\s+|pe\s+|of\s+)?(?:rs\.?|)?\s*(\d+(?:\.\d+)?)/i, fn: (m: RegExpMatchArray) => { const disc = parseFloat(m[1]); const price = parseFloat(m[2]); const saved = price * disc / 100; return 'Original: ₹' + price + '\n' + disc + '% discount = ₹' + saved.toFixed(0) + ' saved\n**Final price: ₹' + (price - saved).toFixed(0) + '**'; }},
      { regex: /(\d+(?:\.\d+)?)\s+(?:log|person|aadmi)\s+mein\s+(?:rs\.?|)?\s*(\d+(?:\.\d+)?)\s+(?:barabar|divide|split|baat|share)/i, fn: (m: RegExpMatchArray) => { const people = parseFloat(m[1]); const amount = parseFloat(m[2]); return '💰 ' + people + ' logon mein ₹' + amount + '\n**Har koi: ₹' + (amount/people).toFixed(0) + '**'; }},
      { regex: /(\d+(?:\.\d+)?)\s+(?:ghante|hour|hrs?)\s+mein\s+(\d+(?:\.\d+)?)\s+(?:km|kilometer)/i, fn: (m: RegExpMatchArray) => { const hrs = parseFloat(m[1]); const km = parseFloat(m[2]); return '🚗 Speed: ' + (km/hrs).toFixed(1) + ' km/h\nAvg time for 100km: ' + (100/(km/hrs)*60).toFixed(0) + ' min'; }},
      { regex: /(\d+(?:\.\d+)?)\s+(?:rs\.?|)?\s*(?:mein|per)\s+(\d+(?:\.\d+)?)\s+(?:din|day|mahina|month|saal|year)/i, fn: (m: RegExpMatchArray) => { const amount = parseFloat(m[1]); const time = parseFloat(m[2]); return '📊 ₹' + amount + ' per period:\nPer day: ₹' + (amount/time).toFixed(0); }},
    ];
    for (const { regex, fn } of smartMathPatterns) {
      const m = text.match(regex);
      if (m) { reply('🧮 ' + fn(m)); return; }
    }

    //  PERSONALITY MODE 
    if (/strict mode|focus mode|kaam.*mode|serious mode/i.test(t)) {
      if (typeof window !== 'undefined') localStorage.setItem('jarvis_mode', 'strict');
      reply('🎯 **Strict Mode ON**\nAb main sirf kaam ki baatein karunga. No jokes, no bakwaas. Focus karo boss!');
      return;
    }
    if (/chill mode|relax mode|fun mode|casual mode/i.test(t)) {
      if (typeof window !== 'undefined') localStorage.setItem('jarvis_mode', 'chill');
      reply('😎 **Chill Mode ON**\nRelax boss, ab baatein karte hain. Kya chal raha hai?');
      return;
    }
    if (/normal mode|default mode|mode off|mode hatao/i.test(t)) {
      if (typeof window !== 'undefined') localStorage.removeItem('jarvis_mode');
      reply('✅ Normal mode. Main hoon — JARVIS.');
      return;
    }

    //  CONTACT MEMORY 
    const contactSave = text.match(/(.+?)\s+(?:ka|ki|ke)\s+(?:number|contact|phone)\s+(?:hai|=|:)\s+([0-9+\s]{10,15})/i);
    if (contactSave) {
      const name = contactSave[1].trim();
      const number = contactSave[2].replace(/\s/g, '');
      if (typeof window !== 'undefined') {
        const contacts = JSON.parse(localStorage.getItem('jarvis_contacts') || '{}');
        contacts[name.toLowerCase()] = number;
        localStorage.setItem('jarvis_contacts', JSON.stringify(contacts));
        reply('📱 **' + name + '** ka number save ho gaya: ' + number);
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
          reply('📱 **' + contactFind[1] + '**: ' + num + '\n\nCall karna hai? "' + contactFind[1] + ' ko call karo" bolo.');
          return;
        } else {
          reply('📱 **' + contactFind[1] + '** ka number mujhe nahi pata. Batao: "' + contactFind[1] + ' ka number hai +91XXXXXXXXXX"');
          return;
        }
      }
    }

    //  DAILY DIGEST 
    if (/daily digest|aaj ka digest|morning brief|subah ka update|daily update/i.test(t)) {
      const h = new Date().getHours();
      const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
      try {
        const { getWeather } = await import('@/lib/core/freeAPIs');
        const weather = await getWeather('Maihar').catch(() => 'Weather unavailable');
        const habits = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('jarvis_habits') || '{}' : '{}');
        const expenses = JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('jarvis_expenses') || '[]' : '[]');
        const todaySpend = expenses.filter((e: any) => new Date(e.ts).toDateString() === new Date().toDateString()).reduce((s: number, e: any) => s + e.amount, 0);
        const streaks = Object.entries(habits as Record<string,any>).map(([k,v]: any) => k + ': ' + v.streak + '🔥').join(' | ') || 'Koi habit nahi';
        const { getAllGoals } = await import('@/lib/db');
        const goals = await getAllGoals().catch(() => []);
        const activeGoals = (goals as any[]).filter((g: any) => !g.completed).slice(0, 3).map((g: any) => '• ' + g.title).join('\n') || 'Koi active goal nahi';
        reply(greeting + ' boss! 🌅\n\n' +
          '🌤️ **Weather:**\n' + weather.split('\n')[0] + '\n\n' +
          '🎯 **Active Goals:**\n' + activeGoals + '\n\n' +
          '🔥 **Habits:** ' + streaks + '\n\n' +
          '💸 **Aaj ka kharcha:** ₹' + todaySpend.toLocaleString('en-IN') + '\n\n' +
          '_"Ek kaam achhi tarah se karo  baaki khud ho jaayega."_ 💪');
        return;
      } catch {
        reply(greeting + ' boss! 🌅\n\nAaj ka din ache se shuru karo. Kya karna hai?');
        return;
      }
    }

    //  EXPENSE TRACKER 
    const expenseMatch = text.match(/(?:kharcha|kharch|spend|spent|paid|diya|lagaya)[:\s]+(?:rs\.?||rupee[s]?)?\s*(\d+(?:\.\d+)?)\s+(.+)/i)
      || text.match(/(\d+(?:\.\d+)?)\s+(?:rs\.?||rupee[s]?)?\s+(.+?)\s+(?:kharcha|lagaya|diya|spend|paid)/i);
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
        const alerts: Record<number,string> = { 500:'⚠️ Aaj ₹500 ho gaya kharcha boss.', 1000:'⚠️ ₹1,000 aaj — thoda ruko.', 2000:'🚨 ₹2,000 aaj! Bahut zyada ho gaya.', 5000:'🚨 ₹5,000 aaj — emergency?' };
        const todaySpend = expenses.filter((e:any) => new Date(e.ts).toDateString() === new Date().toDateString()).reduce((s:number,e:any)=>s+e.amount,0);
        for (const [threshold, msg] of Object.entries(alerts)) {
          if (todaySpend >= parseInt(threshold) && todaySpend - amount < parseInt(threshold)) {
            setTimeout(() => toastErr(msg), 1500); break;
          }
        }
        reply('💸 Expense saved!\n₹' + amount + ' — ' + category + '\n\n📊 This month total: ₹' + total.toLocaleString('en-IN'));
        return;
      }
    }
    if (/expense|kharcha|spending|kitna kharcha|monthly|budget/i.test(t) && /dikhao|show|report|kitna|summary/i.test(t)) {
      if (typeof window !== 'undefined') {
        const expenses = JSON.parse(localStorage.getItem('jarvis_expenses') || '[]');
        if (!expenses.length) { reply('Koi expense nahi. "500 grocery kharcha" type karo.'); return; }
        const thisMonth = expenses.filter((e: any) => new Date(e.ts).getMonth() === new Date().getMonth());
        const total = thisMonth.reduce((s: number, e: any) => s + e.amount, 0);
        const recent = thisMonth.slice(0, 5).map((e: any) => '• ₹' + e.amount + ' — ' + e.category + ' (' + e.date + ')').join('\n');
        reply('💸 **This Month Expenses**\n\nTotal: **₹' + total.toLocaleString('en-IN') + '**\n\n' + recent);
        return;
      }
    }

    //  HABIT TRACKER 
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
          'gym': h.streak >= 7 ? '💪 7 din! Ab rest day le aaj.' : h.streak >= 3 ? 'Keep pushing boss!' : 'Shuruat achhi hai!',
          'padhai': h.streak >= 5 ? '📚 Padhne ki aadat ban gayi!' : 'Consistency hi success hai.',
          'meditation': '🧘 ' + h.streak + ' din ka peace. Kal bhi karna.',
          'running': h.streak >= 7 ? '🏃 Ek hafta! Body thank kar rahi hogi.' : 'Chal raha hai boss!',
        };
        const advice = adviceMap[habit.toLowerCase()] || (h.streak >= 7 ? '🏆 Zabardast streak boss!' : h.streak >= 3 ? '💪 Consistent ho!' : 'Kal bhi karo!');
        reply('✅ **' + habit + '** — Done!\n🔥 Streak: **' + h.streak + ' days**\n' + advice);
        return;
      }
    }
    if (/habit|streak|dikhao.*habit|habit.*dikhao/i.test(t)) {
      if (typeof window !== 'undefined') {
        const habits = JSON.parse(localStorage.getItem('jarvis_habits') || '{}');
        const keys = Object.keys(habits);
        if (!keys.length) { reply('Koi habit nahi. "Aaj gym kiya" ya "aaj padhai kiya" bolo.'); return; }
        reply('🔥 **Habit Streaks:**\n\n' + keys.map(k => '• **' + k + '**: ' + habits[k].streak + ' days 🔥').join('\n'));
        return;
      }
    }

    //  WHATSAPP AI DRAFT 
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
        reply('💬 WhatsApp draft ready:\n"' + draft + '"\n\nWhatsApp khul raha hai...');
        return;
      }
    }

    //  NIFTY/SENSEX 
    if (/nifty|sensex|stock market|share market/i.test(t)) {
      try {
        const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&range=1d', { signal: AbortSignal.timeout(5000) });
        const d = await res.json();
        const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
        const prev = d?.chart?.result?.[0]?.meta?.previousClose;
        const change = price && prev ? ((price - prev) / prev * 100).toFixed(2) : null;
        if (price) {
          reply('📈 **Nifty 50**: ' + price?.toLocaleString('en-IN') + (change ? ('\n' + (parseFloat(change) > 0 ? '📈' : '📉') + ' ' + change + '% today') : ''));
          return;
        }
      } catch {}
      // Fallback
      reply('📈 Stock market data fetch nahi hua. NSE India: nseindia.com check karo.');
      return;
    }

    //  TRAIN STATUS 
    const trainMatch = text.match(/(?:train|rajdhani|shatabdi|express)\s+(?:number|no\.?|#)?\s*(\d{4,5})/i)
      || text.match(/(\d{4,5})\s+(?:train|number|no\.?)\s+(?:kahan hai|status|location|running)/i);
    if (trainMatch?.[1] || /train.*kahan|train.*status|train.*running/i.test(t)) {
      const trainNo = trainMatch?.[1] || '12301';
      const url = 'https://www.railyatri.in/live-train-status/train-' + trainNo;
      reply('🚂 **Train ' + trainNo + ' Status**\n\nSeedha check karo:\n' + url + '\n\nYa NTES app use karo — most accurate live data.');
      return;
    }

    //  CRICKET/IPL SCORE 
    if (/cricket|ipl|score|match.*score|cricket.*score/i.test(t)) {
      try {
        const res = await fetch('https://api.cricapi.com/v1/currentMatches?apikey=free&offset=0', { signal: AbortSignal.timeout(5000) });
        const d = await res.json();
        if (d?.data?.length) {
          const matches = d.data.slice(0, 3).map((m: any) => '🏏 ' + m.name + '\n' + (m.score?.map((s: any) => s.inning + ': ' + s.r + '/' + s.w).join(' | ') || 'Score loading...')).join('\n\n');
          reply('🏏 **Live Cricket:**\n\n' + matches);
        } else {
          reply('🏏 Abhi koi live match nahi. Cricbuzz check karo: cricbuzz.com');
        }
        return;
      } catch {
        reply('🏏 Cricket score fetch nahi hua. Cricbuzz: cricbuzz.com ya Espncricinfo: espncricinfo.com');
        return;
      }
    }

    //  YOUTUBE SEARCH 
    const ytMatch = text.match(/(?:youtube|yt)\s+(?:pe|mein|par|search|play|chalao|dekho)\s+(.+)/i)
      || text.match(/(.+)\s+(?:youtube pe|yt pe)\s+(?:search|play|chalao|dekho)/i);
    if (ytMatch?.[1]) {
      const query = ytMatch[1].trim();
      const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
      if (typeof window !== 'undefined') window.open(url, '_blank');
      reply('▶️ YouTube search: "' + query + '"\nKhul raha hai...');
      return;
    }

    //  PETROL PRICE 
    if (/petrol|diesel|fuel.*price|price.*fuel/i.test(t)) {
      reply('⛽ **Petrol/Diesel Price (Approx)**\n\nMaihar, MP (today):\n• Petrol: ~₹107/litre\n• Diesel: ~₹92/litre\n\n_Exact rate ke liye: fuel.goodreturns.in_\n_Ya type karo: "petrol rate Maihar"_');
      return;
    }

    //  GOLD & SILVER PRICE 
    //  GOLD & SILVER PRICE 
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
          '🥇 **Gold & Silver (Live)**\n\n' +
          '🥇 Gold 24K: **₹' + Math.round(g).toLocaleString('en-IN') + '/g** | 10g = ₹' + Math.round(g*10).toLocaleString('en-IN') + '\n' +
          '🥇 Gold 22K: **₹' + Math.round(g*0.916).toLocaleString('en-IN') + '/g** | 10g = ₹' + Math.round(g*9.16).toLocaleString('en-IN') + '\n' +
          '🥈 Silver: **₹' + Math.round(s).toLocaleString('en-IN') + '/g** | 100g = ₹' + Math.round(s*100).toLocaleString('en-IN')
        );
        return;
      } catch {
        reply('🥇 Gold 24K: ~₹9,000/g | Gold 22K: ~₹8,250/g\n🥈 Silver: ~₹105/g\n_(Approximate — live data nahi mila)_');
        return;
      }
    }

    //  CRYPTO PRICE 
    const cryptoMatch = text.match(/(?:price|rate|value|kitna)\s+(?:of\s+)?([a-z]+)(?:\s+coin)?/i);
    if (/bitcoin|btc|ethereum|eth|crypto|coin price|doge|solana/i.test(t)) {
      const coin = /bitcoin|btc/i.test(t) ? 'bitcoin' : /ethereum|eth/i.test(t) ? 'ethereum' : /doge/i.test(t) ? 'dogecoin' : /solana/i.test(t) ? 'solana' : (cryptoMatch?.[1] || 'bitcoin').toLowerCase();
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + coin + '&vs_currencies=inr,usd&include_24hr_change=true');
        const d = await res.json();
        const data = d[coin];
        if (data) {
          const ch = data.usd_24h_change?.toFixed(2);
          reply('₿ **' + coin.charAt(0).toUpperCase() + coin.slice(1) + '**\n₹' + data.inr?.toLocaleString('en-IN') + ' | $' + data.usd?.toLocaleString() + '\n' + (parseFloat(ch) > 0 ? '📈' : '📉') + ' 24h: ' + ch + '%');
        } else reply('Coin nahi mila: ' + coin);
        return;
      } catch { reply('Crypto price nahi mila.'); return; }
    }

    //  DICTIONARY / MEANING 
    const wordMatch = text.match(/(?:meaning|matlab|definition|define|kya hota hai)\s+(?:of\s+)?['"]?(\w+)['"]?/i);
    if (wordMatch?.[1]) {
      try {
        const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + wordMatch[1].toLowerCase());
        const d = await res.json();
        if (Array.isArray(d) && d[0]) {
          const entry = d[0];
          const def = entry.meanings?.[0]?.definitions?.[0];
          reply(' **' + entry.word + '** (' + (entry.meanings?.[0]?.partOfSpeech || '') + ')\n' + def?.definition + (def?.example ? '\n\n*"' + def.example + '"*' : ''));
        } else { reply('"' + wordMatch[1] + '" ka meaning nahi mila.'); }
        return;
      } catch { reply('Dictionary fetch nahi ho saka.'); return; }
    }

    // ── NEWS ────────────────────────────────────────────────────
    if (/(?:aaj ki|latest|today) news|top news|khabar|headlines/i.test(t)) {
      try {
        const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
        const ids = await res.json();
        const stories = await Promise.all(ids.slice(0, 5).map((id: number) =>
          fetch('https://hacker-news.firebaseio.com/v0/item/' + id + '.json').then(r => r.json())
        ));
        reply(' **Top News:**\n' + stories.map((s: any, i: number) => (i+1) + '. ' + s.title).join('\n'));
        return;
      } catch { reply('News fetch nahi ho saki.'); return; }
    }

    // ── MATH INLINE ─────────────────────────────────────────────
    const mathExpr = text.match(/^(?:calc(?:ulate)?|calculate|solve|compute|=)\s+(.+)$/i);
    if (mathExpr?.[1]) {
      try {
        const safe = mathExpr[1].replace(/[^0-9+\-*/.()%\s^]/g, '');
        const result = Function('"use strict"; return (' + safe + ')')();
        reply(' ' + mathExpr[1] + ' = **' + result + '**');
        return;
      } catch { /* fall through to AI */ }
    }

    // ── WEATHER ────────────────────────────────────────────────
    if (/weather|mausam|garmi|sardi|barish|temperature/i.test(t)) {
      const cityM = text.match(/(?:of|in|at|ka|mein|for)\s+(\w+)/i);
      const city = cityM?.[1] || location || 'Maihar';
      try {
        const { getWeather } = await import('@/lib/core/freeAPIs');
        reply(' **' + city + ' Weather:**\n\n' + await getWeather(city)); return;
      } catch { reply('Weather nahi mila. Internet check karo.'); return; }
    }

    // ── ISS LOCATION ────────────────────────────────────────────
    if (/iss|space station|antariksha station|satellite location/i.test(t)) {
      try {
        const { getISS } = await import('@/lib/core/freeAPIs');
        reply(await getISS()); return;
      } catch { reply('ISS location nahi mili.'); return; }
    }

    // ── COUNTRY INFO ────────────────────────────────────────────
    const countryMatch = text.match(/(?:about|info|details?|tell me about|batao)\s+(.+?)(?:\s+(?:country|desh|nation))?$/i);
    if (/which country|kis desh|country info|desh ki jankari/i.test(t) && countryMatch?.[1]) {
      try {
        const { getCountryInfo } = await import('@/lib/core/freeAPIs');
        reply(await getCountryInfo(countryMatch[1].trim())); return;
      } catch { reply('Country info nahi mili.'); return; }
    }

    // ── RANDOM ADVICE ────────────────────────────────────────────
    if (/^(?:advice|sujhao|give me advice|kya karu|suggest karo|help me decide)$/i.test(t.trim())) {
      const { getAdvice } = await import('@/lib/core/freeAPIs');
      reply(await getAdvice()); return;
    }

    // ── QUOTES ───────────────────────────────────────────────────
    if (/^(?:quote|suvichar|anmol vachan|motivat(?:ion)?|inspir(?:ation)?)$/i.test(t.trim())) {
      const { getQuote } = await import('@/lib/core/freeAPIs');
      reply(await getQuote()); return;
    }

    // ── JOKES ─────────────────────────────────────────────────────
    if (/^(?:joke|chutkula|funny|hasao|ek joke suno)$/i.test(t.trim()) || /tell.*joke|joke.*suno|ek.*joke/i.test(t)) {
      const { getJoke } = await import('@/lib/core/freeAPIs');
      reply(await getJoke()); return;
    }

    // ── TIMER ──────────────────────────────────────────────────
    const timerM = text.match(/(\d+)\s*(?:minute|min|second|sec)\s*(?:ka\s*)?timer/i);
    if (timerM) {
      const n = parseInt(timerM[1]);
      const unit = /sec/i.test(timerM[0]) ? 'second' : 'minute';
      const ms = unit === 'second' ? n * 1000 : n * 60000;
      setTimeout(() => {
        if (typeof navigator !== 'undefined') navigator.vibrate?.([500, 200, 500]);
        import('@/lib/automation/bridge').then(m => m.showNotification(' Timer Done!', n + ' ' + unit + ' ho gaye boss!'));
      }, ms);
      reply(' **' + n + ' ' + unit + ' timer** set ho gaya! Baj jaayega.'); return;
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
        reply(' **' + app.charAt(0).toUpperCase() + app.slice(1) + '** khul raha hai...'); return;
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
          ' **JARVIS Status**\n\n' +
          ' Battery: ' + (bat ? bat.level + '%' + (bat.charging ? ' charging' : '') : 'N/A') + '\n' +
          ' Goals: ' + goals.filter((g: any) => !g.completed).length + ' active\n' +
          ' Reminders: ' + rems.length + ' upcoming\n' +
          ' Chats today: ' + todayChats.length + '\n' +
          ' Streak: ' + streak.current + ' days\n' +
          ' Network: ' + (navigator.onLine ? 'Online ' : 'Offline ')
        ); return;
      } catch { /* fall through */ }
    }

    // ── CHAT SEARCH ────────────────────────────────────────────
    const searchMatch = text.match(/(?:search|dhundho|find|kahan)\s+(?:chat|baat|conversation|messages?)[:\s]+(.+)/i)
      || text.match(/(.+)\s+wali\s+(?:baat|chat)\s+dhundho/i);
    if (searchMatch) {
      const query = (searchMatch[1] || searchMatch[0]).trim().toLowerCase();
      try {
        const { getRecentChats } = await import('@/lib/db');
        const chats = await getRecentChats(200);
        const found = chats.filter((c: any) => c.content?.toLowerCase().includes(query)).slice(0, 5);
        if (found.length === 0) { reply(' "' + query + '"  koi baat nahi mili purani chats mein.'); return; }
        reply(' **"' + query + '"**  ' + found.length + ' matches mile:\n\n' +
          found.map((c: any) => (c.role === 'user' ? '' : '') + ' ' + c.content.slice(0, 80) + '...').join('\n\n')); return;
      } catch { reply('Chat search nahi ho saka.'); return; }
    }

    // ── WEEKLY PROGRESS REPORT ─────────────────────────────────
    if (/progress report|weekly report|hafte ka|week.*summary|report banao/i.test(text)) {
      try {
        const { getAllGoals, getStreak, getTodayChats } = await import('@/lib/db');
        const { getReminders } = await import('@/lib/reminders');
        const [goals, streak, todayChats] = await Promise.all([getAllGoals(), Promise.resolve(getStreak()), getTodayChats()]);
        const rems = getReminders();
        const activeGoals = goals.filter((g: any) => !g.completed);
        const doneGoals = goals.filter((g: any) => g.completed);
        const report = ' **Weekly Progress Report**\n' +
          '\n\n' +
          ' **Streak:** ' + streak.current + ' days (Best: ' + streak.best + ')\n\n' +
          ' **Goals:**\n' +
          '   Done: ' + doneGoals.length + '\n' +
          '   Active: ' + activeGoals.length + '\n' +
          (activeGoals.length ? '  ' + activeGoals.slice(0,3).map((g: any) => ' ' + g.title).join('\n  ') + '\n' : '') + '\n' +
          ' **Reminders set:** ' + rems.length + '\n\n' +
          ' **Chats today:** ' + todayChats.length + '\n\n' +
          '\n' +
          (streak.current >= 7 ? ' 7 din ka streak! Zabardast consistency!' : streak.current >= 3 ? ' ' + streak.current + ' din se active  keep going!' : ' Kal se daily aao, streak banao!');
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
        reply(' WhatsApp pe bhej raha hoon...'); return;
      }
      reply('Pehle "progress report" type karo, phir share karo.'); return;
    }

    // ── MUSIC GENERATION ──────────────────────────────────────
    if (/^music|^song|gaana bana|music generate/i.test(t)) {
      const mood = text.replace(/music|song|gaana|bana|generate/gi,'').trim() || 'relaxing hindi'
      // Open Suno + Udio as alternatives
      const sunoUrl = 'https://suno.com/create?prompt=' + encodeURIComponent(mood)
      const udioUrl = 'https://www.udio.com/create?prompt=' + encodeURIComponent(mood)
      reply(' Music generate karo:\n\nSuno: ' + sunoUrl + '\nUdio: ' + udioUrl + '\n\nDono free hain boss!')
      return
    }

    // ── VIDEO GENERATION ───────────────────────────────────────
    if (/^video|video bana|clip generate/i.test(t)) {
      const prompt = text.replace(/video|bana|generate|clip/gi,'').trim() || 'cinematic short clip'
      const klingUrl = 'https://klingai.com/create?prompt=' + encodeURIComponent(prompt)
      const lumaUrl = 'https://lumalabs.ai/dream-machine?prompt=' + encodeURIComponent(prompt)
      reply(' Video generate karo:\n\nKling AI (best): ' + klingUrl + '\nLuma (8/month): ' + lumaUrl)
      return
    }

    // ── TTS / VOICE ────────────────────────────────────────────
    if (/^(?:bol|speak|tts|voice|read aloud|padho)\s+(.+)/i.test(text)) {
      const sayText = text.replace(/^(?:bol|speak|tts|voice|read aloud|padho)\s+/i,'').trim()
      if (sayText) {
        const { speakText } = await import('@/lib/tts')
        speakText(sayText)
        reply(' Bol raha hoon: "' + sayText.slice(0,50) + (sayText.length > 50 ? '...' : '') + '"')
        return
      }
    }

    // ── CHAT EXPORT ────────────────────────────────────────────
    if (/export|share chat|chat export|save chat|download chat/i.test(text)) {
      const chatText = msgs.map(m => (m.role === 'user' ? ' You: ' : ' JARVIS: ') + m.content).join('\n\n');
      const blob = new Blob([chatText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = 'jarvis-chat-' + new Date().toLocaleDateString('en-IN').replace(/\//g, '-') + '.txt';
      a.click(); URL.revokeObjectURL(url);
      reply(' Chat export ho gaya  download ho rahi hai!'); return;
    }

    // Share chat via WhatsApp
    if (/whatsapp.*share.*chat|chat.*share.*whatsapp/i.test(text)) {
      const last5 = msgs.slice(-5).map(m => (m.role === 'user' ? 'Me: ' : 'JARVIS: ') + m.content.slice(0, 100)).join('\n');
      window.location.href = 'whatsapp://send?text=' + encodeURIComponent('JARVIS Chat:\n\n' + last5);
      reply(' WhatsApp pe bhej raha hoon...'); return;
    }

    // ── SESSION TIMER ───────────────────────────────────────────
    if (/session.*start|kaam.*start|timer.*start|work.*start/i.test(text)) {
      const startTime = Date.now();
      if (typeof window !== 'undefined') localStorage.setItem('jarvis_session_start', String(startTime));
      reply(' Session shuru! Jab kaam khatam karo toh "session end" bolo.'); return;
    }
    if (/session.*end|kaam.*khatam|session.*stop|work.*done/i.test(text)) {
      const start = parseInt(typeof window !== 'undefined' ? localStorage.getItem('jarvis_session_start') || '0' : '0');
      if (!start) { reply('Koi session start nahi tha. "Session start" bolo pehle.'); return; }
      const mins = Math.round((Date.now() - start) / 60000);
      const hrs = Math.floor(mins / 60); const remMins = mins % 60;
      if (typeof window !== 'undefined') localStorage.removeItem('jarvis_session_start');
      reply(' Session khatam!\n\n Total time: **' + (hrs > 0 ? hrs + ' hr ' : '') + remMins + ' min**\n\nGood work boss! '); return;
    }

    // ── PINNED MESSAGES ────────────────────────────────────────
    if (/pinned|pin.*dikhao|saved.*messages|important.*messages/i.test(text)) {
      if (typeof window === 'undefined') { reply('Pinned messages load nahi ho sake.'); return; }
      const pins = JSON.parse(localStorage.getItem('jarvis_pins') || '[]');
      if (pins.length === 0) { reply('Koi pinned message nahi. Long press karo message pe   Pin.'); return; }
      reply(' **Pinned Messages (' + pins.length + '):**\n\n' +
        pins.map((p: any, i: number) => (i+1) + '. ' + p.content.slice(0, 100) + (p.content.length > 100 ? '...' : '')).join('\n\n'));
      return;
    }

    // ── PAGE NAVIGATION ────────────────────────────────────────
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
        reply(' **' + label + '** pe ja raha hun...'); return;
      }
    }

    // ── AUTOMATION ─────────────────────────────────────────────
    const autoAction = detectAutomationIntent(text);
    if (autoAction) {
      const result = await triggerMacro(autoAction);
      reply(result.ok ? ' ' + result.msg : ' ' + result.msg); return;
    }

    // ── VIDEO GENERATION ───────────────────────────────────────
    const videoMatch = text.match(/video\s+(?:bana|banao|generate|create|chahiye|de)[:\s]+(.+)/i)
      || text.match(/(.+)\s+(?:ka|ki)\s+video\s+(?:bana|banao|create)/i);
    if (videoMatch) {
      const videoPrompt = (videoMatch[1] || text).replace(/video|bana|banao|create|generate|chahiye/gi,'').trim() || text.trim();
      const videoId = 'a_vid_' + Date.now();
      setMsgs(prev => [...prev,
        { id:'u_'+Date.now(), role:'user', content:text.trim(), timestamp:Date.now() },
        { id:videoId, role:'assistant', content:' Video generate kar raha hoon: "' + videoPrompt + '"\n 15-30 seconds lagenge...', timestamp:Date.now() },
      ]);
      setInput('');
      (async () => {
        try {
          const videoUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(videoPrompt + ', cinematic, motion, video style') + '?width=1280&height=720&model=flux&nologo=true&seed=' + Date.now();
          const genUrl = 'https://pollinations.ai/p/' + encodeURIComponent(videoPrompt);
          setMsgs(prev => prev.map(m => m.id===videoId ? {...m,
            content:' **Video:** "' + videoPrompt + '"\n\n [Pollinations pe dekho](' + genUrl + ')\n\nYa image version:',
            card:{ type:'image', imageUrl:videoUrl, title:'Video: '+videoPrompt }
          } : m));
        } catch {
          setMsgs(prev => prev.map(m => m.id===videoId ? {...m, content:'Video generate nahi hua.'} : m));
        }
      })();
      return;
    }

    // ── VOICE TRANSCRIBE ───────────────────────────────────────
    if (/transcribe|audio.*text|speech.*text|recording.*convert/i.test(t)) {
      reply(' Voice transcription ke liye:\n1. Mic button tap karo\n2. Bol do kuch bhi\n3. JARVIS automatically text kar dega\n\nYa voice page use karo: /voice'); return;
    }

    // ── MULTI MODEL IMAGE ──────────────────────────────────────
    const modelMatch = text.match(/(?:flux|seedream|gpt.?image|dirtberry|zimage|imagen)\s+(?:se\s+)?(?:bana|generate|image)[:\s]+(.+)/i);
    if (modelMatch) {
      const modelName = /seedream/i.test(text) ? 'seedream' : /gpt.?image/i.test(text) ? 'gptimage' : /dirtberry/i.test(text) ? 'dirtberry' : /zimage|z-image/i.test(text) ? 'zimage' : /flux.pro/i.test(text) ? 'flux-pro' : 'flux';
      const prompt = modelMatch[1].trim();
      const imgUrl = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt + ', high quality') + '?model=' + modelName + '&width=1024&height=1024&nologo=true&seed=' + Date.now();
      setMsgs(prev => [...prev,
        { id:'u_'+Date.now(), role:'user', content:text.trim(), timestamp:Date.now() },
        { id:'a_'+Date.now(), role:'assistant', content:' ' + modelName.toUpperCase() + ' se bana raha hoon: "' + prompt + '"', timestamp:Date.now(), card:{ type:'image', imageUrl:imgUrl, title:prompt+' ('+modelName+')' } },
      ]);
      setInput(''); return;
    }

    // ── Direct Image Generation — bypass AI refusal ──────────
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
        { id: tempId, role: 'assistant', content: ' Generating "' + safePrompt + '"...', timestamp: Date.now(),
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
              ? { ...m, content: ' "' + safePrompt + '" (DALL-E 3)', card: { type: 'image', imageUrl: puterUrl, title: safePrompt + ' (HD)' } }
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
    // Safety timeout — 30 sec ke baad loading reset
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
      setMsgs(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && (!last.content || last.content.length < 5)) {
          return [...prev.slice(0, -1), { ...last, content: ' Response timeout. Dobara try karo ya Flash mode use karo.' }];
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

    let activeSessionId = sessionId;
    if (!activeSessionId) {
      activeSessionId = await createSession('New Chat');
      setSessionId(activeSessionId);
    }
    if (activeSessionId) {
      saveMessage({ sessionId: activeSessionId, role: 'user', content: text.trim(), timestamp: Date.now() });
      if (isFirstMsg) generateTitle(text.trim(), activeSessionId);
    }

    // ── Smart API Router — auto-detect and call free APIs ─────
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

    // ── Offline fallback ─────────────────────────────────────
    if (!navigator.onLine) {
      try {
        const { getOfflineAnswer } = await import('@/lib/offline/answers');
        const offlineReply = getOfflineAnswer(text.trim());
        if (offlineReply) {
          setMsgs(prev => [...prev,
            { id: 'u_' + Date.now(), role: 'user', content: text.trim(), timestamp: Date.now() },
            { id: 'a_' + Date.now(), role: 'assistant', content: ' *Offline mode*\n\n' + offlineReply, timestamp: Date.now() },
          ]);
          setInput(''); setLoading(false);
          return;
        }
      } catch {}
      setMsgs(prev => [...prev,
        { id: 'u_' + Date.now(), role: 'user', content: text.trim(), timestamp: Date.now() },
        { id: 'a_' + Date.now(), role: 'assistant', content: ' Offline hoon abhi. Internet wapas aane pe jawab dunga. Basic cheezein poochho  time, date, math, GK  offline bhi jawab deta hoon!', timestamp: Date.now() },
      ]);
      setInput(''); setLoading(false);
      return;
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

    // Smart web search injection — auto-trigger on factual queries
    const searchTrigger = /latest|news|khabar|price|stock|score|result|who is|kya hai|search|find|current|today|2025|2026|released|launched|happened|broke|won|lost|died|born|invented|discovered/.test(text.toLowerCase())
    let searchContext = ''
    if (searchTrigger && text.length > 8 && !(/weather|mausam|battery|reminder|goal|note|timer|whatsapp|open app/i.test(text))) {
      try {
        const gnewsKey = typeof window !== 'undefined' ? localStorage.getItem('jarvis_key_GNEWS_API_KEY') || '' : ''
        const sr = await fetch('/api/search?q=' + encodeURIComponent(text.slice(0, 120)), {
          signal: AbortSignal.timeout(5000),
          headers: gnewsKey ? { 'x-gnews-key': gnewsKey } : {}
        })
        const sd = await sr.json()
        if (sd.results?.length) {
          const top = sd.results.slice(0, 3).map((r: any) => '[' + r.source + '] ' + r.title + ': ' + (r.text || '').slice(0, 250)).join('\n')
          searchContext = ' [LIVE WEB DATA:\n' + top + '\nUse this fresh data in your answer.]'
        }
      } catch {}
    }

    // If image attached, run vision first then include result as context
    if (attachedImage) {
      const imgSnap = attachedImage; setAttachedImage(null);
      const ck2: Record<string,string> = {};
      if (typeof window !== 'undefined') ['GROQ_API_KEY','GEMINI_API_KEY','CEREBRAS_API_KEY','TOGETHER_API_KEY','MISTRAL_API_KEY','COHERE_API_KEY','FIREWORKS_API_KEY','OPENROUTER_API_KEY','DEEPINFRA_API_KEY','HUGGINGFACE_API_KEY'].forEach(k => { const v=localStorage.getItem('jarvis_key_'+k); if(v) ck2[k]=v; });
      try {
        const vr = await fetch('/api/vision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:imgSnap.base64,question:text.trim(),clientKeys:ck2})});
        const vd = await vr.json();
        if (vd.result) searchContext += '\n\n[IMAGE ANALYSIS: ' + vd.result + ']';
      } catch {}
    }
    history.push({ role: 'user', content: text.trim() + searchContext });

    const eMode = mode === 'auto' ? autoRouteMode(text) : mode;

    const assistantId = `a_${Date.now()}`;
    let fullText = '', card: any = null, provider = '';

    const _widget = text.trim();
    setMsgs(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now(), widget: _widget }]);
    setStreamingProvider('...');

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
              setStreamingProvider('');
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
        setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, content: 'Network issue. Thodi der mein try karo! ' } : m));
      }
    }

    setLoading(false);
    if (activeSessionId && fullText) saveMessage({ sessionId: activeSessionId, role: 'assistant', content: fullText, timestamp: Date.now(), provider, card });

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
            id: 'suggest_' + Date.now(),
            role: 'assistant',
            content: ' ' + suggestion,
            timestamp: Date.now(),
          }]);
        }, 1800);
      }

      // Proactive action — JARVIS takes initiative
      if (!suggestion) {
        const lc = fullText.toLowerCase()
        // If JARVIS mentions a link → auto-make it tappable
        // If JARVIS gives a phone number → auto-show call button
        // If JARVIS mentions a time → check if reminder needed
        const timeMatch = fullText.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|baje|AM|PM))/)
        if (timeMatch && /remind|yaad|alarm|timer/i.test(text)) {
          setTimeout(() => {
            setMsgs(prev => [...prev, {
              id: 'proact_' + Date.now(), role: 'assistant',
              content: ' Reminder set karna chahoge **' + timeMatch[1] + '** ke liye? "Haan" bolo.',
              timestamp: Date.now(),
            }])
          }, 2000)
        }
      }

      // Mood detection — frustrated/tired → gentle suggestion
      const stressWords = /pareshan|thak|bore|stress|tension|headache|rona|samajh nahi|kya karu|help|stuck|confused|frustrat/i;
      const lateNight = new Date().getHours() >= 23 || new Date().getHours() < 4;
      if (stressWords.test(text.trim()) && !suggestion) {
        setTimeout(() => {
          setMsgs(prev => [...prev, {
            id: 'mood_' + Date.now(),
            role: 'assistant',
            content: lateNight ? ' Boss, so jao ab. Kal fresh mind se sab clear ho jaayega.' : ' Ek chhota break lo. Chai piyo, 10 min. Phir aata hoon.',
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

      {/* Header — Premium */}
      <div className="jarvis-header">
        <button className="header-logo" onClick={() => setNavOpen(true)}>J</button>

        <div className="header-title">
          <div className="name">
            JARVIS
            {!online && <span style={{ fontSize:9, color:'#ef4444', marginLeft:6, WebkitTextFillColor:'#ef4444' }}>● Offline</span>}
            {reconnected && <span style={{ fontSize:9, color:'#22c55e', marginLeft:6, WebkitTextFillColor:'#22c55e' }}>● Online</span>}
          </div>
          <div className="sub">{location ? '📍 ' + location : online ? '● Connected' : '○ Offline'}</div>
        </div>

        <div style={{ position: 'relative' }}>
          <button className="header-menu-btn" onClick={() => setHeaderMenuOpen(p => !p)}>⋮</button>
          {headerMenuOpen && (
            <>
              <div onClick={() => setHeaderMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
              <div className="header-dropdown">
                {[
                  { icon: wakeActive ? '' : '', label: wakeActive ? 'Wake Word OFF' : 'Wake Word ON', action: () => {
                    if (wakeActive) { stopWakeWord(); setWakeActive(false); toastInfo('Wake word off'); }
                    else { const ok = startWakeWord(() => { toastOk(' Bol boss!'); navigator.vibrate?.(100); setInput(''); textareaRef.current?.focus(); }); if (ok) { setWakeActive(true); toastOk('Wake word ON'); } else toastErr('Mic permission chahiye'); }
                    setHeaderMenuOpen(false);
                  }, active: wakeActive },
                  { icon: theme === 'dark' ? '' : theme === 'light' ? '' : theme === 'amoled' ? '' : '', label: 'Theme: ' + theme, action: () => { const t = toggleTheme(); setThemeState(t); setHeaderMenuOpen(false); }, active: false },
                  { icon: '', label: 'Chat History', action: () => { setHistoryOpen(true); setHeaderMenuOpen(false); }, active: false },
                  { icon: '', label: 'Connected Apps', action: () => { setAppsOpen(true); setHeaderMenuOpen(false); }, active: false },
                  { icon: '', label: 'Stop Speaking', action: () => { stopSpeaking(); setHeaderMenuOpen(false); }, active: false },
                  { icon: '', label: 'Agent Mode', action: () => { router.push('/agent'); setHeaderMenuOpen(false); }, active: false },
                  { icon: '', label: 'Sakhi', action: () => { router.push('/sakhi'); setHeaderMenuOpen(false); }, active: false },
                  { icon: '', label: 'Settings', action: () => { router.push('/settings'); setHeaderMenuOpen(false); }, active: false },
                  { icon: '🧠', label: 'Memory', action: () => { router.push('/settings'); setHeaderMenuOpen(false); }, active: false },
                ].map(item => (
                  <button key={item.label} onClick={item.action}
                    className={item.active ? 'active' : ''}>
                    <span style={{ fontSize: 16 }}>{item.icon}</span>{item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Quick Command Bar — DYNAMIC TIME-BASED chips */}
      <div className="quick-chips">
        {(() => {
          const h = new Date().getHours();
          const morning = h >= 5 && h < 12;
          const afternoon = h >= 12 && h < 17;
          const evening = h >= 17 && h < 21;
          // const night = h >= 21 || h < 5;
          const base = [
            { label:'🌤️ Mausam', cmd:'Maihar ka mausam batao' },
            { label:'📰 News', cmd:'Top India news today' },
            { label:'₿ BTC', cmd:'Bitcoin price INR' },
            { label:'🖼️ Image', cmd:'Image bana: beautiful landscape' },
          ];
          const extra = morning
            ? [{ label:'☀️ Good morning!', cmd:'Good morning JARVIS, aaj ka brief batao' }, { label:'📅 Aaj kya karna hai?', cmd:'Aaj ka plan banao' }, { label:'📖 Motivation', cmd:'/quote' }]
            : afternoon
            ? [{ label:'🍱 Khaana?', cmd:'Quick healthy lunch ideas batao' }, { label:'📊 Life score', cmd:'Mera aaj ka life score batao' }, { label:'😂 Joke', cmd:'/joke' }]
            : evening
            ? [{ label:'🌙 Din kaisa raha?', cmd:'Aaj ka din summary batao' }, { label:'🎵 Music', cmd:'Relaxing music generate karo' }, { label:'📝 Notes', cmd:'notes dikhao' }]
            : [{ label:'🌙 Neend aao', cmd:'Raat ka routine suggest karo' }, { label:'💭 Sochna hai', cmd:'Ek deep philosophical baat batao' }, { label:'🔋 Battery', cmd:'/battery' }];
          return [...base, ...extra, { label:'🎯 Goals', cmd:'/goals' }, { label:'💱 USD→INR', cmd:'1 USD to INR' }].map(c => (
            <button key={c.label} onClick={() => send(c.cmd)} className="chip">{c.label}</button>
          ));
        })()}
      </div>

      {/* PWA Install Banner */}
      {canInstall && (
        <div onClick={async () => {
          if (isIOS) {
            showToast('iOS: Share  "Add to Home Screen" karo ', 'info');
          } else {
            const r = await install();
            if (r === 'accepted') toastOk(' JARVIS installed!');
          }
        }}
          data-pwa-banner style={{ background: 'rgba(0,212,255,0.08)', borderBottom: '1px solid rgba(0,212,255,0.2)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📲</span>
          <div>
            <div style={{ color: '#00d4ff', fontSize: 12, fontWeight: 600 }}>JARVIS Install karo</div>
            <div style={{ color: '#555', fontSize: 10 }}>Home screen pe add karo — faster, offline ready</div>
          </div>
          <span style={{ marginLeft: 'auto', color: '#00d4ff', fontSize: 12 }}>Install →</span>
        </div>
      )}

      {/* FEATURE 6: In-chat search bar */}
      {searchOpen && (
        <div style={{ background:'#0d0d16', borderBottom:'1px solid #1e1e2e', padding:'8px 12px', display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ color:'#555', fontSize:14 }}>🔍</span>
          <input autoFocus value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
            placeholder="Messages mein dhundho..."
            style={{ flex:1, background:'none', border:'none', color:'#e0e0ff', fontSize:13, outline:'none' }} />
          <span style={{ color:'#555', fontSize:11 }}>
            {searchQuery ? msgs.filter(m=>m.content.toLowerCase().includes(searchQuery.toLowerCase())).length + ' found' : ''}
          </span>
          <button onClick={()=>{setSearchOpen(false);setSearchQuery('');}} style={{ background:'none', border:'none', color:'#555', fontSize:18, cursor:'pointer' }}>✕</button>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesAreaRef} className="messages-area" style={{ background: chatBg !== 'none' ? chatBg : undefined, position:'relative' }}
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
          <div style={{ textAlign: 'center', padding: 10, color: '#00d4ff', fontSize: 12 }}>🔄 Refreshing...</div>
        )}
        {/* Clock Welcome Screen — jab koi user message nahi */}
        {msgs.filter(m=>m.role==='user').length === 0 && !loading && (() => {
          const now = new Date();
          const h = now.getHours();
          const m = now.getMinutes();
          const hh = String(h % 12 || 12).padStart(2, '0');
          const mm = String(m).padStart(2, '0');
          const ampm = h < 12 ? 'am' : 'pm';
          const days = ['रवि','सोम','मंगल','बुध','गुरु','शुक्र','शनि'];
          const months = ['जनवरी','फरवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितम्बर','अक्टूबर','नवम्बर','दिसम्बर'];
          const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`;
          const userName = typeof window !== 'undefined' ? localStorage.getItem('jarvis_user_name') || 'Boss' : 'Boss';
          const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Kya scene hai' : h < 21 ? 'Good evening' : 'Raat ka scene';
          return (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, padding:'20px 20px 10px', gap:8, minHeight:240 }}>
              {/* Big clock */}
              <div style={{ fontSize: 52, fontWeight:200, letterSpacing:2, color:'#e0e0ff', fontFamily:'system-ui', lineHeight:1 }}>
                {hh}:{mm} <span style={{ fontSize:18, color:'#555', verticalAlign:'middle' }}>{ampm}</span>
              </div>
              <div style={{ color:'#555', fontSize:13 }}>{dateStr}</div>
              <div style={{ color:'#888', fontSize:14, marginTop:4 }}>{greeting}, {userName} 👋</div>
              {/* 2x3 quick grid */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, width:'100%', maxWidth:320, marginTop:12 }}>
                {[
                  { icon:'🖼️', label:'Image banao', cmd:'Image bana: beautiful indian landscape' },
                  { icon:'📰', label:'Aaj ki news', cmd:'Top India news today' },
                  { icon:'🌤️', label:'Mausam', cmd:'Maihar ka mausam batao' },
                  { icon:'💻', label:'Python code', cmd:'Python mein hello world program likho' },
                  { icon:'🧮', label:'Math solve', cmd:'(12! / (4^12 * 12!)) solve karo step by step' },
                  { icon:'📖', label:'Summary', cmd:'Mere liye motivational summary do aaj ke liye' },
                ].map(q => (
                  <button key={q.label} onClick={() => send(q.cmd)}
                    style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'12px 10px', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:8, transition:'all 0.15s' }}>
                    <span style={{ fontSize:18 }}>{q.icon}</span>
                    <span style={{ color:'#aaa', fontSize:12 }}>{q.label}</span>
                  </button>
                ))}
              </div>
              <div style={{ color:'#2a2a3a', fontSize:10, marginTop:8 }}>Ctrl+K sidebar · Ctrl+F search · / commands</div>
            </div>
          );
        })()}
        {(searchQuery
          ? msgs.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
          : msgs
        ).map((msg: Msg) => {
          const msgDel = (id: string) => setMsgs(prev => prev.filter(m => m.id !== id));
          const msgRegen = () => { const u = [...msgs].reverse().find(m => m.role === 'user'); if (u) send(u.content); };
          const msgQuote = (m: Msg) => { setQuotedMsg(m); textareaRef.current?.focus(); };
          const showTs = showTimestamps && msg.timestamp;
          return (
            <div key={msg.id}>
              {showTs && (
                <div style={{ textAlign:'center', color:'#333', fontSize:9, margin:'2px 0', letterSpacing:0.5 }}>
                  {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                </div>
              )}
              {searchQuery && msg.content.toLowerCase().includes(searchQuery.toLowerCase()) && (
                <div style={{ margin:'0 12px 2px', height:2, background:'linear-gradient(90deg,transparent,rgba(0,212,255,0.4),transparent)', borderRadius:2 }} />
              )}
              <MsgItem msg={msg} onDelete={msgDel} onRegenerate={msgRegen} fontSize={fontSize} onQuote={msgQuote} compact={compactMode} />
            </div>
          );
        })}
        {loading && <TypingDots provider={streamingProvider} />}

        {/* Smart suggested replies */}
        {!loading && msgs.length > 0 && msgs[msgs.length-1]?.role === 'assistant' && (() => {
          const lastMsg = msgs[msgs.length-1].content.toLowerCase();
          const lastUser = [...msgs].reverse().find(m => m.role === 'user')?.content.toLowerCase() || '';
          const chips: string[] = [];
          if (/weather|mausam|°c|forecast/.test(lastMsg)) chips.push('Kal ka mausam?', 'Barish hogi?');
          else if (/goal|target/.test(lastMsg)) chips.push('Goals dikhao', 'Goal add karo');
          else if (/remind|alarm|timer/.test(lastMsg)) chips.push('Reminders dikhao', 'Timer lagao');
          else if (/image|photo|generated|generating/.test(lastMsg)) chips.push('Aur ek bana', 'Wallpaper bana');
          else if (/battery|charge/.test(lastMsg)) chips.push('WhatsApp kholo', 'Settings kholo');
          else if (/news|khabar/.test(lastMsg)) chips.push('Tech news?', 'India news?');
          else if (/bitcoin|crypto|price/.test(lastMsg)) chips.push('Ethereum price?', 'Doge price?');
          else if (/₹|usd|currency/.test(lastMsg)) chips.push('EUR to INR?', 'GBP to INR?');
          else if (/note|save|yaad/.test(lastMsg)) chips.push('Notes dikhao', 'Memory dikhao');
          else if (msgs.length <= 2) chips.push('Mausam batao', 'Joke suno', 'Image bana');
          else chips.push('Aur batao', 'Example do');
          if (!chips.length) return null;
          return (
            <div className="suggest-chips">
              {chips.slice(0,3).map(c => (
                <button key={c} onClick={() => send(c)} className="suggest-chip">
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
        <div className="slash-menu">
          <div style={{ padding:'6px 12px 4px', color:'var(--muted)', fontSize:10, borderBottom:'1px solid rgba(255,255,255,0.04)', letterSpacing:0.5 }}>⚡ SLASH COMMANDS</div>
          {SLASH_COMMANDS.filter(c => c.cmd.startsWith(slashFilter) || c.desc.toLowerCase().includes(slashFilter.slice(1))).slice(0, 8).map(c => (
            <button key={c.cmd}
              onClick={() => { setInput(c.cmd + ' '); setSlashOpen(false); textareaRef.current?.focus(); }}
              className="slash-item">
              <span style={{ fontSize: 16 }}>{c.icon}</span>
              <div>
                <div style={{ color: '#00d4ff', fontSize: 12, fontFamily: 'monospace' }}>{c.cmd}</div>
                <div style={{ color: '#444', fontSize: 10 }}>{c.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* FEATURE 11: Jump to bottom button */}
      {showJumpBtn && (
        <button onClick={() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); setNewMsgCount(0); }}
          style={{ position:'fixed', bottom: 180, right: 16, width: 42, height: 42, borderRadius:'50%', background:'rgba(0,212,255,0.15)', border:'1px solid rgba(0,212,255,0.4)', color:'#00d4ff', fontSize: 18, cursor:'pointer', zIndex: 50, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 20px rgba(0,212,255,0.2)', backdropFilter:'blur(8px)' }}>
          {newMsgCount > 0 ? <span style={{ fontSize:10, fontWeight:700 }}>{newMsgCount}↓</span> : '↓'}
        </button>
      )}

      {/* Bottom strip — mode + char count + search + toggles */}
      <div className="bottom-strip">
        <span className={"mode-pill " + (mode === 'auto' ? 'auto' : mode)} onClick={() => setPlusOpen(p=>!p)} style={{ cursor:'pointer' }}>
          {mode==='flash'?'⚡':mode==='think'?'🧠':mode==='deep'?'🔬':'🤖'} {mode==='auto'?`Auto → ${effectiveMode}`:mode.charAt(0).toUpperCase()+mode.slice(1)}
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {/* FEATURE 6: Search toggle */}
          <button onClick={()=>setSearchOpen(p=>!p)} title="Search chats (Ctrl+F)"
            style={{ background: searchOpen ? 'rgba(0,212,255,0.1)' : 'none', border:'none', color: searchOpen ? '#00d4ff' : '#333', cursor:'pointer', fontSize:14, padding:'2px 6px', borderRadius:6 }}>🔍</button>
          {/* FEATURE 10: Compact mode toggle */}
          <button onClick={()=>setCompactMode(p=>!p)} title="Compact mode"
            style={{ background: compactMode ? 'rgba(0,212,255,0.1)' : 'none', border:'none', color: compactMode ? '#00d4ff' : '#333', cursor:'pointer', fontSize:13, padding:'2px 6px', borderRadius:6 }}>≡</button>
          {/* FEATURE 7: Timestamps toggle */}
          <button onClick={()=>setShowTimestamps(p=>!p)} title="Show timestamps"
            style={{ background: showTimestamps ? 'rgba(0,212,255,0.1)' : 'none', border:'none', color: showTimestamps ? '#00d4ff' : '#333', cursor:'pointer', fontSize:13, padding:'2px 6px', borderRadius:6 }}>🕐</button>
          {input.trim().length > 0 && <span style={{ color:'var(--muted)', fontSize:10 }}>{input.length}</span>}
          {input.trim().length > 20 && (
            <div style={{ display:'flex', gap:3 }}>
              {(['tiny','short','medium'] as CompressLevel[]).map(level => (
                <button key={level} onClick={() => { const c=compressUserMessage(input,level); setInput(c); toastInfo(`✂️ ${level}: ${c.split(' ').length}w`); }}
                  style={{ background:'rgba(255,255,255,0.04)', border:'1px solid var(--border)', borderRadius:6, color:'var(--muted)', fontSize:9, padding:'2px 7px', cursor:'pointer' }}>
                  {level}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FEATURE 9: Quote/Reply preview bar */}
      {quotedMsg && (
        <div style={{ background:'rgba(0,212,255,0.06)', borderTop:'1px solid rgba(0,212,255,0.15)', padding:'6px 12px', display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ flex:1 }}>
            <div style={{ color:'#00d4ff', fontSize:9, marginBottom:2, letterSpacing:0.5 }}>
              ↩ REPLYING TO {quotedMsg.role === 'user' ? 'YOU' : 'JARVIS'}
            </div>
            <div style={{ color:'#666', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'80vw' }}>
              {quotedMsg.content.slice(0, 80)}{quotedMsg.content.length > 80 ? '…' : ''}
            </div>
          </div>
          <button onClick={() => setQuotedMsg(null)} style={{ background:'none', border:'none', color:'#444', cursor:'pointer', fontSize:18, flexShrink:0 }}>✕</button>
        </div>
      )}

      {/* Image Preview Strip */}
      {attachedImage && (
        <div className="img-preview-strip">
          <div style={{ position:'relative', flexShrink:0 }}>
            <img src={attachedImage.preview} alt="attached" style={{ width:50,height:50,objectFit:'cover',borderRadius:10,border:'1px solid rgba(0,212,255,0.3)' }} />
            <button onClick={() => setAttachedImage(null)} style={{ position:'absolute',top:-6,right:-6,width:18,height:18,borderRadius:'50%',background:'#ef4444',border:'none',color:'#fff',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900 }}>×</button>
          </div>
          <div style={{ fontSize:11 }}>
            <div style={{ color:'var(--accent)' }}>📷 {attachedImage.name}</div>
            <div style={{ color:'var(--muted)', fontSize:10 }}>Question type karo → Send</div>
          </div>
          <button onClick={async () => {
            const imgCopy=attachedImage; setAttachedImage(null);
            const ck: Record<string,string>={};
            if(typeof window!=='undefined') ['GROQ_API_KEY','GEMINI_API_KEY','CEREBRAS_API_KEY','TOGETHER_API_KEY','MISTRAL_API_KEY','COHERE_API_KEY','FIREWORKS_API_KEY','OPENROUTER_API_KEY','DEEPINFRA_API_KEY','HUGGINGFACE_API_KEY'].forEach(k=>{const v=localStorage.getItem('jarvis_key_'+k);if(v)ck[k]=v;});
            setMsgs(prev=>[...prev,{id:'u_'+Date.now(),role:'user',content:'📷 '+imgCopy.name,timestamp:Date.now(),card:{type:'image',imageUrl:imgCopy.preview,title:imgCopy.name}}]);
            setLoading(true);
            try{const res=await fetch('/api/vision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:imgCopy.base64,question:'Is image mein kya hai? Detail mein Hinglish mein batao.',clientKeys:ck})});const d=await res.json();setMsgs(prev=>[...prev,{id:'a_'+Date.now(),role:'assistant',content:'🔍 '+(d.result||d.error||'Vision failed'),timestamp:Date.now()}]);}
            catch{setMsgs(prev=>[...prev,{id:'a_'+Date.now(),role:'assistant',content:'🔍 Vision error. Settings mein Gemini key daalo.',timestamp:Date.now()}]);}
            setLoading(false);
          }} style={{ marginLeft:'auto',background:'rgba(0,212,255,0.1)',border:'1px solid rgba(0,212,255,0.3)',borderRadius:10,color:'var(--accent)',fontSize:11,padding:'6px 12px',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,fontWeight:600 }}>
            🔍 Analyze
          </button>
        </div>
      )}

      {/* ── Premium Input Bar ── */}
      <div className="input-area">
        <div className="input-box">
          {/* Plus button */}
          <button onClick={() => setPlusOpen(p=>!p)} data-plus
            className="input-icon-btn" style={{ color: plusOpen ? 'var(--accent)' : undefined, background: plusOpen ? 'rgba(0,212,255,0.1)' : undefined }}>
            {plusOpen ? '✕' : '+'}
          </button>

          <textarea ref={textareaRef} value={input} onChange={handleTextChange} onKeyDown={handleKeyDown}
            placeholder={loading ? 'JARVIS soch raha hai...' : 'Kuch bhi poocho boss...'}
            disabled={loading} rows={1}
          />

          {/* Mic */}
          <button className={"input-icon-btn" + (micActive ? " active" : "")}
            onClick={async () => {
              try { await navigator.mediaDevices?.getUserMedia({ audio: true }); } catch { toastErr('Mic permission do'); return; }
              const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
              if(!SR){toastErr('Voice Voice page try karo.');return;}
              const rec=new SR(); rec.lang='hi-IN'; rec.continuous=false; rec.interimResults=true;
              let final=''; setMicActive(true); toastOk('🎙️ Bol boss...');
              rec.onresult=(e:any)=>{final=Array.from(e.results).map((r:any)=>r[0].transcript).join('');setInput(final);};
              rec.onerror=(e:any)=>{setMicActive(false);if(e.error==='not-allowed')toastErr('Mic permission nahi');else toastErr('Mic error: '+e.error);};
              rec.onend=()=>{setMicActive(false);if(final.trim())setTimeout(()=>send(final),300);};
              try{rec.start();}catch{toastErr('Mic start nahi hua');setMicActive(false);}
            }}>
            {micActive ? '🔴' : '🎙️'}
          </button>

          {/* Send */}
          <button className="send-btn" onClick={() => { navigator.vibrate?.(30); send(input); }} disabled={!input.trim() || loading}>
            {loading ? '⏳' : '↑'}
          </button>
        </div>

        {/* Hidden file inputs */}
        <input id="imgEditInput" type="file" accept="image/*" style={{ display:'none' }} onChange={async e => {
          const f=e.target.files?.[0]; if(!f)return; e.currentTarget.value='';
          const editPrompt=(window as any).__jarvisEditPrompt||'Remove background, make it clean';
          const reader=new FileReader(); reader.onload=async ev=>{const dataUrl=ev.target?.result as string; const ck:Record<string,string>={}; if(typeof window!=='undefined')['GROQ_API_KEY','GEMINI_API_KEY'].forEach(k=>{const v=localStorage.getItem('jarvis_key_'+k);if(v)ck[k]=v;}); setMsgs(prev=>[...prev,{id:'u_'+Date.now(),role:'user',content:'🖼️ '+f.name,timestamp:Date.now(),card:{type:'image',imageUrl:dataUrl,title:f.name}}]); setLoading(true); try{const res=await fetch('/api/vision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:dataUrl.split(',')[1],question:editPrompt,clientKeys:ck})});const d=await res.json();setMsgs(prev=>[...prev,{id:'a_'+Date.now(),role:'assistant',content:'✨ '+(d.result||d.error||'Done'),timestamp:Date.now()}]);}catch{}; setLoading(false);}; reader.readAsDataURL(f);
        }} />
        <input ref={photoInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={async e => {
          const f=e.target.files?.[0]; if(!f)return; e.target.value='';
          const reader=new FileReader(); reader.onload=async ev=>{const dataUrl=ev.target?.result as string; setAttachedImage({base64:dataUrl.split(',')[1],preview:dataUrl,name:f.name}); toastOk('📷 Photo attach ho gayi! Ab question type karo.'); textareaRef.current?.focus();}; reader.readAsDataURL(f);
        }} />
        <input ref={fileInputRef} type="file" accept="*/*" style={{ display:'none' }} onChange={async e => {
          const f=e.target.files?.[0]; if(!f)return; e.target.value='';
          const mb=(f.size/1024/1024).toFixed(1);
          if(f.type.startsWith('image/')){photoInputRef.current?.click();return;}
          setMsgs(prev=>[...prev,{id:'u_'+Date.now(),role:'user',content:'📄 '+f.name+' ('+mb+' MB)',timestamp:Date.now()}]);
          if(f.type==='text/plain'||f.name.endsWith('.txt')||f.name.endsWith('.md')){const txt=await f.text();setMsgs(prev=>[...prev,{id:'a_'+Date.now(),role:'assistant',content:'📄 File padh li: '+f.name+'. Summarize karoon?',timestamp:Date.now()}]);setInput('Summarize karo: '+txt.slice(0,2000));}
          else{setMsgs(prev=>[...prev,{id:'a_'+Date.now(),role:'assistant',content:'📄 File receive ki: '+f.name+' ('+mb+' MB).',timestamp:Date.now()}]);}
        }} />

        {/* Plus popup — mode select */}
        {plusOpen && (
          <div className="plus-popup" data-plus onClick={e=>e.stopPropagation()} style={{ maxHeight:'75vh', overflowY:'auto' }}>
            {/* 3 Tabs: Attach / Mode / Persona */}
            <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)', marginBottom:14, gap:0 }}>
              {(['attach','mode','persona'] as const).map(tab => (
                <button key={tab} onClick={()=>setModePopupTab(tab as any)}
                  style={{ flex:1, background:'none', border:'none', borderBottom: modePopupTab===tab ? '2px solid #00d4ff' : '2px solid transparent', color: modePopupTab===tab ? '#00d4ff' : '#555', fontSize:11, cursor:'pointer', padding:'8px 4px', fontWeight: modePopupTab===tab ? 700 : 400, textTransform:'uppercase', letterSpacing:0.5 }}>
                  {tab==='attach'?'🔗 Attach':tab==='mode'?'⚡ Mode':'🎭 Persona'}
                </button>
              ))}
            </div>

            {/* ATTACH TAB */}
            {modePopupTab === 'attach' && (
              <div style={{ display:'flex', gap:8 }}>
                {[
                  {icon:'📷',label:'Photo',color:'var(--success)',action:()=>{photoInputRef.current?.click();setPlusOpen(false);}},
                  {icon:'📄',label:'File',color:'var(--warn)',action:()=>{fileInputRef.current?.click();setPlusOpen(false);}},
                  {icon:recording?'⏹️':'🎤',label:recording?'Stop':'Audio',color:recording?'var(--danger)':'var(--purple)',action:async()=>{
                    setPlusOpen(false);if(recording){mediaRecRef.current?.stop();setRecording(false);return;}
                    try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const rec=new MediaRecorder(stream);const chunks:BlobPart[]=[];rec.ondataavailable=e=>chunks.push(e.data);rec.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:'audio/webm'});const url=URL.createObjectURL(blob);setMsgs(prev=>[...prev,{id:'u_'+Date.now(),role:'user',content:'🎤 Voice message',timestamp:Date.now(),card:{type:'audio',audioUrl:url,title:'Voice message'}}]);setRecording(false);toastOk('Voice saved!');};rec.start();mediaRecRef.current=rec;setRecording(true);toastOk('🎤 Recording... Phir tap karo stop ke liye');}catch{toastErr('Mic permission do');}
                  }},
                  {icon:'📷',label:'Camera',color:'var(--accent)',action:()=>{router.push('/camera');setPlusOpen(false);}},
                ].map(item=>(
                  <button key={item.label} onClick={item.action}
                    style={{ flex:1, background:'var(--card2)', border:'1px solid var(--border2)', borderRadius:14, padding:'12px 6px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:24 }}>{item.icon}</span>
                    <span style={{ color:item.color, fontSize:10, fontWeight:600 }}>{item.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* MODE TAB — Beautiful cascade display */}
            {modePopupTab === 'mode' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  { m:'auto' as Mode, icon:'🤖', label:'Auto', desc:'Smart router — type se decide', col:'#00d4ff',
                    cascade:['⚡ Flash ya 🔬 Deep — auto detect'] },
                  { m:'flash' as Mode, icon:'⚡', label:'Flash', desc:'Short answers, fastest', col:'#f59e0b',
                    cascade:['Groq Llama4 Scout','→ Together 70B','→ Gemini 2.5','→ Pollinations','→ Puter'] },
                  { m:'think' as Mode, icon:'🧠', label:'Think', desc:'Deep reasoning, long answer', col:'#a855f7',
                    cascade:['OpenRouter DeepSeek R1','→ Gemini 2.5 Flash','→ Pollinations','→ Puter'] },
                  { m:'deep' as Mode, icon:'🔬', label:'Deep', desc:'Live data: weather/news/maps', col:'#22c55e',
                    cascade:['Gemini 2.5 + Tools','→ Pollinations','→ Puter'] },
                ].map(({ m, icon, label, desc, col, cascade }) => (
                  <button key={m} onClick={()=>{setMode(m);setPlusOpen(false);}}
                    style={{ background: mode===m ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.02)', border:`1px solid ${mode===m?'rgba(0,212,255,0.3)':'rgba(255,255,255,0.06)'}`, borderRadius:14, padding:'12px 14px', cursor:'pointer', textAlign:'left', position:'relative' }}>
                    {mode===m && <span style={{ position:'absolute', top:8, right:10, background:'rgba(0,212,255,0.15)', color:'#00d4ff', fontSize:9, padding:'2px 8px', borderRadius:8, fontWeight:700, letterSpacing:0.5 }}>ACTIVE</span>}
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                      <span style={{ fontSize:18 }}>{icon}</span>
                      <span style={{ color:'#e0e0ff', fontWeight:600, fontSize:13 }}>{label}</span>
                    </div>
                    <div style={{ color:'#666', fontSize:11, marginBottom:6 }}>{desc}</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {cascade.map((c, i) => (
                        <span key={i} style={{ background: i===0 ? `${col}22` : 'rgba(255,255,255,0.04)', border:`1px solid ${i===0 ? col+'44' : 'rgba(255,255,255,0.06)'}`, borderRadius:8, color: i===0 ? col : '#555', fontSize:10, padding:'2px 8px' }}>{c}</span>
                      ))}
                    </div>
                  </button>
                ))}

                {/* Force Provider Lock */}
                <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:10, marginTop:2 }}>
                  <div style={{ color:'#555', fontSize:10, marginBottom:6, letterSpacing:0.5 }}>🔒 FORCE PROVIDER (LOCK)</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {[null,'groq','gemini','pollinations','puter','together','cerebras'].map(p => (
                      <button key={p||'auto'} onClick={()=>{ setForcedProvider(p); if(typeof window!=='undefined') p ? localStorage.setItem('jarvis_forced_provider',p) : localStorage.removeItem('jarvis_forced_provider'); setPlusOpen(false); toastInfo(p ? `🔒 Locked: ${p}` : '🔓 Auto cascade'); }}
                        style={{ background: forcedProvider===p ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.03)', border:`1px solid ${forcedProvider===p?'rgba(0,212,255,0.4)':'rgba(255,255,255,0.06)'}`, borderRadius:10, color: forcedProvider===p ? '#00d4ff' : '#666', fontSize:10, padding:'5px 10px', cursor:'pointer', fontWeight: forcedProvider===p ? 700 : 400 }}>
                        {p === null ? '🔓 Auto' : `🔒 ${p}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PERSONA TAB */}
            {modePopupTab === 'persona' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  { id:'jons', icon:'🦾', name:'Jons Bhai', desc:'Default — Tony Stark JARVIS style, Hinglish' },
                  { id:'strict', icon:'🎯', name:'Focus Mode', desc:'Sirf kaam ki baatein, no jokes' },
                  { id:'chill', icon:'😎', name:'Chill Bro', desc:'Casual, fun, masti' },
                  { id:'teacher', icon:'📚', name:'Teacher', desc:'Explain karta hai clearly, examples deta hai' },
                ].map(p => {
                  const cur = typeof window !== 'undefined' ? (localStorage.getItem('jarvis_mode')||'jons') : 'jons';
                  return (
                    <button key={p.id} onClick={()=>{ if(typeof window!=='undefined') p.id==='jons' ? localStorage.removeItem('jarvis_mode') : localStorage.setItem('jarvis_mode',p.id); setPlusOpen(false); toastInfo(`🎭 Persona: ${p.name}`); }}
                      style={{ background: cur===p.id ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.02)', border:`1px solid ${cur===p.id?'rgba(0,212,255,0.3)':'rgba(255,255,255,0.06)'}`, borderRadius:14, padding:'10px 12px', cursor:'pointer', textAlign:'left' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:20 }}>{p.icon}</span>
                        <div>
                          <div style={{ color:'#e0e0ff', fontSize:13, fontWeight:600 }}>{p.name}</div>
                          <div style={{ color:'#666', fontSize:11 }}>{p.desc}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}  
