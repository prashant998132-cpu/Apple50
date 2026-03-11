// categories/entertainment.ts
export { get_joke } from '../no-key/index'
export { search_movies, search_youtube } from '../free-key/index'

// Movie fallback via Wikidata SPARQL (free, no key)
export async function search_movies_nokey(args: { query: string }) {
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(args.query)}`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error('not found')
    const d = await res.json()
    return { title: d.title, summary: d.extract?.slice(0, 300), image: d.thumbnail?.source, url: d.content_urls?.desktop?.page }
  } catch {
    return { query: args.query, note: 'Search on JustWatch', link: `https://www.justwatch.com/in/search?q=${encodeURIComponent(args.query)}` }
  }
}

// YouTube via Invidious (no API key needed)
export async function search_youtube_nokey(args: { query: string; max_results?: number }) {
  const instances = ['https://iv.datura.network', 'https://invidious.incogniweb.net']
  for (const base of instances) {
    try {
      const res = await fetch(`${base}/api/v1/search?q=${encodeURIComponent(args.query)}&type=video`, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) continue
      const d = await res.json()
      const videos = (Array.isArray(d) ? d : []).slice(0, args.max_results || 3)
      return videos.map((v: any) => ({
        title: v.title,
        videoId: v.videoId,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        thumbnail: `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg`,
        views: v.viewCount,
        duration: v.lengthSeconds,
      }))
    } catch {}
  }
  return [{ query: args.query, note: 'Search on YouTube', link: `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}` }]
}
