// lib/agent/jarvisAgent.ts — JARVIS Autonomous Agent v2
// ReAct pattern: Reason → Act → Observe → Repeat
'use client'

export interface AgentTool {
  name: string
  description: string
  execute: (input: string) => Promise<string>
}

export interface AgentStep {
  thought: string
  action: string
  tool: string
  input: string
  result: string
  status: 'running' | 'done' | 'error'
}

export interface AgentRun {
  goal: string
  steps: AgentStep[]
  finalAnswer: string
  status: 'planning' | 'running' | 'done' | 'error'
}

// ── Tool Definitions ─────────────────────────────────────────────────
export const AGENT_TOOLS: AgentTool[] = [
  {
    name: 'weather',
    description: 'Get weather for any city. Input: city name',
    execute: async (city: string) => {
      try {
        const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`).then(r => r.json())
        const loc = geo.results?.[0]
        if (!loc) return `${city} ka weather nahi mila`
        const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia/Kolkata`).then(r => r.json())
        const c = w.current
        const codes: Record<number,string> = {0:'Clear',1:'Clear',2:'Cloudy',3:'Overcast',45:'Foggy',61:'Rainy',80:'Showers',95:'Thunderstorm'}
        return `${city}: ${c.temperature_2m}°C, ${codes[c.weather_code] || 'Unknown'}, Humidity: ${c.relative_humidity_2m}%`
      } catch { return 'Weather fetch failed' }
    }
  },
  {
    name: 'web_search',
    description: 'Search the web for current information. Input: search query',
    execute: async (query: string) => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const d = await r.json()
        return d.results?.slice(0,3).map((r: any) => `${r.title}: ${(r.text || '').slice(0,150)}`).join('\n') || 'No results'
      } catch { return 'Search failed' }
    }
  },
  {
    name: 'set_reminder',
    description: 'Set a reminder. Input: "message|HH:MM" format',
    execute: async (input: string) => {
      try {
        const [msg, time] = input.split('|')
        const d = new Date()
        const [h, m] = (time || '09:00').split(':').map(Number)
        d.setHours(h, m, 0, 0)
        if (d < new Date()) d.setDate(d.getDate() + 1)
        const { addReminder } = await import('@/lib/reminders')
        addReminder(msg.trim(), d.getTime())
        return `Reminder set: "${msg.trim()}" at ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
      } catch { return 'Reminder set nahi hua' }
    }
  },
  {
    name: 'save_note',
    description: 'Save a note or information. Input: note text',
    execute: async (text: string) => {
      try {
        const { setSetting, getSetting } = await import('@/lib/db')
        const notes = await getSetting('jarvis_quick_notes').catch(() => []) as any[]
        const updated = [{ id: Date.now(), text: text.trim(), ts: Date.now() }, ...(Array.isArray(notes) ? notes : [])].slice(0, 50)
        await setSetting('jarvis_quick_notes', updated)
        return `Note saved: "${text.slice(0, 60)}"`
      } catch { return 'Note save nahi hua' }
    }
  },
  {
    name: 'add_goal',
    description: 'Add a new goal/target. Input: goal title',
    execute: async (title: string) => {
      try {
        const { addGoal } = await import('@/lib/db')
        await addGoal({ title: title.trim(), completed: false, priority: 'medium', progress: 0, timestamp: Date.now() })
        return `Goal added: "${title.trim()}"`
      } catch { return 'Goal add nahi hua' }
    }
  },
  {
    name: 'get_goals',
    description: 'Get all current goals. Input: none',
    execute: async () => {
      try {
        const { getAllGoals } = await import('@/lib/db')
        const goals = await getAllGoals()
        const active = goals.filter((g: any) => !g.completed)
        return `Active goals (${active.length}): ${active.map((g: any) => g.title).join(', ') || 'None'}`
      } catch { return 'Goals load nahi hue' }
    }
  },
  {
    name: 'currency',
    description: 'Convert currency. Input: "100 USD INR" format',
    execute: async (input: string) => {
      try {
        const parts = input.trim().split(' ')
        const amount = parseFloat(parts[0]) || 1
        const from = (parts[1] || 'USD').toUpperCase()
        const to = (parts[2] || 'INR').toUpperCase()
        const d = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`).then(r => r.json())
        const rate = d.rates?.[to]
        return rate ? `${amount} ${from} = ${(amount * rate).toFixed(2)} ${to}` : 'Rate not found'
      } catch { return 'Currency convert nahi hua' }
    }
  },
  {
    name: 'crypto_price',
    description: 'Get crypto price. Input: coin name (bitcoin, ethereum, etc)',
    execute: async (coin: string) => {
      try {
        const d = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.toLowerCase()}&vs_currencies=inr,usd`).then(r => r.json())
        const data = d[coin.toLowerCase()]
        return data ? `${coin}: ₹${data.inr?.toLocaleString('en-IN')} | $${data.usd?.toLocaleString()}` : 'Coin not found'
      } catch { return 'Price not found' }
    }
  },
  {
    name: 'generate_image',
    description: 'Generate an AI image. Input: image description',
    execute: async (prompt: string) => {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ', high quality')}`
      return `Image URL: ${url}`
    }
  },
  {
    name: 'open_app',
    description: 'Open a phone app. Input: app name (whatsapp, youtube, maps, etc)',
    execute: async (app: string) => {
      const schemes: Record<string, string> = {
        whatsapp: 'whatsapp://', youtube: 'vnd.youtube:', maps: 'geo:0,0',
        instagram: 'instagram://', spotify: 'spotify://', telegram: 'tg://',
        zomato: 'zomato://', uber: 'uber://', ola: 'olacabs://',
      }
      const url = schemes[app.toLowerCase()]
      if (url && typeof window !== 'undefined') window.location.href = url
      return url ? `${app} khol raha hoon...` : `${app} ka URL nahi pata`
    }
  },
  {
    name: 'get_news',
    description: 'Get latest news. Input: topic (optional)',
    execute: async (topic: string) => {
      try {
        const ids = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json').then(r => r.json())
        const stories = await Promise.all(ids.slice(0,4).map((id: number) =>
          fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
        ))
        const filtered = topic ? stories.filter((s: any) => s.title?.toLowerCase().includes(topic.toLowerCase())) : stories
        return (filtered.length ? filtered : stories).map((s: any) => s.title).join('\n')
      } catch { return 'News fetch failed' }
    }
  },
  {
    name: 'calculate',
    description: 'Calculate math. Input: math expression',
    execute: async (expr: string) => {
      try {
        const safe = expr.replace(/[^0-9+\-*/.()%\s^]/g, '')
        const result = Function('"use strict"; return (' + safe + ')')()
        return `${expr} = ${result}`
      } catch { return 'Calculation failed' }
    }
  },
  {
    name: 'write_content',
    description: 'Write any content (email, message, essay, plan). Input: what to write',
    execute: async (prompt: string) => {
      try {
        const res = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'openai', messages: [{ role: 'user', content: `Write this concisely in Hinglish: ${prompt}` }] })
        })
        const d = await res.json()
        return d.choices?.[0]?.message?.content || 'Content write nahi hua'
      } catch { return 'Write failed' }
    }
  },
]

// ── ReAct Agent Runner ────────────────────────────────────────────────
export async function runAgent(
  goal: string,
  onStep: (step: AgentStep, stepIndex: number) => void,
  onDone: (answer: string) => void,
  onError: (msg: string) => void,
  maxSteps = 6
): Promise<void> {
  const toolNames = AGENT_TOOLS.map(t => `${t.name}: ${t.description}`).join('\n')
  const steps: AgentStep[] = []

  for (let i = 0; i < maxSteps; i++) {
    // Build context from previous steps
    const context = steps.map((s, idx) =>
      `Step ${idx + 1}:\nThought: ${s.thought}\nAction: ${s.tool}("${s.input}")\nResult: ${s.result}`
    ).join('\n\n')

    const prompt = `You are JARVIS, an autonomous AI agent. Complete the goal step by step.

GOAL: ${goal}

AVAILABLE TOOLS:
${toolNames}

${context ? `PREVIOUS STEPS:\n${context}\n\n` : ''}

Respond in this EXACT format (no other text):
THOUGHT: [what you think needs to be done next, or "Goal complete" if done]
ACTION: [tool_name or "FINAL_ANSWER"]
INPUT: [input for the tool, or final answer text]`

    try {
      const res = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai',
          messages: [{ role: 'user', content: prompt }],
          seed: Date.now(),
        }),
        signal: AbortSignal.timeout(20000),
      })

      const d = await res.json()
      const text = d.choices?.[0]?.message?.content || ''

      const thoughtMatch = text.match(/THOUGHT:\s*(.+?)(?:\n|$)/i)
      const actionMatch = text.match(/ACTION:\s*(\w+)/i)
      const inputMatch = text.match(/INPUT:\s*([\s\S]+)/i)

      const thought = thoughtMatch?.[1]?.trim() || 'Thinking...'
      const action = actionMatch?.[1]?.trim() || 'FINAL_ANSWER'
      const input = inputMatch?.[1]?.trim() || goal

      // Final answer
      if (action === 'FINAL_ANSWER' || thought.toLowerCase().includes('goal complete') || thought.toLowerCase().includes('done')) {
        onDone(input)
        return
      }

      // Find and execute tool
      const tool = AGENT_TOOLS.find(t => t.name.toLowerCase() === action.toLowerCase())
      const step: AgentStep = {
        thought,
        action: `${action}("${input.slice(0, 50)}")`,
        tool: action,
        input,
        result: '',
        status: 'running',
      }

      steps.push(step)
      onStep({ ...step }, i)

      if (!tool) {
        step.result = `Tool "${action}" nahi mila`
        step.status = 'error'
        onStep({ ...step }, i)
        continue
      }

      const result = await tool.execute(input)
      step.result = result
      step.status = 'done'
      onStep({ ...step }, i)

    } catch (e) {
      onError('Agent step failed: ' + String(e))
      return
    }
  }

  onDone('Sab steps complete. Goal achieve hua!')
}
