// lib/tools/categories/music.ts — Music APIs
export async function deezer_search(args: { query: string }) {
  try {
    const r = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(args.query)}&limit=5`)
    const d = await r.json()
    const tracks = d.data?.slice(0, 4).map((t: any) =>
      `🎵 **${t.title}** — ${t.artist.name}\n  [Preview](${t.preview})`
    ).join('\n\n') || 'No tracks found'
    return { success: true, text: `🎵 **Deezer: "${args.query}"**\n\n${tracks}` }
  } catch { return { success: false, error: 'Deezer search failed' } }
}

export async function deezer_chart() {
  try {
    const r = await fetch('https://api.deezer.com/chart/0/tracks?limit=5')
    const d = await r.json()
    const tracks = d.data?.slice(0, 5).map((t: any, i: number) =>
      `${i+1}. **${t.title}** — ${t.artist.name}`
    ).join('\n') || 'Chart unavailable'
    return { success: true, text: `🏆 **Deezer Top Charts:**\n\n${tracks}` }
  } catch { return { success: false, error: 'Chart failed' } }
}

export async function spotify_search(args: { query: string }) {
  const url = `https://open.spotify.com/search/${encodeURIComponent(args.query)}`
  return { success: true, text: `🎧 **Spotify Search:** "${args.query}"\n[Spotify mein sunna hai →](${url})` }
}

export async function lastfm_artist_info(args: { artist: string }) {
  try {
    const r = await fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(args.artist)}&api_key=43693facbb24d1ac893a7d33846bd4c2&format=json`)
    const d = await r.json()
    const info = d.artist
    return { success: true, text: `🎤 **${info.name}**\nListeners: ${Number(info.stats?.listeners).toLocaleString()}\n\n${info.bio?.summary?.split('<a')[0]?.slice(0, 200)}...` }
  } catch { return { success: false, error: 'LastFM failed' } }
}

export async function lastfm_top_charts() {
  try {
    const r = await fetch('https://ws.audioscrobbler.com/2.0/?method=chart.getTopTracks&api_key=43693facbb24d1ac893a7d33846bd4c2&format=json&limit=5')
    const d = await r.json()
    const tracks = d.tracks?.track?.slice(0,5).map((t: any, i: number) =>
      `${i+1}. **${t.name}** — ${t.artist.name}`
    ).join('\n') || 'Charts unavailable'
    return { success: true, text: `🏆 **Global Top Tracks:**\n\n${tracks}` }
  } catch { return { success: false, error: 'Charts failed' } }
}

export async function musicbrainz_artist(args: { artist: string }) {
  try {
    const r = await fetch(`https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(args.artist)}&fmt=json&limit=3`, { headers: { 'User-Agent': 'JARVIS/1.0' } })
    const d = await r.json()
    const a = d.artists?.[0]
    return { success: true, text: `🎼 **${a?.name}** (${a?.disambiguation || a?.type || 'Artist'})\nCountry: ${a?.country || 'Unknown'}` }
  } catch { return { success: false, error: 'MusicBrainz failed' } }
}
