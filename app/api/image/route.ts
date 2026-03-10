/* app/api/image/route.ts — Image generation (URL only, no binary proxy) */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt) return NextResponse.json({ error: 'Prompt required' }, { status: 400 });

    // Pollinations (unlimited, no key)
    const seed = Math.floor(Math.random() * 999999);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

    // Verify URL is reachable (HEAD request)
    try {
      const check = await fetch(imageUrl, { method: 'HEAD' });
      if (check.ok) {
        return NextResponse.json({ url: imageUrl, provider: 'Pollinations' });
      }
    } catch {}

    // Fallback URL (still Pollinations but different params)
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;
    return NextResponse.json({ url: fallbackUrl, provider: 'Pollinations-Fallback' });
  } catch (err) {
    return NextResponse.json({ error: `Image generation failed: ${err}` }, { status: 500 });
  }
}
