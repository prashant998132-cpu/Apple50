// categories/fun.ts
import { get_joke as _gj, get_quote as _gq } from '../no-key/index'
export async function get_joke(args?: { language?: string; type?: string }) { return _gj(args || {}) }
export async function get_quote_builtin() { return _gq() }

// Shayari — built-in collection (no API needed)
const SHAYARI = [
  'Dil ke dard ko lafzon mein kahan likh paate,\nYe aansu hi hain jo sab kuch keh jaate.',
  'Waqt ke saath bhaagti hai ye zindagi,\nKuch yaadein chhod jaati hai khud ki kami.',
  'Mohabbat sikhati hai sabr ka matlab,\nToot ke hi samjhe hum dil ka junoon.',
  'Jo beet gaya use bhoolna seekho,\nAane waale pal ko apna banaalo.',
  'Toofan se ladna seekho, girke uthna seekho,\nJindagi badi khoobsurat hai, jeena seekho.',
  'Kuch khwab aise bhi hote hain jo poore nahi hote,\nLekin unhe dekhne ki aadat nahi jaati.',
  'Akele chalte rehna ek aadat ban gayi,\nAb saath ki zaroorat hi nahi rahi.',
]

export async function get_shayari() {
  const s = SHAYARI[Math.floor(Math.random() * SHAYARI.length)]
  return { shayari: s, type: 'Hinglish/Urdu' }
}

// Trivia — Open Trivia DB (free, no key)
export async function get_trivia(args: { category?: string; difficulty?: string }) {
  const catMap: Record<string, number> = { science: 17, history: 23, geography: 22, sports: 21, general: 9 }
  const catId = catMap[args.category || 'general'] || 9
  const diff = args.difficulty || 'medium'
  try {
    const res = await fetch(`https://opentdb.com/api.php?amount=1&type=multiple&difficulty=${diff}&category=${catId}`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error('OpenTDB failed')
    const d = await res.json()
    const q = d.results?.[0]
    if (!q) throw new Error('No question')
    return {
      question: q.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'),
      correct: q.correct_answer,
      options: [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5),
      category: q.category,
      difficulty: q.difficulty,
    }
  } catch {
    return { question: 'Bharat ka sabse bada shaher kaunsa hai?', correct: 'Mumbai', options: ['Delhi', 'Mumbai', 'Kolkata', 'Chennai'] }
  }
}
