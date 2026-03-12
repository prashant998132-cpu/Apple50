/* app/api/jarvis/deep-stream/route.ts — Deep mode: tools + 16 rich cards + appCommand */
import { NextRequest } from 'next/server';
import { smartRouter } from '@/lib/core/smartRouter';
import { detectIntent } from '@/lib/tools/intent';
import { dispatchTool } from '@/lib/tools/connected';

export const runtime = 'edge';
export const maxDuration = 30;

function createSSE(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

const SYSTEM_PROMPT = `You are JARVIS — Iron Man's AI. You speak Hinglish. You have access to real-time tools and just used some of them. Based on the tool results provided, give a comprehensive, helpful response.

Format nicely with markdown. Be smart and synthesize the tool data into a useful response. If multiple tool results are available, combine them intelligently.`;

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const body = await req.json().catch(() => ({}));
  const { messages = [], intent: intentHint, systemPrompt } = body;
  const lastUserMsg = messages.filter((m: any) => m.role === 'user').pop()?.content || '';
  const DEEP_SYSTEM = systemPrompt || SYSTEM_PROMPT;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(createSSE(data)));
      };

      try {
        const intent = detectIntent(lastUserMsg);
        const toolResults: string[] = [];
        const cards: any[] = [];

        // Run tools
        for (const cat of intent.categories.slice(0, 5)) {
          if (cat === 'chat') continue;
          send({ type: 'tool_start', tool: cat });
          try {
            const result = await dispatchTool(cat, intent.extractedArgs);
            if (result.success) {
              if (result.text) toolResults.push(`[${cat.toUpperCase()} DATA]:\n${result.text}`);
              if (result.card) cards.push(result.card);
              send({ type: 'card', card: result.card, tool: cat });
            }
          } catch {}
        }

        // Build messages with tool context
        const contextMsg = toolResults.length > 0
          ? `Tool results:\n${toolResults.join('\n\n')}\n\nUser asked: "${lastUserMsg}"\n\nNow give a comprehensive response using these results.`
          : lastUserMsg;

        const fullMessages = [
          { role: 'system', content: DEEP_SYSTEM },
          ...messages.slice(-6).filter((m: any) => m.role !== 'system'),
          { role: 'user', content: contextMsg },
        ];

        const result = await smartRouter(fullMessages as any, 'think', 1000);

        // Stream response
        const words = result.text.split(' ');
        let buffer = '';
        for (let i = 0; i < words.length; i++) {
          buffer += (i > 0 ? ' ' : '') + words[i];
          if (i % 5 === 4 || i === words.length - 1) {
            send({ type: 'delta', text: buffer });
            buffer = '';
            await new Promise(r => setTimeout(r, 12));
          }
        }

        // Check for app commands in response
        const appCmds = extractAppCommands(result.text);
        for (const cmd of appCmds) {
          send({ type: 'appCommand', command: cmd });
        }

        send({ type: 'done', provider: result.provider, model: result.model, cards });
      } catch (err) {
        send({ type: 'error', text: `Deep mode mein issue aa gaya. Try karo! Error: ${err}` });
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

function extractAppCommands(text: string): string[] {
  const cmds: string[] = [];
  const matches = text.matchAll(/\[APP_CMD:([\w/:]+)\]/g);
  for (const m of matches) cmds.push(m[1]);
  return cmds;
}
