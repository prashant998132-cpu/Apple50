// categories/image_gen.ts
export { generate_image_fast } from '../no-key/index'
export { get_photos } from '../free-key/index'

// Flux via Pollinations — no key, returns URL (never proxied)
export async function generate_image_flux(args: { prompt: string; style?: string }) {
  const stylePrefix = args.style ? `${args.style} style, ` : ''
  const fullPrompt = stylePrefix + args.prompt
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?model=flux&width=1024&height=1024&nologo=true&enhance=true`
  // We never fetch the image — just return the URL
  return { url, prompt: fullPrompt, model: 'flux', note: 'Direct URL — no proxy, no bandwidth used' }
}

// Unsplash without key (via source.unsplash.com)
export async function get_free_photo(args: { query: string; count?: number }) {
  const count = Math.min(args.count || 3, 5)
  const photos = Array.from({ length: count }, (_, i) => ({
    url: `https://source.unsplash.com/1200x800/?${encodeURIComponent(args.query)}&sig=${i}`,
    thumb: `https://source.unsplash.com/400x300/?${encodeURIComponent(args.query)}&sig=${i}`,
    query: args.query,
    source: 'Unsplash (free)',
  }))
  return photos
}
