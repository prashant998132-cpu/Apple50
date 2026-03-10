'use client';
import React, { useRef, useState, useEffect } from 'react';

export type ChatMode = 'auto' | 'flash' | 'think' | 'deep';

interface InputBarProps {
  onSend: (text: string, attachments?: File[]) => void;
  onModeChange: (mode: ChatMode) => void;
  mode: ChatMode;
  disabled?: boolean;
  inputValue?: string;
  onInputChange?: (v: string) => void;
}

export default function InputBar({ onSend, onModeChange, mode, disabled, inputValue, onInputChange }: InputBarProps) {
  const [text, setText] = useState(inputValue || '');
  const [plusOpen, setPlusOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputValue !== undefined) setText(inputValue);
  }, [inputValue]);

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
    onInputChange?.('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    onInputChange?.(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const handlePlusClick = () => {
    setPlusOpen(prev => !prev);
    if (!plusOpen) {
      setTimeout(() => {
        const close = (e: MouseEvent) => {
          if (!(e.target as Element).closest('.plus-popup') && !(e.target as Element).closest('.plus-btn')) {
            setPlusOpen(false);
            document.removeEventListener('click', close);
          }
        };
        document.addEventListener('click', close);
      }, 80);
    }
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onSend(`[Attached: ${files.map(f => f.name).join(', ')}]`, files);
    e.target.value = '';
    setPlusOpen(false);
  };

  const MODES: { key: ChatMode; icon: string; label: string }[] = [
    { key: 'auto', icon: '🤖', label: 'Auto' },
    { key: 'flash', icon: '⚡', label: 'Flash' },
    { key: 'think', icon: '🧠', label: 'Think' },
    { key: 'deep', icon: '🔬', label: 'Deep' },
  ];

  return (
    <div style={{ position: 'relative', padding: '8px 12px', borderTop: '1px solid #1e1e2e', background: 'var(--bg)' }}>
      {/* Plus popup */}
      {plusOpen && (
        <div
          className="plus-popup"
          style={{
            position: 'fixed',
            bottom: 80,
            left: 12,
            right: 12,
            zIndex: 9999,
            background: '#111118',
            border: '1px solid #1e1e2e',
            borderRadius: 16,
            padding: 16,
          }}
        >
          {/* Mode selection */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: '#666', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Mode</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {MODES.map(m => (
                <button
                  key={m.key}
                  onClick={() => { onModeChange(m.key); setPlusOpen(false); }}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: 10,
                    border: mode === m.key ? '1px solid #00d4ff' : '1px solid #2a2a4a',
                    background: mode === m.key ? 'rgba(0,212,255,0.1)' : '#1a1a2e',
                    color: mode === m.key ? '#00d4ff' : '#888',
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Attach options */}
          <div>
            <div style={{ color: '#666', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Attach</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { icon: '📷', label: 'Camera', action: () => { fileRef.current?.click(); setPlusOpen(false); } },
                { icon: '🖼️', label: 'Image', action: () => { fileRef.current?.click(); setPlusOpen(false); } },
                { icon: '📄', label: 'PDF', action: () => { fileRef.current?.click(); setPlusOpen(false); } },
                { icon: '🎵', label: 'Voice', action: () => setPlusOpen(false) },
              ].map(opt => (
                <button
                  key={opt.label}
                  onClick={opt.action}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: 10,
                    border: '1px solid #2a2a4a',
                    background: '#1a1a2e',
                    color: '#888',
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        {/* Plus button */}
        <button
          className="plus-btn"
          onClick={handlePlusClick}
          style={{
            width: 40, height: 40,
            borderRadius: '50%',
            background: plusOpen ? 'rgba(0,212,255,0.15)' : '#1a1a2e',
            border: '1px solid #2a2a4a',
            color: plusOpen ? '#00d4ff' : '#888',
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
        >
          +
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="JARVIS se kuch bhi pucho..."
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            background: '#111118',
            border: '1px solid #2a2a4a',
            borderRadius: 20,
            padding: '10px 14px',
            color: '#e0e0ff',
            fontSize: 15,
            outline: 'none',
            resize: 'none',
            minHeight: 40,
            maxHeight: 120,
            lineHeight: 1.4,
            fontFamily: 'inherit',
            overflowY: 'auto',
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          style={{
            width: 40, height: 40,
            borderRadius: '50%',
            background: text.trim() && !disabled ? '#00d4ff' : '#1a1a2e',
            border: 'none',
            color: text.trim() && !disabled ? '#000' : '#444',
            fontSize: 18,
            cursor: text.trim() && !disabled ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
        >
          ↑
        </button>
      </div>

      {/* Hidden file input */}
      <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFileAttach} multiple accept="image/*,.pdf" />
    </div>
  );
}
