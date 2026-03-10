'use client';
import React from 'react';
import { useRouter } from 'next/navigation';

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { icon: '💬', label: 'Chat', route: '/' },
  { icon: '📚', label: 'Study', route: '/study' },
  { icon: '🎨', label: 'Studio', route: '/studio' },
  { icon: '📱', label: 'Apps', route: '/apps' },
  { icon: '🇮🇳', label: 'India Hub', route: '/india' },
  { icon: '🎵', label: 'Media', route: '/media' },
  { icon: '🎤', label: 'Voice', route: '/voice' },
  { icon: '🛠️', label: 'Tools', route: '/tools' },
  { icon: '🎯', label: 'Goals', route: '/target' },
  { icon: '⚙️', label: 'Settings', route: '/settings' },
];

export default function NavDrawer({ open, onClose }: NavDrawerProps) {
  const router = useRouter();

  const go = (route: string) => {
    onClose();
    router.push(route);
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 99 }}
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`nav-drawer ${open ? 'open' : ''}`}
        style={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{ width: 36, height: 4, background: '#333', borderRadius: 2 }} />
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 20, color: '#00d4ff', fontWeight: 700, fontSize: 18 }}>
          🤖 JARVIS
        </div>

        {/* Nav items */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.route}
              onClick={() => go(item.route)}
              style={{
                background: 'none',
                border: 'none',
                color: '#e0e0ff',
                padding: '16px 8px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                borderRadius: 12,
                fontSize: 12,
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,212,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontSize: 24 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Version */}
        <div style={{ textAlign: 'center', marginTop: 16, color: '#444', fontSize: 11 }}>
          JARVIS v20.3 · ₹0/month
        </div>
      </div>
    </>
  );
}
