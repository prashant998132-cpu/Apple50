/* lib/core/contextCompressor.ts
 * Smart history compression — token wastage rokta hai
 * Rule G28: Cache + compress = API cost minimize
 */

interface Message { role: 'user' | 'assistant' | 'system'; content: string; }

// Rough token estimate (1 token ≈ 4 chars)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Compress a single message if too long
function compressMessage(msg: Message, maxChars: number): Message {
  if (msg.content.length <= maxChars) return msg;
  // Keep first + last 40% (preserves context)
  const keep = Math.floor(maxChars * 0.4);
  const start = msg.content.slice(0, keep);
  const end   = msg.content.slice(-keep);
  return { ...msg, content: `${start}\n...[compressed]...\n${end}` };
}

// Main compressor
export function compressHistory(
  messages: Message[],
  opts: {
    maxTokens?:     number;  // total token budget for history
    maxMessages?:   number;  // max messages to keep
    keepSystemMsg?: boolean;
  } = {},
): Message[] {
  const {
    maxTokens   = 2000,
    maxMessages = 12,
    keepSystemMsg = true,
  } = opts;

  const system = messages.filter(m => m.role === 'system');
  let history  = messages.filter(m => m.role !== 'system');

  // Step 1: Trim to maxMessages (keep latest)
  if (history.length > maxMessages) {
    history = history.slice(-maxMessages);
  }

  // Step 2: If still too many tokens, compress long messages
  let totalTokens = history.reduce((s, m) => s + estimateTokens(m.content), 0);

  if (totalTokens > maxTokens) {
    // Compress assistant messages first (they tend to be longest)
    history = history.map(m => {
      if (m.role === 'assistant' && estimateTokens(m.content) > 300) {
        return compressMessage(m, 600);
      }
      return m;
    });

    // Recalculate
    totalTokens = history.reduce((s, m) => s + estimateTokens(m.content), 0);

    // If still over, trim older messages
    while (totalTokens > maxTokens && history.length > 2) {
      history.shift();
      totalTokens = history.reduce((s, m) => s + estimateTokens(m.content), 0);
    }
  }

  return keepSystemMsg ? [...system, ...history] : history;
}

// Summary compression — for very long chats
export function summarizeOldHistory(
  messages: Message[],
  keepLast: number = 6,
): Message[] {
  if (messages.length <= keepLast) return messages;

  const system  = messages.filter(m => m.role === 'system');
  const history = messages.filter(m => m.role !== 'system');
  const old     = history.slice(0, -keepLast);
  const recent  = history.slice(-keepLast);

  // Create a summary of old messages
  const pairs: string[] = [];
  for (let i = 0; i < old.length - 1; i += 2) {
    const u = old[i];
    const a = old[i + 1];
    if (u && a) pairs.push(`Q: ${u.content.slice(0, 80)} → A: ${a.content.slice(0, 80)}`);
  }

  const summary: Message = {
    role: 'system',
    content: `[Purani baat ka summary]\n${pairs.join('\n')}\n[Ab nayi baat shuru]`,
  };

  return [...system, summary, ...recent];
}

// Quick check — should we compress?
export function needsCompression(messages: Message[], tokenLimit = 3000): boolean {
  const total = messages.reduce((s, m) => s + estimateTokens(m.content), 0);
  return total > tokenLimit;
}
