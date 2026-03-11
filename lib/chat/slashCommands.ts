// lib/chat/slashCommands.ts — 9 Slash Commands (v16 Gold)
// All zero-cost: client-side APIs, no Vercel bandwidth
// Commands: /nasa /wiki /joke /shayari /map /quote /qr /meaning /search /img

export interface SlashResult {
  type: 'text' | 'image' | 'map' | 'qr' | 'special'
  content: string    // text or HTML or URL
  provider: string
  title?: string
}

// ── /nasa — NASA APOD (Astronomy Photo of the Day) ────────
export async function cmdNasa(apiKey?: string): Promise<SlashResult> {
  const key = apiKey || 'DEMO_KEY'
  const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${key}`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error('nasa_' + res.status)
  const data = await res.json()
  const isVideo = data.media_type === 'video'
  return {
    type: isVideo ? 'text' : 'image',
    content: isVideo
      ? `🚀 **NASA APOD** — ${data.title}\n\n${data.explanation?.slice(0, 300)}...\n\n[Watch Video](${data.url})`
      : data.url,
    title: `🚀 ${data.title}`,
    provider: 'NASA APOD API (Free)',
  }
}

// ── /wiki — Wikipedia Summary ─────────────────────────────
export async function cmdWiki(query: string): Promise<SlashResult> {
  const q = encodeURIComponent(query)
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&exchars=400&titles=${q}&origin=*`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) throw new Error('wiki_fail')
  const data = await res.json()
  const pages = data.query?.pages || {}
  const page  = Object.values(pages)[0] as any
  if (!page || page.missing) throw new Error('wiki_not_found')
  // Strip HTML tags
  const text = (page.extract || '').replace(/<[^>]+>/g, '').trim().slice(0, 400)
  return {
    type: 'text',
    content: `📖 **${page.title}**\n\n${text}...\n\n[Wikipedia पर पढ़ें](https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)})`,
    provider: 'Wikipedia API (Free)',
  }
}

// ── /joke — Random Clean Joke ─────────────────────────────
export async function cmdJoke(): Promise<SlashResult> {
  const res = await fetch('https://v2.jokeapi.dev/joke/Any?safe-mode&type=twopart,single', {
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) throw new Error('joke_fail')
  const data = await res.json()
  let joke = ''
  if (data.type === 'twopart') {
    joke = `😂 **${data.setup}**\n\n👉 ${data.delivery}`
  } else {
    joke = `😂 ${data.joke}`
  }
  return { type: 'text', content: joke, provider: 'JokeAPI.dev (Free)' }
}

// ── /quote — Inspirational Quote ─────────────────────────
export async function cmdQuote(): Promise<SlashResult> {
  try {
    const res = await fetch('https://zenquotes.io/api/random', { signal: AbortSignal.timeout(6000) })
    if (!res.ok) throw new Error()
    const [data] = await res.json()
    return {
      type: 'text',
      content: `✨ *"${data.q}"*\n\n— **${data.a}**`,
      provider: 'ZenQuotes.io (Free)',
    }
  } catch {
    // Fallback hardcoded
    const quotes = [
      { q: 'The only way to do great work is to love what you do.', a: 'Steve Jobs' },
      { q: 'In the middle of every difficulty lies opportunity.', a: 'Albert Einstein' },
      { q: 'Padhai kar, chhod mat.', a: 'Jons Bhai' },
      { q: 'Success is not final, failure is not fatal.', a: 'Winston Churchill' },
    ]
    const q = quotes[Math.floor(Math.random() * quotes.length)]
    return { type: 'text', content: `✨ *"${q.q}"*\n\n— **${q.a}**`, provider: 'Fallback' }
  }
}

// ── /map — Google Maps Embed ──────────────────────────────
export async function cmdMap(place: string): Promise<SlashResult> {
  const q = encodeURIComponent(place)
  const embedUrl = `https://maps.google.com/maps?q=${q}&output=embed&z=14`
  return {
    type: 'map',
    content: embedUrl,
    title: `📍 ${place}`,
    provider: 'Google Maps (Free embed)',
  }
}

// ── /qr — QR Code Generator (client-side) ─────────────────
export async function cmdQR(text: string): Promise<SlashResult> {
  // Use QR Server API (no key, free)
  const q = encodeURIComponent(text.trim())
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${q}`
  return {
    type: 'image',
    content: url,
    title: `📱 QR Code: ${text.slice(0, 30)}`,
    provider: 'QR Server API (Free)',
  }
}

// ── /meaning — Dictionary ─────────────────────────────────
export async function cmdMeaning(word: string): Promise<SlashResult> {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.trim())}`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) throw new Error('dict_not_found')
  const [entry] = await res.json()
  const meanings = entry.meanings?.slice(0, 2).map((m: any) => {
    const def = m.definitions?.[0]
    return `**${m.partOfSpeech}**: ${def?.definition || ''}${def?.example ? `\n*Example: "${def.example}"*` : ''}`
  }).join('\n\n') || 'Definition not found'
  const phonetic = entry.phonetics?.find((p: any) => p.text)?.text || ''
  return {
    type: 'text',
    content: `📚 **${entry.word}** ${phonetic}\n\n${meanings}`,
    provider: 'Free Dictionary API',
  }
}

// ── /search — Web Search ──────────────────────────────────
export async function cmdSearch(query: string, braveKey?: string): Promise<SlashResult> {
  if (braveKey) {
    try {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
        { headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip', 'X-Subscription-Token': braveKey }, signal: AbortSignal.timeout(8000) }
      )
      if (res.ok) {
        const data = await res.json()
        const results = data.web?.results?.slice(0, 4).map((r: any) =>
          `• **[${r.title}](${r.url})**\n  ${r.description?.slice(0, 100) || ''}`
        ).join('\n\n') || 'No results'
        return { type: 'text', content: `🔍 **Search: ${query}**\n\n${results}`, provider: 'Brave Search' }
      }
    } catch {}
  }
  // DuckDuckGo Instant Answers (no key)
  const res = await fetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
    { signal: AbortSignal.timeout(8000) }
  )
  const data = await res.json()
  const answer = data.AbstractText || data.Answer || `No instant answer. [Search on DuckDuckGo](https://duckduckgo.com/?q=${encodeURIComponent(query)})`
  return {
    type: 'text',
    content: `🔍 **${query}**\n\n${answer.slice(0, 500)}`,
    provider: 'DuckDuckGo (Free)',
  }
}

// ── /shayari — AI-generated Hindi/Urdu Shayari ────────────
export async function cmdShayari(groqKey?: string): Promise<SlashResult> {
  const topics = ['zindagi', 'mohabbat', 'dost', 'sapne', 'mushkil', 'kamyabi', 'raat']
  const topic  = topics[Math.floor(Math.random() * topics.length)]
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'Tu ek ustaad shayar hai. Sirf Urdu/Hindi mein 4-line shayari likho. Koi explanation mat do.' },
            { role: 'user', content: `${topic} par ek beautiful 4-line shayari likho` }
          ],
          max_tokens: 150, temperature: 1.0,
        }),
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) {
        const data = await res.json()
        const shayari = data.choices?.[0]?.message?.content?.trim()
        if (shayari) return { type: 'text', content: `🌹 *${shayari}*`, provider: 'Groq AI Shayari' }
      }
    } catch {}
  }
  // Fallback hardcoded shayaris
  const shayaris = [
    'Zindagi ek kitaab hai,\nHar din ek naya safha.\nPadh lo ise dil se,\nKoi bhi pal na jaye befaida.',
    'Raat ki khamoshi mein,\nSitaare baat karte hain.\nSapne aankhon mein lekar,\nKamyabi ki raah chalte hain.',
    'Mushkil hai raasta magar,\nManzil bhi koi hai to.\nHimmat rakh, chalta chal,\nSunne mein kuch awaaz hai to.',
    'Dost milte hain aise,\nJaise rooh ko chain mile.\nSaath rahen ya na rahen,\nYaadein kabhi nahi bhige.',
  ]
  const s = shayaris[Math.floor(Math.random() * shayaris.length)]
  return { type: 'text', content: `🌹 *${s}*`, provider: 'Built-in Shayari' }
}

// ── /img — DALL-E 3 via Puter (better quality) ────────────
export async function cmdImgDalle(prompt: string): Promise<SlashResult> {
  // This needs Puter.js loaded — returns imageUrl or null
  // Called from chat page which has access to puter
  return {
    type: 'special',
    content: `PUTER_IMAGE:${prompt}`,
    provider: 'Puter DALL-E 3 (Free)',
  }
}

// ── /app — Universal app launcher ───────────────────────
export async function cmdApp(appId: string, query?: string): Promise<SlashResult> {
  const appMap: Record<string, {url:(q?:string)=>string; name:string}> = {
    // AI
    chatgpt:     { name:'ChatGPT',          url:(q)=>q?`https://chat.openai.com/?q=${encodeURIComponent(q)}`:'https://chat.openai.com' },
    gemini:      { name:'Gemini',           url:(q)=>q?`https://gemini.google.com/app?q=${encodeURIComponent(q)}`:'https://gemini.google.com' },
    perplexity:  { name:'Perplexity',       url:(q)=>q?`https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`:'https://perplexity.ai' },
    claude:      { name:'Claude',           url:()=>'https://claude.ai/new' },
    // Design
    figma:       { name:'Figma',            url:()=>'https://www.figma.com/design/new' },
    excalidraw:  { name:'Excalidraw',       url:()=>'https://excalidraw.com' },
    // Code
    github:      { name:'GitHub',           url:(q)=>q?`https://github.com/search?q=${encodeURIComponent(q)}`:'https://github.com/new' },
    replit:      { name:'Replit',           url:()=>'https://replit.com/new' },
    codepen:     { name:'CodePen',          url:()=>'https://codepen.io/pen/' },
    gist:        { name:'GitHub Gist',      url:()=>'https://gist.github.com' },
    colab:       { name:'Google Colab',     url:()=>'https://colab.research.google.com/#create=true' },
    python:      { name:'Python (Colab)',   url:()=>'https://colab.research.google.com/#create=true' },
    // Docs
    gdocs:       { name:'Google Docs',      url:()=>'https://docs.new' },
    gsheets:     { name:'Google Sheets',    url:()=>'https://sheets.new' },
    gslides:     { name:'Google Slides',    url:()=>'https://slides.new' },
    notion:      { name:'Notion',           url:()=>'https://notion.so/new' },
    // Math
    wolfram:     { name:'Wolfram Alpha',    url:(q)=>q?`https://www.wolframalpha.com/input?i=${encodeURIComponent(q)}`:'https://wolframalpha.com' },
    desmos:      { name:'Desmos Graphing',  url:()=>'https://www.desmos.com/calculator' },
    graph:       { name:'Desmos',           url:(q)=>q?`https://www.desmos.com/calculator?${encodeURIComponent(q)}`:'https://www.desmos.com/calculator' },
    // PDF
    pdf:         { name:'iLovePDF',         url:()=>'https://www.ilovepdf.com' },
    ilovepdf:    { name:'iLovePDF',         url:()=>'https://www.ilovepdf.com' },
    // Translate
    translate:   { name:'Google Translate', url:(q)=>q?`https://translate.google.com/?sl=auto&tl=hi&text=${encodeURIComponent(q)}`:'https://translate.google.com' },
    hindi:       { name:'Translate→Hindi',  url:(q)=>q?`https://translate.google.com/?sl=en&tl=hi&text=${encodeURIComponent(q)}`:'https://translate.google.com/?sl=en&tl=hi' },
    english:     { name:'Translate→English',url:(q)=>q?`https://translate.google.com/?sl=hi&tl=en&text=${encodeURIComponent(q)}`:'https://translate.google.com/?sl=hi&tl=en' },
    // Images
    unsplash:    { name:'Unsplash',         url:(q)=>q?`https://unsplash.com/s/photos/${encodeURIComponent(q)}`:'https://unsplash.com' },
    pexels:      { name:'Pexels',           url:(q)=>q?`https://www.pexels.com/search/${encodeURIComponent(q)}/`:'https://pexels.com' },
    // Media
    youtube:     { name:'YouTube',          url:(q)=>q?`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`:'https://youtube.com' },
    spotify:     { name:'Spotify',          url:(q)=>q?`https://open.spotify.com/search/${encodeURIComponent(q)}`:'https://open.spotify.com' },
    // Calendar
    calendar:    { name:'Google Calendar',  url:()=>'https://calendar.google.com/calendar/r/eventedit' },
    gcal:        { name:'Google Calendar',  url:()=>'https://calendar.google.com/calendar/r/eventedit' },
    // India
    irctc:       { name:'IRCTC',            url:()=>'https://www.irctc.co.in/nget/train-search' },
    train:       { name:'IRCTC Trains',     url:()=>'https://www.irctc.co.in/nget/train-search' },
    pnr:         { name:'PNR Status',       url:()=>'https://www.irctc.co.in/nget/pnr-status' },
    digilocker:  { name:'DigiLocker',       url:()=>'https://www.digilocker.gov.in' },
    nta:         { name:'NTA NEET',         url:()=>'https://neet.nta.nic.in' },
    neet:        { name:'NEET Portal',      url:()=>'https://neet.nta.nic.in' },
    // Communication
    whatsapp:    { name:'WhatsApp Web',     url:()=>'https://web.whatsapp.com' },
    wa:          { name:'WhatsApp Web',     url:(q)=>q?`https://wa.me/${q.replace(/\D/g,'')}`:'https://web.whatsapp.com' },
    telegram:    { name:'Telegram Web',     url:()=>'https://web.telegram.org' },
    // Apps hub
    apps:        { name:'Apps Hub',         url:()=>'/apps' },
  }

  const app = appMap[appId.toLowerCase()]
  if (!app) return { type:'text', content:`❓ "${appId}" app nahi mila. /apps se sab dekho.`, provider:'JARVIS' }

  const url = app.url(query)
  const isExternal = url.startsWith('http')
  return {
    type: 'special',
    content: `OPEN_APP:${url}:${app.name}`,
    provider: 'JARVIS Apps Hub',
    title: `${app.name} khul raha hai...`,
  }
}

// ── /canva — Open Canva with AI design brief ─────────────
export async function cmdCanva(query: string): Promise<SlashResult> {
  if (!query.trim()) {
    return {
      type: 'special',
      content: 'CANVA_GALLERY:all',
      provider: 'Canva Integration',
      title: '🎨 Canva Design Studio',
    }
  }
  return {
    type: 'special',
    content: `CANVA_BRIEF:${query}`,
    provider: 'Canva Integration',
    title: `🎨 Canva: ${query.slice(0, 40)}`,
  }
}

// ════════════════════════════════════════════════════════
// Main parser — call this before regular send
// Returns null if not a slash command
// ════════════════════════════════════════════════════════
export interface ParsedCommand {
  cmd: string
  arg: string
  isSlash: boolean
}

export function parseSlashCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null
  const spaceIdx = trimmed.indexOf(' ')
  const cmd  = spaceIdx > 0 ? trimmed.slice(1, spaceIdx).toLowerCase() : trimmed.slice(1).toLowerCase()
  const arg  = spaceIdx > 0 ? trimmed.slice(spaceIdx + 1).trim() : ''
  const KNOWN = [
    'nasa','wiki','joke','shayari','map','quote','qr','meaning','search','img','image',
    'summarize','calc',
    // App shortcuts
    'canva','design',           // Design
    'figma','excalidraw',       // Design
    'chatgpt','gemini','claude','perplexity', // AI
    'github','gist','replit','codepen',       // Code
    'gdocs','gsheets','gslides','notion',     // Docs
    'colab','python',                         // Code/ML
    'wolfram','desmos','graph', // Math
    'pdf','ilovepdf',           // PDF
    'translate','hindi','english', // Translate
    'unsplash','pexels',        // Images
    'youtube','spotify',        // Media
    'calendar','gcal',          // Calendar
    'irctc','train','pnr',      // India travel
    'digilocker','nta','neet',  // India govt
    'whatsapp','wa','telegram', // Communication
    'open',                     // Generic open
    'apps',                     // Hub
  ]
  if (!KNOWN.includes(cmd)) return null
  return { cmd, arg, isSlash: true }
}

// All available commands for autocomplete
export const SLASH_COMMANDS = [
  { cmd: '/nasa',         desc: 'NASA ka aaj ka space photo',          icon: '🚀' },
  { cmd: '/wiki',         desc: '/wiki [topic] — Wikipedia summary',    icon: '📖' },
  { cmd: '/joke',         desc: 'Ek random joke suno',                  icon: '😂' },
  { cmd: '/shayari',      desc: 'AI-generated Hindi/Urdu shayari',      icon: '🌹' },
  { cmd: '/map',          desc: '/map [jagah] — Google Maps dikhao',    icon: '📍' },
  { cmd: '/quote',        desc: 'Inspirational quote',                  icon: '✨' },
  { cmd: '/qr',           desc: '/qr [text] — QR code banao',           icon: '📱' },
  { cmd: '/meaning',      desc: '/meaning [word] — Dictionary',         icon: '📚' },
  { cmd: '/search',       desc: '/search [query] — Web search',         icon: '🔍' },
  { cmd: '/img',          desc: '/img [prompt] — DALL-E 3 image',       icon: '🎨' },
  { cmd: '/image',        desc: '/image [prompt] — Pollinations image', icon: '🖼️' },
  { cmd: '/canva',        desc: '/canva [design idea] — Canva mein design kholo', icon: '🎨' },
  { cmd: '/design',       desc: '/design [type] — Canva templates browse karo',   icon: '✏️' },
  { cmd: '/chatgpt',      desc: '/chatgpt [query] — ChatGPT mein kholo',          icon: '🤖' },
  { cmd: '/gemini',       desc: '/gemini [query] — Gemini mein kholo',            icon: '🌟' },
  { cmd: '/wolfram',      desc: '/wolfram [formula] — Wolfram Alpha compute',     icon: '🧮' },
  { cmd: '/desmos',       desc: '/desmos — Graphing calculator kholo',            icon: '📈' },
  { cmd: '/github',       desc: '/github [query] — GitHub search / new repo',     icon: '🐙' },
  { cmd: '/replit',       desc: '/replit — Browser IDE mein code karo',           icon: '🔄' },
  { cmd: '/translate',    desc: '/translate [text] — Google Translate',           icon: '🌐' },
  { cmd: '/youtube',      desc: '/youtube [query] — YouTube search',              icon: '▶️' },
  { cmd: '/irctc',        desc: '/irctc — IRCTC train ticket booking',            icon: '🚂' },
  { cmd: '/train',        desc: '/train — IRCTC train search',                    icon: '🚂' },
  { cmd: '/pnr',          desc: '/pnr — PNR status check',                        icon: '🎫' },
  { cmd: '/pdf',          desc: '/pdf — iLovePDF tools',                          icon: '📄' },
  { cmd: '/unsplash',     desc: '/unsplash [topic] — Free HD photos search',      icon: '📷' },
  { cmd: '/apps',         desc: 'Saare app integrations dekho',                   icon: '🔗' },
]
