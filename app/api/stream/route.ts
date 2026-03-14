/* app/api/stream/route.ts — JARVIS AI Stream v4
 * 
 * KEY FIXES:
 * 1. Client-side API keys support via x-jarvis-keys header
 *    → Settings mein save kiye keys ab actually kaam karte hain
 * 2. systemPrompt from client (memory + personality)
 * 3. noStream mode for agent executor
 */
import { NextRequest } from 'next/server'
import { smartRouter } from '@/lib/core/smartRouter'
import { getTokenBudget, trimHistory } from '@/lib/core/tokenBudget'
import { detectIntent, autoRouteMode } from '@/lib/tools/intent'
import { classifyQuery } from '@/lib/core/resourceManager'
import { runIntegration } from '@/lib/integrations/mega'

export const runtime = 'edge'
export const maxDuration = 30

const FALLBACK_SYSTEM = `You are JARVIS — "Jons Bhai". Hinglish mein baat karo. Concise, witty. Never "As an AI".`

function createSSE(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

// Merge client keys with process.env (client keys take priority)
function getEffectiveEnv(clientKeys: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {}
  const keyNames = [
    'GROQ_API_KEY', 'GEMINI_API_KEY', 'CEREBRAS_API_KEY', 'TOGETHER_API_KEY',
    'MISTRAL_API_KEY', 'COHERE_API_KEY', 'FIREWORKS_API_KEY', 'OPENROUTER_API_KEY',
    'DEEPINFRA_API_KEY', 'HUGGINGFACE_API_KEY',
  ]
  for (const k of keyNames) {
    const val = clientKeys[k] || (process.env as any)[k] || ''
    if (val) env[k] = val
  }
  return env
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { messages = [], mode = 'auto', systemPrompt, noStream, clientKeys } = body

  const lastUserMsg = messages.filter((m: any) => m.role === 'user').pop()?.content || ''
  const sysPrompt = systemPrompt || FALLBACK_SYSTEM

  // Merge keys: client-saved > Vercel env
  const effectiveKeys = getEffectiveEnv(clientKeys || {})

  // ── Non-streaming (agent executor) ───────────────────────
  if (noStream) {
    try {
      const budget = getTokenBudget(lastUserMsg)
      const trimmed = trimHistory(messages, budget.historyMsgs)
      const fullMsgs = [{ role: 'system', content: sysPrompt }, ...trimmed]
      const result = await smartRouter(fullMsgs as any, mode as any, budget.maxTokens, effectiveKeys)
      return new Response(JSON.stringify({ content: result.text, provider: result.provider }), {
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (err) {
      return new Response(JSON.stringify({ content: 'Error: ' + err, provider: 'error' }), {
        headers: { 'Content-Type': 'application/json' }, status: 500,
      })
    }
  }

  // ── Streaming mode ────────────────────────────────────────
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(encoder.encode(createSSE(data)))

      try {
        const intent = detectIntent(lastUserMsg)
        const effectiveMode = mode === 'auto' ? autoRouteMode(lastUserMsg) : mode
        send({ type: 'mode', mode: effectiveMode })

        const qType = classifyQuery(lastUserMsg)
        // Agentic tool execution — results fed BACK to AI as context
        const toolContext: string[] = []
        if (intent.categories.length > 0) {
          for (const cat of intent.categories.slice(0, 3)) {
            if (cat === 'chat') continue
            send({ type: 'tool_start', tool: cat })
            try {
              const result = await runIntegration(cat, intent.extractedArgs)
              if (result.success && result.text) {
                send({ type: 'tool_result', tool: cat, text: result.text, card: result.card })
                toolContext.push('[TOOL: ' + cat + ']\n' + result.text.slice(0, 400))
              }
            } catch {}
          }
        }

        const budget = getTokenBudget(lastUserMsg)
        const trimmed = trimHistory(messages, budget.historyMsgs)
        // Inject tool results into system prompt so AI can reason about them
        const enrichedSystem = toolContext.length > 0
          ? sysPrompt + '\n\nREAL-TIME DATA (abhi fetch hua):\n' + toolContext.join('\n\n')
          : sysPrompt
        const fullMsgs = [{ role: 'system', content: enrichedSystem }, ...trimmed]

        send({ type: 'thinking', text: '...' })
        const result = await smartRouter(fullMsgs as any, effectiveMode as any, budget.maxTokens, effectiveKeys)

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
        send({ type: 'error', text: `Retry karo! 🔄` })
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
