// categories/science.ts
export { get_iss_location } from '../no-key/index'
export { get_nasa_content } from '../free-key/index'

// Space launches — Launch Library 2 (free, no key)
export async function get_space_events(args: { limit?: number }) {
  try {
    const res = await fetch(`https://ll.thespacedevs.com/2.2.0/launch/upcoming/?format=json&limit=${args.limit || 3}&mode=list`, { signal: AbortSignal.timeout(7000) })
    if (!res.ok) throw new Error('API failed')
    const d = await res.json()
    return {
      launches: d.results?.slice(0, args.limit || 3).map((l: any) => ({
        name: l.name,
        date: l.net,
        provider: l.launch_service_provider?.name,
        location: l.pad?.location?.name,
        mission: l.mission?.description?.slice(0, 100),
      })) || []
    }
  } catch {
    return { note: 'Space launches at', link: 'https://www.nextspaceflight.com' }
  }
}
