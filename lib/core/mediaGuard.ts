/* lib/core/mediaGuard.ts
 * CDN-only media — Vercel bandwidth waste rokta hai
 * Rule: Media sirf CDN se aaye — kabhi khud proxy mat karo
 */

// Allowed CDN domains for media
const ALLOWED_CDNS = [
  'image.pollinations.ai',
  'cdn.pixabay.com',
  'images.unsplash.com',
  'i.imgur.com',
  'upload.wikimedia.org',
  'avatars.githubusercontent.com',
  'raw.githubusercontent.com',
  'img.youtube.com',
  'i.ytimg.com',
  'media.giphy.com',
  'media0.giphy.com',
  'media1.giphy.com',
  'via.placeholder.com',
  'picsum.photos',
  'source.unsplash.com',
  'openweathermap.org',
  'wttr.in',
  // Indian news CDNs
  'akm-img-a-in.tosshub.com',
  'c.ndtvimg.com',
  'static.toiimg.com',
];

// Check if URL is from allowed CDN
export function isAllowedMedia(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_CDNS.some(cdn => hostname === cdn || hostname.endsWith(`.${cdn}`));
  } catch { return false; }
}

// Sanitize media URL — return null if not allowed
export function sanitizeMediaUrl(url: string | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('data:')) return null;     // no base64 blobs
  if (url.startsWith('/api/')) return null;      // no internal proxy
  if (!url.startsWith('https://')) return null;  // https only
  if (!isAllowedMedia(url)) {
    console.warn('[mediaGuard] Blocked:', url);
    return null;
  }
  return url;
}

// Generate Pollinations image URL (primary free CDN)
export function pollinationsImage(prompt: string, opts: {
  width?:  number;
  height?: number;
  model?:  string;
  seed?:   number;
} = {}): string {
  const { width = 512, height = 512, model = 'flux', seed } = opts;
  const encoded = encodeURIComponent(prompt.slice(0, 200));
  const seedParam = seed ? `&seed=${seed}` : '';
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&model=${model}${seedParam}&nologo=true`;
}

// Generate Pollinations GIF (from image)
export function pollinationsGif(prompt: string): string {
  return pollinationsImage(prompt, { width: 400, height: 400, model: 'flux' });
}

// Check if image is loading (for lazy load optimization)
export function getMediaLoadPriority(index: number): 'eager' | 'lazy' {
  return index < 2 ? 'eager' : 'lazy';
}
