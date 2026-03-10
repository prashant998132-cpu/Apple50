/* lib/core/agentDispatcher.ts
 * Model tier picker: nano → standard → powerful → reasoning
 * Rule R-B: Wired into smartRouter.ts
 */
import type { ModelTier, AgentDecision } from '@/types/jarvis.types';

interface TierConfig {
  tier:      ModelTier;
  provider:  string;
  model:     string;
  maxTokens: number;
  envKey?:   string;
}

// Priority order per tier
const TIERS: Record<ModelTier, TierConfig[]> = {
  nano: [
    { tier: 'nano', provider: 'Groq',     model: 'llama-3.1-8b-instant',        maxTokens: 300,  envKey: 'GROQ_API_KEY' },
    { tier: 'nano', provider: 'Cerebras', model: 'llama3.1-8b',                  maxTokens: 300,  envKey: 'CEREBRAS_API_KEY' },
    { tier: 'nano', provider: 'Pollinations', model: 'openai',                   maxTokens: 300 },
  ],
  standard: [
    { tier: 'standard', provider: 'Groq',    model: 'llama-3.3-70b-versatile',  maxTokens: 500,  envKey: 'GROQ_API_KEY' },
    { tier: 'standard', provider: 'Cerebras',model: 'llama3.1-70b',             maxTokens: 500,  envKey: 'CEREBRAS_API_KEY' },
    { tier: 'standard', provider: 'Together',model: 'meta-llama/Llama-3-70b-chat-hf', maxTokens: 500, envKey: 'TOGETHER_API_KEY' },
    { tier: 'standard', provider: 'Gemini',  model: 'gemini-2.0-flash',          maxTokens: 600,  envKey: 'GEMINI_API_KEY' },
    { tier: 'standard', provider: 'Pollinations', model: 'openai',               maxTokens: 500 },
  ],
  powerful: [
    { tier: 'powerful', provider: 'Gemini',  model: 'gemini-2.0-flash',          maxTokens: 800,  envKey: 'GEMINI_API_KEY' },
    { tier: 'powerful', provider: 'Together',model: 'meta-llama/Llama-3-70b-chat-hf', maxTokens: 800, envKey: 'TOGETHER_API_KEY' },
    { tier: 'powerful', provider: 'Groq',    model: 'llama-3.3-70b-versatile',  maxTokens: 800,  envKey: 'GROQ_API_KEY' },
    { tier: 'powerful', provider: 'Pollinations', model: 'openai',               maxTokens: 700 },
  ],
  reasoning: [
    { tier: 'reasoning', provider: 'Groq',       model: 'deepseek-r1-distill-llama-70b', maxTokens: 1200, envKey: 'GROQ_API_KEY' },
    { tier: 'reasoning', provider: 'OpenRouter',  model: 'deepseek/deepseek-r1:free',    maxTokens: 1200, envKey: 'OPENROUTER_API_KEY' },
    { tier: 'reasoning', provider: 'Gemini',      model: 'gemini-2.0-flash-thinking-exp',maxTokens: 1000, envKey: 'GEMINI_API_KEY' },
    { tier: 'reasoning', provider: 'Pollinations', model: 'openai',                      maxTokens: 1000 },
  ],
};

// Detect tier from query + mode
export function pickTier(query: string, mode: string): ModelTier {
  const q = query.toLowerCase();

  // Reasoning: NEET, JEE, math, code, logic, debate
  if (mode === 'deep') return 'reasoning';
  if (/neet|jee|upsc|theorem|proof|derive|algorithm|debug|refactor|explain.*code|solve.*math/.test(q)) return 'reasoning';

  // Powerful: detailed explanations, comparisons, essays
  if (mode === 'think') return 'powerful';
  if (/explain|compare|analyse|analyze|essay|write.*story|summarize|translate.*paragraph/.test(q)) return 'powerful';

  // Nano: simple, fast, greetings, quick facts
  if (/^(hi|hello|hey|time|date|thanks|ok|bye|what is \w+\?)/.test(q)) return 'nano';
  if (q.length < 40) return 'nano';

  // Default: standard
  return 'standard';
}

// Pick best available model for tier (checks env keys)
export function pickModelTier(
  query: string,
  mode: string,
  availableKeys: Record<string, boolean>,
): AgentDecision {
  const tier = pickTier(query, mode);
  const options = TIERS[tier];

  for (const cfg of options) {
    // No key needed (Pollinations) → always available
    if (!cfg.envKey) {
      return { tier: cfg.tier, provider: cfg.provider, model: cfg.model, maxTokens: cfg.maxTokens, reason: `${tier} tier, no key needed` };
    }
    // Key available → use it
    if (availableKeys[cfg.envKey]) {
      return { tier: cfg.tier, provider: cfg.provider, model: cfg.model, maxTokens: cfg.maxTokens, reason: `${tier} tier, key available` };
    }
  }

  // Fallback: Pollinations nano
  return { tier: 'nano', provider: 'Pollinations', model: 'openai', maxTokens: 300, reason: 'fallback: no keys' };
}

// Export tier configs for smartRouter
export function getTierModels(tier: ModelTier): TierConfig[] {
  return TIERS[tier] || TIERS.standard;
}
