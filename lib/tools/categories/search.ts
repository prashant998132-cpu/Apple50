// categories/search.ts

// DuckDuckGo instant answer API — free, no key
export async function web_search(args: { query: string; count?: number }) {
  try {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(args.query)}&format=json&no_html=1&skip_disambig=1`, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) throw new Error('DDG failed')
    const d = await res.json()
    const results: any[] = []
    if (d.AbstractText) results.push({ title: d.Heading, snippet: d.AbstractText.slice(0, 300), url: d.AbstractURL || d.AbstractSource })
    if (d.RelatedTopics?.length) {
      for (const t of d.RelatedTopics.slice(0, Math.min(args.count || 3, 5))) {
        if (t.Text) results.push({ title: t.Text.slice(0, 80), snippet: t.Text.slice(0, 200), url: t.FirstURL })
      }
    }
    if (!results.length) return { query: args.query, note: 'No instant answer. Try Wikipedia or Google.', links: [`https://duckduckgo.com/?q=${encodeURIComponent(args.query)}`, `https://www.google.com/search?q=${encodeURIComponent(args.query)}`] }
    return { query: args.query, results: results.slice(0, args.count || 3) }
  } catch {
    return { query: args.query, search_link: `https://duckduckgo.com/?q=${encodeURIComponent(args.query)}` }
  }
}
