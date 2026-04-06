'use client'
import React from 'react'
import { useRouter, usePathname } from 'next/navigation'

const TABS = [
  { icon: '\uD83C\uDFE0', label: 'Home',     route: '/' },
  { icon: '\uD83D\uDD2E', label: 'Orb',      route: '/orb' },
  { icon: null,           label: 'New',       route: '__new__' }, // center FAB
  { icon: '\uD83C\uDF38', label: 'Sakhi',     route: '/sakhi' },
  { icon: '\u2699\uFE0F', label: 'Settings',  route: '/settings' },
]

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  const handleTab = (route: string) => {
    if (route === '__new__') {
      if (pathname === '/') {
        // Fire event to clear chat from home page
        window.dispatchEvent(new CustomEvent('jarvis:newchat'))
      } else {
        router.push('/')
      }
      return
    }
    router.push(route)
  }

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'rgba(8,8,15,0.97)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid #1e1e2e',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-around',
      paddingTop: 6,
      paddingBottom: 'max(8px,env(safe-area-inset-bottom))',
      zIndex: 100,
    }}>
      {TABS.map((tab, i) => {
        const isNew = tab.route === '__new__'
        const active = !isNew && pathname === tab.route
        return (
          <button key={tab.route + i} onClick={() => handleTab(tab.route)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: isNew ? '0' : '4px 12px',
              borderRadius: isNew ? '50%' : 10,
              minWidth: isNew ? 52 : 54,
              color: active ? '#00d4ff' : '#444',
              transform: isNew ? 'translateY(-12px)' : 'none',
              transition: 'all 0.2s',
            }}>
            {isNew ? (
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'linear-gradient(135deg,#00d4ff,#0055aa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, color: '#000', fontWeight: 900,
                boxShadow: '0 4px 20px rgba(0,212,255,0.45)',
                border: '3px solid #08080f',
              }}>
                ✦
              </div>
            ) : (
              <>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{tab.icon}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{tab.label}</span>
                {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#00d4ff', marginTop: 1 }} />}
              </>
            )}
          </button>
        )
      })}
    </nav>
  )
}
