'use client'
import React from 'react'
import { useRouter, usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { icon: '⚡', label: 'Agent',        route: '/agent',        cat: 'AI' },
  { icon: '🎙️', label: 'Voice',        route: '/voice',        cat: 'AI' },
  { icon: '📡', label: 'Briefing',     route: '/briefing',     cat: 'AI' },
  { icon: '🧠', label: 'Agent',        route: '/agent',        cat: 'AI' },
  { icon: '📚', label: 'Study',        route: '/study',        cat: 'Learn' },
  { icon: '📝', label: 'Notes',        route: '/notes',        cat: 'Learn' },
  { icon: '🃏', label: 'Flashcards',   route: '/notes',        cat: 'Learn' },
  { icon: '🎯', label: 'Goals',        route: '/target',       cat: 'Learn' },
  { icon: '⏰', label: 'Reminders',    route: '/reminders',    cat: 'Productivity' },
  { icon: '💬', label: 'History',      route: '/chat-history', cat: 'Productivity' },
  { icon: '🛠️', label: 'Tools',        route: '/tools',        cat: 'Tools' },
  { icon: '📱', label: 'Apps Hub',     route: '/apps',         cat: 'Tools' },
  { icon: '🎨', label: 'Media Hub',    route: '/media',        cat: 'Create' },
  { icon: '🖌️', label: 'Canva AI',    route: '/canva',        cat: 'Create' },
  { icon: '🎭', label: 'AI Studio',    route: '/studio',       cat: 'Create' },
  { icon: '🇮🇳', label: 'India Hub',   route: '/india',        cat: 'India' },
  { icon: '🖥️', label: 'System',       route: '/system',       cat: 'System' },
  { icon: '⚙️', label: 'Settings',     route: '/settings',     cat: 'System' },
]

// Remove duplicate Agent entry
const ITEMS = [
  { icon: '⚡', label: 'Agent',        route: '/agent' },
  { icon: '📷', label: 'Camera AI',    route: '/camera' },
  { icon: '🎙️', label: 'Voice',        route: '/voice' },
  { icon: '📡', label: 'Briefing',     route: '/briefing' },
  { icon: '📚', label: 'Study',        route: '/study' },
  { icon: '📝', label: 'Notes',        route: '/notes' },
  { icon: '🎯', label: 'Goals',        route: '/target' },
  { icon: '⏰', label: 'Reminders',    route: '/reminders' },
  { icon: '💬', label: 'History',      route: '/chat-history' },
  { icon: '🛠️', label: 'Tools',        route: '/tools' },
  { icon: '📱', label: 'Apps Hub',     route: '/apps' },
  { icon: '🎨', label: 'Media Hub',    route: '/media' },
  { icon: '🖌️', label: 'Canva AI',    route: '/canva' },
  { icon: '🎭', label: 'AI Studio',    route: '/studio' },
  { icon: '🇮🇳', label: 'India Hub',   route: '/india' },
  { icon: '🖥️', label: 'System',       route: '/system' },
  { icon: '⚙️', label: 'Settings',     route: '/settings' },
]

const CATS: Record<string, string[]> = {
  '🤖 AI':          ['/agent', '/voice', '/briefing', '/camera'],
  '📖 Learn':       ['/study', '/notes', '/target'],
  '✅ Productivity':['/reminders', '/chat-history'],
  '🔧 Tools':       ['/tools', '/apps'],
  '🎨 Create':      ['/media', '/canva', '/studio'],
  '🇮🇳 India':      ['/india'],
  '⚙️ System':      ['/system', '/settings'],
}

interface Props { onClose: () => void }

export default function NavDrawer({ onClose }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const go = (route: string) => { router.push(route); onClose() }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }} />
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 260, background: '#08080f', borderRight: '1px solid #1e1e2e', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid #1e1e2e' }}>
          <div style={{ color: '#00d4ff', fontWeight: 900, fontSize: 18, letterSpacing: 2 }}>JARVIS</div>
          <div style={{ color: '#333', fontSize: 11, marginTop: 2 }}>v21 · Just A Rather Very Intelligent System</div>
        </div>

        {/* Home button */}
        <button onClick={() => go('/')} style={{ margin: '10px 14px', background: pathname === '/' ? 'rgba(0,212,255,0.1)' : '#111118', border: `1px solid ${pathname === '/' ? '#00d4ff' : '#1e1e2e'}`, borderRadius: 10, color: pathname === '/' ? '#00d4ff' : '#888', padding: '10px 14px', cursor: 'pointer', fontSize: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          🏠 <span>Home Chat</span>
        </button>

        {/* Categorized nav */}
        {Object.entries(CATS).map(([cat, routes]) => (
          <div key={cat} style={{ marginBottom: 4 }}>
            <div style={{ color: '#333', fontSize: 10, fontWeight: 600, padding: '8px 14px 4px', letterSpacing: 1 }}>{cat}</div>
            {ITEMS.filter(item => routes.includes(item.route)).map(item => (
              <button key={item.route} onClick={() => go(item.route)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', background: pathname === item.route ? 'rgba(0,212,255,0.08)' : 'none', border: 'none', borderLeft: pathname === item.route ? '2px solid #00d4ff' : '2px solid transparent', color: pathname === item.route ? '#00d4ff' : '#777', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}

        <div style={{ flex: 1 }} />
        <div style={{ padding: 14, color: '#222', fontSize: 11, textAlign: 'center' }}>
          Made with ❤️ by Pranshu · Maihar
        </div>
      </div>
    </div>
  )
}
