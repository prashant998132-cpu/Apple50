/* lib/location/tracker.ts — GPS → Nominatim → IndexedDB */
'use client';

import { saveLocation, getLocation } from '@/lib/storage';

export interface Location {
  lat: number;
  lon: number;
  city?: string;
  region?: string;
  country?: string;
}

export async function getOrDetectLocation(): Promise<Location | null> {
  // Check cache first
  try {
    const cached = await getLocation();
    if (cached && Date.now() - cached.updatedAt < 3600000) {
      return { lat: cached.lat, lon: cached.lon, city: cached.city, region: cached.region, country: cached.country };
    }
  } catch {}

  // Try GPS
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
          const data = await res.json();
          const loc: Location = {
            lat,
            lon,
            city: data?.address?.city || data?.address?.town || data?.address?.village || '',
            region: data?.address?.state || '',
            country: data?.address?.country || '',
          };
          await saveLocation({ ...loc, updatedAt: Date.now() });
          resolve(loc);
        } catch {
          resolve({ lat, lon });
        }
      },
      () => resolve(null),
      { timeout: 5000, maximumAge: 3600000 },
    );
  });
}

export function formatLocation(loc: Location | null): string {
  if (!loc) return 'unknown location';
  const parts = [loc.city, loc.region, loc.country].filter(Boolean);
  return parts.join(', ') || `${loc.lat.toFixed(2)}, ${loc.lon.toFixed(2)}`;
}
