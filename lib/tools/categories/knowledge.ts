// categories/knowledge.ts
export { search_wikipedia, get_word_meaning, translate_text, search_books } from '../no-key/index'

// Wiktionary fallback — free, no key
export async function get_definition_wiktionary(args: { word: string; lang?: string }) {
  const lang = args.lang || 'en'
  const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(args.word)}`, { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error('Wiktionary failed')
  const d = await res.json()
  const defs = d[lang]?.[0]?.definitions?.slice(0, 3) || []
  return {
    word: args.word,
    definitions: defs.map((x: any) => ({ pos: x.partOfSpeech, def: x.definition?.replace(/<[^>]+>/g, '') }))
  }
}
