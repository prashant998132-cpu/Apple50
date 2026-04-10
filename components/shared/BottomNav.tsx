'use client'
import React from 'react'
import { useRouter, usePathname } from 'next/navigation'

// Clean BottomNav — sirf Home + Memory + New Chat + Settings
// Orb/Sakhi hata diye — chat ke liye zyada jagah

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()

  const tabs = [
    { icon: '🏠', label: 'Home',     route: '/' },
    { icon: '🧠', label: 'Memory',   route: '__memory__' },
    { icon: null,  label: 'New',      route: '__new__' },   // center FAB
    { icon: '📋', label: 'History',  route: '/chat-history' },
    { icon: '⚙️', label: 'Settings', route: '/settings' },
  ]

  const handleTab = (route: string) => {
    if (route === '__new__') {
      if (pathname === '/') {
        window.dispatchEvent(new CustomEvent('jarvis:newchat'))
      } else {
        router.push('/')
      }
      return
    }
    if (route === '__memory__') {
      window.dispatchEvent(new CustomEvent('jarvis:openmemory'))
      return
    }
    router.push(route)
  }

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'rgba(6,6,15,0.97)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-around',
      paddingTop: 6,
      paddingBottom: 'max(8px,env(safe-area-inset-bottom))',
      zIndex: 100,
    }}>
      {tabs.map((tab, i) => {
        const isNew = tab.route === '__new__'
        const active = !isNew && tab.route !== '__memory__' && pathname === tab.route
        return (
          <button key={tab.route + i} onClick={() => handleTab(tab.route)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: isNew ? 0 : '4px 10px',
              minWidth: isNew ? 52 : 50,
              color: active ? '#00d4ff' : '#444',
              transform: isNew ? 'translateY(-12px)' : 'none',
              transition: 'all 0.2s',
            }}>
            {isNew ? (
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'linear-gradient(135deg,#00d4ff,#0055aa)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, color: '#000', fontWeight: 900,
                boxShadow: '0 4px 20px rgba(0,212,255,0.4)',
                border: '3px solid rgba(6,6,15,0.8)',
              }}>✦</div>
            ) : (
              <>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
                <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, letterSpacing: 0.3 }}>{tab.label}</span>
                {active && <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#00d4ff', marginTop: 1 }} />}
              </>
            )}
          </button>
        )
      })}
    </nav>
  )
}
