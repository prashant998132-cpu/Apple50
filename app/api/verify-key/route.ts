/* app/api/verify-key/route.ts — Live API key tester */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { provider, key } = await req.json();

  try {
    switch (provider) {
      case 'groq': {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        return NextResponse.json({ valid: res.ok, status: res.status });
      }
      case 'gemini': {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        return NextResponse.json({ valid: res.ok, status: res.status });
      }
      case 'together': {
        const res = await fetch('https://api.together.xyz/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        return NextResponse.json({ valid: res.ok, status: res.status });
      }
      default:
        return NextResponse.json({ valid: false, error: 'Unknown provider' });
    }
  } catch (err) {
    return NextResponse.json({ valid: false, error: String(err) });
  }
}
