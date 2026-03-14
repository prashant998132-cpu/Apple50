import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'
export const maxDuration = 15

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  if (!q.trim()) return NextResponse.json({ error: 'No query' }, { status: 400 })

  const results: any[] = []

  // 1. DuckDuckGo Instant Answer (no key needed)
  try {
    const r = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`, { signal: AbortSignal.timeout(5000) })
    const d = await r.json()
    if (d.AbstractText) results.push({ type: 'answer', title: d.Heading || q, text: d.AbstractText, url: d.AbstractURL, source: 'DuckDuckGo' })
    if (d.Answer) results.push({ type: 'instant', title: 'Instant Answer', text: d.Answer, source: 'DuckDuckGo' })
    // Related topics
    if (d.RelatedTopics?.length) {
      d.RelatedTopics.slice(0, 3).forEach((t: any) => {
        if (t.Text) results.push({ type: 'related', title: t.Text.slice(0, 80), text: t.Text, url: t.FirstURL, source: 'DuckDuckGo' })
      })
    }
  } catch {}

  // 2. Wikipedia
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(4000) })
    if (r.ok) {
      const d = await r.json()
      if (d.extract) results.push({ type: 'wiki', title: d.title, text: d.extract.slice(0, 500), url: d.content_urls?.desktop?.page, image: d.thumbnail?.source, source: 'Wikipedia' })
    }
  } catch {}

  // 3. HN search
  try {
    const r = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&hitsPerPage=3&tags=story`, { signal: AbortSignal.timeout(4000) })
    const d = await r.json()
    d.hits?.slice(0, 3).forEach((h: any) => {
      results.push({ type: 'news', title: h.title, text: `⬆${h.points} · ${h.author}`, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, source: 'HN' })
    })
  } catch {}

  return NextResponse.json({ query: q, results, count: results.length })
}
