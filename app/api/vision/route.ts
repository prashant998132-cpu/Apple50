import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { image, question = 'What is in this image?', systemPrompt = '', clientKeys = {} } = body

  if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  const geminiKey = (clientKeys as any).GEMINI_API_KEY || process.env.GEMINI_API_KEY
  if (!geminiKey) return NextResponse.json({ error: 'Gemini API key nahi hai. Settings mein daalo.' }, { status: 400 })

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: 'image/jpeg', data: image } },
              { text: (systemPrompt ? systemPrompt + '\n\n' : '') + question },
            ]
          }],
          generationConfig: { maxOutputTokens: 1000, temperature: 0.4 },
        }),
        signal: AbortSignal.timeout(25000),
      }
    )
    const d = await res.json()
    const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (!text) return NextResponse.json({ error: 'Gemini ne response nahi diya' }, { status: 500 })
    return NextResponse.json({ result: text })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Vision failed' }, { status: 500 })
  }
}
