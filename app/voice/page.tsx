'use client';
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { speakText, stopSpeaking } from '@/lib/tts';

export default function VoicePage() {
  const router = useRouter();
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Use Chrome!');
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (e: any) => {
      const text = Array.from(e.results).map((r: any) => r[0].transcript).join('');
      setTranscript(text);
    };

    recognition.onend = async () => {
      setListening(false);
      if (transcript) await sendToJARVIS(transcript);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
    setTranscript('');
    setResponse('');
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const sendToJARVIS = async (text: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: text }], mode: 'flash' }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const d = JSON.parse(line.slice(6));
              if (d.type === 'delta') { full += d.text; setResponse(full); }
            } catch {}
          }
        }
      }
      speakText(full);
    } catch {
      setResponse('Error. Try again!');
    }
    setLoading(false);
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>🎤 Voice Mode</div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 24 }}>
        {/* Mic button */}
        <button
          onClick={listening ? stopListening : startListening}
          style={{
            width: 100, height: 100, borderRadius: '50%',
            background: listening ? 'rgba(239,68,68,0.2)' : 'rgba(0,212,255,0.1)',
            border: listening ? '3px solid #ef4444' : '3px solid #00d4ff',
            fontSize: 40, cursor: 'pointer',
            animation: listening ? 'pulse-glow 1s infinite' : 'none',
            transition: 'all 0.3s',
          }}
        >
          {listening ? '⏹️' : '🎤'}
        </button>

        <div style={{ color: '#555', fontSize: 14 }}>
          {listening ? 'Bol raha hun... (tap to stop)' : 'Mic tap karo aur bolo'}
        </div>

        {transcript && (
          <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 12, padding: 16, width: '100%', maxWidth: 340 }}>
            <div style={{ color: '#555', fontSize: 11, marginBottom: 6 }}>YOU SAID:</div>
            <div style={{ color: '#e0e0ff', fontSize: 14 }}>{transcript}</div>
          </div>
        )}

        {loading && (
          <div style={{ color: '#555', fontSize: 14 }}>🧠 JARVIS soch raha hai...</div>
        )}

        {response && (
          <div style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 12, padding: 16, width: '100%', maxWidth: 340 }}>
            <div style={{ color: '#00d4ff', fontSize: 11, marginBottom: 6 }}>JARVIS:</div>
            <div style={{ color: '#c8e8ff', fontSize: 14, lineHeight: 1.6 }}>{response}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => speakText(response)}
                style={{ flex: 1, background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, color: '#888', padding: 8, cursor: 'pointer', fontSize: 12 }}
              >
                🔊 Speak again
              </button>
              <button
                onClick={stopSpeaking}
                style={{ flex: 1, background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: 8, color: '#888', padding: 8, cursor: 'pointer', fontSize: 12 }}
              >
                🔇 Stop
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
