/* app/api/tts/route.ts — TTS (browser-side Web Speech API preferred) */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'en-IN' } = await req.json();
    if (!text) return NextResponse.json({ error: 'Text required' }, { status: 400 });

    // Try Pollinations TTS
    const clean = text.replace(/[#*`_\[\]]/g, '').slice(0, 300);
    const pollinationsUrl = `https://text.pollinations.ai/${encodeURIComponent(clean)}`;

    return NextResponse.json({
      url: pollinationsUrl,
      provider: 'Pollinations-TTS',
      note: 'Use browser Web Speech API for best quality',
    });
  } catch (err) {
    return NextResponse.json({ error: `TTS failed: ${err}` }, { status: 500 });
  }
}
