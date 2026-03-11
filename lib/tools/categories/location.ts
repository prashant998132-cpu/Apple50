// categories/location.ts
export { get_location_info, lookup_pincode } from '../no-key/index'
export { get_user_location } from '../free-key/index'

// Haversine distance — zero API, pure math
export async function get_distance(args: { from: string; to: string }) {
  // Built-in coords for common Indian cities
  const COORDS: Record<string, [number, number]> = {
    'delhi': [28.6139, 77.2090], 'mumbai': [19.0760, 72.8777],
    'kolkata': [22.5726, 88.3639], 'chennai': [13.0827, 80.2707],
    'bangalore': [12.9716, 77.5946], 'bengaluru': [12.9716, 77.5946],
    'hyderabad': [17.3850, 78.4867], 'pune': [18.5204, 73.8567],
    'ahmedabad': [23.0225, 72.5714], 'jaipur': [26.9124, 75.7873],
    'lucknow': [26.8467, 80.9462], 'bhopal': [23.2599, 77.4126],
    'rewa': [24.5362, 81.3032], 'indore': [22.7196, 75.8577],
    'nagpur': [21.1458, 79.0882], 'patna': [25.5941, 85.1376],
    'agra': [27.1767, 78.0081], 'varanasi': [25.3176, 82.9739],
    'london': [51.5074, -0.1278], 'new york': [40.7128, -74.0060],
    'tokyo': [35.6762, 139.6503], 'dubai': [25.2048, 55.2708],
  }
  const f = args.from.toLowerCase().trim()
  const t = args.to.toLowerCase().trim()
  const c1 = COORDS[f], c2 = COORDS[t]
  if (!c1 || !c2) {
    return { from: args.from, to: args.to, note: 'Exact distance unavailable. Try Google Maps.', link: `https://www.google.com/maps/dir/${encodeURIComponent(args.from)}/${encodeURIComponent(args.to)}` }
  }
  const R = 6371
  const dLat = (c2[0] - c1[0]) * Math.PI / 180
  const dLon = (c2[1] - c1[1]) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(c1[0]*Math.PI/180) * Math.cos(c2[0]*Math.PI/180) * Math.sin(dLon/2)**2
  const km = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))
  return { from: args.from, to: args.to, distance_km: km, distance_miles: Math.round(km * 0.621) }
}
