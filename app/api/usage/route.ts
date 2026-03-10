/* app/api/usage/route.ts — API usage stats for system dashboard */
import { NextResponse } from 'next/server';
import { getUsageStats, cacheStats } from '@/lib/core/resourceManager';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({
    usage: getUsageStats(),
    cache: cacheStats(),
    timestamp: Date.now(),
  });
}
