/* app/api/stream/route.ts — JARVIS AI Stream v3
 * Fixes:
 * 1. systemPrompt client se receive karta hai (memory + personality included)
 * 2. stream:false mode support — agent executor ke liye
 * 3. Tool dispatch improved
 */
import { NextRequest } from 'next/server'
import { smartRouter } from '@/lib/core/smartRouter'
import { getTokenBudget, trimHistory } from '@/lib/core/tokenBudget'
import { detectIntent, autoRouteMode } from '@/lib/tools/intent'
import { classifyQuery } from '@/lib/core/resourceManager'
import { runIntegration } from '@/lib/integrations/mega'

export const runtime = 'edge'
export const maxDuration = 30

const FALLBACK_SYSTEM = `You are JARVIS — "Jons Bhai" — Tony Stark ka AI. Hinglish mein baat karo. Concise, witty, helpful. Never say "As an AI". Memory aur personality sab include hai.`

function createSSE(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { messages = [], mode = 'auto', sessionId, systemPrompt, noStream } = body

  const lastUserMsg = messages.filter((m: any) => m.role === 'user').pop()?.content || ''
  const sysPrompt = systemPrompt || FALLBACK_SYSTEM

  // ── Non-streaming mode (for agent executor) ─────────────
  if (noStream) {
    try {
      const budget = getTokenBudget(lastUserMsg)
      const trimmed = trimHistory(messages, budget.historyMsgs)
      const fullMessages = [{ role: 'system', content: sysPrompt }, ...trimmed]
      const result = await smartRouter(fullMessages as any, mode as any, budget.maxTokens)
      return new Response(JSON.stringify({ content: result.text, provider: result.provider }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err) {
      return new Response(JSON.stringify({ content: 'Error: ' + err, provider: 'error' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      })
    }
  }

  // ── Streaming mode (for chat UI) ────────────────────────
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(createSSE(data)))
      }

      try {
        const intent = detectIntent(lastUserMsg)
        const effectiveMode = mode === 'auto' ? autoRouteMode(lastUserMsg) : mode

        send({ type: 'mode', mode: effectiveMode })

        const qType = classifyQuery(lastUserMsg)

        // Tool dispatch
        if ((effectiveMode === 'deep' || qType === 'api_tool') && intent.categories.length > 0) {
          for (const cat of intent.categories.slice(0, 3)) {
            if (cat === 'chat') continue
            send({ type: 'tool_start', tool: cat })
            try {
              const result = await runIntegration(cat, intent.extractedArgs)
              if (result.success && result.text) {
                send({ type: 'tool_result', tool: cat, text: result.text, card: result.card })
              }
            } catch {}
          }
        }

        const budget = getTokenBudget(lastUserMsg)
        const trimmed = trimHistory(messages, budget.historyMsgs)
        const fullMessages = [{ role: 'system', content: sysPrompt }, ...trimmed]

        send({ type: 'thinking', text: '...' })

        const result = await smartRouter(fullMessages as any, effectiveMode as any, budget.maxTokens)

        // Stream in word chunks
        const words = result.text.split(' ')
        let buffer = ''
        for (let i = 0; i < words.length; i++) {
          buffer += (i > 0 ? ' ' : '') + words[i]
          if (i % 6 === 5 || i === words.length - 1) {
            send({ type: 'delta', text: buffer })
            buffer = ''
            await new Promise(r => setTimeout(r, 8))
          }
        }

        send({ type: 'done', provider: result.provider, model: result.model })
      } catch (err) {
        send({ type: 'error', text: `Ek second... retry karo! 🔄` })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
