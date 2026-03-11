// categories/weather.ts
export { get_weather } from '../no-key/index'
export { get_air_quality } from '../free-key/index'

// Fallback via wttr.in (zero key, public API)
export async function get_weather_wttr(args: { location?: string }) {
  const loc = encodeURIComponent(args.location || 'Rewa')
  const res = await fetch(`https://wttr.in/${loc}?format=j1`, {
    headers: { 'User-Agent': 'JARVIS/1.0' },
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error('wttr.in failed')
  const d = await res.json()
  const cur = d.current_condition?.[0] || {}
  const area = d.nearest_area?.[0]
  return {
    location: area ? `${area.areaName?.[0]?.value}, ${area.country?.[0]?.value}` : args.location,
    temp_c: cur.temp_C,
    feels_like: cur.FeelsLikeC,
    humidity: cur.humidity + '%',
    description: cur.weatherDesc?.[0]?.value,
    wind_kmph: cur.windspeedKmph,
    uv_index: cur.uvIndex,
    visibility: cur.visibility + ' km',
  }
}
