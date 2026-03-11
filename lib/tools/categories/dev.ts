// lib/tools/categories/dev.ts — Developer Tools
export { getGitHubTrending as github_trending } from '../connected/index'

export async function npm_search(args: { query: string }) {
  try {
    const r = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(args.query)}&size=5`)
    const d = await r.json()
    const pkgs = d.objects?.slice(0, 5).map((p: any) =>
      `📦 **${p.package.name}** v${p.package.version} — ${p.package.description?.slice(0, 80) || ''}`
    ).join('\n') || 'No packages found'
    return { success: true, text: `📦 **npm: "${args.query}"**\n\n${pkgs}` }
  } catch { return { success: false, error: 'npm search failed' } }
}

export async function stackoverflow_search(args: { query: string }) {
  try {
    const r = await fetch(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(args.query)}&site=stackoverflow&pagesize=5`)
    const d = await r.json()
    const qs = d.items?.slice(0, 4).map((q: any) =>
      `• **[${q.title}](${q.link})** (${q.score} votes, ${q.answer_count} answers)`
    ).join('\n') || 'No results'
    return { success: true, text: `🔍 **StackOverflow: "${args.query}"**\n\n${qs}` }
  } catch { return { success: false, error: 'SO search failed' } }
}

export async function chess_stats(args: { username: string }) {
  try {
    const r = await fetch(`https://api.chess.com/pub/player/${args.username}/stats`)
    const d = await r.json()
    const rapid = d?.chess_rapid?.last?.rating || 'N/A'
    return { success: true, text: `♟️ **Chess.com: ${args.username}**\nRapid rating: ${rapid}` }
  } catch { return { success: false, error: 'Chess stats failed' } }
}

export async function pypi_search(args: { query: string }) {
  try {
    const r = await fetch(`https://pypi.org/pypi/${encodeURIComponent(args.query)}/json`)
    const d = await r.json()
    const info = d.info
    return { success: true, text: `🐍 **PyPI: ${info.name}** v${info.version}\n${info.summary}` }
  } catch { return { success: false, error: 'PyPI search failed' } }
}
