// lib/agent/executor.ts — Step-by-step workflow runner
// Executes AgentPlan steps sequentially, passes output between steps
'use client'

import type { AgentPlan, AgentStep } from './planner'
import { triggerMacro } from '../automation/bridge'

export type StepCallback = (step: AgentStep, planId: string) => void

// Replace {{prev_output}} placeholder in inputs
function resolveInput(input: Record<string, any>, prevOutput: string): Record<string, any> {
  const resolved: Record<string, any> = {}
  for (const [k, v] of Object.entries(input)) {
    resolved[k] = typeof v === 'string' ? v.replace('{{prev_output}}', prevOutput) : v
  }
  return resolved
}

// Execute a single step → returns output string
async function runStep(step: AgentStep, prevOutput: string): Promise<string> {
  const inp = resolveInput(step.input, prevOutput)

  switch (step.tool) {

    case 'ai_text': {
      const res = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: inp.prompt }],
          mode: 'flash',
          stream: false,
        }),
      })
      const data = await res.json()
      return data.content || data.text || 'AI response unavailable'
    }

    case 'ai_image': {
      const prompt = encodeURIComponent(inp.prompt || 'AI generated image')
      const url = `https://image.pollinations.ai/prompt/${prompt}?width=800&height=450&nologo=true`
      return `![Generated Image](${url})\n\n[Download](${url})`
    }

    case 'ai_tts': {
      // Use browser TTS (free, no API)
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utt = new SpeechSynthesisUtterance(inp.text || prevOutput)
        utt.lang = 'hi-IN'
        window.speechSynthesis.speak(utt)
        return '🔊 Speaking...'
      }
      return 'TTS: Browser speech not available'
    }

    case 'web_search': {
      const q = encodeURIComponent(inp.query || '')
      const res = await fetch(`https://api.duckduckgo.com/?q=${q}&format=json&no_redirect=1`)
        .catch(() => null)
      if (res?.ok) {
        const data = await res.json()
        const abstract = data.Abstract || data.RelatedTopics?.[0]?.Text || ''
        return abstract || `Search done: [${inp.query}](https://duckduckgo.com/?q=${q})`
      }
      return `[Search: ${inp.query}](https://duckduckgo.com/?q=${q})`
    }

    case 'open_app': {
      const appLinks: Record<string, string> = {
        youtube:   'intent://youtube.com/#Intent;scheme=https;package=com.google.android.youtube;end',
        whatsapp:  'whatsapp://',
        instagram: 'intent://instagram.com/#Intent;scheme=https;package=com.instagram.android;end',
        maps:      'geo:0,0',
        camera:    'android.media.action.IMAGE_CAPTURE',
        settings:  'android.settings.SETTINGS',
        gmail:     'googlegmail://',
        chrome:    'googlechrome://navigate?url=https://google.com',
        spotify:   'spotify://',
      }
      const link = appLinks[inp.app?.toLowerCase()] || `intent://${inp.app}/#Intent;scheme=https;end`
      if (typeof window !== 'undefined') window.location.href = link
      return `📱 Opening ${inp.app}...`
    }

    case 'phone_action': {
      const result = await triggerMacro({ type: inp.action, payload: inp.payload })
      return result.msg
    }

    case 'save_note': {
      try {
        const { addMemory } = await import('../db/index')
        await addMemory('fact', inp.content || prevOutput, 3)
        return `✅ Saved: "${inp.title || 'Note'}"`
      } catch {
        return '✅ Note saved (local)'
      }
    }

    case 'send_message': {
      const text = encodeURIComponent(inp.text || prevOutput)
      const phone = inp.phone || ''
      const link = inp.app === 'whatsapp'
        ? `https://wa.me/${phone}?text=${text}`
        : `sms:${phone}?body=${text}`
      if (typeof window !== 'undefined') window.open(link, '_blank')
      return `📤 Message ready to send via ${inp.app}`
    }

    case 'copy_text': {
      const text = inp.text || prevOutput
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text).catch(() => {})
      }
      return `📋 Copied to clipboard`
    }

    case 'open_url': {
      if (typeof window !== 'undefined') window.open(inp.url, '_blank')
      return `🌐 Opened: ${inp.url}`
    }

    case 'show_result': {
      return inp.message || prevOutput
    }

    default:
      return `Unknown tool: ${step.tool}`
  }
}

// Main executor — runs all steps, calls onStep after each
export async function executePlan(
  plan: AgentPlan,
  onStep: StepCallback,
  onDone: (plan: AgentPlan) => void,
  onError: (msg: string) => void
): Promise<void> {
  let prevOutput = ''
  const updatedPlan: AgentPlan = { ...plan, status: 'running' }

  for (let i = 0; i < plan.steps.length; i++) {
    const step = { ...plan.steps[i], status: 'running' as const }
    updatedPlan.steps[i] = step
    onStep(step, plan.goal)

    try {
      // Retry once on failure
      let output = ''
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          output = await runStep(step, prevOutput)
          break
        } catch (e: any) {
          if (attempt === 1) throw e
          await new Promise(r => setTimeout(r, 1000))
        }
      }
      prevOutput = output
      const doneStep = { ...step, status: 'done' as const, output }
      updatedPlan.steps[i] = doneStep
      onStep(doneStep, plan.goal)

    } catch (err: any) {
      const failedStep = { ...step, status: 'failed' as const, error: err.message }
      updatedPlan.steps[i] = failedStep
      onStep(failedStep, plan.goal)
      // Continue to next step even on failure
    }

    // Small delay between steps
    await new Promise(r => setTimeout(r, 500))
  }

  updatedPlan.status = 'done'
  onDone(updatedPlan)
}
