/* app/api/jarvis/route.ts — Non-streaming fallback (for fetch without SSE support) */
import { NextRequest, NextResponse } from 'next/server';
import { smartRouter } from '@/lib/core/smartRouter';
import { getTokenBudget, trimHistory } from '@/lib/core/tokenBudget';
import { detectIntent } from '@/lib/tools/intent';
import { runIntegration } from '@/lib/integrations/mega';

export const runtime = 'edge';
export const maxDuration = 30;

const SYSTEM_PROMPT = `You are JARVIS — Iron Man's AI. You speak Hinglish. Be helpful, smart, and concise.`;

export async function POST(req: NextRequest) {
  try {
    const { messages = [], mode = 'auto' } = await req.json();
    const lastMsg = messages.filter((m: any) => m.role === 'user').pop()?.content || '';

    // Detect intent and run tools if needed
    const intent = detectIntent(lastMsg);
    const toolResults: string[] = [];
    const cards: any[] = [];

    if (intent.categories[0] !== 'chat' && intent.categories.length > 0) {
      for (const cat of intent.categories.slice(0, 3)) {
        if (cat === 'chat') continue;
        try {
          const result = await runIntegration(cat, intent.extractedArgs);
          if (result.success && result.text) toolResults.push(result.text);
          if (result.card) cards.push(result.card);
        } catch {}
      }
    }

    // Build context
    const budget = getTokenBudget(lastMsg);
    const trimmed = trimHistory(messages, budget.historyMsgs);
    const contextContent = toolResults.length > 0
      ? `Tool results:\n${toolResults.join('\n\n')}\n\nUser: ${lastMsg}`
      : lastMsg;

    const fullMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...trimmed.slice(0, -1),
      { role: 'user', content: contextContent },
    ];

    const result = await smartRouter(fullMessages as any, mode as any, budget.maxTokens);

    return NextResponse.json({
      success: true,
      text: result.text,
      provider: result.provider,
      model: result.model,
      cards,
    });

  } catch (err) {
    return NextResponse.json({
      success: false,
      text: 'Network issue. Dobara try karo! 🔄',
      error: String(err),
    }, { status: 200 }); // 200 so client doesn't crash
  }
}
