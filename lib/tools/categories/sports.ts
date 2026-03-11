// categories/sports.ts

// Cricket via cricketdata.org (free public) + ESPN RSS fallback
export async function get_cricket_score(args: { type?: string }) {
  const type = args.type || 'live'
  try {
    // Try cricAPI free endpoint
    const res = await fetch('https://api.cricapi.com/v1/currentMatches?apikey=apikey&offset=0', { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const d = await res.json()
      if (d.status === 'success') {
        return { matches: d.data?.slice(0, 3).map((m: any) => ({ name: m.name, status: m.status, score: m.score })) }
      }
    }
  } catch {}
  // Fallback: ESPN RSS
  try {
    const rss = await fetch('https://www.espncricinfo.com/rss/content/story/feeds/0.xml', { signal: AbortSignal.timeout(5000) })
    if (rss.ok) {
      const xml = await rss.text()
      const titles = [...xml.matchAll(/<title><!\[CDATA\[([^\]]+)\]\]>/g)].slice(1, 4).map(m => m[1])
      return { type, headlines: titles, source: 'ESPNCricinfo', full: 'https://www.espncricinfo.com' }
    }
  } catch {}
  return { note: 'Live scores at', links: ['https://www.cricbuzz.com', 'https://www.espncricinfo.com'] }
}

// Sports news via RSS
export async function get_sports_news(args: { sport?: string }) {
  const sport = args.sport || 'cricket'
  const feeds: Record<string, string> = {
    cricket:  'https://www.espncricinfo.com/rss/content/story/feeds/0.xml',
    football: 'https://www.goal.com/feeds/en/news',
    general:  'https://timesofindia.indiatimes.com/rss/4719148.cms',
  }
  const url = feeds[sport] || feeds.general
  try {
    const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=5`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error('RSS failed')
    const d = await res.json()
    return { sport, items: d.items?.slice(0, 5).map((i: any) => ({ title: i.title, link: i.link, date: i.pubDate })) }
  } catch {
    return { sport, note: 'Check latest scores at cricbuzz.com', link: 'https://www.cricbuzz.com' }
  }
}
