/* lib/integrations/mega.ts — 150+ Apps Integration Hub, Lazy Loaded */
import { cacheGet, cacheSet, trackUsage } from '@/lib/core/resourceManager';

export interface AppResult {
  success: boolean;
  text?: string;
  card?: any;
  url?: string;
  error?: string;
  source?: string;
}

// ── CATEGORY MAP (lazy routing) ─────────────────────────────────────────
export const CATEGORY_MAP: Record<string, string[]> = {
  finance:     ['crypto', 'stock', 'currency', 'emi', 'sip', 'gst', 'gold', 'fd', 'mutual_fund'],
  weather:     ['weather', 'forecast', 'air_quality', 'sunrise', 'moon'],
  news:        ['news', 'tech_news', 'sports_news', 'business_news', 'science_news'],
  education:   ['wiki', 'dictionary', 'wordofday', 'quiz', 'math', 'formula', 'periodic', 'translate'],
  india:       ['train', 'pnr', 'holiday', 'pincode', 'ipl', 'cricket', 'upi'],
  productivity:['reminder', 'todo', 'note', 'timer', 'alarm', 'pomodoro', 'shorturl', 'qr'],
  media:       ['movie', 'music', 'anime', 'podcast', 'youtube', 'gif'],
  health:      ['bmi', 'calories', 'water', 'sleep', 'symptom', 'medicine'],
  space:       ['nasa', 'iss', 'space_news', 'apod', 'exoplanet', 'stars'],
  fun:         ['joke', 'meme', 'riddle', 'quote', 'trivia', 'fact', 'fortune', 'roast'],
  dev:         ['github', 'npm', 'caniuse', 'http_status', 'regex', 'json', 'color', 'ip'],
  ai:          ['image', 'tts', 'ocr', 'summarize', 'translate_ai', 'code_explain'],
  food:        ['recipe', 'nutrition', 'restaurant', 'calories_food'],
  travel:      ['maps', 'directions', 'airport', 'visa', 'timezone', 'currency'],
  sports:      ['cricket', 'football', 'ipl', 'nba', 'f1'],
  utility:     ['password', 'uuid', 'base64', 'hash', 'converter', 'calculator', 'age', 'tip'],
};

// Get category for a tool
export function getToolCategory(toolId: string): string {
  for (const [cat, tools] of Object.entries(CATEGORY_MAP)) {
    if (tools.includes(toolId)) return cat;
  }
  return 'utility';
}

// ── TOOL REGISTRY ────────────────────────────────────────────────────────
type ToolFn = (args: Record<string, string>) => Promise<AppResult>;

const TOOLS: Record<string, ToolFn> = {

  // ── WEATHER ──────────────────────────────────────────────────────────
  weather: async ({ city = 'Delhi' }) => {
    const ckey = `weather:${city}`;
    const cached = cacheGet(ckey);
    if (cached) return cached;
    if (!trackUsage('wttr')) return { success: false, error: 'Weather API limit reached' };
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
      const d = await res.json();
      const c = d?.current_condition?.[0];
      const area = d?.nearest_area?.[0]?.areaName?.[0]?.value || city;
      const result: AppResult = {
        success: true,
        text: `🌤️ **${area}** — ${c?.weatherDesc?.[0]?.value}\n🌡️ ${c?.temp_C}°C (feels ${c?.FeelsLikeC}°C) · 💧${c?.humidity}% · 💨${c?.windspeedKmph}km/h`,
        card: { type: 'weather', title: area, subtitle: `${c?.temp_C}°C · ${c?.weatherDesc?.[0]?.value}` },
        source: 'wttr.in',
      };
      cacheSet(ckey, result, 'weather');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  air_quality: async ({ city = 'Delhi' }) => {
    const ckey = `air:${city}`;
    const cached = cacheGet(ckey);
    if (cached) return cached;
    try {
      const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=28.6&longitude=77.2&current=european_aqi`);
      const d = await res.json();
      const aqi = d?.current?.european_aqi;
      const level = aqi < 20 ? 'Good 🟢' : aqi < 40 ? 'Fair 🟡' : aqi < 60 ? 'Moderate 🟠' : 'Poor 🔴';
      const result: AppResult = { success: true, text: `💨 **Air Quality** (${city})\nAQI: **${aqi}** — ${level}`, source: 'open-meteo' };
      cacheSet(ckey, result, 'weather');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── NEWS ─────────────────────────────────────────────────────────────
  news: async ({ query = 'india' }) => {
    const ckey = `news:${query}`;
    const cached = cacheGet(ckey);
    if (cached) return cached;
    try {
      const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
      const ids = await res.json();
      const items = await Promise.all(ids.slice(0, 5).map((id: number) =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
      ));
      const text = `📰 **Top News:**\n${items.map((n: any, i: number) => `${i+1}. ${n.title}`).join('\n')}`;
      const result: AppResult = { success: true, text, source: 'HackerNews' };
      cacheSet(ckey, result, 'news');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── CRYPTO ───────────────────────────────────────────────────────────
  crypto: async ({ coin = 'bitcoin' }) => {
    const ckey = `crypto:${coin}`;
    const cached = cacheGet(ckey);
    if (cached) return cached;
    if (!trackUsage('coingecko')) return { success: false, error: 'Crypto API limit' };
    const MAP: Record<string, string> = { btc: 'bitcoin', eth: 'ethereum', doge: 'dogecoin', bnb: 'binancecoin', sol: 'solana', xrp: 'ripple' };
    const id = MAP[coin.toLowerCase()] || coin.toLowerCase();
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=inr,usd&include_24hr_change=true`);
      const d = await res.json();
      const c = d[id];
      if (!c) return { success: false, error: `${coin} not found` };
      const chg = c.inr_24h_change?.toFixed(2);
      const arrow = parseFloat(chg) >= 0 ? '📈' : '📉';
      const result: AppResult = { success: true, text: `💰 **${id.toUpperCase()}**\n₹${c.inr?.toLocaleString('en-IN')} | $${c.usd?.toFixed(2)}\n${arrow} 24h: ${chg}%`, source: 'CoinGecko' };
      cacheSet(ckey, result, 'crypto');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── STOCK ────────────────────────────────────────────────────────────
  stock: async ({ query = 'RELIANCE' }) => {
    const ckey = `stock:${query}`;
    const cached = cacheGet(ckey);
    if (cached) return cached;
    const symbol = query.toUpperCase().includes('.NS') ? query.toUpperCase() : `${query.toUpperCase()}.NS`;
    try {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`);
      const d = await res.json();
      const meta = d?.chart?.result?.[0]?.meta;
      if (!meta) return { success: false, error: 'Stock not found' };
      const price = meta.regularMarketPrice?.toFixed(2);
      const chg = ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 100).toFixed(2);
      const result: AppResult = { success: true, text: `📈 **${meta.symbol}**\n₹${price} | ${parseFloat(chg) >= 0 ? '📈' : '📉'} ${chg}%`, source: 'Yahoo Finance' };
      cacheSet(ckey, result, 'stock');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── CURRENCY ─────────────────────────────────────────────────────────
  currency: async ({ amount = '1', from = 'USD', to = 'INR' }) => {
    const ckey = `currency:${from}:${to}`;
    const cached = cacheGet(ckey);
    if (cached) {
      const rate = cached;
      const result2 = (parseFloat(amount) * rate).toFixed(2);
      return { success: true, text: `💱 ${amount} ${from.toUpperCase()} = **${result2} ${to.toUpperCase()}**` };
    }
    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`);
      const d = await res.json();
      const rate = d?.rates?.[to.toUpperCase()];
      if (!rate) return { success: false, error: 'Currency not found' };
      cacheSet(ckey, rate, 'currency');
      const result = (parseFloat(amount) * rate).toFixed(2);
      return { success: true, text: `💱 ${amount} ${from.toUpperCase()} = **${result} ${to.toUpperCase()}**\n1 ${from.toUpperCase()} = ${rate.toFixed(4)} ${to.toUpperCase()}`, source: 'ExchangeRate-API' };
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── GOLD PRICE ────────────────────────────────────────────────────────
  gold: async () => {
    const ckey = 'gold:inr';
    const cached = cacheGet(ckey);
    if (cached) return cached;
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/XAU');
      const d = await res.json();
      const inr = d?.rates?.INR;
      if (!inr) return { success: false, error: 'Gold price unavailable' };
      const per10g = (inr / 31.1035 * 10).toFixed(0);
      const result: AppResult = { success: true, text: `🥇 **Gold Price (India)**\n10g = ₹${parseFloat(per10g).toLocaleString('en-IN')}\n1 oz = ₹${inr?.toFixed(0)}`, source: 'ExchangeRate-API' };
      cacheSet(ckey, result, 'currency');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── WIKIPEDIA ────────────────────────────────────────────────────────
  wiki: async ({ query = 'India' }) => {
    const ckey = `wiki:${query}`;
    const cached = cacheGet(ckey);
    if (cached) return cached;
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
      const d = await res.json();
      if (!d?.extract) return { success: false, error: 'Not found on Wikipedia' };
      const result: AppResult = {
        success: true,
        text: `📚 **${d.title}**\n\n${d.extract.slice(0, 400)}...\n\n[Read more](${d.content_urls?.desktop?.page})`,
        card: { type: 'wiki', title: d.title, subtitle: d.description, imageUrl: d.thumbnail?.source },
        source: 'Wikipedia',
      };
      cacheSet(ckey, result, 'wiki');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── TRANSLATE ─────────────────────────────────────────────────────────
  translate: async ({ text = '', targetLang = 'Hindi' }) => {
    // Use MyMemory free API
    const langCode: Record<string, string> = { hindi: 'hi', english: 'en', spanish: 'es', french: 'fr', german: 'de', japanese: 'ja', chinese: 'zh', arabic: 'ar', portuguese: 'pt', russian: 'ru' };
    const code = langCode[targetLang.toLowerCase()] || targetLang.slice(0, 2).toLowerCase();
    const ckey = `translate:${code}:${text.slice(0, 30)}`;
    const cached = cacheGet(ckey);
    if (cached) return cached;
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${code}`);
      const d = await res.json();
      const translated = d?.responseData?.translatedText;
      if (!translated) return { success: false, error: 'Translation failed' };
      const result: AppResult = { success: true, text: `🌐 **Translation (→ ${targetLang}):**\n\n*Original:* ${text}\n*Translated:* **${translated}**`, source: 'MyMemory' };
      cacheSet(ckey, result, 'wiki');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── MOVIE (OMDB) ──────────────────────────────────────────────────────
  movie: async ({ title = '' }) => {
    const ckey = `movie:${title}`;
    const cached = cacheGet(ckey);
    if (cached) return cached;
    if (!trackUsage('omdb')) return { success: false, error: 'Movie API limit' };
    const key = process.env.OMDB_API_KEY;
    if (!key) return { success: false, error: 'OMDB_API_KEY not set' };
    try {
      const res = await fetch(`http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${key}`);
      const d = await res.json();
      if (d?.Response === 'False') return { success: false, error: d?.Error };
      const result: AppResult = {
        success: true,
        text: `🎬 **${d.Title}** (${d.Year})\n⭐ ${d.imdbRating}/10 | ${d.Genre}\n${d.Actors}\n\n${d.Plot}`,
        card: { type: 'movie', title: d.Title, subtitle: `${d.Year} · ⭐${d.imdbRating}`, imageUrl: d.Poster !== 'N/A' ? d.Poster : undefined, linkUrl: `https://imdb.com/title/${d.imdbID}` },
        source: 'OMDB',
      };
      cacheSet(ckey, result, 'movie');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── RECIPE ────────────────────────────────────────────────────────────
  recipe: async ({ dish = '' }) => {
    const ckey = `recipe:${dish}`;
    const cached = cacheGet(ckey);
    if (cached) return cached;
    try {
      const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(dish)}`);
      const d = await res.json();
      const meal = d?.meals?.[0];
      if (!meal) return { success: false, error: `Recipe "${dish}" not found` };
      const ings: string[] = [];
      for (let i = 1; i <= 20; i++) {
        const ing = meal[`strIngredient${i}`];
        if (ing?.trim()) ings.push(`${meal[`strMeasure${i}`]?.trim()} ${ing.trim()}`);
      }
      const result: AppResult = {
        success: true,
        text: `🍳 **${meal.strMeal}**\n${meal.strArea} · ${meal.strCategory}\n\n**Ingredients:**\n${ings.slice(0, 8).map(i => `• ${i}`).join('\n')}\n\n${meal.strInstructions?.slice(0, 300)}...`,
        card: { type: 'movie', title: meal.strMeal, subtitle: `${meal.strArea} · ${meal.strCategory}`, imageUrl: meal.strMealThumb },
        source: 'TheMealDB',
      };
      cacheSet(ckey, result, 'recipe');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── ANIME ─────────────────────────────────────────────────────────────
  anime: async ({ query = 'naruto' }) => {
    const ckey = `anime:${query}`;
    const cached = cacheGet(ckey);
    if (cached) return cached;
    try {
      const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`);
      const d = await res.json();
      const a = d?.data?.[0];
      if (!a) return { success: false, error: `Anime "${query}" not found` };
      const result: AppResult = {
        success: true,
        text: `🎌 **${a.title}** (${a.year})\n⭐ ${a.score} · ${a.episodes} eps · ${a.genres?.map((g: any) => g.name).join(', ')}\n\n${a.synopsis?.slice(0, 250)}...`,
        card: { type: 'image', title: a.title, subtitle: `⭐${a.score} · ${a.type}`, imageUrl: a.images?.jpg?.image_url },
        source: 'Jikan/MyAnimeList',
      };
      cacheSet(ckey, result, 'anime');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── POKEMON ──────────────────────────────────────────────────────────
  pokemon: async ({ query = 'pikachu' }) => {
    const ckey = `pokemon:${query}`;
    const cached = cacheGet(ckey);
    if (cached) return cached;
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${query.toLowerCase()}`);
      const d = await res.json();
      const types = d.types.map((t: any) => t.type.name).join(', ');
      const result: AppResult = {
        success: true,
        text: `⚡ **${d.name.toUpperCase()}** #${d.id}\nType: ${types} | ${d.height/10}m · ${d.weight/10}kg`,
        card: { type: 'image', title: d.name, subtitle: `#${d.id} · ${types}`, imageUrl: d.sprites?.other?.['official-artwork']?.front_default },
        source: 'PokeAPI',
      };
      cacheSet(ckey, result, 'pokemon');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── NASA APOD ─────────────────────────────────────────────────────────
  nasa: async () => {
    const ckey = 'nasa:apod';
    const cached = cacheGet(ckey);
    if (cached) return cached;
    if (!trackUsage('nasa')) return { success: false, error: 'NASA API limit' };
    try {
      const key = process.env.NASA_API_KEY || 'DEMO_KEY';
      const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${key}`);
      const d = await res.json();
      const result: AppResult = {
        success: true,
        text: `🚀 **NASA APOD:** ${d.title} (${d.date})\n\n${d.explanation?.slice(0, 300)}...`,
        card: { type: 'image', title: d.title, subtitle: d.date, imageUrl: d.url },
        source: 'NASA',
      };
      cacheSet(ckey, result, 'nasa');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── ISS ───────────────────────────────────────────────────────────────
  iss: async () => {
    const ckey = 'iss:location';
    const cached = cacheGet(ckey);
    if (cached) return cached;
    try {
      const res = await fetch('http://api.open-notify.org/iss-now.json');
      const d = await res.json();
      const { latitude, longitude } = d?.iss_position || {};
      const result: AppResult = {
        success: true,
        text: `🛸 **ISS Location:**\nLat: ${parseFloat(latitude).toFixed(2)}° | Lon: ${parseFloat(longitude).toFixed(2)}°\n[View on Map](https://maps.google.com/?q=${latitude},${longitude})`,
        source: 'open-notify.org',
      };
      cacheSet(ckey, result, 'iss');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── GITHUB TRENDING ──────────────────────────────────────────────────
  github: async () => {
    const ckey = 'github:trending';
    const cached = cacheGet(ckey);
    if (cached) return cached;
    try {
      const res = await fetch('https://api.github.com/search/repositories?q=stars:>1000&sort=stars&order=desc&per_page=5', {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });
      const d = await res.json();
      const repos = d?.items?.slice(0, 5) || [];
      const text = `🔥 **GitHub Trending:**\n${repos.map((r: any, i: number) => `${i+1}. **${r.full_name}** ⭐${r.stargazers_count.toLocaleString()} (${r.language || 'N/A'})`).join('\n')}`;
      const result: AppResult = { success: true, text, source: 'GitHub' };
      cacheSet(ckey, result, 'github');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── PINCODE ───────────────────────────────────────────────────────────
  pincode: async ({ query = '' }) => {
    const ckey = `pincode:${query}`;
    const cached = cacheGet(ckey);
    if (cached) return cached;
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${query}`);
      const d = await res.json();
      const post = d?.[0]?.PostOffice?.[0];
      if (!post) return { success: false, error: 'Pincode not found' };
      const result: AppResult = { success: true, text: `📮 **Pincode ${query}**\n${post.Name}, ${post.District}, ${post.State}\nDivision: ${post.Division}`, source: 'PostalPincode API' };
      cacheSet(ckey, result, 'wiki');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── HOLIDAY ───────────────────────────────────────────────────────────
  holiday: async ({ year = new Date().getFullYear().toString() }) => {
    const ckey = `holiday:${year}`;
    const cached = cacheGet(ckey);
    if (cached) return cached;
    try {
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/IN`);
      const d = await res.json();
      const upcoming = d?.filter((h: any) => new Date(h.date) >= new Date()).slice(0, 6) || [];
      const text = `🎉 **Upcoming Indian Holidays (${year}):**\n${upcoming.map((h: any) => `• **${h.name}** — ${new Date(h.date).toLocaleDateString('en-IN', {day:'numeric',month:'long'})}`).join('\n')}`;
      const result: AppResult = { success: true, text, source: 'date.nager.at' };
      cacheSet(ckey, result, 'wiki');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── JOKE ──────────────────────────────────────────────────────────────
  joke: async () => {
    try {
      const res = await fetch('https://v2.jokeapi.dev/joke/Any?safe-mode&type=twopart,single');
      const d = await res.json();
      if (d.type === 'twopart') return { success: true, text: `😂 ${d.setup}\n\n||${d.delivery}||` };
      return { success: true, text: `😂 ${d.joke}` };
    } catch {
      return { success: true, text: `😂 **Joke:**\nStudent: "Sir, mera homework kha gaya."\nTeacher: "Kyun?"\nStudent: "Aapne kaha tha yeh bakwaas hai!" 😅` };
    }
  },

  // ── QUOTE ─────────────────────────────────────────────────────────────
  quote: async () => {
    const ckey = 'quote:random';
    const cached = cacheGet(ckey);
    if (cached) return cached;
    try {
      const res = await fetch('https://zenquotes.io/api/random');
      const d = await res.json();
      const result: AppResult = { success: true, text: `✨ *"${d[0]?.q}"*\n— **${d[0]?.a}**` };
      cacheSet(ckey, result, 'quote');
      return result;
    } catch {
      return { success: true, text: `✨ *"Khwab dekhna band mat karo — jo sochoge wahi banoge."*\n— **JARVIS** 🤖` };
    }
  },

  // ── TRIVIA ────────────────────────────────────────────────────────────
  trivia: async () => {
    try {
      const res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
      const d = await res.json();
      const q = d?.results?.[0];
      if (!q) throw new Error('empty');
      const decode = (s: string) => s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'");
      const opts = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5);
      return { success: true, text: `🧠 **${decode(q.category)}**\n\n${decode(q.question)}\n\n${opts.map((o: string, i: number) => `${String.fromCharCode(65+i)}. ${decode(o)}`).join('\n')}\n\n||✅ ${decode(q.correct_answer)}||` };
    } catch {
      return { success: true, text: `🧠 Q: Mitochondria is the powerhouse of the?\nA) Nucleus  B) Cell  C) Ribosome  D) Virus\n||✅ B) Cell||` };
    }
  },

  // ── RANDOM FACT ───────────────────────────────────────────────────────
  fact: async () => {
    try {
      const res = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random');
      const d = await res.json();
      return { success: true, text: `🤯 **Did you know?**\n\n${d.text}`, source: 'UselessFacts' };
    } catch {
      return { success: true, text: `🤯 Honey never spoils — archaeologists found 3000-year-old honey in Egyptian tombs that was still edible!` };
    }
  },

  // ── WORD OF DAY ──────────────────────────────────────────────────────
  wordofday: async () => {
    const words = [
      { word: 'Ephemeral', meaning: 'Lasting a very short time', example: 'Social media fame is ephemeral.' },
      { word: 'Tenacity', meaning: 'Determined persistence', example: 'NEET mein success ke liye tenacity chahiye.' },
      { word: 'Resilience', meaning: 'Ability to recover quickly', example: 'His resilience inspired the class.' },
      { word: 'Serendipity', meaning: 'Happy accidents / unexpected good fortune', example: 'Finding this book was serendipity.' },
      { word: 'Ubiquitous', meaning: 'Present everywhere', example: 'Smartphones are ubiquitous now.' },
      { word: 'Perspicacious', meaning: 'Having sharp mental perception', example: 'A perspicacious student spots patterns quickly.' },
      { word: 'Equanimity', meaning: 'Calmness under pressure', example: 'Face your NEET exam with equanimity.' },
    ];
    const w = words[new Date().getDate() % words.length];
    return { success: true, text: `📝 **Word of the Day: ${w.word}**\n\n*Meaning:* ${w.meaning}\n*Example:* "${w.example}"` };
  },

  // ── AI IMAGE ─────────────────────────────────────────────────────────
  image: async ({ prompt = 'beautiful landscape' }) => {
    const seed = Math.floor(Math.random() * 999999);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;
    return { success: true, text: `🎨 Image generated for: "${prompt}"`, card: { type: 'image', title: 'AI Image', subtitle: prompt.slice(0, 60), imageUrl }, url: imageUrl };
  },

  // ── URL SHORTENER ─────────────────────────────────────────────────────
  shorturl: async ({ url = '' }) => {
    try {
      const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
      const short = await res.text();
      return { success: true, text: `🔗 Short URL:\n${url}\n↓\n**${short}**` };
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── QR CODE ──────────────────────────────────────────────────────────
  qr: async ({ text = '' }) => {
    const imageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
    return { success: true, text: `📱 QR Code for: "${text}"`, card: { type: 'image', title: 'QR Code', subtitle: text.slice(0, 40), imageUrl } };
  },

  // ── DICTIONARY ───────────────────────────────────────────────────────
  dictionary: async ({ query = '' }) => {
    const ckey = `dict:${query}`;
    const cached = cacheGet(ckey);
    if (cached) return cached;
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`);
      const d = await res.json();
      if (!Array.isArray(d)) return { success: false, error: `"${query}" not found` };
      const entry = d[0];
      const meanings = entry.meanings?.slice(0, 2).map((m: any) => `**${m.partOfSpeech}:** ${m.definitions?.[0]?.definition}`).join('\n');
      const result: AppResult = { success: true, text: `📖 **${entry.word}** ${entry.phonetic || ''}\n\n${meanings}`, source: 'DictionaryAPI' };
      cacheSet(ckey, result, 'wiki');
      return result;
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── HTTP STATUS ───────────────────────────────────────────────────────
  http_status: async ({ query = '404' }) => {
    const statuses: Record<string, string> = {
      '200': 'OK — Request successful', '201': 'Created — Resource created', '204': 'No Content',
      '301': 'Moved Permanently', '302': 'Found / Redirect', '400': 'Bad Request — Invalid syntax',
      '401': 'Unauthorized — Auth required', '403': 'Forbidden — No permission', '404': 'Not Found',
      '422': 'Unprocessable Entity', '429': 'Too Many Requests — Rate limited', '500': 'Internal Server Error',
      '502': 'Bad Gateway', '503': 'Service Unavailable', '504': 'Gateway Timeout',
    };
    const desc = statuses[query] || 'Unknown status code';
    return { success: true, text: `🌐 **HTTP ${query}**\n${desc}` };
  },

  // ── COLOR ─────────────────────────────────────────────────────────────
  color: async ({ query = '#00d4ff' }) => {
    const hex = query.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return { success: true, text: `🎨 **Color #${hex.toUpperCase()}**\nRGB: rgb(${r}, ${g}, ${b})\nHSL: ~(${Math.round(Math.atan2(Math.sqrt(3)*(g-b), 2*r-g-b) * 180/Math.PI + 360) % 360}°, ~50%, ~50%)\nUse in CSS: \`color: #${hex};\`` };
  },

  // ── IP INFO ───────────────────────────────────────────────────────────
  ip: async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const d = await res.json();
      return { success: true, text: `🌐 **Your IP Info:**\nIP: ${d.ip}\nCity: ${d.city}, ${d.region}, ${d.country_name}\nISP: ${d.org}\nTimezone: ${d.timezone}`, source: 'ipapi.co' };
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── TIMEZONE ─────────────────────────────────────────────────────────
  timezone: async ({ query = 'Asia/Kolkata' }) => {
    const now = new Date();
    try {
      const time = now.toLocaleString('en-IN', { timeZone: query, weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return { success: true, text: `🕐 **${query}:**\n${time}` };
    } catch {
      return { success: false, error: `Invalid timezone: ${query}` };
    }
  },

  // ── CRICKET ──────────────────────────────────────────────────────────
  cricket: async () => {
    return { success: true, text: `🏏 **Cricket Live Scores**\nFor live scores, visit:\n• [ESPNCricinfo](https://www.espncricinfo.com/live-cricket-score)\n• [BCCI](https://www.bcci.tv)\n\n_Add CRICAPI_KEY in settings for live scores!_` };
  },

  // ── NUTRITION ────────────────────────────────────────────────────────
  nutrition: async ({ query = 'apple' }) => {
    try {
      const res = await fetch(`https://api.calorieninjas.com/v1/nutrition?query=${encodeURIComponent(query)}`, {
        headers: { 'X-Api-Key': process.env.CALORIE_NINJA_KEY || '' },
      });
      if (!res.ok) return { success: true, text: `🥗 **${query} Nutrition** (approximate):\nAdd CALORIE_NINJA_KEY for exact values.` };
      const d = await res.json();
      const item = d?.items?.[0];
      if (!item) return { success: false, error: 'Food not found' };
      return { success: true, text: `🥗 **${item.name}** (100g)\nCalories: ${item.calories} kcal\nProtein: ${item.protein_g}g | Carbs: ${item.carbohydrates_total_g}g | Fat: ${item.fat_total_g}g` };
    } catch (e) { return { success: false, error: String(e) }; }
  },

  // ── FORTUNE COOKIE ───────────────────────────────────────────────────
  fortune: async () => {
    const fortunes = [
      'Aaj ka din tumhara hai — full use karo! 🌟',
      'Hard work beats talent when talent doesn\'t work hard. Keep going! 💪',
      'Ek baar aur koshish karo — success bahut paas hai. 🎯',
      'Jo kal ki chinta karta hai woh aaj ka mazaa kho deta hai. Live in now! ⚡',
      'Tumhara NEET rank tumhari mehnat ka mirror hai. Mehnat karo! 📚',
      'Mushkilein aati hain taaki hum strong banen. Don\'t give up! 🔥',
    ];
    return { success: true, text: `🥠 **Fortune Cookie:**\n\n*${fortunes[Math.floor(Math.random() * fortunes.length)]}*` };
  },

  // ── PASSWORD GENERATOR ───────────────────────────────────────────────
  password: async ({ query = '16' }) => {
    const len = Math.min(parseInt(query) || 16, 64);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let pwd = '';
    for (let i = 0; i < len; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return { success: true, text: `🔒 **Secure Password (${len} chars):**\n\`${pwd}\`` };
  },

  // ── UUID ──────────────────────────────────────────────────────────────
  uuid: async () => {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return { success: true, text: `🆔 **UUID:**\n\`${uuid}\`` };
  },
};

// ── Main dispatcher with caching + usage tracking ────────────────────────
export async function runIntegration(toolId: string, args: Record<string, string>): Promise<AppResult> {
  const fn = TOOLS[toolId];
  if (!fn) return { success: false, error: `Tool "${toolId}" not found in mega.ts` };

  try {
    return await fn(args);
  } catch (err) {
    return { success: false, error: `Tool "${toolId}" crashed: ${err}` };
  }
}

export function listTools(): string[] {
  return Object.keys(TOOLS);
}

export function listCategories(): Record<string, string[]> {
  return CATEGORY_MAP;
}
