/* lib/core/appController.ts
 * App Control System — JARVIS chat se pura app control karta hai
 * Like ChatGPT Canvas — ek baar connect, phir automatically kaam karta hai
 */

export type AppCommand =
  | `navigate:${string}`
  | `toast:${string}`
  | `toastOk:${string}`
  | `toastErr:${string}`
  | `toastInfo:${string}`
  | 'clearChat'
  | 'openNav'
  | 'closeNav'
  | 'openHistory'
  | 'openSettings'
  | 'openApps'
  | 'openVoice'
  | 'openStudy'
  | 'openTools'
  | 'openBriefing'
  | 'openTarget'
  | `setMode:${'auto'|'flash'|'think'|'deep'}`
  | `setInput:${string}`
  | `setTheme:${'dark'|'light'|'amoled'}`
  | 'stopSpeaking'
  | 'newChat'
  | `compressMsg:${'tiny'|'short'|'medium'}`
  | 'scrollTop'
  | 'scrollBottom';

// Parse JARVIS response for embedded app commands
export function parseAppCommands(text: string): { clean: string; commands: string[] } {
  const commands: string[] = [];
  // Format: [[CMD:value]] or [[CMD]]
  const clean = text.replace(/\[\[([^\]]+)\]\]/g, (_, cmd) => {
    commands.push(cmd.trim());
    return '';
  }).trim();
  return { clean, commands };
}

// Natural language → app command detection (client-side, zero API)
export function detectAppIntent(msg: string): string | null {
  const m = msg.toLowerCase().trim();

  // Navigation
  if (/settings|setting|seting/i.test(m))         return 'navigate:/settings';
  if (/study|padhai|mcq|neet.*page/i.test(m) && /jao|open|page|kholo/i.test(m))
    return 'navigate:/study';
  if (/voice|bol.*mode|speak.*mode/i.test(m))      return 'navigate:/voice';
  if (/tools?|calculator|calc/i.test(m) && /jao|open|kholo/i.test(m))
    return 'navigate:/tools';
  if (/briefing|news.*page/i.test(m))              return 'navigate:/briefing';
  if (/target|goal|lakshy/i.test(m) && /jao|open/i.test(m))
    return 'navigate:/target';

  // Mode switch
  if (/flash.*mode|fast.*mode|quick.*mode/i.test(m))  return 'setMode:flash';
  if (/think.*mode|soch.*mode/i.test(m))               return 'setMode:think';
  if (/deep.*mode|detail.*mode/i.test(m))              return 'setMode:deep';
  if (/auto.*mode/i.test(m))                           return 'setMode:auto';

  // Chat actions
  if (/clear.*chat|chat.*clear|sab.*hata|fresh.*start/i.test(m)) return 'clearChat';
  if (/new.*chat|naya.*chat/i.test(m))                 return 'newChat';
  if (/band.*karo|stop.*speak|chup.*karo/i.test(m))   return 'stopSpeaking';

  // History/drawer
  if (/history|purani.*chat|past.*chat/i.test(m))     return 'openHistory';
  if (/connected.*apps?|apps.*connect/i.test(m))      return 'openApps';

  return null;
}

// Execute command on client side
export function executeCommand(cmd: string, handlers: {
  navigate:     (path: string) => void;
  showToast:    (msg: string, type?: string) => void;
  clearChat:    () => void;
  openNav:      () => void;
  closeNav:     () => void;
  openHistory:  () => void;
  openSettings: () => void;
  openApps:     () => void;
  setMode:      (mode: string) => void;
  setInput:     (text: string) => void;
  stopSpeaking: () => void;
  newChat:      () => void;
  scrollTop:    () => void;
  scrollBottom: () => void;
}): void {
  if (cmd.startsWith('navigate:'))     { handlers.navigate(cmd.replace('navigate:', '')); return; }
  if (cmd.startsWith('toast:'))        { handlers.showToast(cmd.replace('toast:', '')); return; }
  if (cmd.startsWith('toastOk:'))      { handlers.showToast(cmd.replace('toastOk:', ''), 'ok'); return; }
  if (cmd.startsWith('toastErr:'))     { handlers.showToast(cmd.replace('toastErr:', ''), 'err'); return; }
  if (cmd.startsWith('toastInfo:'))    { handlers.showToast(cmd.replace('toastInfo:', ''), 'info'); return; }
  if (cmd.startsWith('setMode:'))      { handlers.setMode(cmd.replace('setMode:', '')); return; }
  if (cmd.startsWith('setInput:'))     { handlers.setInput(cmd.replace('setInput:', '')); return; }
  switch (cmd) {
    case 'clearChat':    handlers.clearChat();    break;
    case 'openNav':      handlers.openNav();      break;
    case 'closeNav':     handlers.closeNav();     break;
    case 'openHistory':  handlers.openHistory();  break;
    case 'openSettings': handlers.navigate('/settings'); break;
    case 'openApps':     handlers.openApps();     break;
    case 'newChat':      handlers.newChat();      break;
    case 'stopSpeaking': handlers.stopSpeaking(); break;
    case 'scrollTop':    handlers.scrollTop();    break;
    case 'scrollBottom': handlers.scrollBottom(); break;
  }
}

// ── Compress message (user ki message compress karo before send) ──────────
export type CompressLevel = 'tiny' | 'short' | 'medium';

export function compressUserMessage(msg: string, level: CompressLevel): string {
  const words = msg.trim().split(/\s+/);

  switch (level) {
    case 'tiny':
      // Sirf main keyword — 3-5 words
      if (words.length <= 5) return msg;
      // Remove filler words
      const FILLERS = ['kya','hai','ho','kar','karo','mujhe','please','bata','batao','do','de','dena','ji','ek','ek','se'];
      const filtered = words.filter(w => !FILLERS.includes(w.toLowerCase()));
      return filtered.slice(0, 5).join(' ');

    case 'short':
      // ~40% of original — max 15 words
      if (words.length <= 15) return msg;
      return words.slice(0, Math.ceil(words.length * 0.4)).join(' ') + '...';

    case 'medium':
      // ~60% of original — max 30 words
      if (words.length <= 30) return msg;
      return words.slice(0, Math.ceil(words.length * 0.6)).join(' ') + '...';

    default:
      return msg;
  }
}

// Connected Apps — indirect connection like ChatGPT Canvas
// User ek baar "connect" karta hai, phir automatically use hota hai
export interface ConnectedApp {
  id:           string;
  name:         string;
  icon:         string;
  connected:    boolean;
  lastUsed?:    number;
  autoTrigger?: string[];  // keywords jo is app ko trigger karte hain
}

export const CONNECTABLE_APPS: Omit<ConnectedApp, 'connected'>[] = [
  { id: 'pollinations', name: 'Pollinations AI',  icon: '🎨', autoTrigger: ['image banao', 'draw', 'generate image', 'photo banao'] },
  { id: 'wttr',         name: 'Weather (wttr.in)', icon: '🌤️', autoTrigger: ['weather', 'mausam', 'temperature'] },
  { id: 'gnews',        name: 'Google News',       icon: '📰', autoTrigger: ['news', 'khabar', 'latest news'] },
  { id: 'wolfram',      name: 'Wolfram Alpha',      icon: '🔢', autoTrigger: ['calculate', 'solve', 'math', 'equation'] },
  { id: 'youtube',      name: 'YouTube',            icon: '▶️', autoTrigger: ['youtube', 'video', 'watch'] },
  { id: 'spotify',      name: 'Spotify',            icon: '🎵', autoTrigger: ['song', 'music', 'playlist', 'gaana'] },
  { id: 'desmos',       name: 'Desmos Graph',       icon: '📈', autoTrigger: ['graph', 'plot', 'function graph'] },
  { id: 'replit',       name: 'Replit',             icon: '💻', autoTrigger: ['run code', 'execute', 'repl', 'compiler'] },
];

// Auto-detect which app to trigger from message
export function detectAutoApp(msg: string): string | null {
  const m = msg.toLowerCase();
  for (const app of CONNECTABLE_APPS) {
    if (app.autoTrigger?.some(t => m.includes(t))) return app.id;
  }
  return null;
}
