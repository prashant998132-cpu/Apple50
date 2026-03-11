// lib/tools/categories/books.ts — Books, Literature
// Apple50 connected/index se jo available hai woh use karo
export { searchWiki as openlib_search } from '../connected/index'

// Standalone: OpenLibrary
export async function search_books(args: { query: string }) {
  try {
    const r = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(args.query)}&limit=5`)
    const d = await r.json()
    const books = d.docs?.slice(0, 5).map((b: any) =>
      `📚 **${b.title}** by ${b.author_name?.[0] || 'Unknown'} (${b.first_publish_year || '?'})`
    ).join('\n') || 'No books found'
    return { success: true, text: `📚 **Books: "${args.query}"**\n\n${books}` }
  } catch { return { success: false, error: 'Books search failed' } }
}

export async function get_synonyms(args: { word: string }) {
  try {
    const r = await fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(args.word)}&max=8`)
    const d = await r.json()
    const words = d.map((w: any) => w.word).join(', ')
    return { success: true, text: `🔤 **Synonyms of "${args.word}":** ${words}` }
  } catch { return { success: false, error: 'Synonyms failed' } }
}

export async function get_rhymes(args: { word: string }) {
  try {
    const r = await fetch(`https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(args.word)}&max=8`)
    const d = await r.json()
    const words = d.map((w: any) => w.word).join(', ')
    return { success: true, text: `🎵 **Rhymes with "${args.word}":** ${words}` }
  } catch { return { success: false, error: 'Rhymes failed' } }
}
