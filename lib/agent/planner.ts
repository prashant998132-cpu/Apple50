// lib/agent/planner.ts — AI Task Planner
// Natural language → structured step list
// Uses existing smartRouter providers — zero extra cost
'use client'

export interface AgentStep {
  id: string
  tool: AgentTool
  input: Record<string, any>
  status: 'pending' | 'running' | 'done' | 'failed'
  output?: string
  error?: string
}

export type AgentTool =
  | 'ai_text'        // Generate text via AI
  | 'ai_image'       // Generate image via Pollinations
  | 'ai_tts'         // Text to speech
  | 'web_search'     // DuckDuckGo search
  | 'open_app'       // MacroDroid: open app
  | 'phone_action'   // MacroDroid: WiFi/BT/alarm etc
  | 'save_note'      // Save to IndexedDB
  | 'send_message'   // WhatsApp/SMS deep link
  | 'open_url'       // Open URL in browser
  | 'copy_text'      // Copy to clipboard
  | 'show_result'    // Display final result to user

export interface AgentPlan {
  goal: string
  steps: AgentStep[]
  status: 'planning' | 'running' | 'done' | 'failed'
  createdAt: number
}

// Predefined plan templates (fast, no AI call needed)
const PLAN_TEMPLATES: Array<{
  match: RegExp[]
  plan: (input: string) => Omit<AgentStep, 'id'>[]
}> = [
  {
    match: [/youtube video.*upload|upload.*youtube|video bana/i],
    plan: () => [
      { tool: 'ai_text',    input: { prompt: 'Write a 60-second YouTube script on the requested topic. Include hook, main content, and CTA.' }, status: 'pending' },
      { tool: 'ai_image',   input: { prompt: 'YouTube thumbnail, vibrant, eye-catching' }, status: 'pending' },
      { tool: 'show_result',input: { message: 'Script + thumbnail ready! Manual upload steps: 1) Copy script 2) Record video 3) Use thumbnail' }, status: 'pending' },
      { tool: 'open_app',   input: { app: 'youtube' }, status: 'pending' },
    ]
  },
  {
    match: [/whatsapp.*bhej|message.*send|send.*message/i],
    plan: (input) => [
      { tool: 'ai_text',    input: { prompt: `Write a short WhatsApp message for: ${input}` }, status: 'pending' },
      { tool: 'copy_text',  input: { text: '{{prev_output}}' }, status: 'pending' },
      { tool: 'open_app',   input: { app: 'whatsapp' }, status: 'pending' },
    ]
  },
  {
    match: [/research|research kar|find out about/i],
    plan: (input) => [
      { tool: 'web_search', input: { query: input }, status: 'pending' },
      { tool: 'ai_text',    input: { prompt: 'Summarize the search results in 5 bullet points' }, status: 'pending' },
      { tool: 'save_note',  input: { title: `Research: ${input.slice(0,40)}` }, status: 'pending' },
      { tool: 'show_result',input: { message: '{{prev_output}}' }, status: 'pending' },
    ]
  },
  {
    match: [/image.*bana|generate image|create image/i],
    plan: (input) => [
      { tool: 'ai_text',    input: { prompt: `Create a detailed image generation prompt for: ${input}` }, status: 'pending' },
      { tool: 'ai_image',   input: { prompt: '{{prev_output}}' }, status: 'pending' },
      { tool: 'show_result',input: { message: 'Image generated!' }, status: 'pending' },
    ]
  },
  {
    match: [/morning routine|din shuru|good morning routine/i],
    plan: () => [
      { tool: 'ai_text',    input: { prompt: 'Give me a 5-step morning routine with timing' }, status: 'pending' },
      { tool: 'phone_action',input: { action: 'alarm', payload: { time: '6:00am' } }, status: 'pending' },
      { tool: 'show_result', input: { message: 'Morning routine set! Alarm bhi lag gaya.' }, status: 'pending' },
    ]
  },
  {
    match: [/study plan|study schedule|padhai plan|padhna hai|study time|subjects.*plan|plan.*subjects/i],
    plan: (input) => [
      { tool: 'ai_text', input: { prompt: `User ne kaha: "${input}"\n\nEk detailed study plan banao. Include:\n1. Subjects/topics list (agar mention kiya ho)\n2. Daily time slots (morning/afternoon/evening)\n3. Weekly schedule\n4. Short breaks\n5. Revision days\n\nHinglish mein likho, practical aur achievable banao.` }, status: 'pending' },
      { tool: 'save_note', input: { title: 'Study Plan', content: '{{prev_output}}' }, status: 'pending' },
      { tool: 'show_result', input: { message: '{{prev_output}}' }, status: 'pending' },
    ]
  },
  {
    match: [/todo|task list|kya karna hai|aaj ka kaam|checklist|plan for today/i],
    plan: (input) => [
      { tool: 'ai_text', input: { prompt: `"${input}" — Iske liye ek clear actionable todo list banao. Numbered, short points, priority order mein. Hinglish mein.` }, status: 'pending' },
      { tool: 'copy_text', input: { text: '{{prev_output}}' }, status: 'pending' },
      { tool: 'show_result', input: { message: '{{prev_output}}' }, status: 'pending' },
    ]
  },
  {
    match: [/remind|reminder|yaad dilao|alarm set|schedule.*remind/i],
    plan: (input) => [
      { tool: 'ai_text', input: { prompt: `Parse this reminder request: "${input}". Extract: what to remind, when. Reply in format: "⏰ Reminder: [what] at [time]"` }, status: 'pending' },
      { tool: 'phone_action', input: { action: 'alarm', payload: {} }, status: 'pending' },
      { tool: 'show_result', input: { message: '{{prev_output}} — Set kar diya!' }, status: 'pending' },
    ]
  },
  {
    match: [/weather.*reminder|barish.*umbrella|rain.*remind|temperature.*alarm/i],
    plan: (input) => [
      { tool: 'web_search', input: { query: 'today weather forecast ' + input }, status: 'pending' },
      { tool: 'ai_text', input: { prompt: 'Weather data dekho. Agar barish/rain expected hai toh reminder suggest karo with MacroDroid action. Otherwise just weather batao.' }, status: 'pending' },
      { tool: 'phone_action', input: { action: 'notification', payload: { title: 'JARVIS Weather Alert', body: '{{prev_output}}' } }, status: 'pending' },
      { tool: 'show_result', input: { message: '{{prev_output}}' }, status: 'pending' },
    ]
  },
  {
    match: [/battery.*low.*remind|charge.*remind|low battery/i],
    plan: () => [
      { tool: 'phone_action', input: { action: 'notification', payload: { title: '⚡ JARVIS', body: 'Boss, battery check karo!' } }, status: 'pending' },
      { tool: 'show_result', input: { message: 'Battery reminder set! Notification bhej di.' }, status: 'pending' },
    ]
  },
  {
    match: [/whatsapp.*bhej|message.*send.*whatsapp|send.*whatsapp/i],
    plan: (input) => [
      { tool: 'ai_text', input: { prompt: 'WhatsApp message draft karo for: ' + input + '. Short, natural Hinglish. Bas message text, koi explanation nahi.' }, status: 'pending' },
      { tool: 'copy_text', input: { text: '{{prev_output}}' }, status: 'pending' },
      { tool: 'open_app', input: { app: 'whatsapp' }, status: 'pending' },
      { tool: 'show_result', input: { message: 'Message copy ho gaya, WhatsApp khul raha hai. Paste karke bhej do!' }, status: 'pending' },
    ]
  },
  {
    match: [/maps.*open|navigate|directions|kaise jaaun|rasta batao/i],
    plan: (input) => [
      { tool: 'open_app', input: { app: 'maps', extra: input }, status: 'pending' },
      { tool: 'show_result', input: { message: 'Maps khul raha hai! Route dekho.' }, status: 'pending' },
    ]
  },
  {
    match: [/birthday|janmdin|birthday.*wish|wish.*birthday/i],
    plan: (input) => [
      { tool: 'ai_text', input: { prompt: 'Ek heartfelt birthday wish likho: ' + input + '. Hinglish mein, warm aur personal.' }, status: 'pending' },
      { tool: 'ai_image', input: { prompt: 'beautiful birthday celebration, balloons, cake, colorful, festive' }, status: 'pending' },
      { tool: 'copy_text', input: { text: '{{prev_output}}' }, status: 'pending' },
      { tool: 'open_app', input: { app: 'whatsapp' }, status: 'pending' },
      { tool: 'show_result', input: { message: 'Birthday wish copy ho gaya + WhatsApp khul raha hai. Paste kar do!' }, status: 'pending' },
    ]
  },
  {
    match: [/essay|article|lekh|nibandh|write.*about/i],
    plan: (input) => [
      { tool: 'web_search', input: { query: input }, status: 'pending' },
      { tool: 'ai_text', input: { prompt: 'Web search results ke basis pe ek detailed essay/article likho: ' + input + '. 400-500 words, structured, informative.' }, status: 'pending' },
      { tool: 'save_note', input: { title: 'Essay: ' + input.slice(0,30) }, status: 'pending' },
      { tool: 'show_result', input: { message: '{{prev_output}}' }, status: 'pending' },
    ]
  },
  {
    match: [/business idea|startup|naya kaam|business plan/i],
    plan: (input) => [
      { tool: 'web_search', input: { query: input + ' business opportunity India 2025' }, status: 'pending' },
      { tool: 'ai_text', input: { prompt: 'Ek practical business plan banao: ' + input + '. Include: market opportunity, starting cost, revenue model, risks. India-specific, realistic.' }, status: 'pending' },
      { tool: 'save_note', input: { title: 'Business Plan: ' + input.slice(0,30) }, status: 'pending' },
      { tool: 'show_result', input: { message: '{{prev_output}}' }, status: 'pending' },
    ]
  },
  {
    match: [/news|khabar|aaj ki news|latest.*news|news.*summarize/i],
    plan: (input) => [
      { tool: 'web_search', input: { query: input.replace(/bata(o)?|dedo|lao/gi, '').trim() || 'today latest news India' }, status: 'pending' },
      { tool: 'ai_text', input: { prompt: 'Search results ke basis pe 5 main news points banao. Bullet points mein, Hinglish mein, short aur clear.' }, status: 'pending' },
      { tool: 'show_result', input: { message: '{{prev_output}}' }, status: 'pending' },
    ]
  },
]

// AI-based planner for unknown requests
export async function planWithAI(goal: string): Promise<Omit<AgentStep, 'id'>[]> {
  const TOOLS_DESC = `
Available tools (use exact names):
- ai_text: Generate any text content. Input: { prompt: string }
- ai_image: Generate an image. Input: { prompt: string }
- web_search: Search the web. Input: { query: string }
- open_app: Open Android app. Input: { app: "youtube"|"whatsapp"|"instagram"|"maps"|"camera"|"settings" }
- phone_action: Phone automation. Input: { action: "wifi_on"|"wifi_off"|"alarm"|"volume_up", payload?: {} }
- save_note: Save to memory. Input: { title: string }
- send_message: Send via deep link. Input: { app: "whatsapp", text: string, phone?: string }
- copy_text: Copy to clipboard. Input: { text: string }
- open_url: Open URL. Input: { url: string }
- show_result: Show final result. Input: { message: string }
`

  const prompt = `You are a task planner for JARVIS AI assistant.
Convert this user goal into 2-6 sequential steps using available tools.

Goal: "${goal}"

${TOOLS_DESC}

Respond ONLY with a JSON array. No markdown, no explanation. Example:
[{"tool":"web_search","input":{"query":"AI news today"}},{"tool":"show_result","input":{"message":"{{prev_output}}"}}]`

  try {
    // Use Groq (fastest) via our existing API
    const res = await fetch('/api/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        mode: 'flash',
        stream: false,
      }),
    })
    const data = await res.json()
    const text = data.content || data.text || ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const steps = JSON.parse(jsonMatch[0])
      return steps.map((s: any) => ({ ...s, status: 'pending' as const }))
    }
  } catch {}

  // Fallback: generic 2-step plan
  return [
    { tool: 'ai_text',    input: { prompt: goal }, status: 'pending' },
    { tool: 'show_result',input: { message: '{{prev_output}}' }, status: 'pending' },
  ]
}

export async function createPlan(goal: string): Promise<AgentPlan> {
  // Try templates first (instant, no AI call)
  for (const tmpl of PLAN_TEMPLATES) {
    if (tmpl.match.some(r => r.test(goal))) {
      const rawSteps = tmpl.plan(goal)
      return {
        goal,
        steps: rawSteps.map((s, i) => ({ ...s, id: `step_${i}_${Date.now()}` })),
        status: 'planning',
        createdAt: Date.now(),
      }
    }
  }
  // AI planner for everything else
  const rawSteps = await planWithAI(goal)
  return {
    goal,
    steps: rawSteps.map((s, i) => ({ ...s, id: `step_${i}_${Date.now()}` })),
    status: 'planning',
    createdAt: Date.now(),
  }
}
