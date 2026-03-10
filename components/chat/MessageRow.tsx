'use client';
/* components/chat/MessageRow.tsx
 * ThinkBlock — DeepSeek R1 / Gemini Thinking ke liye reasoning display
 * Rule R-B: page.tsx mein import karke use karo
 */
import React, { useState } from 'react';

interface ThinkBlockProps {
  thinking: string;
}

export function ThinkBlock({ thinking }: ThinkBlockProps) {
  const [open, setOpen] = useState(false);
  if (!thinking?.trim()) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background:    'rgba(168,85,247,0.08)',
          border:        '1px solid rgba(168,85,247,0.25)',
          borderRadius:  8,
          padding:       '4px 12px',
          color:         '#a855f7',
          fontSize:      11,
          cursor:        'pointer',
          display:       'flex',
          alignItems:    'center',
          gap:           6,
        }}
      >
        <span style={{ fontSize: 14 }}>{open ? '🧠' : '💭'}</span>
        {open ? 'Thinking chhupao' : `Thinking dekho (${Math.ceil(thinking.length / 4)} tokens)`}
        <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          background:   'rgba(168,85,247,0.05)',
          border:       '1px solid rgba(168,85,247,0.15)',
          borderRadius: '0 0 8px 8px',
          padding:      12,
          marginTop:    -1,
          fontSize:     12,
          color:        '#888',
          lineHeight:   1.7,
          whiteSpace:   'pre-wrap',
          maxHeight:    300,
          overflowY:    'auto',
          fontFamily:   'monospace',
        }}>
          {thinking}
        </div>
      )}
    </div>
  );
}

// Code copy button — inline mein use karo
export function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        position:   'absolute',
        top:        8,
        right:      8,
        background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
        border:     '1px solid #2a2a4a',
        borderRadius: 6,
        padding:    '3px 8px',
        color:      copied ? '#22c55e' : '#666',
        fontSize:   10,
        cursor:     'pointer',
        transition: 'all 0.2s',
      }}
    >
      {copied ? '✅ Copied' : '📋 Copy'}
    </button>
  );
}

// Image save button
export function ImageSaveButton({ url, name = 'jarvis-image' }: { url: string; name?: string }) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${name}.jpg`;
      a.click();
    } catch {
      window.open(url, '_blank');
    }
    setSaving(false);
  };

  return (
    <button
      onClick={handleSave}
      disabled={saving}
      style={{
        background:   'rgba(0,212,255,0.08)',
        border:       '1px solid rgba(0,212,255,0.2)',
        borderRadius: 6,
        padding:      '4px 10px',
        color:        '#00d4ff',
        fontSize:     11,
        cursor:       saving ? 'not-allowed' : 'pointer',
        marginTop:    4,
      }}
    >
      {saving ? '⏳ Saving...' : '💾 Save Image'}
    </button>
  );
}
