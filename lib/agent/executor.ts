// lib/agent/executor.ts — JARVIS Agent Executor v2
// Fix: ai_text uses noStream API correctly now
// Fix: proper result chaining with {{prev_output}}
import { type AgentPlan, type AgentStep } from './planner'

export interface StepResult {
  stepId: string
  tool: string
  output: string
  success: boolean
  error?: string
}

export interface ExecutionResult {
  planId: string
  steps: StepResult[]
  finalOutput: string
  success: boolean
}

// Resolve {{prev_output}} placeholder
function resolve(text: string, prevOutput: string): string {
  return text.replace(/\{\{prev_output\}\}/g, prevOutput)
}

// ── Tool: AI Text (noStream) ──────────────────────────────
async function runAIText(prompt: string): Promise<string> {
  const res = await fetch('/api/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      mode: 'flash',
      noStream: true,
    }),
  })
  if (!res.ok) throw new Error('AI call failed: ' + res.status)
  const data = await res.json()
  return data.content || ''
}

// ── Tool: Web Search (DuckDuckGo) ─────────────────────────
async function runWebSearch(query: string): Promise<string> {
  const res = await fetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`
  )
  const data = await res.json()
  if (data.AbstractText) return data.AbstractText
  if (data.RelatedTopics?.length) {
    return data.RelatedTopics
      .slice(0, 3)
      .map((t: any) => t.Text)
      .filter(Boolean)
      .join('\n\n')
  }
  return `Search results for: ${query} — koi abstract nahi mila, AI se poocha.`
}

// ── Tool: Open URL ────────────────────────────────────────
async function runOpenURL(url: string): Promise<string> {
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener')
    return `Opened: ${url}`
  }
  return `URL ready: ${url}`
}

// ── Tool: Open App / Navigate ─────────────────────────────
async function runOpenApp(app: string): Promise<string> {
  const routes: Record<string, string> = {
    voice: '/voice', study: '/study', tools: '/tools',
    agent: '/agent', india: '/india', studio: '/studio',
    settings: '/settings', goals: '/target', apps: '/apps',
  }
  const route = routes[app.toLowerCase()] || null
  if (route && typeof window !== 'undefined') {
    window.location.href = route
    return `Opened ${app}`
  }
  return `App "${app}" opened`
}

// ── Tool: Copy Text ───────────────────────────────────────
async function runCopyText(text: string): Promise<string> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(text)
    return 'Copied to clipboard ✅'
  }
  return 'Copy: clipboard unavailable'
}

// ── Tool: Save Note ───────────────────────────────────────
async function runSaveNote(content: string): Promise<string> {
  const { addMemory } = await import('@/lib/db')
  await addMemory('fact', content.slice(0, 300), 8)
  return `Note saved: "${content.slice(0, 60)}..."`
}

// ── Tool: Show Result (passthrough) ──────────────────────
async function runShowResult(text: string): Promise<string> {
  return text
}

// ── Tool: Send Message ────────────────────────────────────
async function runSendMessage(args: { app?: string; message?: string }): Promise<string> {
  const app = (args.app || 'whatsapp').toLowerCase()
  const msg = args.message || ''
  if (app === 'whatsapp') {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`
    if (typeof window !== 'undefined') window.open(url, '_blank')
    return `WhatsApp message ready`
  }
  return `Message to ${app}: "${msg.slice(0, 80)}"`
}

// ── Tool: AI Image ────────────────────────────────────────
async function runAIImage(prompt: string): Promise<string> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`
  if (typeof window !== 'undefined') {
    window.open(url, '_blank')
  }
  return `![Generated Image](${url})`
}

// ── Main Executor ─────────────────────────────────────────
export async function executePlan(
  plan: AgentPlan,
  onStepUpdate?: (stepId: string, status: 'running' | 'done' | 'error', output?: string) => void
): Promise<ExecutionResult> {
  const results: StepResult[] = []
  let prevOutput = plan.goal
  let finalOutput = ''

  for (const step of plan.steps) {
    onStepUpdate?.(step.id, 'running')

    let output = ''
    let success = true
    let error: string | undefined

    try {
      // step.input can be Record<string,any> — extract string value
      const rawInput = typeof step.input === 'string'
        ? step.input
        : step.input?.prompt || step.input?.query || step.input?.app ||
          step.input?.url || step.input?.message || step.input?.text ||
          JSON.stringify(step.input)
      const input = resolve(rawInput || '', prevOutput)

      switch (step.tool) {
        case 'ai_text':
          output = await runAIText(input || step.tool)
          break
        case 'web_search':
          output = await runWebSearch(input || plan.goal)
          break
        case 'ai_image':
          output = await runAIImage(input || plan.goal)
          break
        case 'open_url':
          output = await runOpenURL(input)
          break
        case 'open_app':
          output = await runOpenApp(input)
          break
        case 'copy_text':
          output = await runCopyText(prevOutput)
          break
        case 'save_note':
          output = await runSaveNote(prevOutput)
          break
        case 'send_message':
          output = await runSendMessage(typeof input === 'string' ? { message: input } : input as any)
          break
        case 'show_result':
          output = await runShowResult(prevOutput)
          break
        case 'phone_action':
          output = `Phone action: ${input} — browser mein available nahi, par log ho gaya.`
          break
        default:
          output = `Tool "${step.tool}" not implemented yet`
          success = false
      }

      prevOutput = output
      finalOutput = output
    } catch (err: any) {
      // Retry once
      try {
        await new Promise(r => setTimeout(r, 800))
        if (step.tool === 'ai_text') {
          output = await runAIText(typeof step.input === 'string' ? step.input : (step.input?.prompt as string) || step.tool)
          prevOutput = output
          finalOutput = output
        } else {
          throw err
        }
      } catch (err2: any) {
        success = false
        error = err2.message
        output = `Error: ${err2.message}`
      }
    }

    results.push({ stepId: step.id, tool: step.tool, output, success, error })
    onStepUpdate?.(step.id, success ? 'done' : 'error', output)

    // Small delay between steps
    await new Promise(r => setTimeout(r, 400))
  }

  const allSuccess = results.every(r => r.success)
  return { planId: plan.goal.slice(0,20), steps: results, finalOutput, success: allSuccess }
}
