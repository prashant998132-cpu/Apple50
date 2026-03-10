/* app/api/stt/route.ts — Groq Whisper STT (browser STT fail hone par fallback) */
export const runtime = 'edge';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const key = process.env.GROQ_API_KEY;
    if (!key) {
      return Response.json({ error: 'GROQ_API_KEY not set', text: '' }, { status: 200 });
    }

    const formData = await req.formData();
    const audio = formData.get('audio') as File | null;
    const lang = (formData.get('lang') as string) || 'hi'; // Hindi default for NEET student

    if (!audio) return Response.json({ error: 'No audio file', text: '' }, { status: 200 });

    // Forward to Groq Whisper
    const groqForm = new FormData();
    groqForm.append('file', audio, 'audio.webm');
    groqForm.append('model', 'whisper-large-v3');
    groqForm.append('language', lang);
    groqForm.append('response_format', 'json');
    groqForm.append('temperature', '0');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: groqForm,
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: `Groq STT error: ${err}`, text: '' }, { status: 200 });
    }

    const data = await res.json();
    return Response.json({ text: data.text || '', model: 'whisper-large-v3', provider: 'Groq' });

  } catch (err: any) {
    return Response.json({ error: err.message, text: '' }, { status: 200 });
  }
}
