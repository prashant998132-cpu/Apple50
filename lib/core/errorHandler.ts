/* lib/core/errorHandler.ts
 * Centralized error handling — sab errors ek jagah
 * Rule G30: Never crash — always return friendly message
 */

export type ErrorSource =
  | 'provider'    // LLM API error
  | 'tool'        // tool call error
  | 'storage'     // IndexedDB / Puter error
  | 'network'     // fetch failed
  | 'stream'      // SSE stream error
  | 'auth'        // PIN / biometric
  | 'unknown';

export interface JarvisError {
  source:   ErrorSource;
  code:     string;
  message:  string;
  retry:    boolean;
  userMsg:  string;  // Hindi/Hinglish message for user
}

// Error classifier
export function classifyError(err: unknown, source: ErrorSource = 'unknown'): JarvisError {
  const msg = err instanceof Error ? err.message : String(err);
  const code = extractCode(msg);

  // Provider errors
  if (source === 'provider') {
    if (code === '429') return { source, code, message: msg, retry: true,  userMsg: '⏳ Rate limit — thodi der mein try karo' };
    if (code === '401') return { source, code, message: msg, retry: false, userMsg: '🔑 API key galat hai — Settings mein check karo' };
    if (code === '503') return { source, code, message: msg, retry: true,  userMsg: '🔧 Provider down — dusre pe ja raha hun...' };
    if (msg.includes('85% limit')) return { source, code: 'LIMIT', message: msg, retry: true, userMsg: '📊 Daily limit near — next provider try kar raha hun' };
  }

  // Network errors
  if (source === 'network' || msg.includes('fetch') || msg.includes('network')) {
    return { source: 'network', code: 'NET_ERR', message: msg, retry: true, userMsg: '📶 Network issue — check connection ya retry karo' };
  }

  // Storage errors
  if (source === 'storage') {
    return { source, code: 'STORAGE_ERR', message: msg, retry: false, userMsg: '💾 Storage error — Puter KV pe switch kar raha hun' };
  }

  // Stream errors
  if (source === 'stream' || msg.includes('stream') || msg.includes('SSE')) {
    return { source: 'stream', code: 'STREAM_ERR', message: msg, retry: true, userMsg: '🔄 Stream issue — dobara try karo' };
  }

  // Abort (user cancelled)
  if (msg.includes('AbortError') || msg.includes('abort')) {
    return { source, code: 'ABORTED', message: msg, retry: false, userMsg: '' };
  }

  // Default
  return { source, code: 'UNKNOWN', message: msg, retry: false, userMsg: '❌ Kuch gadbad hui — thodi der mein try karo' };
}

function extractCode(msg: string): string {
  const match = msg.match(/\b([45]\d{2})\b/);
  return match ? match[1] : 'ERR';
}

// Log error (dev only)
export function logError(err: JarvisError, context?: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[JARVIS Error] ${err.source}/${err.code}${context ? ` (${context})` : ''}:`, err.message);
  }
}

// Safe async wrapper — never throws
export async function safeCall<T>(
  fn: () => Promise<T>,
  fallback: T,
  source: ErrorSource = 'unknown',
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const e = classifyError(err, source);
    logError(e);
    return fallback;
  }
}
