/* app/api/stream/route.ts — Flash + Think SSE streaming with ResourceManager */
import { NextRequest } from 'next/server';
import { smartRouter } from '@/lib/core/smartRouter';
import { getTokenBudget, trimHistory } from '@/lib/core/tokenBudget';
import { detectIntent, autoRouteMode } from '@/lib/tools/intent';
import { classifyQuery } from '@/lib/core/resourceManager';
import { runIntegration } from '@/lib/integrations/mega';

export const runtime = 'edge';
export const maxDuration = 30;

const SYSTEM_PROMPT = `You are JARVIS — a ultra-smart personal AI assistant made by Prashant. You speak in Hinglish (Hindi + English mix) naturally. You are like Iron Man's JARVIS — intelligent, witty, helpful, and slightly sarcastic when appropriate.

PERSONALITY:
- Speak naturally in Hinglish (mix Hindi and English)
- Be concise but helpful. Don't pad responses unnecessarily.
- Use emojis naturally, not excessively
- When solving NEET/JEE problems, be thorough and step-by-step
- Never break character — you ARE JARVIS

RESPONSE FORMAT:
- Use markdown for structure (bold, lists, code blocks)
- Keep responses focused and useful
- For calculations: show steps clearly
- For code: always use code blocks with language tags

Remember: You're talking to Prashant — a NEET student from Maihar, MP.`;

function createSSE(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const body = await req.json().catch(() => ({}));

  const { messages = [], mode = 'auto', sessionId } = body;
  const lastUserMsg = messages.filter((m: any) => m.role === 'user').pop()?.content || '';

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(createSSE(data)));
      };

      try {
        // Detect intent for tool use
        const intent = detectIntent(lastUserMsg);
        const effectiveMode = mode === 'auto' ? autoRouteMode(lastUserMsg) : mode;

        send({ type: 'mode', mode: effectiveMode });

        // Tool dispatch if deep mode or tool intent detected
        // Classify: local / api_tool / ai_reason / ai_simple
        const qType = classifyQuery(lastUserMsg);
        send({ type: 'query_type', qType });

        if ((effectiveMode === 'deep' || qType === 'api_tool') && intent.categories.length > 0) {
          for (const cat of intent.categories.slice(0, 3)) {
            if (cat === 'chat') continue;
            send({ type: 'tool_start', tool: cat });
            try {
              const result = await runIntegration(cat, intent.extractedArgs);
              if (result.success && result.text) {
                send({ type: 'tool_result', tool: cat, text: result.text, card: result.card });
              }
            } catch {}
          }
        }

        // Get token budget
        const budget = getTokenBudget(lastUserMsg);
        const trimmed = trimHistory(messages, budget.historyMsgs);

        // Add system prompt
        const fullMessages = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...trimmed,
        ];

        // Route to provider
        send({ type: 'thinking', text: '...' });

        const result = await smartRouter(fullMessages as any, effectiveMode as any, budget.maxTokens);

        // Stream response in chunks
        const words = result.text.split(' ');
        let buffer = '';
        for (let i = 0; i < words.length; i++) {
          buffer += (i > 0 ? ' ' : '') + words[i];
          if (i % 5 === 4 || i === words.length - 1) {
            send({ type: 'delta', text: buffer });
            buffer = '';
            await new Promise(r => setTimeout(r, 10));
          }
        }

        send({ type: 'done', provider: result.provider, model: result.model });
      } catch (err) {
        send({ type: 'error', text: `Ek second... thoda issue aa gaya. Dobara try karo! 🔄\n\nError: ${err}` });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
