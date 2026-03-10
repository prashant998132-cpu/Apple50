'use client';
import React, { useEffect, useState, useCallback } from 'react';

export interface ToastData {
  id: string;
  message: string;
  type: 'default' | 'ok' | 'err' | 'info' | 'warn';
  icon?: string;
}

const TYPE_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  ok:      { bg: 'rgba(34,197,94,0.12)',   border: '#22c55e', icon: '✅' },
  err:     { bg: 'rgba(239,68,68,0.12)',   border: '#ef4444', icon: '❌' },
  info:    { bg: 'rgba(0,212,255,0.10)',   border: '#00d4ff', icon: '💡' },
  warn:    { bg: 'rgba(245,158,11,0.12)',  border: '#f59e0b', icon: '⚠️' },
  default: { bg: 'rgba(255,255,255,0.05)', border: '#2a2a4a', icon: '🔔' },
};

export function Toast({ toast, onClose }: { toast: ToastData; onClose: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onClose(toast.id), 300);
  }, [toast.id, onClose]);

  useEffect(() => {
    // Fade in
    const t1 = setTimeout(() => setVisible(true), 10);
    // Auto dismiss after 4 seconds
    const t2 = setTimeout(dismiss, 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [dismiss]);

  const style = TYPE_STYLES[toast.type] || TYPE_STYLES.default;
  const icon = toast.icon || style.icon;

  return (
    <div
      onClick={dismiss}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 14,
        padding: '10px 14px',
        marginBottom: 8,
        cursor: 'pointer',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px ${style.border}22`,
        // Fade in/out animation
        opacity: visible && !leaving ? 1 : 0,
        transform: visible && !leaving ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.96)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        maxWidth: 340,
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <span style={{ color: '#e0e0ff', fontSize: 13, lineHeight: 1.4, flex: 1 }}>{toast.message}</span>
      <span style={{ color: '#444', fontSize: 14, flexShrink: 0 }}>✕</span>
    </div>
  );
}

export function ToastContainer({ toasts, onClose }: { toasts: ToastData[]; onClose: (id: string) => void }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 90,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '92%',
      maxWidth: 360,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'all', width: '100%' }}>
          <Toast toast={t} onClose={onClose} />
        </div>
      ))}
    </div>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback((
    message: string,
    type: ToastData['type'] = 'default',
    icon?: string,
  ) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev.slice(-3), { id, message, type, icon }]); // max 4 at once
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Shortcuts
  const toastOk   = (msg: string) => showToast(msg, 'ok');
  const toastErr  = (msg: string) => showToast(msg, 'err');
  const toastInfo = (msg: string) => showToast(msg, 'info');
  const toastWarn = (msg: string) => showToast(msg, 'warn');

  return { toasts, showToast, hideToast, toastOk, toastErr, toastInfo, toastWarn };
}
