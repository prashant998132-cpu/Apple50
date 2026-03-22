'use client'

export async function getGPSLocation(): Promise<{ lat: number; lng: number; accuracy: number; city?: string } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords
        try {
          const res = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lng}`)
          const d = await res.json()
          resolve({ lat, lng, accuracy, city: d.name || d.admin1 || 'Unknown' })
        } catch { resolve({ lat, lng, accuracy }) }
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  })
}

export function getNetworkInfo() {
  if (typeof navigator === 'undefined') return { type: 'unknown', speed: 'unknown', online: false }
  const conn = (navigator as any).connection || (navigator as any).mozConnection
  return {
    type: conn?.effectiveType || 'unknown',
    speed: conn?.downlink ? conn.downlink + ' Mbps' : 'unknown',
    online: navigator.onLine,
    rtt: conn?.rtt ? conn.rtt + 'ms' : 'unknown',
  }
}

export async function getBatteryInfo(): Promise<{ level: number; charging: boolean; timeLeft?: number } | null> {
  if (typeof navigator === 'undefined') return null
  try {
    const bat = await (navigator as any).getBattery?.()
    if (!bat) return null
    return { level: Math.round(bat.level * 100), charging: bat.charging, timeLeft: bat.charging ? bat.chargingTime : bat.dischargingTime }
  } catch { return null }
}

export async function readClipboard(): Promise<string> {
  if (typeof navigator === 'undefined') return ''
  try { return await navigator.clipboard.readText() } catch { return '' }
}

export async function writeClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

let wakeLock: any = null
export async function keepScreenOn(enable: boolean): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  try {
    if (enable) { wakeLock = await (navigator as any).wakeLock?.request('screen'); return !!wakeLock }
    else { await wakeLock?.release(); wakeLock = null; return true }
  } catch { return false }
}

export function vibrate(pattern: number | number[] = 200): boolean {
  if (typeof navigator === 'undefined') return false
  return navigator.vibrate?.(pattern) || false
}

export async function nativeShare(title: string, text: string, url?: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  try { await navigator.share({ title, text, url }); return true } catch { return false }
}

export async function toggleFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false
  try {
    if (!document.fullscreenElement) { await document.documentElement.requestFullscreen(); return true }
    else { await document.exitFullscreen(); return false }
  } catch { return false }
}

export async function getStorageInfo(): Promise<{ used: string; available: string; percent: number } | null> {
  if (typeof navigator === 'undefined') return null
  try {
    const est = await navigator.storage?.estimate()
    if (!est) return null
    const used = est.usage || 0, total = est.quota || 1
    return { used: (used/1024/1024).toFixed(1)+' MB', available: ((total-used)/1024/1024).toFixed(0)+' MB', percent: Math.round(used/total*100) }
  } catch { return null }
}

export async function checkPermissions(): Promise<Record<string, string>> {
  if (typeof navigator === 'undefined') return {}
  const perms: Record<string, string> = {}
  for (const p of ['camera','microphone','geolocation','notifications']) {
    try { const r = await navigator.permissions.query({ name: p as PermissionName }); perms[p] = r.state }
    catch { perms[p] = 'unknown' }
  }
  return perms
}

export function getDeviceInfo(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  return {
    screen: screen.width + 'x' + screen.height,
    dpr: String(window.devicePixelRatio || 1),
    language: navigator.language || 'unknown',
    cores: String((navigator as any).hardwareConcurrency || '?'),
    memory: (navigator as any).deviceMemory ? (navigator as any).deviceMemory + ' GB' : 'unknown',
    touch: 'ontouchstart' in window ? 'Yes' : 'No',
    pwa: window.matchMedia('(display-mode: standalone)').matches ? 'Installed' : 'Browser',
    online: String(navigator.onLine),
  }
}
