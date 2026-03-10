/* app/api/title/route.ts — AI Session Title generator (Groq, background) */
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    if (!message) return Response.json({ title: 'New Chat' });

    const key = process.env.GROQ_API_KEY;
    if (!key) return Response.json({ title: generateLocalTitle(message) });

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Generate a very short, crisp chat title (max 5 words, no quotes, no punctuation at end). Hindi or English based on user message.' },
          { role: 'user', content: message.slice(0, 200) },
        ],
        max_tokens: 20,
        temperature: 0.5,
      }),
    });

    if (!res.ok) return Response.json({ title: generateLocalTitle(message) });

    const data = await res.json();
    const title = data?.choices?.[0]?.message?.content?.trim().replace(/['"]/g, '').slice(0, 40);
    return Response.json({ title: title || generateLocalTitle(message) });

  } catch {
    return Response.json({ title: 'New Chat' });
  }
}

// Instant local title (keyword-based, zero API)
function generateLocalTitle(msg: string): string {
  const m = msg.toLowerCase().trim();
  if (m.includes('weather') || m.includes('mausam')) return '🌤️ Weather';
  if (m.includes('neet') || m.includes('biology') || m.includes('chemistry')) return '📚 NEET Study';
  if (m.includes('image') || m.includes('generate') || m.includes('draw')) return '🎨 AI Image';
  if (m.includes('code') || m.includes('program') || m.includes('function')) return '💻 Code Help';
  if (m.includes('crypto') || m.includes('bitcoin') || m.includes('stock')) return '💰 Finance';
  if (m.includes('news') || m.includes('khabar')) return '📰 News';
  if (m.includes('recipe') || m.includes('khana') || m.includes('food')) return '🍳 Recipe';
  if (m.includes('joke') || m.includes('funny')) return '😂 Jokes';
  if (m.includes('movie') || m.includes('film')) return '🎬 Movies';
  if (m.includes('song') || m.includes('music') || m.includes('gaana')) return '🎵 Music';
  if (m.includes('translate') || m.includes('hindi') || m.includes('english')) return '🌐 Translation';
  if (m.includes('math') || m.includes('calculate') || m.includes('solve')) return '🧮 Math';
  if (m.includes('hello') || m.includes('hi') || m.includes('namaste')) return '👋 Greetings';
  // First 4 words fallback
  const words = msg.split(' ').slice(0, 4).join(' ');
  return words.length > 3 ? words.charAt(0).toUpperCase() + words.slice(1) : 'New Chat';
}
