// lib/tools/executor.ts — JARVIS Autonomous Tool Executor v1
// 1. detectIntent() → categories
// 2. Select best tools (prefer no-key, max 2)
// 3. Execute with fallback chain
// 4. Cache results
// 5. Return formatted context for AI injection

import { detectIntent, type IntentResult, type ToolCategory } from './intent'
import { getToolsByCategory, getToolById, toGeminiFunctions, type ToolMeta } from './registry'
import { cachedFetch } from './cache'

// ── Category → module loader map (lazy imports) ──────────
// Each category loaded only when needed
const LOADERS: Partial<Record<ToolCategory, () => Promise<Record<string, (args: any) => Promise<any>>>>> = {
  weather:       () => import('./categories/weather'),
  time:          () => import('./categories/time'),
  news:          () => import('./categories/news'),
  finance:       () => import('./categories/finance'),
  knowledge:     () => import('./categories/knowledge'),
  location:      () => import('./categories/location'),
  india:         () => import('./categories/india'),
  education:     () => import('./categories/education'),
  entertainment: () => import('./categories/entertainment'),
  image_gen:     () => import('./categories/image_gen'),
  productivity:  () => import('./categories/productivity'),
  science:       () => import('./categories/science'),
  health:        () => import('./categories/health'),
  sports:        () => import('./categories/sports'),
  food:          () => import('./categories/food'),
  fun:           () => import('./categories/fun'),
  search:        () => import('./categories/search'),
}

// ── Module cache (don't re-import same module) ────────────
const _loadedModules: Partial<Record<ToolCategory, Record<string, (args: any) => Promise<any>>>> = {}

async function loadCategory(cat: ToolCategory): Promise<Record<string, (args: any) => Promise<any>>> {
  if (_loadedModules[cat]) return _loadedModules[cat]!
  const loader = LOADERS[cat]
  if (!loader) return {}
  try {
    _loadedModules[cat] = await loader()
    return _loadedModules[cat]!
  } catch { return {} }
}

// ── Tool result type ──────────────────────────────────────
export interface ToolResult {
  toolId: string
  success: boolean
  data: any
  fromCache: boolean
  errorMsg?: string
  durationMs: number
}

// ── Select best tools for intent ─────────────────────────
// Rules:
// 1. Prefer no-key tools
// 2. Prefer tools with longer cache TTL (more stable)
// 3. Max 2 tools total
// 4. Only load from matched categories
function selectTools(intent: IntentResult): ToolMeta[] {
  if (intent.skipTools || intent.categories[0] === 'none') return []

  const selected: ToolMeta[] = []
  const seen = new Set<string>()

  for (const cat of intent.categories.slice(0, 2) as import("./intent").ToolCategory[]) {
    const catTools = getToolsByCategory(cat)

    // Score each tool in category
    const scored = catTools.map(t => ({
      tool: t,
      score:
        (!t.requiresKey ? 10 : 0) +        // prefer no-key
        (t.fallbacks.length > 0 ? 2 : 0) + // prefer has fallbacks
        Math.min(t.cacheTTL / 3600, 5),    // prefer longer TTL (max +5)
    }))
    .sort((a, b) => b.score - a.score)

    // Take best tool from this category
    const best = scored[0]?.tool
    if (best && !seen.has(best.id)) {
      selected.push(best)
      seen.add(best.id)
      if (selected.length >= intent.maxTools) break
    }
  }

  return selected
}

// ── Execute a single tool with fallback chain ─────────────
async function executeTool(
  tool: ToolMeta,
  args: Record<string, any>,
  depth = 0
): Promise<ToolResult> {
  if (depth > 2) {
    return { toolId: tool.id, success: false, data: null, fromCache: false, errorMsg: 'max_fallbacks', durationMs: 0 }
  }

  const t0 = Date.now()

  // Check for required env key
  if (tool.requiresKey && tool.keyName) {
    const hasKey = typeof process !== 'undefined' && !!process.env[tool.keyName]
    if (!hasKey) {
      // Try fallback immediately
      const fallbackId = tool.fallbacks[0]
      if (fallbackId) {
        const fallbackTool = getToolById(fallbackId)
        if (fallbackTool) return executeTool(fallbackTool, args, depth + 1)
      }
      return { toolId: tool.id, success: false, data: null, fromCache: false, errorMsg: 'key_missing', durationMs: 0 }
    }
  }

  // Load module for this tool's category
  const module = await loadCategory(tool.category)
  const fn = module[tool.id]
  if (!fn) {
    // Function not found — try fallback
    const fallbackId = tool.fallbacks[0]
    if (fallbackId) {
      const fallbackTool = getToolById(fallbackId)
      if (fallbackTool) return executeTool(fallbackTool, args, depth + 1)
    }
    return { toolId: tool.id, success: false, data: null, fromCache: false, errorMsg: 'fn_not_found', durationMs: Date.now() - t0 }
  }

  // Execute with cache
  try {
    const { value, fromCache } = await cachedFetch(
      tool.id,
      Object.keys(args).length > 0 ? args : undefined,
      tool.cacheTTL,
      () => Promise.race([
        fn(args),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
      ])
    )
    return { toolId: tool.id, success: true, data: value, fromCache, durationMs: Date.now() - t0 }
  } catch (e: any) {
    // Try next fallback
    const fallbackId = tool.fallbacks[0]
    if (fallbackId) {
      const fallbackTool = getToolById(fallbackId)
      if (fallbackTool) {
        const result = await executeTool(fallbackTool, args, depth + 1)
        if (result.success) return result
      }
    }
    return { toolId: tool.id, success: false, data: null, fromCache: false, errorMsg: e.message, durationMs: Date.now() - t0 }
  }
}

// ── Main: autonomous execution pipeline ──────────────────
export interface ExecutionPlan {
  intent: IntentResult
  selectedTools: ToolMeta[]
  results: ToolResult[]
  contextString: string   // formatted for AI injection
  totalMs: number
  toolsUsed: string[]
}

export async function autonomousExecute(
  query: string,
  preExtractedArgs?: Record<string, any>
): Promise<ExecutionPlan> {
  const t0 = Date.now()

  // Step 1: Detect intent
  const intent = detectIntent(query)

  // Step 2: Skip if no tool needed
  if (intent.skipTools || intent.categories[0] === 'none') {
    return {
      intent, selectedTools: [], results: [],
      contextString: '', totalMs: Date.now() - t0, toolsUsed: [],
    }
  }

  // Step 3: Select tools
  const selectedTools = selectTools(intent)
  if (selectedTools.length === 0) {
    return {
      intent, selectedTools: [], results: [],
      contextString: '', totalMs: Date.now() - t0, toolsUsed: [],
    }
  }

  // Step 4: Build args (merge pre-extracted + intent args + defaults)
  const baseArgs = { ...intent.extractedArgs, ...(preExtractedArgs || {}) }

  // Step 5: Execute tools (in parallel if 2)
  const execPromises = selectedTools.map(tool => {
    const toolArgs = buildToolArgs(tool, query, baseArgs)
    return executeTool(tool, toolArgs)
  })

  const results = await Promise.all(execPromises)

  // Step 6: Format context string for AI
  const contextString = formatResults(results, selectedTools, intent)
  const toolsUsed = results.filter(r => r.success).map(r => r.toolId)

  return {
    intent, selectedTools, results,
    contextString, totalMs: Date.now() - t0, toolsUsed,
  }
}

// ── Build tool args from query + extracted args + defaults ─
function buildToolArgs(
  tool: ToolMeta,
  query: string,
  baseArgs: Record<string, any>
): Record<string, any> {
  const args: Record<string, any> = {}

  // Fill defaults first
  for (const [key, schema] of Object.entries(tool.params || {})) {
    if (schema.default !== undefined) args[key] = schema.default
  }

  // Override with extracted args
  for (const [key, val] of Object.entries(baseArgs)) {
    if (tool.params?.[key]) args[key] = val
  }

  // Smart fills based on tool type
  if (tool.id === 'get_weather' && !args.location) {
    // Try to extract city from query
    const cityMatch = query.match(/(?:in|at|of|ke liye)\s+([A-Z][a-zA-Z\s]{2,20})(?:\?|$|\s)/i)
    if (cityMatch) args.location = cityMatch[1].trim()
  }

  if (tool.id.includes('wikipedia') || tool.id === 'search_books') {
    if (!args.query) args.query = query.replace(/\b(kya hai|kaun hai|who is|what is|batao|explain|about)\b/gi, '').trim().slice(0, 100)
  }

  if (tool.id === 'get_recipe' && !args.query) {
    args.query = query
  }

  if (tool.id === 'web_search' && !args.query) {
    args.query = query
  }

  if (tool.id === 'translate_text') {
    const hiToEn = /hindi.?mein|हिंदी में|translate to hindi/i.test(query)
    args.to = hiToEn ? 'hi' : 'en'
    // Extract text to translate
    const textMatch = query.match(/translate\s+"?([^"]+)"?/i) || query.match(/anuvad karo\s+(.+)/i)
    if (textMatch) args.text = textMatch[1].trim()
    else args.text = query
  }

  return args
}

// ── Format results into AI context string ─────────────────
function formatResults(
  results: ToolResult[],
  tools: ToolMeta[],
  intent: IntentResult
): string {
  const parts: string[] = []

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const t = tools[i]
    if (!r.success || !r.data) continue

    const cacheFlag = r.fromCache ? ' [cached]' : ''
    parts.push(`[TOOL: ${t.name}${cacheFlag}]\n${JSON.stringify(r.data, null, 0).slice(0, 1200)}`)
  }

  if (parts.length === 0) return ''

  return `\n\n[AUTO_TOOL_DATA]\n${parts.join('\n\n')}\n[/AUTO_TOOL_DATA]\n\nInstructions: Use the above real-time data in your response. Be concise. Present data in Hindi-friendly format.`
}

// ── Get Gemini function declarations for selected tools ───
export function getSelectedFunctions(intent: IntentResult): any[] {
  if (intent.skipTools) return []
  const tools = selectTools(intent)
  return toGeminiFunctions(tools)
}
