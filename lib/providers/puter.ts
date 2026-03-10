/* lib/providers/puter.ts — Puter.js pre-loader */

declare global {
  interface Window {
    puter?: any;
  }
}

let puterLoaded = false;
let puterLoading = false;
const loadCallbacks: Array<() => void> = [];

export function loadPuter(): Promise<any> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(null); return; }
    if (puterLoaded && window.puter) { resolve(window.puter); return; }
    if (puterLoading) { loadCallbacks.push(() => resolve(window.puter)); return; }

    puterLoading = true;

    const check = setInterval(() => {
      if (window.puter) {
        clearInterval(check);
        puterLoaded = true;
        puterLoading = false;
        loadCallbacks.forEach(cb => cb());
        loadCallbacks.length = 0;
        resolve(window.puter);
      }
    }, 200);

    setTimeout(() => {
      clearInterval(check);
      puterLoading = false;
      resolve(null);
    }, 10000);
  });
}

export async function puterChat(messages: any[], model = 'gpt-4o-mini'): Promise<string> {
  const puter = await loadPuter();
  if (!puter) throw new Error('Puter not available');

  try {
    const response = await puter.ai.chat(messages, { model });
    if (typeof response === 'string') return response;
    if (response?.message?.content) return response.message.content;
    if (response?.content) return response.content;
    return String(response);
  } catch (err) {
    throw new Error(`Puter chat failed: ${err}`);
  }
}

export async function puterImage(prompt: string): Promise<string> {
  const puter = await loadPuter();
  if (!puter) throw new Error('Puter not available');

  const result = await puter.ai.txt2img(prompt);
  if (result?.src) return result.src;
  if (typeof result === 'string') return result;
  throw new Error('Puter image failed');
}
