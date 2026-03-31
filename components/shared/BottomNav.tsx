'use client'
import React from 'react'
import { useRouter, usePathname } from 'next/navigation'

const TABS = [
  { icon: '⌂', label: 'Home',     route: '/' },
  { icon: '🔮', label: 'Orb',  route: '/orb' },
  { icon: '🛠️', label: 'Tools', route: '/tools' },
  { icon: '🌸', label: 'Sakhi', route: '/sakhi' },
  { icon: '⚙️', label: 'Settings', route: '/settings' },
]

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'rgba(8,8,15,0.97)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid #1e1e2e',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      paddingTop: 8,
      paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      zIndex: 100,
    }}>
      {TABS.map(tab => {
        const active = pathname === tab.route
        return (
          <button
            key={tab.route}
            onClick={() => router.push(tab.route)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 2, background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 12px', borderRadius: 10, minWidth: 54,
              color: active ? '#00d4ff' : '#444',
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{tab.icon}</span>
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{tab.label}</span>
            {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#00d4ff', marginTop: 1 }} />}
          </button>
        )
      })}
    </nav>
  )
}
