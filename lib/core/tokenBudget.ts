/* lib/core/tokenBudget.ts — Smart token budget based on query complexity */

export type QueryComplexity = 'nano' | 'simple' | 'normal' | 'deep' | 'research';

export interface TokenBudget {
  maxTokens: number;
  historyMsgs: number;
  maxTools: number;
  complexity: QueryComplexity;
}

const BUDGETS: Record<QueryComplexity, TokenBudget> = {
  nano:     { maxTokens: 60,   historyMsgs: 2,  maxTools: 0,  complexity: 'nano' },
  simple:   { maxTokens: 150,  historyMsgs: 4,  maxTools: 3,  complexity: 'simple' },
  normal:   { maxTokens: 350,  historyMsgs: 6,  maxTools: 6,  complexity: 'normal' },
  deep:     { maxTokens: 600,  historyMsgs: 8,  maxTools: 10, complexity: 'deep' },
  research: { maxTokens: 1000, historyMsgs: 10, maxTools: 15, complexity: 'research' },
};

const NANO_PATTERNS = /^(hi|hello|hey|hii|helo|yo|sup|ok|okay|thanks|thx|ty|hmm|hm|k|yes|no|nahi|haan|acha|theek|done)$/i;
const SIMPLE_PATTERNS = /^.{0,50}$/;
const DEEP_PATTERNS = /code|script|program|write|create|build|make|explain|solve|calculate|neet|jee|math|derive|prove|reason|step by step|kaise|samjhao|banao|likhna|formula/i;
const RESEARCH_PATTERNS = /research|analyze|compare|report|detailed|comprehensive|essay|article|everything|poora|sab kuch|detail mein/i;

export function detectComplexity(input: string): QueryComplexity {
  const trimmed = input.trim();
  const wordCount = trimmed.split(/\s+/).length;

  if (NANO_PATTERNS.test(trimmed) || wordCount <= 2) return 'nano';
  if (RESEARCH_PATTERNS.test(trimmed) || wordCount > 50) return 'research';
  if (DEEP_PATTERNS.test(trimmed) || wordCount > 15) return 'deep';
  if (SIMPLE_PATTERNS.test(trimmed) || wordCount <= 8) return 'simple';
  return 'normal';
}

export function getTokenBudget(input: string): TokenBudget {
  const complexity = detectComplexity(input);
  return BUDGETS[complexity];
}

export function trimHistory(
  messages: Array<{ role: string; content: string }>,
  maxMsgs: number,
): Array<{ role: string; content: string }> {
  const system = messages.filter(m => m.role === 'system');
  const convo = messages.filter(m => m.role !== 'system');
  const trimmed = convo.slice(-maxMsgs);
  return [...system, ...trimmed];
}
