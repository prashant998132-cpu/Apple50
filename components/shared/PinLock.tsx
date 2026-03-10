'use client';
import React, { useState, useEffect } from 'react';

const PIN_KEY = 'jarvis_pin_hash';
const ATTEMPTS_KEY = 'jarvis_pin_attempts';
const LOCKOUT_KEY = 'jarvis_pin_lockout';

async function hashPIN(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'JARVIS_SALT_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function usePinLock() {
  const hasPIN = () => typeof window !== 'undefined' && !!localStorage.getItem(PIN_KEY);
  const setPIN = async (pin: string) => {
    const hash = await hashPIN(pin);
    localStorage.setItem(PIN_KEY, hash);
  };
  const clearPIN = () => localStorage.removeItem(PIN_KEY);
  return { hasPIN, setPIN, clearPIN };
}

interface PinLockProps {
  onUnlock: () => void;
}

export default function PinLock({ onUnlock }: PinLockProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);

  useEffect(() => {
    const lockout = parseInt(localStorage.getItem(LOCKOUT_KEY) || '0');
    if (lockout > Date.now()) {
      setLocked(true);
      const remaining = Math.ceil((lockout - Date.now()) / 1000);
      setLockTimer(remaining);
      const interval = setInterval(() => {
        const rem = Math.ceil((lockout - Date.now()) / 1000);
        if (rem <= 0) { setLocked(false); clearInterval(interval); }
        else setLockTimer(rem);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, []);

  const handleUnlock = async () => {
    if (locked) return;
    const hash = await hashPIN(pin);
    const stored = localStorage.getItem(PIN_KEY);
    if (hash === stored) {
      localStorage.removeItem(ATTEMPTS_KEY);
      localStorage.removeItem(LOCKOUT_KEY);
      onUnlock();
    } else {
      const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0') + 1;
      localStorage.setItem(ATTEMPTS_KEY, String(attempts));
      if (attempts >= 5) {
        const lockoutEnd = Date.now() + 5 * 60 * 1000;
        localStorage.setItem(LOCKOUT_KEY, String(lockoutEnd));
        setLocked(true);
        setLockTimer(300);
      }
      setError(`Wrong PIN! ${5 - attempts} attempts left`);
      setPin('');
    }
  };

  const numPad = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0a0a0f',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>🤖</div>
      <div style={{ color: '#00d4ff', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>JARVIS</div>
      <div style={{ color: '#666', fontSize: 13, marginBottom: 32 }}>Enter PIN to unlock</div>

      {/* PIN dots */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: '50%',
            background: pin.length > i ? '#00d4ff' : '#222',
            border: '2px solid #333',
          }} />
        ))}
      </div>

      {locked && (
        <div style={{ color: '#ef4444', marginBottom: 16, fontSize: 13 }}>
          🔒 Locked — {lockTimer}s remaining
        </div>
      )}

      {error && <div style={{ color: '#ef4444', marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {/* Number pad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 12 }}>
        {numPad.map((n, i) => (
          <button
            key={i}
            onClick={() => {
              if (!n) return;
              if (n === '⌫') { setPin(p => p.slice(0, -1)); setError(''); }
              else if (pin.length < 4) {
                const newPin = pin + n;
                setPin(newPin);
                if (newPin.length === 4) {
                  setTimeout(() => {
                    hashPIN(newPin).then(hash => {
                      const stored = localStorage.getItem(PIN_KEY);
                      if (hash === stored) { localStorage.removeItem(ATTEMPTS_KEY); onUnlock(); }
                      else {
                        setError('Wrong PIN!');
                        setPin('');
                      }
                    });
                  }, 100);
                }
              }
            }}
            style={{
              width: 72, height: 72,
              borderRadius: '50%',
              background: n ? '#1a1a2e' : 'transparent',
              border: n ? '1px solid #2a2a4a' : 'none',
              color: '#e0e0ff',
              fontSize: 20,
              fontWeight: 500,
              cursor: n ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
