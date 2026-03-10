/* lib/core/smartRouter.ts — 14-provider cascade router */

export type RouterMode = 'flash' | 'think' | 'deep';

interface Message { role: 'user' | 'assistant' | 'system'; content: string; }

interface RouterResult {
  text: string;
  provider: string;
  model: string;
}

// ── Provider configurations ─────────────────────────────────────────────
const PROVIDERS = {
  groq_8b: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.1-8b-instant',
    key: () => process.env.GROQ_API_KEY,
  },
  groq_70b: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    key: () => process.env.GROQ_API_KEY,
  },
  gemini_flash: {
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.0-flash',
    key: () => process.env.GEMINI_API_KEY,
  },
  gemini_think: {
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.0-flash-thinking-exp',
    key: () => process.env.GEMINI_API_KEY,
  },
  together: {
    url: 'https://api.together.xyz/v1/chat/completions',
    model: 'meta-llama/Llama-3-70b-chat-hf',
    key: () => process.env.TOGETHER_API_KEY,
  },
  cerebras: {
    url: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'llama3.1-70b',
    key: () => process.env.CEREBRAS_API_KEY,
  },
  mistral: {
    url: 'https://api.mistral.ai/v1/chat/completions',
    model: 'mistral-small-latest',
    key: () => process.env.MISTRAL_API_KEY,
  },
  cohere: {
    url: 'https://api.cohere.com/v1/chat',
    model: 'command-r',
    key: () => process.env.COHERE_API_KEY,
    special: 'cohere',
  },
  fireworks: {
    url: 'https://api.fireworks.ai/inference/v1/chat/completions',
    model: 'accounts/fireworks/models/llama-v3p1-70b-instruct',
    key: () => process.env.FIREWORKS_API_KEY,
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'deepseek/deepseek-r1:free',
    key: () => process.env.OPENROUTER_API_KEY,
  },
  deepinfra: {
    url: 'https://api.deepinfra.com/v1/openai/chat/completions',
    model: 'meta-llama/Meta-Llama-3-70B-Instruct',
    key: () => process.env.DEEPINFRA_API_KEY,
  },
  huggingface: {
    url: 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions',
    model: 'mistralai/Mistral-7B-Instruct-v0.3',
    key: () => process.env.HUGGINGFACE_API_KEY,
  },
};

// ── OpenAI-compatible POST ───────────────────────────────────────────────
async function callOpenAI(
  url: string,
  apiKey: string,
  model: string,
  messages: Message[],
  maxTokens = 800,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
    signal,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text;
  if (!text) throw new Error('Empty response');
  return text.trim();
}

// ── Pollinations fallback (unlimited) ───────────────────────────────────
async function callPollinations(messages: Message[], signal?: AbortSignal): Promise<string> {
  const res = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai',
      messages,
      max_tokens: 800,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty Pollinations response');
  return text.trim();
}

// ── Cohere special format ────────────────────────────────────────────────
async function callCohere(messages: Message[], signal?: AbortSignal): Promise<string> {
  const key = process.env.COHERE_API_KEY;
  if (!key) throw new Error('No Cohere key');
  const userMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
  const history = messages.filter(m => m.role !== 'user').map(m => ({
    role: m.role === 'assistant' ? 'CHATBOT' : 'USER',
    message: m.content,
  }));
  const res = await fetch('https://api.cohere.com/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ message: userMsg, chat_history: history, model: 'command-r' }),
    signal,
  });
  if (!res.ok) throw new Error(`Cohere ${res.status}`);
  const data = await res.json();
  return data?.text || '';
}

// ── Main router ──────────────────────────────────────────────────────────
export async function smartRouter(
  messages: Message[],
  mode: RouterMode = 'flash',
  maxTokens = 800,
  signal?: AbortSignal,
): Promise<RouterResult> {

  // Build cascade based on mode
  let cascade: Array<[string, () => Promise<string>]>;

  if (mode === 'think' || mode === 'deep') {
    cascade = [
      ['OpenRouter/DeepSeek-R1', () => {
        const key = PROVIDERS.openrouter.key();
        if (!key) throw new Error('No key');
        return callOpenAI(PROVIDERS.openrouter.url, key, PROVIDERS.openrouter.model, messages, maxTokens, signal);
      }],
      ['Gemini-Thinking', () => {
        const key = PROVIDERS.gemini_think.key();
        if (!key) throw new Error('No key');
        return callOpenAI(PROVIDERS.gemini_think.url, key, PROVIDERS.gemini_think.model, messages, maxTokens, signal);
      }],
      ['Together/Llama-70B', () => {
        const key = PROVIDERS.together.key();
        if (!key) throw new Error('No key');
        return callOpenAI(PROVIDERS.together.url, key, PROVIDERS.together.model, messages, maxTokens, signal);
      }],
      ['Gemini-Flash', () => {
        const key = PROVIDERS.gemini_flash.key();
        if (!key) throw new Error('No key');
        return callOpenAI(PROVIDERS.gemini_flash.url, key, PROVIDERS.gemini_flash.model, messages, maxTokens, signal);
      }],
      ['Pollinations', () => callPollinations(messages, signal)],
    ];
  } else {
    // flash mode
    cascade = [
      ['Groq/Llama-8B', () => {
        const key = PROVIDERS.groq_8b.key();
        if (!key) throw new Error('No key');
        return callOpenAI(PROVIDERS.groq_8b.url, key, PROVIDERS.groq_8b.model, messages, maxTokens, signal);
      }],
      ['Groq/Llama-70B', () => {
        const key = PROVIDERS.groq_70b.key();
        if (!key) throw new Error('No key');
        return callOpenAI(PROVIDERS.groq_70b.url, key, PROVIDERS.groq_70b.model, messages, maxTokens, signal);
      }],
      ['Together/Llama-70B', () => {
        const key = PROVIDERS.together.key();
        if (!key) throw new Error('No key');
        return callOpenAI(PROVIDERS.together.url, key, PROVIDERS.together.model, messages, maxTokens, signal);
      }],
      ['Gemini-Flash', () => {
        const key = PROVIDERS.gemini_flash.key();
        if (!key) throw new Error('No key');
        return callOpenAI(PROVIDERS.gemini_flash.url, key, PROVIDERS.gemini_flash.model, messages, maxTokens, signal);
      }],
      ['Cerebras/Llama-70B', () => {
        const key = PROVIDERS.cerebras.key();
        if (!key) throw new Error('No key');
        return callOpenAI(PROVIDERS.cerebras.url, key, PROVIDERS.cerebras.model, messages, maxTokens, signal);
      }],
      ['Mistral-Small', () => {
        const key = PROVIDERS.mistral.key();
        if (!key) throw new Error('No key');
        return callOpenAI(PROVIDERS.mistral.url, key, PROVIDERS.mistral.model, messages, maxTokens, signal);
      }],
      ['Cohere/Command-R', () => callCohere(messages, signal)],
      ['Fireworks/Llama-70B', () => {
        const key = PROVIDERS.fireworks.key();
        if (!key) throw new Error('No key');
        return callOpenAI(PROVIDERS.fireworks.url, key, PROVIDERS.fireworks.model, messages, maxTokens, signal);
      }],
      ['HuggingFace/Mistral-7B', () => {
        const key = PROVIDERS.huggingface.key();
        if (!key) throw new Error('No key');
        return callOpenAI(PROVIDERS.huggingface.url, key, PROVIDERS.huggingface.model, messages, maxTokens, signal);
      }],
      ['Pollinations', () => callPollinations(messages, signal)],
    ];
  }

  // Try each provider in cascade
  for (const [name, fn] of cascade) {
    try {
      const text = await fn();
      if (text && text.length > 2) {
        const [provider, model] = name.split('/');
        return { text, provider: provider || name, model: model || name };
      }
    } catch {
      // try next
    }
  }

  // Ultimate fallback — keyword responses
  const lastMsg = messages.filter(m => m.role === 'user').pop()?.content?.toLowerCase() || '';
  return {
    text: generateKeywordFallback(lastMsg),
    provider: 'Keyword-Fallback',
    model: 'offline',
  };
}

function generateKeywordFallback(input: string): string {
  if (input.includes('hello') || input.includes('hi') || input.includes('hii'))
    return 'Hello! Main JARVIS hun. Abhi mera network thoda slow hai, par main yahan hun. Kya chahiye?';
  if (input.includes('time') || input.includes('samay'))
    return `Abhi ka time: ${new Date().toLocaleTimeString('en-IN')}`;
  if (input.includes('date') || input.includes('aaj'))
    return `Aaj ki date: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  if (input.includes('neet') || input.includes('exam'))
    return 'NEET ki taiyari kar rahe ho? Ekdum sahi kaam hai! Study page pe jao — /study — wahan MCQs milenge. Keep going! 💪';
  if (input.includes('weather') || input.includes('mausam'))
    return 'Weather ke liye location chahiye. "weather [city name]" type karo, main bata deta hun.';
  return 'Mera network abhi thoda slow hai. Thodi der mein try karo ya settings mein API keys add karo for faster responses.';
}
