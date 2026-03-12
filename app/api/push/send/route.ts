import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
export async function GET() {
  return NextResponse.json({ vapidPublic: VAPID_PUBLIC })
}
export async function POST(req: NextRequest) {
  try {
    const { title, body, subscription } = await req.json()
    if (!subscription || !process.env.VAPID_PRIVATE) {
      return NextResponse.json({ ok: true, fallback: true })
    }
    const webpush = await import('web-push').catch(() => null)
    if (!webpush) return NextResponse.json({ ok: true, fallback: true })
    webpush.setVapidDetails('mailto:jarvis@ai.com', VAPID_PUBLIC, process.env.VAPID_PRIVATE)
    await webpush.sendNotification(subscription, JSON.stringify({ title, body }))
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
