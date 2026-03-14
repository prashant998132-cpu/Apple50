'use client'
import React, { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const ITEMS = [
  { icon: '⚡', label: 'Agent',         route: '/agent' },
  { icon: '📱', label: 'Phone Control', route: '/macrodroid' },
  { icon: '📷', label: 'Camera AI',     route: '/camera' },
  { icon: '🎙️', label: 'Voice',         route: '/voice' },
  { icon: '📡', label: 'Briefing',      route: '/briefing' },
  { icon: '📚', label: 'Study',         route: '/study' },
  { icon: '📝', label: 'Notes',         route: '/notes' },
  { icon: '🎯', label: 'Goals',         route: '/target' },
  { icon: '⏰', label: 'Reminders',     route: '/reminders' },
  { icon: '💬', label: 'History',       route: '/chat-history' },
  { icon: '🛠️', label: 'Tools',         route: '/tools' },
  { icon: '📱', label: 'Apps Hub',      route: '/apps' },
  { icon: '🎨', label: 'Media Hub',     route: '/media' },
  { icon: '🖌️', label: 'Canva AI',     route: '/canva' },
  { icon: '🎭', label: 'AI Studio',     route: '/studio' },
  { icon: '🇮🇳', label: 'India Hub',    route: '/india' },
  { icon: '🖥️', label: 'System',        route: '/system' },
  { icon: '⚙️', label: 'Settings',      route: '/settings' },
]

const CATS: Record<string, string[]> = {
  '🤖 AI':           ['/agent', '/macrodroid', '/camera', '/voice', '/briefing'],
  '📖 Learn':        ['/study', '/notes', '/target'],
  '✅ Productivity': ['/reminders', '/chat-history'],
  '🔧 Tools':        ['/tools', '/apps'],
  '🎨 Create':       ['/media', '/canva', '/studio'],
  '🇮🇳 India':       ['/india'],
  '⚙️ System':       ['/system', '/settings'],
}

interface Props { open: boolean; onClose: () => void }

export default function NavDrawer({ open, onClose }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  // Close on back button / escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null  // ← THE FIX: not mounted when closed

  const go = (route: string) => { router.push(route); onClose() }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      {/* Overlay — tap anywhere to close */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)' }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 260,
        background: '#08080f', borderRight: '1px solid #1e1e2e',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        animation: 'slideIn 0.2s ease',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(-100%) } to { transform: translateX(0) } }`}</style>

        {/* Header */}
        <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#00d4ff', fontWeight: 900, fontSize: 18, letterSpacing: 2 }}>JARVIS</div>
            <div style={{ color: '#333', fontSize: 10, marginTop: 1 }}>v23 · apple50.vercel.app</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* Home */}
        <button onClick={() => go('/')} style={{ margin: '10px 14px 6px', background: pathname === '/' ? 'rgba(0,212,255,0.1)' : '#111118', border: `1px solid ${pathname === '/' ? '#00d4ff' : '#1e1e2e'}`, borderRadius: 10, color: pathname === '/' ? '#00d4ff' : '#888', padding: '10px 14px', cursor: 'pointer', fontSize: 14, display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left' }}>
          🏠 <span>Home Chat</span>
        </button>

        {/* Categorized */}
        {Object.entries(CATS).map(([cat, routes]) => (
          <div key={cat} style={{ marginBottom: 2 }}>
            <div style={{ color: '#333', fontSize: 10, fontWeight: 600, padding: '8px 14px 3px', letterSpacing: 1 }}>{cat}</div>
            {ITEMS.filter(item => routes.includes(item.route)).map(item => (
              <button key={item.route + item.label} onClick={() => go(item.route)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', background: pathname === item.route ? 'rgba(0,212,255,0.08)' : 'none', border: 'none', borderLeft: pathname === item.route ? '2px solid #00d4ff' : '2px solid transparent', color: pathname === item.route ? '#00d4ff' : '#777', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 17 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}

        <div style={{ flex: 1 }} />
        <div style={{ padding: 14, color: '#1a1a2e', fontSize: 11, textAlign: 'center' }}>
          Made with ❤️ Pranshu · Maihar
        </div>
      </div>
    </div>
  )
}
