// lib/tools/registry.ts — JARVIS Tool Registry v1
// Metadata ONLY — no actual implementation code
// 150+ tool slots designed in, organized by category
// Actual code loaded lazily by category in executor.ts

import type { ToolCategory } from './intent'

export interface ToolMeta {
  id: string                    // unique snake_case name
  category: ToolCategory        // category for lazy loading
  name: string                  // human readable
  desc: string                  // short description for AI
  requiresKey: boolean          // needs API key?
  keyName?: string              // env var name for key
  cacheTTL: number              // seconds. 0 = no cache
  fallbacks: string[]           // ordered fallback tool ids
  params?: Record<string, {     // input params schema (compact)
    type: 'string' | 'number' | 'boolean'
    required?: boolean
    default?: string | number | boolean
    desc?: string
  }>
  tags?: string[]               // extra matching hints
}

// ═══════════════════════════════════════════════════════════
// TOOL REGISTRY — 50 tools defined, 150+ slots available
// Each category group is a lazy-loadable module
// ═══════════════════════════════════════════════════════════
export const TOOL_REGISTRY: ToolMeta[] = [

  // ── WEATHER (3 tools) ──────────────────────────────────
  {
    id: 'get_weather', category: 'weather', name: 'Weather',
    desc: 'Current weather + 7-day forecast for any city. Default: Rewa, MP.',
    requiresKey: false, cacheTTL: 900,   // 15 min cache
    fallbacks: ['get_weather_wttr'],
    params: {
      location: { type: 'string', default: 'Rewa, Madhya Pradesh', desc: 'City name' },
      days:     { type: 'number', default: 3, desc: 'Forecast days 1-7' },
    },
  },
  {
    id: 'get_weather_wttr', category: 'weather', name: 'Weather (wttr.in)',
    desc: 'Backup weather via wttr.in public API.',
    requiresKey: false, cacheTTL: 900,
    fallbacks: [],
    params: { location: { type: 'string', default: 'Rewa' } },
  },
  {
    id: 'get_air_quality', category: 'weather', name: 'Air Quality',
    desc: 'AQI + pollutants for Indian cities.',
    requiresKey: false, cacheTTL: 1800,
    fallbacks: [],
    params: { city: { type: 'string', default: 'Rewa' } },
  },

  // ── TIME (3 tools) ─────────────────────────────────────
  {
    id: 'get_datetime', category: 'time', name: 'Date & Time',
    desc: 'Current date, time, day in IST. No API needed.',
    requiresKey: false, cacheTTL: 0,    // no cache — always fresh
    fallbacks: [],
    params: {
      timezone: { type: 'string', default: 'Asia/Kolkata' },
      format:   { type: 'string', default: 'full', desc: 'full|date|time|day' },
    },
  },
  {
    id: 'get_public_holidays', category: 'time', name: 'Public Holidays',
    desc: 'National + bank holidays for India.',
    requiresKey: false, cacheTTL: 86400,  // 24h cache
    fallbacks: [],
    params: {
      country: { type: 'string', default: 'IN' },
      year:    { type: 'number', default: 2025 },
    },
  },
  {
    id: 'get_sunrise_sunset', category: 'time', name: 'Sunrise/Sunset',
    desc: 'Sunrise, sunset, golden hour times. IST timezone.',
    requiresKey: false, cacheTTL: 43200,  // 12h cache
    fallbacks: [],
    params: {
      lat:  { type: 'number', default: 24.53, desc: 'Latitude. Default: Rewa' },
      lon:  { type: 'number', default: 81.30, desc: 'Longitude. Default: Rewa' },
      date: { type: 'string', desc: 'YYYY-MM-DD. Default: today' },
    },
  },

  // ── NEWS (4 tools) ─────────────────────────────────────
  {
    id: 'get_india_news', category: 'news', name: 'India News',
    desc: 'Latest India news headlines from RSS feeds. Zero API key.',
    requiresKey: false, cacheTTL: 600,   // 10 min
    fallbacks: ['get_reddit_posts'],
    params: {
      query:    { type: 'string', desc: 'Optional search topic' },
      category: { type: 'string', desc: 'politics|sports|tech|entertainment|business' },
      limit:    { type: 'number', default: 5 },
    },
  },
  {
    id: 'get_reddit_posts', category: 'news', name: 'Reddit Posts',
    desc: 'Hot posts from subreddits. Good for India/tech discussions.',
    requiresKey: false, cacheTTL: 600,
    fallbacks: ['get_hackernews'],
    params: {
      subreddit: { type: 'string', default: 'india', desc: 'Subreddit name without r/' },
      sort:      { type: 'string', default: 'hot', desc: 'hot|top|new|rising' },
      limit:     { type: 'number', default: 5 },
    },
  },
  {
    id: 'get_hackernews', category: 'news', name: 'Hacker News',
    desc: 'Tech/startup news from Hacker News.',
    requiresKey: false, cacheTTL: 900,
    fallbacks: [],
    params: {
      type:  { type: 'string', default: 'top', desc: 'top|new|ask|show' },
      limit: { type: 'number', default: 5 },
    },
  },
  {
    id: 'get_news_rss', category: 'news', name: 'RSS News',
    desc: 'News via public RSS: Times of India, NDTV, BBC Hindi.',
    requiresKey: false, cacheTTL: 600,
    fallbacks: ['get_india_news'],
    params: {
      source: { type: 'string', default: 'toi', desc: 'toi|ndtv|bbc_hindi|hindu|hindustan' },
      limit:  { type: 'number', default: 5 },
    },
  },

  // ── FINANCE (5 tools) ──────────────────────────────────
  {
    id: 'get_crypto_price', category: 'finance', name: 'Crypto Price',
    desc: 'Live crypto prices from CoinGecko (free, no key).',
    requiresKey: false, cacheTTL: 120,  // 2 min cache
    fallbacks: ['get_crypto_price_backup'],
    params: {
      coin:     { type: 'string', required: true, desc: 'bitcoin|ethereum|solana|etc.' },
      currency: { type: 'string', default: 'inr', desc: 'inr|usd|eur' },
    },
  },
  {
    id: 'get_crypto_price_backup', category: 'finance', name: 'Crypto (Backup)',
    desc: 'Binance public API for crypto prices.',
    requiresKey: false, cacheTTL: 60,
    fallbacks: [],
    params: { coin: { type: 'string', required: true } },
  },
  {
    id: 'get_exchange_rate', category: 'finance', name: 'Exchange Rate',
    desc: 'Live forex rates from exchangerate-api (free tier).',
    requiresKey: false, cacheTTL: 3600,  // 1h cache
    fallbacks: ['get_exchange_rate_backup'],
    params: {
      from:   { type: 'string', default: 'USD', desc: 'Source currency' },
      to:     { type: 'string', default: 'INR', desc: 'Target currency' },
      amount: { type: 'number', default: 1 },
    },
  },
  {
    id: 'get_exchange_rate_backup', category: 'finance', name: 'Exchange Rate (Backup)',
    desc: 'Frankfurter.app free forex API.',
    requiresKey: false, cacheTTL: 3600,
    fallbacks: [],
    params: { from: { type: 'string', default: 'USD' }, to: { type: 'string', default: 'INR' } },
  },
  {
    id: 'get_india_stock', category: 'finance', name: 'India Stock Price',
    desc: 'BSE/NSE stock price via Yahoo Finance API.',
    requiresKey: false, cacheTTL: 300,  // 5 min
    fallbacks: [],
    params: {
      symbol: { type: 'string', required: true, desc: 'Stock symbol like RELIANCE, TCS, INFY' },
      exchange: { type: 'string', default: 'NSE', desc: 'NSE|BSE' },
    },
  },

  // ── KNOWLEDGE (5 tools) ────────────────────────────────
  {
    id: 'search_wikipedia', category: 'knowledge', name: 'Wikipedia',
    desc: 'Summary from Wikipedia. Works in Hindi+English.',
    requiresKey: false, cacheTTL: 86400,  // 24h
    fallbacks: ['get_word_meaning'],
    params: {
      query:    { type: 'string', required: true },
      language: { type: 'string', default: 'en', desc: 'en|hi' },
    },
  },
  {
    id: 'get_word_meaning', category: 'knowledge', name: 'Dictionary',
    desc: 'Word meaning, pronunciation, synonyms from Free Dictionary API.',
    requiresKey: false, cacheTTL: 86400,
    fallbacks: [],
    params: { word: { type: 'string', required: true } },
  },
  {
    id: 'translate_text', category: 'knowledge', name: 'Translate',
    desc: 'Translate text between Hindi, English, and other languages.',
    requiresKey: false, cacheTTL: 86400,
    fallbacks: [],
    params: {
      text: { type: 'string', required: true },
      from: { type: 'string', default: 'auto' },
      to:   { type: 'string', default: 'en' },
    },
  },
  {
    id: 'search_books', category: 'knowledge', name: 'Books Search',
    desc: 'Book info via Google Books API (free, no key).',
    requiresKey: false, cacheTTL: 86400,
    fallbacks: [],
    params: { query: { type: 'string', required: true } },
  },
  {
    id: 'get_definition_wiktionary', category: 'knowledge', name: 'Wiktionary',
    desc: 'Word definitions from Wiktionary API.',
    requiresKey: false, cacheTTL: 86400,
    fallbacks: ['get_word_meaning'],
    params: { word: { type: 'string', required: true }, lang: { type: 'string', default: 'en' } },
  },

  // ── LOCATION (3 tools) ─────────────────────────────────
  {
    id: 'get_location_info', category: 'location', name: 'Location Info',
    desc: 'Info about places, cities, landmarks via Nominatim.',
    requiresKey: false, cacheTTL: 86400,
    fallbacks: [],
    params: { query: { type: 'string', required: true } },
  },
  {
    id: 'lookup_pincode', category: 'location', name: 'Pincode Lookup',
    desc: 'India pincode → district, state, post office list.',
    requiresKey: false, cacheTTL: 86400,
    fallbacks: [],
    params: { pincode: { type: 'string', required: true, desc: '6-digit India pincode' } },
  },
  {
    id: 'get_distance', category: 'location', name: 'Distance Calculator',
    desc: 'Straight-line distance between two cities (no API).',
    requiresKey: false, cacheTTL: 86400,
    fallbacks: [],
    params: {
      from: { type: 'string', required: true, desc: 'Origin city' },
      to:   { type: 'string', required: true, desc: 'Destination city' },
    },
  },

  // ── INDIA (5 tools) ────────────────────────────────────
  {
    id: 'get_rewa_info', category: 'india', name: 'Rewa Info',
    desc: 'Local info about Rewa, MP — food, places, hospitals, colleges.',
    requiresKey: false, cacheTTL: 86400,
    fallbacks: [],
    params: {
      type: { type: 'string', required: true, desc: 'food|places|hospitals|colleges|transport|government' },
      area: { type: 'string', desc: 'Specific area in Rewa' },
    },
  },
  {
    id: 'get_pnr_status', category: 'india', name: 'PNR Status',
    desc: 'Indian Railways PNR status check.',
    requiresKey: false, cacheTTL: 300,
    fallbacks: [],
    params: { pnr: { type: 'string', required: true, desc: '10-digit PNR number' } },
  },
  {
    id: 'get_india_fuel_price', category: 'india', name: 'India Fuel Price',
    desc: 'Petrol + diesel prices for Indian cities.',
    requiresKey: false, cacheTTL: 3600,
    fallbacks: [],
    params: { city: { type: 'string', default: 'Rewa', desc: 'City name' } },
  },
  {
    id: 'get_government_scheme', category: 'india', name: 'Government Scheme',
    desc: 'Info about Indian government schemes (PM Kisan, Ayushman, etc.).',
    requiresKey: false, cacheTTL: 86400,
    fallbacks: ['search_wikipedia'],
    params: { query: { type: 'string', required: true, desc: 'Scheme name or category' } },
  },
  {
    id: 'get_neet_info', category: 'india', name: 'NEET Info',
    desc: 'NEET exam dates, syllabus, admit card, result info.',
    requiresKey: false, cacheTTL: 3600,
    fallbacks: ['search_wikipedia'],
    params: { query: { type: 'string', required: true, desc: 'neet dates|syllabus|admit card|cutoff|colleges' } },
  },

  // ── EDUCATION (4 tools) ────────────────────────────────
  {
    id: 'solve_math', category: 'education', name: 'Math Solver',
    desc: 'Solve math expressions, equations, basic calculus. No API.',
    requiresKey: false, cacheTTL: 0,
    fallbacks: ['calculate'],
    params: { expression: { type: 'string', required: true } },
  },
  {
    id: 'calculate', category: 'education', name: 'Calculator',
    desc: 'Safe arithmetic calculator. No API.',
    requiresKey: false, cacheTTL: 0,
    fallbacks: [],
    params: { expression: { type: 'string', required: true } },
  },
  {
    id: 'get_periodic_element', category: 'education', name: 'Periodic Table',
    desc: 'Element info from periodic table. Built-in data.',
    requiresKey: false, cacheTTL: 86400,
    fallbacks: ['search_wikipedia'],
    params: { query: { type: 'string', required: true, desc: 'Element name, symbol, or atomic number' } },
  },
  {
    id: 'get_physics_constant', category: 'education', name: 'Physics Constants',
    desc: 'NEET/JEE physical constants with SI units. Built-in.',
    requiresKey: false, cacheTTL: 86400,
    fallbacks: [],
    params: { name: { type: 'string', required: true, desc: 'Constant name like planck, boltzmann, speed of light' } },
  },

  // ── ENTERTAINMENT (4 tools) ────────────────────────────
  {
    id: 'search_movies', category: 'entertainment', name: 'Movie Search',
    desc: 'Movie/series info via OMDB API (free key).',
    requiresKey: true, keyName: 'OMDB_API_KEY', cacheTTL: 86400,
    fallbacks: ['search_movies_nokey'],
    params: {
      query:    { type: 'string', required: true },
      type:     { type: 'string', default: 'movie', desc: 'movie|series|episode' },
      language: { type: 'string', default: 'hindi|english' },
    },
  },
  {
    id: 'search_movies_nokey', category: 'entertainment', name: 'Movie Info (Wikidata)',
    desc: 'Movie info via Wikidata SPARQL. Free, no key.',
    requiresKey: false, cacheTTL: 86400,
    fallbacks: ['search_wikipedia'],
    params: { query: { type: 'string', required: true } },
  },
  {
    id: 'search_youtube', category: 'entertainment', name: 'YouTube Search',
    desc: 'YouTube search via invidious (no API key). Returns video URLs.',
    requiresKey: false, cacheTTL: 1800,
    fallbacks: [],
    params: {
      query:       { type: 'string', required: true },
      max_results: { type: 'number', default: 3 },
      language:    { type: 'string', default: 'hi' },
    },
  },
  {
    id: 'get_joke', category: 'entertainment', name: 'Joke',
    desc: 'Random joke in Hindi/English from JokeAPI.',
    requiresKey: false, cacheTTL: 300,
    fallbacks: [],
    params: {
      language: { type: 'string', default: 'en', desc: 'en|hi' },
      type:     { type: 'string', default: 'any', desc: 'any|pun|programming' },
    },
  },

  // ── IMAGE GEN (2 tools) ────────────────────────────────
  {
    id: 'generate_image_fast', category: 'image_gen', name: 'Image Generate',
    desc: 'AI image via Pollinations (free, no key). Returns URL only.',
    requiresKey: false, cacheTTL: 0,
    fallbacks: ['generate_image_flux'],
    params: {
      prompt: { type: 'string', required: true },
      width:  { type: 'number', default: 1024 },
      height: { type: 'number', default: 1024 },
      model:  { type: 'string', default: 'flux', desc: 'flux|turbo|stable-diffusion' },
    },
  },
  {
    id: 'generate_image_flux', category: 'image_gen', name: 'Image (Flux)',
    desc: 'Flux model via Pollinations. Better quality.',
    requiresKey: false, cacheTTL: 0,
    fallbacks: [],
    params: {
      prompt: { type: 'string', required: true },
      style:  { type: 'string', default: 'photorealistic' },
    },
  },

  // ── PRODUCTIVITY (4 tools) ─────────────────────────────
  {
    id: 'set_reminder', category: 'productivity', name: 'Set Reminder',
    desc: 'Create a reminder stored in IndexedDB. No API.',
    requiresKey: false, cacheTTL: 0,
    fallbacks: [],
    params: {
      message: { type: 'string', required: true },
      time:    { type: 'string', required: true, desc: 'Time like "8pm" or "kal subah"' },
    },
  },
  {
    id: 'save_memory', category: 'productivity', name: 'Save Memory',
    desc: 'Save important info to JARVIS memory.',
    requiresKey: false, cacheTTL: 0,
    fallbacks: [],
    params: {
      key:   { type: 'string', required: true },
      value: { type: 'string', required: true },
    },
  },
  {
    id: 'recall_memory', category: 'productivity', name: 'Recall Memory',
    desc: 'Retrieve previously saved memory from JARVIS.',
    requiresKey: false, cacheTTL: 0,
    fallbacks: [],
    params: { query: { type: 'string', required: true } },
  },
  {
    id: 'get_quote', category: 'productivity', name: 'Quote',
    desc: 'Motivational/inspirational quote.',
    requiresKey: false, cacheTTL: 3600,
    fallbacks: [],
    params: { category: { type: 'string', default: 'motivational' } },
  },

  // ── SCIENCE (3 tools) ──────────────────────────────────
  {
    id: 'get_iss_location', category: 'science', name: 'ISS Location',
    desc: 'Live ISS position from open-notify.org. No key.',
    requiresKey: false, cacheTTL: 30,   // 30s cache — live data
    fallbacks: [],
  },
  {
    id: 'get_nasa_content', category: 'science', name: 'NASA APOD',
    desc: 'NASA Astronomy Picture of the Day. Free DEMO_KEY available.',
    requiresKey: false, cacheTTL: 43200,  // 12h
    fallbacks: [],
    params: { date: { type: 'string', desc: 'YYYY-MM-DD. Default: today' } },
  },
  {
    id: 'get_space_events', category: 'science', name: 'Space Events',
    desc: 'Upcoming rocket launches and space events from Launch Library.',
    requiresKey: false, cacheTTL: 3600,
    fallbacks: ['search_wikipedia'],
    params: { limit: { type: 'number', default: 3 } },
  },

  // ── HEALTH (2 tools) ───────────────────────────────────
  {
    id: 'calculate_bmi', category: 'health', name: 'BMI Calculator',
    desc: 'Calculate BMI from height and weight. No API.',
    requiresKey: false, cacheTTL: 0,
    fallbacks: [],
    params: {
      weight: { type: 'number', required: true, desc: 'Weight in kg' },
      height: { type: 'number', required: true, desc: 'Height in cm' },
    },
  },
  {
    id: 'get_calorie_info', category: 'health', name: 'Calorie Info',
    desc: 'Calorie count of foods via Open Food Facts (free).',
    requiresKey: false, cacheTTL: 86400,
    fallbacks: [],
    params: { food: { type: 'string', required: true } },
  },

  // ── SPORTS (2 tools) ───────────────────────────────────
  {
    id: 'get_cricket_score', category: 'sports', name: 'Cricket Score',
    desc: 'Live/recent cricket scores from CricAPI (free tier).',
    requiresKey: false, cacheTTL: 120,
    fallbacks: ['get_sports_news'],
    params: { type: { type: 'string', default: 'live', desc: 'live|recent|upcoming' } },
  },
  {
    id: 'get_sports_news', category: 'sports', name: 'Sports News',
    desc: 'Sports headlines via Google News RSS.',
    requiresKey: false, cacheTTL: 600,
    fallbacks: ['get_reddit_posts'],
    params: { sport: { type: 'string', default: 'cricket', desc: 'cricket|football|ipl|kabaddi' } },
  },

  // ── FOOD (1 tool) ──────────────────────────────────────
  {
    id: 'get_recipe', category: 'food', name: 'Recipe',
    desc: 'Indian + global recipes from TheMealDB (free).',
    requiresKey: false, cacheTTL: 86400,
    fallbacks: [],
    params: {
      query:    { type: 'string', required: true },
      category: { type: 'string', desc: 'Optional: vegetarian, chicken, dessert' },
    },
  },

  // ── FUN (2 tools) ──────────────────────────────────────
  {
    id: 'get_shayari', category: 'fun', name: 'Shayari',
    desc: 'Hindi/Urdu shayari — built-in collection.',
    requiresKey: false, cacheTTL: 0,
    fallbacks: [],
  },
  {
    id: 'get_trivia', category: 'fun', name: 'Trivia Quiz',
    desc: 'Random trivia question from OpenTDB (free).',
    requiresKey: false, cacheTTL: 300,
    fallbacks: ['get_joke'],
    params: {
      category: { type: 'string', desc: 'science|history|geography|sports' },
      difficulty: { type: 'string', default: 'medium' },
    },
  },

  // ── SEARCH (1 tool) ────────────────────────────────────
  {
    id: 'web_search', category: 'search', name: 'Web Search',
    desc: 'Web search via Brave API (needs key) or DuckDuckGo (free).',
    requiresKey: false, cacheTTL: 300,
    fallbacks: ['search_wikipedia'],
    params: {
      query: { type: 'string', required: true },
      count: { type: 'number', default: 3 },
    },
  },

  // ── PHOTOS (1 tool) ────────────────────────────────────
  {
    id: 'get_photos', category: 'image_gen', name: 'Stock Photos',
    desc: 'Free stock photos from Unsplash/Pexels (no key needed). Returns URLs.',
    requiresKey: false, cacheTTL: 3600,
    fallbacks: [],
    params: {
      query:       { type: 'string', required: true },
      count:       { type: 'number', default: 3 },
      orientation: { type: 'string', default: 'landscape' },
    },
  },

  // ── TRAVEL (1 tool) ────────────────────────────────────
  {
    id: 'get_travel_info', category: 'travel', name: 'Travel Info',
    desc: 'Travel info: visa, best season, distance, currency for destinations.',
    requiresKey: false, cacheTTL: 86400,
    fallbacks: ['search_wikipedia'],
    params: { destination: { type: 'string', required: true } },
  },
]

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

// Get tools for a category (fast lookup)
const _catIndex: Partial<Record<ToolCategory, ToolMeta[]>> = {}
export function getToolsByCategory(category: ToolCategory): ToolMeta[] {
  if (!_catIndex[category]) {
    _catIndex[category] = TOOL_REGISTRY.filter(t => t.category === category)
  }
  return _catIndex[category]!
}

// Get tool by id
const _idIndex: Record<string, ToolMeta> = {}
export function getToolById(id: string): ToolMeta | undefined {
  if (!_idIndex[id]) {
    for (const t of TOOL_REGISTRY) _idIndex[t.id] = t
  }
  return _idIndex[id]
}

// Get no-key tools for a category (preferred)
export function getNoKeyTools(category: ToolCategory): ToolMeta[] {
  return getToolsByCategory(category).filter(t => !t.requiresKey)
}

// Get Gemini function declarations for selected tools only
export function toGeminiFunctions(tools: ToolMeta[]): any[] {
  return tools.map(t => ({
    name: t.id,
    description: t.desc,
    parameters: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(t.params || {}).map(([k, v]) => [k, {
          type: v.type,
          description: v.desc || k,
          ...(v.default !== undefined ? { default: v.default } : {}),
        }])
      ),
      required: Object.entries(t.params || {})
        .filter(([, v]) => v.required)
        .map(([k]) => k),
    },
  }))
}

// Stats
export const REGISTRY_STATS = {
  total: TOOL_REGISTRY.length,
  noKey: TOOL_REGISTRY.filter(t => !t.requiresKey).length,
  categories: [...new Set(TOOL_REGISTRY.map(t => t.category))].length,
}
