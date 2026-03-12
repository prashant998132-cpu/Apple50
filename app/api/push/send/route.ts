import { NextResponse } from 'next/server'
export const runtime = 'edge'
const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC || ''
export async function GET() { return NextResponse.json({ vapidPublic: PUB }) }
export async function POST() { return NextResponse.json({ ok: true, fallback: true }) }
