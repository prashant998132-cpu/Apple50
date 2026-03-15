/* lib/tts.ts — TTS fallback chain */
'use client';

let currentUtterance: SpeechSynthesisUtterance | null = null;
let isSpeaking = false;

export function stopSpeaking(): void {
  if (typeof window === 'undefined') return;
  window.speechSynthesis?.cancel();
  isSpeaking = false;
  currentUtterance = null;
}

export async function speakWithPuter(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const puter = (window as any).puter;
    if (puter?.ai?.txt2speech) {
      const audio = await puter.ai.txt2speech(text.slice(0, 300));
      if (audio) { audio.play(); return true; }
    }
  } catch {}
  return false;
}

export function speakText(text: string, onEnd?: () => void): void {
  if (typeof window === 'undefined') return;
  stopSpeaking();

  // Clean text for TTS
  const clean = text
    .replace(/```[\s\S]*?```/g, 'Code block.')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[|`#*_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);

  if (!clean) return;

  // Try Web Speech API
  if (window.speechSynthesis) {
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'en-IN';
    utter.rate = 1.05;
    utter.pitch = 1.0;
    utter.volume = 1.0;

    // Pick a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.lang === 'en-IN' || v.name.includes('Google') || v.name.includes('Samantha')
    );
    if (preferred) utter.voice = preferred;

    utter.onend = () => {
      isSpeaking = false;
      onEnd?.();
    };
    utter.onerror = () => {
      isSpeaking = false;
    };

    currentUtterance = utter;
    isSpeaking = true;
    window.speechSynthesis.speak(utter);
  }
}

export function getIsSpeaking(): boolean {
  return isSpeaking;
}
