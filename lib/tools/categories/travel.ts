// categories/travel.ts
export { get_location_info } from '../no-key/index'

// Travel info — built-in + Wikipedia
export async function get_travel_info(args: { destination: string }) {
  const dest = args.destination
  try {
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(dest)}`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error('Wiki failed')
    const d = await res.json()
    return {
      destination: dest,
      summary: d.extract?.slice(0, 300),
      image: d.thumbnail?.source,
      wikipedia: d.content_urls?.desktop?.page,
      booking: `https://www.makemytrip.com/flights/`,
      hotels:  `https://www.booking.com/search.html?ss=${encodeURIComponent(dest)}`,
    }
  } catch {
    return {
      destination: dest,
      note: 'Travel info unavailable',
      links: { flights: 'https://www.makemytrip.com', hotels: `https://www.booking.com/search.html?ss=${encodeURIComponent(dest)}` }
    }
  }
}
