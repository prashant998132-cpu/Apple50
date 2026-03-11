// lib/tools/categories/media.ts — Photos, GIFs, Videos
import { pollinationsImage } from '../../core/mediaGuard'

export async function unsplash_random(args: { query?: string }) {
  const q = args.query || 'nature'
  return {
    success: true,
    card: { type: 'image', imageUrl: `https://source.unsplash.com/800x600/?${encodeURIComponent(q)}`, title: `📷 ${q}` },
    text: `📷 **Unsplash photo:** ${q}`,
  }
}

export async function unsplash_search(args: { query: string }) {
  return unsplash_random(args)
}

export async function giphy_search(args: { query: string }) {
  const r = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(args.query)}&limit=3`).catch(() => null)
  if (!r?.ok) return { success: true, card: { type: 'gif', imageUrl: `https://media.giphy.com/media/3o7btNhMBytxAM6YBa/giphy.gif`, title: args.query }, text: `🎭 GIF: ${args.query}` }
  const d = await r.json()
  const gif = d.data?.[0]?.images?.fixed_height?.url
  return { success: true, card: { type: 'gif', imageUrl: gif, title: args.query }, text: `🎭 GIF: ${args.query}` }
}

export async function picsum_image(args: { width?: number; height?: number }) {
  const w = args.width || 600, h = args.height || 400
  return { success: true, card: { type: 'image', imageUrl: `https://picsum.photos/${w}/${h}?random=${Date.now()}`, title: 'Random photo' }, text: '🖼️ Random photo' }
}

export { unsplash_random as pexels_search, unsplash_search as pixabay_search, giphy_search as giphy_trending, picsum_image as tenor_gifs }
