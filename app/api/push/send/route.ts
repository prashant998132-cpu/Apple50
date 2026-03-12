import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC || 
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'

export async function GET() {
  return NextResponse.json({ vapidPublic: VAPID_PUBLIC })
}

export async function POST(req: NextRequest) {
  // web-push not installed → client-side local notification fallback
  return NextResponse.json({ ok: true, fallback: true, message: 'Use client-side notifications' })
}
