/* lib/tools/connected/index.ts — All tool implementations */

export interface ToolResult {
  success: boolean;
  data?: any;
  text?: string;
  card?: any;
  error?: string;
}

// ── WEATHER ──────────────────────────────────────────────────────────────
export async function getWeather(city = 'Delhi'): Promise<ToolResult> {
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    const data = await res.json();
    const current = data?.current_condition?.[0];
    const area = data?.nearest_area?.[0];
    const areaName = area?.areaName?.[0]?.value || city;
    const country = area?.country?.[0]?.value || '';
    const desc = current?.weatherDesc?.[0]?.value || '';
    const temp_c = current?.temp_C || '';
    const feels = current?.FeelsLikeC || '';
    const humidity = current?.humidity || '';
    const wind = current?.windspeedKmph || '';

    const text = `🌤️ **${areaName}, ${country}** ka mausam:\n- 🌡️ Temperature: **${temp_c}°C** (feels like ${feels}°C)\n- 💧 Humidity: ${humidity}%\n- 💨 Wind: ${wind} km/h\n- ☁️ ${desc}`;
    return { success: true, text, data: { temp_c, desc, humidity, wind, city: areaName } };
  } catch (err) {
    return { success: false, error: `Weather fetch failed: ${err}` };
  }
}

export async function get3DayForecast(city = 'Delhi'): Promise<ToolResult> {
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    const data = await res.json();
    const weather = data?.weather?.slice(0, 3) || [];
    const days = weather.map((w: any, i: number) => {
      const date = w?.date || '';
      const maxC = w?.maxtempC || '';
      const minC = w?.mintempC || '';
      const desc = w?.hourly?.[4]?.weatherDesc?.[0]?.value || '';
      return `**Day ${i + 1} (${date}):** ${desc} — Max ${maxC}°C / Min ${minC}°C`;
    });
    return { success: true, text: `📅 **3-Day Forecast for ${city}:**\n${days.join('\n')}` };
  } catch (err) {
    return { success: false, error: `Forecast failed: ${err}` };
  }
}

// ── SEARCH ───────────────────────────────────────────────────────────────
export async function webSearch(query: string): Promise<ToolResult> {
  try {
    // Try Serper
    const serperKey = process.env.SERPER_API_KEY;
    if (serperKey) {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, gl: 'in', hl: 'en' }),
      });
      const data = await res.json();
      const organic = data?.organic?.slice(0, 3) || [];
      if (organic.length > 0) {
        const results = organic.map((r: any, i: number) =>
          `${i + 1}. **${r.title}**\n   ${r.snippet}\n   [${r.link}](${r.link})`
        ).join('\n\n');
        return { success: true, text: `🔍 **Search results for "${query}":**\n\n${results}` };
      }
    }

    // DuckDuckGo fallback
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
    const data = await res.json();
    const abstract = data?.AbstractText || data?.Answer || '';
    const source = data?.AbstractSource || '';
    if (abstract) return { success: true, text: `🔍 **${query}:**\n\n${abstract}\n\n_Source: ${source}_` };

    return { success: false, error: 'No results found' };
  } catch (err) {
    return { success: false, error: `Search failed: ${err}` };
  }
}

// ── NEWS ─────────────────────────────────────────────────────────────────
export async function getNews(query = 'india'): Promise<ToolResult> {
  try {
    // GNews
    const gnewsKey = process.env.GNEWS_API_KEY;
    if (gnewsKey) {
      const res = await fetch(`https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&country=in&max=5&token=${gnewsKey}`);
      const data = await res.json();
      if (data?.articles?.length) {
        const items = data.articles.slice(0, 5).map((a: any, i: number) =>
          `${i + 1}. **${a.title}**\n   ${a.description || ''}\n   [Read more](${a.url})`
        ).join('\n\n');
        return { success: true, text: `📰 **Latest News:**\n\n${items}` };
      }
    }

    // HackerNews fallback
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids = await res.json();
    const top5 = await Promise.all(ids.slice(0, 5).map(async (id: number) => {
      const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      return r.json();
    }));
    const items = top5.map((s: any, i: number) => `${i + 1}. **${s.title}**\n   [HN](https://news.ycombinator.com/item?id=${s.id})`).join('\n\n');
    return { success: true, text: `📰 **Tech News (HackerNews):**\n\n${items}` };
  } catch (err) {
    return { success: false, error: `News fetch failed: ${err}` };
  }
}

// ── WIKIPEDIA ────────────────────────────────────────────────────────────
export async function searchWiki(query: string): Promise<ToolResult> {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data?.extract) {
      return {
        success: true,
        text: `📚 **${data.title}**\n\n${data.extract.slice(0, 500)}...\n\n[Wikipedia](${data.content_urls?.desktop?.page})`,
        data,
      };
    }
    return { success: false, error: 'Not found on Wikipedia' };
  } catch (err) {
    return { success: false, error: `Wiki failed: ${err}` };
  }
}

// ── MOVIE ────────────────────────────────────────────────────────────────
export async function getMovie(title: string): Promise<ToolResult> {
  try {
    const omdbKey = process.env.OMDB_API_KEY;
    if (!omdbKey) return { success: false, error: 'OMDB_API_KEY not set' };
    const res = await fetch(`http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${omdbKey}`);
    const d = await res.json();
    if (d?.Response === 'False') return { success: false, error: d?.Error };
    const text = `🎬 **${d.Title}** (${d.Year})\n⭐ IMDb: ${d.imdbRating}/10 | ${d.Genre}\n🎭 Cast: ${d.Actors}\n📖 ${d.Plot}`;
    const card = {
      type: 'movie' as const,
      title: d.Title,
      subtitle: `${d.Year} · ${d.Genre} · ⭐${d.imdbRating}`,
      imageUrl: d.Poster !== 'N/A' ? d.Poster : undefined,
      linkUrl: `https://www.imdb.com/title/${d.imdbID}`,
    };
    return { success: true, text, card, data: d };
  } catch (err) {
    return { success: false, error: `Movie fetch failed: ${err}` };
  }
}

// ── IMAGE GENERATION ─────────────────────────────────────────────────────
export async function generateImage(prompt: string): Promise<ToolResult> {
  try {
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
    const card = {
      type: 'image' as const,
      title: 'Generated Image',
      subtitle: prompt.slice(0, 60),
      imageUrl,
    };
    return { success: true, text: `🎨 Image generated for: "${prompt}"`, card, data: { imageUrl } };
  } catch (err) {
    return { success: false, error: `Image generation failed: ${err}` };
  }
}

// ── CRYPTO ───────────────────────────────────────────────────────────────
export async function getCrypto(coin: string): Promise<ToolResult> {
  try {
    const cleanCoin = coin.replace(/price|ka|kya|hai|kitna/gi, '').trim().toLowerCase();
    const coinMap: Record<string, string> = {
      bitcoin: 'bitcoin', btc: 'bitcoin', ethereum: 'ethereum', eth: 'ethereum',
      doge: 'dogecoin', dogecoin: 'dogecoin', bnb: 'binancecoin', xrp: 'ripple',
      sol: 'solana', solana: 'solana', ada: 'cardano', dot: 'polkadot',
    };
    const coinId = coinMap[cleanCoin] || cleanCoin;
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=inr,usd&include_24hr_change=true`);
    const data = await res.json();
    const d = data[coinId];
    if (!d) return { success: false, error: `Crypto "${coinId}" not found` };
    const change = d.inr_24h_change?.toFixed(2) || '?';
    const arrow = parseFloat(change) >= 0 ? '📈' : '📉';
    return {
      success: true,
      text: `💰 **${cleanCoin.toUpperCase()}** price:\n- ₹${d.inr?.toLocaleString('en-IN')} INR\n- $${d.usd?.toFixed(2)} USD\n${arrow} 24h change: ${change}%`,
      data: d,
    };
  } catch (err) {
    return { success: false, error: `Crypto failed: ${err}` };
  }
}

// ── CURRENCY ─────────────────────────────────────────────────────────────
export async function getCurrency(amount: string, from: string, to: string): Promise<ToolResult> {
  try {
    const fromU = from.toUpperCase().trim();
    const toU = to.toUpperCase().trim();
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${fromU}`);
    const data = await res.json();
    const rate = data?.rates?.[toU];
    if (!rate) return { success: false, error: `Currency "${toU}" not found` };
    const result = (parseFloat(amount) * rate).toFixed(2);
    return {
      success: true,
      text: `💱 **Currency Convert:**\n${amount} ${fromU} = **${result} ${toU}**\nRate: 1 ${fromU} = ${rate.toFixed(4)} ${toU}`,
    };
  } catch (err) {
    return { success: false, error: `Currency failed: ${err}` };
  }
}

// ── STOCK ────────────────────────────────────────────────────────────────
export async function getStock(query: string): Promise<ToolResult> {
  try {
    const clean = query.replace(/stock|price|ka|kya|hai/gi, '').trim().toUpperCase();
    const symbol = clean.includes('.NS') ? clean : `${clean}.NS`;
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`);
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) return { success: false, error: `Stock "${clean}" not found` };
    const price = meta?.regularMarketPrice?.toFixed(2);
    const change = ((meta?.regularMarketPrice - meta?.chartPreviousClose) / meta?.chartPreviousClose * 100).toFixed(2);
    const arrow = parseFloat(change) >= 0 ? '📈' : '📉';
    return {
      success: true,
      text: `📈 **${meta.symbol}** (${meta.longName || clean})\nPrice: ₹**${price}**\n${arrow} Change: ${change}%\n52W High: ₹${meta.fiftyTwoWeekHigh?.toFixed(2)} | Low: ₹${meta.fiftyTwoWeekLow?.toFixed(2)}`,
    };
  } catch (err) {
    return { success: false, error: `Stock fetch failed: ${err}` };
  }
}

// ── RECIPE ───────────────────────────────────────────────────────────────
export async function getRecipe(dish: string): Promise<ToolResult> {
  try {
    const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(dish)}`);
    const data = await res.json();
    const meal = data?.meals?.[0];
    if (!meal) return { success: false, error: `Recipe for "${dish}" not found` };
    const ingredients: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const ing = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];
      if (ing && ing.trim()) ingredients.push(`${measure?.trim()} ${ing.trim()}`);
    }
    const text = `🍳 **${meal.strMeal}** (${meal.strArea} · ${meal.strCategory})\n\n**Ingredients:**\n${ingredients.map(i => `• ${i}`).join('\n')}\n\n**Instructions:**\n${meal.strInstructions?.slice(0, 400)}...`;
    const card = {
      type: 'movie' as const,
      title: meal.strMeal,
      subtitle: `${meal.strArea} · ${meal.strCategory}`,
      imageUrl: meal.strMealThumb,
    };
    return { success: true, text, card };
  } catch (err) {
    return { success: false, error: `Recipe failed: ${err}` };
  }
}

// ── QR CODE ──────────────────────────────────────────────────────────────
export async function generateQR(text: string): Promise<ToolResult> {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
  const card = { type: 'image' as const, title: 'QR Code', subtitle: text.slice(0, 40), imageUrl: qrUrl };
  return { success: true, text: `📱 QR Code generated for: "${text}"`, card };
}

// ── DICTIONARY ───────────────────────────────────────────────────────────
export async function getDefinition(word: string): Promise<ToolResult> {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return { success: false, error: `Word "${word}" not found` };
    const entry = data[0];
    const meanings = entry.meanings?.slice(0, 2).map((m: any) =>
      `**${m.partOfSpeech}:** ${m.definitions?.[0]?.definition}`
    ).join('\n');
    const phonetic = entry.phonetic || '';
    return { success: true, text: `📚 **${word}** ${phonetic}\n\n${meanings}` };
  } catch (err) {
    return { success: false, error: `Dictionary failed: ${err}` };
  }
}

// ── JOKE ─────────────────────────────────────────────────────────────────
export async function getJoke(): Promise<ToolResult> {
  try {
    const res = await fetch('https://v2.jokeapi.dev/joke/Any?safe-mode&type=twopart,single');
    const data = await res.json();
    if (data.type === 'twopart') {
      return { success: true, text: `😂 **Joke time!**\n\n${data.setup}\n\n||${data.delivery}||` };
    }
    return { success: true, text: `😂 ${data.joke}` };
  } catch {
    return { success: true, text: `😂 Teacher: "Why are you late?"\nStudent: "Sir, aap ne kaha kal aa jaana, toh kal aa gaya!" 🤣` };
  }
}

// ── QUOTE ────────────────────────────────────────────────────────────────
export async function getQuote(): Promise<ToolResult> {
  try {
    const res = await fetch('https://zenquotes.io/api/random');
    const data = await res.json();
    const q = data?.[0];
    if (q?.q) return { success: true, text: `✨ *"${q.q}"*\n\n— **${q.a}**` };
    throw new Error('empty');
  } catch {
    const quotes = [
      { q: "The future belongs to those who believe in the beauty of their dreams.", a: "Eleanor Roosevelt" },
      { q: "Khwab dekhna band mat karo — jo sochoge wahi banoge.", a: "JARVIS" },
      { q: "Success is not final, failure is not fatal: It is the courage to continue that counts.", a: "Winston Churchill" },
    ];
    const rnd = quotes[Math.floor(Math.random() * quotes.length)];
    return { success: true, text: `✨ *"${rnd.q}"*\n\n— **${rnd.a}**` };
  }
}

// ── NASA APOD ─────────────────────────────────────────────────────────────
export async function getNASA(): Promise<ToolResult> {
  try {
    const key = process.env.NASA_API_KEY || 'DEMO_KEY';
    const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${key}`);
    const data = await res.json();
    const card = {
      type: 'image' as const,
      title: data.title,
      subtitle: data.date,
      imageUrl: data.url,
    };
    return { success: true, text: `🚀 **NASA Astronomy Picture of the Day**\n**${data.title}** (${data.date})\n\n${data.explanation?.slice(0, 300)}...`, card };
  } catch (err) {
    return { success: false, error: `NASA failed: ${err}` };
  }
}

// ── CRICKET ──────────────────────────────────────────────────────────────
export async function getCricketScores(): Promise<ToolResult> {
  return {
    success: true,
    text: `🏏 **Cricket Live Scores**\nCricket API requires a key (cricapi.com). Add CRICAPI_KEY to get live scores.\n\nFor now, check: https://www.espncricinfo.com/live-cricket-score`,
  };
}

// ── TRIVIA ───────────────────────────────────────────────────────────────
export async function getTrivia(): Promise<ToolResult> {
  try {
    const res = await fetch('https://opentdb.com/api.php?amount=1&type=multiple');
    const data = await res.json();
    const q = data?.results?.[0];
    if (!q) throw new Error('No trivia');
    const options = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5);
    const text = `🧠 **Trivia Question!**\n**Category:** ${q.category}\n\n**${decodeHtml(q.question)}**\n\n${options.map((o: string, i: number) => `${String.fromCharCode(65 + i)}. ${decodeHtml(o)}`).join('\n')}\n\n||✅ Answer: ${decodeHtml(q.correct_answer)}||`;
    return { success: true, text };
  } catch {
    return { success: true, text: `🧠 **Trivia!**\nQ: Which planet is called the "Red Planet"?\nA) Venus  B) Mars  C) Jupiter  D) Saturn\n\n||✅ Answer: B) Mars||` };
  }
}

function decodeHtml(html: string): string {
  return html.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
}

// ── ANIME ────────────────────────────────────────────────────────────────
export async function getAnime(query: string): Promise<ToolResult> {
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`);
    const data = await res.json();
    const anime = data?.data?.[0];
    if (!anime) return { success: false, error: `Anime "${query}" not found` };
    const card = { type: 'image' as const, title: anime.title, subtitle: `⭐${anime.score} · ${anime.type}`, imageUrl: anime.images?.jpg?.image_url };
    return {
      success: true,
      text: `🎌 **${anime.title}** (${anime.year})\n⭐ Score: ${anime.score}\n📺 Episodes: ${anime.episodes}\nGenres: ${anime.genres?.map((g: any) => g.name).join(', ')}\n\n${anime.synopsis?.slice(0, 300)}...`,
      card,
    };
  } catch (err) {
    return { success: false, error: `Anime failed: ${err}` };
  }
}

// ── RANDOM FACT ──────────────────────────────────────────────────────────
export async function getRandomFact(): Promise<ToolResult> {
  try {
    const res = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random');
    const data = await res.json();
    return { success: true, text: `🤯 **Did you know?**\n\n${data.text}` };
  } catch {
    return { success: true, text: `🤯 **Did you know?**\n\nHoney never spoils — archaeologists found 3000-year-old honey in Egyptian tombs that was still edible!` };
  }
}

// ── BMI CALCULATOR ───────────────────────────────────────────────────────
export function calculateBMI(weight: number, height: number): ToolResult {
  const bmi = weight / ((height / 100) ** 2);
  let category = '';
  if (bmi < 18.5) category = 'Underweight (Kam weight)';
  else if (bmi < 25) category = 'Normal (Healthy)';
  else if (bmi < 30) category = 'Overweight (Zyada weight)';
  else category = 'Obese';
  return { success: true, text: `⚖️ **BMI Calculator**\nWeight: ${weight}kg | Height: ${height}cm\n\nBMI: **${bmi.toFixed(1)}**\nCategory: **${category}**` };
}

// ── EMI CALCULATOR ───────────────────────────────────────────────────────
export function calculateEMI(principal: number, rate: number, months: number): ToolResult {
  const r = rate / 12 / 100;
  const emi = principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
  const total = emi * months;
  const interest = total - principal;
  return {
    success: true,
    text: `💰 **EMI Calculator**\nLoan: ₹${principal.toLocaleString('en-IN')}\nRate: ${rate}% p.a. | Tenure: ${months} months\n\n📌 **Monthly EMI: ₹${emi.toFixed(0)}**\nTotal Amount: ₹${total.toFixed(0)}\nTotal Interest: ₹${interest.toFixed(0)}`,
  };
}

// ── SIP CALCULATOR ───────────────────────────────────────────────────────
export function calculateSIP(monthly: number, rate: number, years: number): ToolResult {
  const months = years * 12;
  const r = rate / 12 / 100;
  const maturity = monthly * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
  const invested = monthly * months;
  const returns = maturity - invested;
  return {
    success: true,
    text: `📊 **SIP Calculator**\nMonthly SIP: ₹${monthly.toLocaleString('en-IN')}\nExpected Return: ${rate}% p.a. | Duration: ${years} years\n\n📌 **Maturity: ₹${maturity.toFixed(0)}**\nTotal Invested: ₹${invested.toLocaleString('en-IN')}\nTotal Returns: ₹${returns.toFixed(0)}`,
  };
}

// ── URL SHORTENER ─────────────────────────────────────────────────────────
export async function shortenURL(url: string): Promise<ToolResult> {
  try {
    const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
    const short = await res.text();
    return { success: true, text: `🔗 **Short URL:**\n${url}\n↓\n**${short}**` };
  } catch (err) {
    return { success: false, error: `URL shortener failed: ${err}` };
  }
}

// ── POKEMON ──────────────────────────────────────────────────────────────
export async function getPokemon(name: string): Promise<ToolResult> {
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`);
    const data = await res.json();
    const types = data.types.map((t: any) => t.type.name).join(', ');
    const stats = data.stats.map((s: any) => `${s.stat.name}: ${s.base_stat}`).join(' | ');
    const imageUrl = data.sprites?.other?.['official-artwork']?.front_default || data.sprites?.front_default;
    const card = { type: 'image' as const, title: data.name, subtitle: `#${data.id} · ${types}`, imageUrl };
    return {
      success: true,
      text: `⚡ **${data.name.toUpperCase()}** (#${data.id})\nType: ${types}\nHeight: ${data.height / 10}m | Weight: ${data.weight / 10}kg\nStats: ${stats}`,
      card,
    };
  } catch (err) {
    return { success: false, error: `Pokemon "${name}" not found` };
  }
}

// ── GITHUB TRENDING ──────────────────────────────────────────────────────
export async function getGitHubTrending(): Promise<ToolResult> {
  try {
    const res = await fetch('https://api.github.com/search/repositories?q=stars:>1000&sort=stars&order=desc&per_page=5', {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });
    const data = await res.json();
    const repos = data?.items?.slice(0, 5) || [];
    const text = `🔥 **GitHub Trending (Top Repos)**\n\n${repos.map((r: any, i: number) =>
      `${i + 1}. **[${r.full_name}](${r.html_url})**\n   ⭐${r.stargazers_count.toLocaleString()} | ${r.language || 'N/A'}\n   ${r.description?.slice(0, 80) || ''}`
    ).join('\n\n')}`;
    return { success: true, text };
  } catch (err) {
    return { success: false, error: `GitHub trending failed: ${err}` };
  }
}

// ── SPACE NEWS ───────────────────────────────────────────────────────────
export async function getSpaceNews(): Promise<ToolResult> {
  try {
    const res = await fetch('https://api.spaceflightnewsapi.net/v4/articles/?limit=5&ordering=-published_at');
    const data = await res.json();
    const articles = data?.results || [];
    const text = `🚀 **Space News:**\n\n${articles.map((a: any, i: number) =>
      `${i + 1}. **${a.title}**\n   ${a.summary?.slice(0, 100)}...\n   [Read](${a.url})`
    ).join('\n\n')}`;
    return { success: true, text };
  } catch (err) {
    return { success: false, error: `Space news failed: ${err}` };
  }
}

// ── ISS LOCATION ─────────────────────────────────────────────────────────
export async function getISSLocation(): Promise<ToolResult> {
  try {
    const res = await fetch('http://api.open-notify.org/iss-now.json');
    const data = await res.json();
    const { latitude, longitude } = data?.iss_position || {};
    return {
      success: true,
      text: `🛸 **ISS Location right now:**\n- Latitude: ${parseFloat(latitude).toFixed(2)}°\n- Longitude: ${parseFloat(longitude).toFixed(2)}°\n- [View on Map](https://www.google.com/maps?q=${latitude},${longitude})`,
    };
  } catch (err) {
    return { success: false, error: `ISS location failed: ${err}` };
  }
}

// ── WORD OF DAY ───────────────────────────────────────────────────────────
export async function getWordOfDay(): Promise<ToolResult> {
  const words = [
    { word: 'Ephemeral', meaning: 'Lasting for a very short time', example: 'Fame can be ephemeral.' },
    { word: 'Serendipity', meaning: 'Finding good things without looking for them', example: 'It was serendipity that they met.' },
    { word: 'Resilience', meaning: 'Ability to recover quickly from difficulties', example: 'His resilience inspired everyone.' },
    { word: 'Ubiquitous', meaning: 'Present, appearing, or found everywhere', example: 'Smartphones are ubiquitous now.' },
    { word: 'Tenacity', meaning: 'The quality of being determined', example: 'She showed great tenacity in her NEET prep.' },
  ];
  const day = new Date().getDate() % words.length;
  const w = words[day];
  return { success: true, text: `📝 **Word of the Day: ${w.word}**\n\n*Meaning:* ${w.meaning}\n*Example:* "${w.example}"` };
}

// Main tool dispatcher
export async function dispatchTool(category: string, args: Record<string, string>): Promise<ToolResult> {
  switch (category) {
    case 'weather': return getWeather(args.city);
    case 'image': return generateImage(args.prompt || args.query || 'beautiful landscape');
    case 'news': return getNews(args.query);
    case 'search': return webSearch(args.query);
    case 'wiki': return searchWiki(args.query);
    case 'movie': return getMovie(args.title || args.query);
    case 'crypto': return getCrypto(args.coin || args.query);
    case 'currency': return getCurrency(args.amount || '1', args.from || 'USD', args.to || 'INR');
    case 'stock': return getStock(args.query);
    case 'recipe': return getRecipe(args.dish || args.query);
    case 'qr': return generateQR(args.text || args.query);
    case 'joke': return getJoke();
    case 'quote': return getQuote();
    case 'trivia': return getTrivia();
    case 'anime': return getAnime(args.query);
    case 'space': return getSpaceNews();
    case 'pokemon': return getPokemon(args.query);
    case 'cricket': return getCricketScores();
    case 'nasa': return getNASA();
    case 'iss': return getISSLocation();
    case 'wordofday': return getWordOfDay();
    case 'fact': return getRandomFact();
    case 'github': return getGitHubTrending();
    case 'dictionary': return getDefinition(args.query);
    case 'shorturl': return shortenURL(args.url || args.query);
    default: return { success: false, error: `Unknown tool: ${category}` };
  }
}
