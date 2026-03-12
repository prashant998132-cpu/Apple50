'use client';
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { speakText, stopSpeaking } from '@/lib/tts';
import { buildSystemPrompt } from '@/lib/personality';

export default function VoicePage() {
  const router = useRouter();
  const [transcript, setTranscript] = useState('');
  const [response, setResponse]     = useState('');
  const [listening, setListening]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [provider, setProvider]     = useState('');
  const [error, setError]           = useState('');

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ── Browser STT (Primary) ───────────────────────────────────────────
  const startBrowserSTT = (): boolean => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return false;

    const rec = new SR();
    rec.lang = 'hi-IN';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      const text = Array.from(e.results).map((r: any) => r[0].transcript).join('');
      setTranscript(text);
    };

    rec.onerror = async (e: any) => {
      console.warn('Browser STT error:', e.error);
      rec.stop();
      // Fallback to Whisper
      await startWhisperSTT();
    };

    rec.onend = async () => {
      setListening(false);
      if (transcript) await sendToJARVIS(transcript);
    };

    rec.start();
    recognitionRef.current = rec;
    setProvider('Browser STT');
    return true;
  };

  // ── Groq Whisper STT (Fallback) ─────────────────────────────────────
  const startWhisperSTT = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setListening(false);

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const form = new FormData();
        form.append('audio', blob, 'voice.webm');
        form.append('lang', 'hi');

        setLoading(true);
        setProvider('Groq Whisper');
        try {
          const res = await fetch('/api/stt', { method: 'POST', body: form });
          const d = await res.json();
          if (d.text) {
            setTranscript(d.text);
            await sendToJARVIS(d.text);
          } else {
            setError(d.error || 'Whisper ne kuch nahi suna.');
          }
        } catch (e) {
          setError('STT failed. Dobara try karo.');
        }
        setLoading(false);
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setListening(true);
      setProvider('Groq Whisper');

      // Auto stop after 10 seconds
      setTimeout(() => { if (mr.state === 'recording') mr.stop(); }, 10000);

    } catch (e: any) {
      setError('Microphone permission chahiye! Settings mein allow karo.');
      setListening(false);
    }
  };

  // ── Start listening (Browser → Whisper fallback) ────────────────────
  const startListening = async () => {
    setTranscript('');
    setResponse('');
    setError('');

    const browserOk = startBrowserSTT();
    if (!browserOk) {
      // Browser STT unavailable → go straight to Whisper
      await startWhisperSTT();
    } else {
      setListening(true);
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
    setListening(false);
  };

  // ── Send to JARVIS ───────────────────────────────────────────────────
  const sendToJARVIS = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const systemPrompt = await buildSystemPrompt().catch(() =>
        `You are JARVIS. Hinglish mein baat karo. Concise, witty. Voice response ke liye short rakho.`
      );
      const res = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: text }], mode: 'flash', systemPrompt }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const d = JSON.parse(line.slice(6));
              if (d.type === 'delta') { full += d.text; setResponse(full); }
            } catch {}
          }
        }
      }
      if (full) speakText(full);
    } catch {
      setError('JARVIS se connect nahi ho paya.');
    }
    setLoading(false);
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1e1e2e' }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#00d4ff', fontWeight: 700, fontSize: 16 }}>🎙️ Voice Mode</div>
        <div style={{ marginLeft: 'auto', color: '#444', fontSize: 10 }}>{provider}</div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>

        {/* Mic Button */}
        <button
          onClick={listening ? stopListening : startListening}
          disabled={loading}
          style={{
            width: 110, height: 110, borderRadius: '50%', fontSize: 40,
            background: listening
              ? 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, rgba(239,68,68,0.1) 70%)'
              : 'radial-gradient(circle, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.05) 70%)',
            border: listening ? '2px solid #ef4444' : '2px solid #00d4ff',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s',
            animation: listening ? 'pulse 1s infinite' : 'none',
            marginBottom: 24,
          }}>
          {listening ? '⏹️' : '🎙️'}
        </button>

        <div style={{ color: '#555', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
          {listening ? `🎙️ Sun raha hun... (${provider})` : loading ? '⏳ Processing...' : 'Tap karo aur bolo'}
        </div>

        {/* Transcript */}
        {transcript && (
          <div style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 12, padding: 14, width: '100%', marginBottom: 14 }}>
            <div style={{ color: '#555', fontSize: 10, marginBottom: 4 }}>YOU SAID</div>
            <div style={{ color: '#e0e0ff', fontSize: 14 }}>{transcript}</div>
          </div>
        )}

        {/* Response */}
        {response && (
          <div style={{ background: 'rgba(0,212,255,0.03)', border: '1px solid #1e1e2e', borderRadius: 12, padding: 14, width: '100%', marginBottom: 14 }}>
            <div style={{ color: '#555', fontSize: 10, marginBottom: 4 }}>JARVIS</div>
            <div style={{ color: '#c8e8ff', fontSize: 14, lineHeight: 1.7 }}>{response}</div>
            <button onClick={() => speakText(response)} style={{ background: 'none', border: 'none', color: '#444', fontSize: 12, cursor: 'pointer', marginTop: 6 }}>🔊 Phir sunao</button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: 12, width: '100%', color: '#ef4444', fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        <button onClick={() => stopSpeaking()} style={{ marginTop: 16, background: 'none', border: '1px solid #2a2a4a', borderRadius: 10, color: '#555', padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}>
          🔇 Stop Speaking
        </button>

        {/* Whisper info */}
        <div style={{ marginTop: 24, color: '#333', fontSize: 11, textAlign: 'center' }}>
          🎙️ Browser STT (primary) → Groq Whisper (fallback)<br />
          Hindi, English, Hinglish — sab supported
        </div>
      </div>
    </div>
  );
}
