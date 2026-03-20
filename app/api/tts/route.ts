// api/tts/route.ts — TTS Smart Router
// Priority: ElevenLabs (realistic) → Puter (free) → Pollinations audio → Web Speech (browser)
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
export const maxDuration = 20

export async function POST(req: NextRequest) {
  const { text, voice = 'nova', provider = 'auto', clientKeys = {} } = await req.json().catch(() => ({}))
  if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 })

  const clean = text.slice(0, 500).replace(/\*\*|__|##|`/g, '')

  // 1. ElevenLabs — most realistic (user key needed, 10K chars/month free)
  const elKey = (clientKeys as any).ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY
  if (elKey && provider !== 'pollinations') {
    try {
      const voiceMap: Record<string,string> = {
        nova: 'EXAVITQu4vr4xnSDxMaL', // Sarah
        alloy: 'pNInz6obpgDQGcFmaJgB', // Adam
        echo: 'ErXwobaYiN019PkySvjV',   // Antoni
        onyx: 'VR6AewLTigWG4xSOukaG',   // Arnold
      }
      const voiceId = voiceMap[voice] || voiceMap.nova
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'xi-api-key': elKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
        signal: AbortSignal.timeout(15000),
      })
      if (res.ok) {
        const audio = await res.arrayBuffer()
        return new NextResponse(audio, { headers: { 'Content-Type': 'audio/mpeg', 'X-Provider': 'ElevenLabs' } })
      }
    } catch {}
  }

  // 2. Pollinations audio (openai-audio model, no key)
  try {
    const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(clean)}?model=openai-audio&voice=${voice}`, {
      signal: AbortSignal.timeout(12000),
    })
    if (res.ok) {
      const audio = await res.arrayBuffer()
      return new NextResponse(audio, { headers: { 'Content-Type': 'audio/mpeg', 'X-Provider': 'Pollinations' } })
    }
  } catch {}

  // 3. Fallback — tell client to use Web Speech
  return NextResponse.json({ fallback: 'webspeech', text: clean }, { status: 200 })
}
