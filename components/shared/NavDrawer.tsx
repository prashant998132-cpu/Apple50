'use client';
import React from 'react';
import { useRouter } from 'next/navigation';

const NAV = [
  { icon: '💬', label: 'Chat', route: '/' },
  { icon: '⚡', label: 'Agent', route: '/agent' },
  { icon: '🎤', label: 'Voice', route: '/voice' },
  { icon: '📚', label: 'Study', route: '/study' },
  { icon: '🎯', label: 'Goals', route: '/target' },
  { icon: '🛠️', label: 'Tools', route: '/tools' },
  { icon: '🇮🇳', label: 'India', route: '/india' },
  { icon: '🎨', label: 'Studio', route: '/studio' },
  { icon: '📱', label: 'Apps', route: '/apps' },
  { icon: '📡', label: 'Briefing', route: '/briefing' },
  { icon: '🌐', label: 'System', route: '/system' },
  { icon: '⚙️', label: 'Settings', route: '/settings' },
];

interface Props { open: boolean; onClose: () => void }

export default function NavDrawer({ open, onClose }: Props) {
  const router = useRouter();

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          zIndex: 100, backdropFilter: 'blur(4px)',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 260,
        background: '#0a0a14', borderRight: '1px solid #1e1e2e',
        zIndex: 101, padding: '20px 0', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '0 20px 20px', borderBottom: '1px solid #1e1e2e', marginBottom: 8 }}>
          <div style={{ color: '#00d4ff', fontSize: 20, fontWeight: 900, letterSpacing: 2 }}>JARVIS</div>
          <div style={{ color: '#333', fontSize: 10, marginTop: 2 }}>AI Assistant v20.9</div>
        </div>

        {/* Nav Items */}
        {NAV.map(item => (
          <button
            key={item.route}
            onClick={() => { router.push(item.route); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              width: '100%', padding: '13px 20px',
              background: 'none', border: 'none',
              color: '#888', fontSize: 14, cursor: 'pointer',
              textAlign: 'left', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#111120';
              (e.currentTarget as HTMLElement).style.color = '#00d4ff';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'none';
              (e.currentTarget as HTMLElement).style.color = '#888';
            }}
          >
            <span style={{ fontSize: 20, minWidth: 24 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}

        {/* Bottom info */}
        <div style={{ padding: '20px', marginTop: 20, borderTop: '1px solid #1e1e2e' }}>
          <div style={{ color: '#222', fontSize: 10, lineHeight: 1.8 }}>
            ₹0/month · 14+ AI providers<br/>
            Vercel + GitHub hosting<br/>
            PWA + Android APK
          </div>
        </div>
      </div>
    </>
  );
}
