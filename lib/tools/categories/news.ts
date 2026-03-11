// categories/news.ts
export { get_reddit_posts, get_hackernews } from '../no-key/index'
export { get_india_news } from '../free-key/index'

// RSS-based news — zero API key, pure public feeds
const RSS_SOURCES: Record<string, string> = {
  toi:          'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
  ndtv:         'https://feeds.feedburner.com/ndtvnews-top-stories',
  bbc_hindi:    'https://feeds.bbci.co.uk/hindi/rss.xml',
  hindustan:    'https://www.livehindustan.com/rss/ttop.xml',
  hindu:        'https://www.thehindu.com/news/national/feeder/default.rss',
  india_today:  'https://www.indiatoday.in/rss/1206514',
  sports:       'https://www.espncricinfo.com/rss/content/story/feeds/0.xml',
}

export async function get_news_rss(args: { source?: string; limit?: number }) {
  const url = RSS_SOURCES[args.source || 'ndtv'] || RSS_SOURCES.ndtv
  const limit = args.limit || 5
  const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&count=${limit}`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error('RSS fetch failed')
  const d = await res.json()
  if (d.status !== 'ok') throw new Error('RSS parse failed')
  return {
    source: d.feed?.title || args.source,
    items: d.items?.slice(0, limit).map((i: any) => ({
      title: i.title,
      description: i.description?.replace(/<[^>]+>/g, '').slice(0, 120),
      link: i.link,
      pubDate: i.pubDate,
    })) || [],
  }
}
