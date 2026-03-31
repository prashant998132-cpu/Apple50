'use client'
import React from 'react'
import { useRouter, usePathname } from 'next/navigation'

const TABS = [
  { icon: '\u2302', label: 'Home',     route: '/' },
  { icon: '\U0001f52e', label: 'Orb',  route: '/orb' },
  { icon: '\U0001f6e0\ufe0f', label: 'Tools', route: '/tools' },
  { icon: '\U0001f338', label: 'Sakhi', route: '/sakhi' },
  { icon: '\u2699\ufe0f', label: 'Settings', route: '/settings' },
]

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'rgba(8,8,15,0.95)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid #1e1e2e',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
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
              gap: 3, background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 12px', borderRadius: 10,
              color: active ? '#00d4ff' : '#444',
              transition: 'color 0.2s',
              minWidth: 54,
            }}
          >
            <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, letterSpacing: 0.3 }}>{tab.label}</span>
            {active && (
              <div style={{
                position: 'absolute',
                width: 4, height: 4, borderRadius: '50%',
                background: '#00d4ff',
                marginTop: 32,
              }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}
