/* app/api/fetch-url/route.ts — Safe URL content fetcher (no Vercel media proxy) */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Blocked patterns — never proxy these
const BLOCKED = [
  /localhost/i, /127\.0\.0\.1/, /192\.168\./,
  /\.onion$/i, /file:\/\//i,
];

// Max response size we'll read (50KB of text)
const MAX_BYTES = 50 * 1024;

export async function POST(req: NextRequest) {
  try {
    const { url, type = 'text' } = await req.json();

    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

    // Block dangerous URLs
    for (const pattern of BLOCKED) {
      if (pattern.test(url)) {
        return NextResponse.json({ error: 'URL not allowed' }, { status: 403 });
      }
    }

    // Must be http/https
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json({ error: 'Only http/https URLs allowed' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 JARVIS-Bot/1.0',
        'Accept': 'text/html,application/json,text/plain,*/*',
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ error: `URL returned ${res.status}` }, { status: 200 });
    }

    const contentType = res.headers.get('content-type') || '';

    // JSON
    if (contentType.includes('application/json')) {
      const json = await res.json();
      return NextResponse.json({ success: true, type: 'json', data: json });
    }

    // Text / HTML
    if (contentType.includes('text/')) {
      const reader = res.body?.getReader();
      if (!reader) return NextResponse.json({ error: 'No body' }, { status: 200 });

      let bytes = 0;
      const chunks: Uint8Array[] = [];
      while (bytes < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        bytes += value.length;
      }
      reader.cancel();

      const text = new TextDecoder().decode(
        new Uint8Array(chunks.reduce((acc: number[], chunk) => [...acc, ...chunk], []))
      );

      // Strip HTML tags for cleaner output
      const clean = contentType.includes('text/html')
        ? text
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 3000)
        : text.slice(0, 3000);

      return NextResponse.json({ success: true, type: 'text', data: clean, truncated: bytes >= MAX_BYTES });
    }

    return NextResponse.json({ success: true, type: contentType, data: 'Binary content — not readable' });

  } catch (err: any) {
    if (err.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out (8s)' }, { status: 200 });
    }
    return NextResponse.json({ error: `Fetch failed: ${err.message}` }, { status: 200 });
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });
  return POST(new NextRequest(req.url, { method: 'POST', body: JSON.stringify({ url }) }));
}
