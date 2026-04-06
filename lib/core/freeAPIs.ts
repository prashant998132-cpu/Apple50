// lib/core/freeAPIs.ts — All Free APIs, No Key Needed
// Smart routing with fallbacks for every category

const T = 5000 // default timeout

async function get(url: string, timeout = T): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout) })
  if (!res.ok) throw new Error(res.status.toString())
  return res.json()
}

// ── WEATHER ─────────────────────────────────────────────────────────
export async function getWeather(city: string): Promise<string> {
  // Try Open-Meteo (most accurate, no key)
  try {
    const geo = await get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`)
    const loc = geo.results?.[0]
    if (loc) {
      const w = await get(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=3&timezone=Asia/Kolkata`)
      const c = w.current
      const wCodes: Record<number,string> = {0:'☀️ Clear',1:'🌤️ Clear',2:'⛅ Cloudy',3:'☁️ Overcast',45:'🌫️ Fog',51:'🌦️ Drizzle',61:'🌧️ Rain',71:'🌨️ Snow',80:'🌧️ Showers',95:'⛈️ Thunderstorm',99:'⛈️ Heavy storm'}
      const desc = wCodes[c.weather_code] || '🌡️'
      const days = w.daily
      return `${desc} **${c.temperature_2m}°C** (feels ${c.apparent_temperature}°C)\n` +
        `Humidity: ${c.relative_humidity_2m}% · Wind: ${c.wind_speed_10m}km/h\n\n` +
        `**3-day forecast:**\n` +
        [0,1,2].map(i => `${new Date(days.time[i]).toLocaleDateString('en-IN',{weekday:'short'})}: ${days.temperature_2m_min[i]}° – ${days.temperature_2m_max[i]}°C · Rain: ${days.precipitation_sum[i]}mm`).join('\n')
    }
  } catch {}
  // Fallback wttr.in
  try {
    const d = await get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`)
    const c = d.current_condition?.[0]
    return `🌡️ **${c?.temp_C}°C** · ${c?.weatherDesc?.[0]?.value}\nHumidity: ${c?.humidity}% · Wind: ${c?.windspeedKmph}km/h`
  } catch { return `Weather data nahi mila for "${city}"` }
}

// ── CURRENCY ─────────────────────────────────────────────────────────
export async function getCurrency(amount: number, from: string, to: string): Promise<string> {
  try {
    const d = await get(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`)
    const rate = d.rates?.[to.toUpperCase()]
    if (!rate) throw new Error('no rate')
    const result = (amount * rate).toFixed(2)
    return `💱 **${amount} ${from.toUpperCase()} = ${result} ${to.toUpperCase()}**\nRate: 1 ${from.toUpperCase()} = ${rate.toFixed(4)} ${to.toUpperCase()}\n_Updated: ${new Date().toLocaleDateString('en-IN')}_`
  } catch {
    return `Currency "${from}" → "${to}" nahi mila`
  }
}

// ── CRYPTO ───────────────────────────────────────────────────────────
const COIN_IDS: Record<string,string> = { bitcoin:'bitcoin', btc:'bitcoin', eth:'ethereum', ethereum:'ethereum', bnb:'binancecoin', sol:'solana', xrp:'ripple', doge:'dogecoin', ada:'cardano', matic:'matic-network', dot:'polkadot', ltc:'litecoin', shib:'shiba-inu', avax:'avalanche-2' }

export async function getCrypto(coin: string): Promise<string> {
  const id = COIN_IDS[coin.toLowerCase()] || coin.toLowerCase()
  try {
    const d = await get(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=inr,usd&include_24hr_change=true&include_market_cap=true`)
    const data = d[id]
    if (!data) return `"${coin}" ka price nahi mila`
    const change = data.usd_24h_change?.toFixed(2)
    const arrow = change > 0 ? '📈' : '📉'
    return `₿ **${id.charAt(0).toUpperCase() + id.slice(1)}**\n₹${data.inr?.toLocaleString('en-IN')} | $${data.usd?.toLocaleString()}\n${arrow} 24h: ${change}%`
  } catch { return `${coin} ka crypto price nahi mila` }
}

// ── NEWS ─────────────────────────────────────────────────────────────
// ── GNEWS (with API key) ─────────────────────────────────────────────
export async function getGNews(query: string = 'india'): Promise<string> {
  try {
    if (typeof window !== 'undefined') {
      const key = localStorage.getItem('jarvis_key_GNEWS_API_KEY')
      if (key) {
        const lang = 'hi,en'
        const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&country=in&max=5&apikey=${key}`
        const d = await get(url, 8000)
        if (d.articles?.length) {
          return '📰 **GNews — ' + query + ':**
' + d.articles.map((a: any, i: number) =>
            `${i+1}. **${a.title}**
   ${a.source.name} · ${new Date(a.publishedAt).toLocaleDateString('en-IN')}`
          ).join('

')
        }
      }
    }
  } catch {}
  return ''
}

export async function getNews(query?: string): Promise<string> {
  try {
    let url = 'https://hacker-news.firebaseio.com/v0/topstories.json'
    const ids = await get(url)
    const stories = await Promise.all(ids.slice(0, 6).map((id: number) =>
      get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, 3000)
    ))
    const filtered = query
      ? stories.filter((s: any) => s.title?.toLowerCase().includes(query.toLowerCase()))
      : stories
    const list = (filtered.length ? filtered : stories).slice(0, 5)
    return '📰 **Top Stories:**\n' + list.map((s: any, i: number) => `${i+1}. ${s.title}\n   ⬆${s.score} · ${s.by}`).join('\n\n')
  } catch { return 'News fetch nahi ho saki' }
}

// ── DICTIONARY ───────────────────────────────────────────────────────
export async function getDictionary(word: string): Promise<string> {
  try {
    const d = await get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`)
    if (!Array.isArray(d) || !d[0]) return `"${word}" ka meaning nahi mila`
    const e = d[0]
    const meanings = e.meanings?.slice(0, 2).map((m: any) =>
      `**${m.partOfSpeech}:** ${m.definitions[0]?.definition}${m.definitions[0]?.example ? `\n_"${m.definitions[0].example}"_` : ''}`
    ).join('\n\n')
    const synonyms = e.meanings?.[0]?.synonyms?.slice(0, 4).join(', ')
    return `📖 **${e.word}** ${e.phonetic || ''}\n\n${meanings}${synonyms ? '\n\n**Synonyms:** ' + synonyms : ''}`
  } catch { return `"${word}" ka meaning nahi mila` }
}

// ── COUNTRY INFO ─────────────────────────────────────────────────────
export async function getCountryInfo(name: string): Promise<string> {
  try {
    const d = await get(`https://restcountries.com/v3.1/search?name=${encodeURIComponent(name)}&fields=name,capital,population,area,currencies,languages,flags,region,flag`)
    if (!d[0]) return `"${name}" country nahi mili`
    const c = d[0]
    const currency = Object.values(c.currencies || {})[0] as any
    const langs = Object.values(c.languages || {}).slice(0, 3).join(', ')
    return `${c.flag || '🌍'} **${c.name?.common}** (${c.region})\n` +
      `🏛️ Capital: ${c.capital?.[0] || 'N/A'}\n` +
      `👥 Population: ${c.population?.toLocaleString('en-IN')}\n` +
      `📐 Area: ${c.area?.toLocaleString()} km²\n` +
      `💰 Currency: ${currency?.name || 'N/A'} (${currency?.symbol || ''})\n` +
      `🗣️ Language: ${langs}`
  } catch { return `${name} ki info nahi mili` }
}

// ── RANDOM ADVICE ────────────────────────────────────────────────────
export async function getAdvice(): Promise<string> {
  try {
    const d = await get('https://api.adviceslip.com/advice')
    return `💡 **Advice of the moment:**\n_"${d.slip?.advice}"_`
  } catch { return '💡 Koi bhi kaam shuru karo — bas start karo.' }
}

// ── QUOTES ───────────────────────────────────────────────────────────
export async function getQuote(tag?: string): Promise<string> {
  try {
    const url = tag ? `https://api.quotable.io/random?tags=${tag}` : 'https://api.quotable.io/random'
    const d = await get(url)
    return `✨ _"${d.content}"_\n— **${d.author}**`
  } catch {
    const offline = [
      '"The only way to do great work is to love what you do." — Steve Jobs',
      '"In the middle of difficulty lies opportunity." — Einstein',
      '"Kaam karo, shikayat nahi." — JARVIS',
    ]
    return '✨ ' + offline[Math.floor(Math.random() * offline.length)]
  }
}

// ── JOKES ────────────────────────────────────────────────────────────
export async function getJoke(): Promise<string> {
  try {
    const d = await get('https://v2.jokeapi.dev/joke/Any?safe-mode&lang=en&type=twopart')
    if (d.setup && d.delivery) return `😂 **${d.setup}**\n\n_${d.delivery}_`
    return `😂 ${d.joke}`
  } catch { return '😂 Joke: JARVIS aur ek AI ek bar mile... JARVIS ne kaha "Main better hoon." AI ne kaha "Agree."' }
}

// ── NUMBER FACTS ─────────────────────────────────────────────────────
export async function getNumberFact(n: number): Promise<string> {
  try {
    const d = await fetch(`http://numbersapi.com/${n}`, { signal: AbortSignal.timeout(4000) })
    return `🔢 ${await d.text()}`
  } catch { return `🔢 ${n} ek achha number hai!` }
}

// ── QR CODE ──────────────────────────────────────────────────────────
export function getQRUrl(text: string, size = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=060610&color=00d4ff&qzone=1`
}

// ── ISS LOCATION ─────────────────────────────────────────────────────
export async function getISS(): Promise<string> {
  try {
    const d = await get('http://api.open-notify.org/iss-now.json')
    const { latitude, longitude } = d.iss_position
    return `🛸 **ISS abhi yahan hai:**\nLatitude: ${parseFloat(latitude).toFixed(4)}°\nLongitude: ${parseFloat(longitude).toFixed(4)}°\n_[Maps pe dekho](https://maps.google.com/?q=${latitude},${longitude})_`
  } catch { return '🛸 ISS location fetch nahi hui' }
}

// ── SMART ROUTER — auto-detect query type and call right API ─────────
export async function smartAPIRouter(query: string): Promise<string | null> {
  const q = query.toLowerCase()

  // Weather
  if (/weather|mausam|temperature|barish|garmi|sardi|forecast/i.test(query)) {
    const cityMatch = query.match(/(?:of|in|at|ka|mein|for|in)\s+(\w+)/i)
    return getWeather(cityMatch?.[1] || 'Maihar')
  }

  // Currency
  const currMatch = query.match(/(\d+(?:\.\d+)?)\s*([a-z]{3})\s+(?:to|mein|ka|in)\s+([a-z]{3})/i)
  if (currMatch) return getCurrency(parseFloat(currMatch[1]), currMatch[2], currMatch[3])
  if (/exchange|currency|dollar|euro|pound|yen|rupee.*rate/i.test(q)) return getCurrency(1, 'USD', 'INR')

  // Crypto
  if (/bitcoin|btc|ethereum|eth|crypto|coin.*price|doge|solana|bnb/i.test(q)) {
    const coin = q.match(/\b(bitcoin|btc|ethereum|eth|doge|solana|bnb|ada|xrp)\b/)?.[1] || 'bitcoin'
    return getCrypto(coin)
  }

  // News
  if (/news|khabar|headlines|today.*news|latest/i.test(q)) return getNews()

  // Dictionary
  const wordMatch = query.match(/(?:meaning|matlab|define|definition|kya hota)\s+(?:of\s+)?(\w+)/i)
  if (wordMatch) return getDictionary(wordMatch[1])

  // Country
  const countryMatch = query.match(/(?:about|info|details?)\s+(?:of\s+)?([a-z\s]+)\s+(?:country|desh|nation)/i)
  if (countryMatch) return getCountryInfo(countryMatch[1].trim())

  // ISS
  if (/iss|space station|international space/i.test(q)) return getISS()

  // Advice
  if (/advice|sujhaav|suggestion|kya karu|help me decide/i.test(q)) return getAdvice()

  // Quote
  if (/quote|motivat|inspirat|suvichar|anmol vachan/i.test(q)) return getQuote()

  // Joke
  if (/joke|chutkula|funny|hasao|haha/i.test(q)) return getJoke()

  return null
}
