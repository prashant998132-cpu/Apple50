/* lib/core/deviceContext.ts
 * Battery, network, wake lock — device ke hisaab se behavior adjust karo
 * Rule G30: Graceful fallback — koi bhi API missing ho toh crash nahi
 */
'use client';

import type { DeviceInfo } from '@/types/jarvis.types';

let _cached: DeviceInfo | null = null;
let _wakeLock: any = null;

// Get current device info
export async function getDeviceInfo(): Promise<DeviceInfo> {
  if (typeof window === 'undefined') {
    return { lowPower: false, prefersReducedMotion: false };
  }

  const info: DeviceInfo = {
    lowPower:             false,
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };

  // Battery API
  try {
    const nav = navigator as any;
    if (nav.getBattery) {
      const bat = await nav.getBattery();
      info.battery  = bat.level;
      info.charging = bat.charging;
      info.lowPower = bat.level < 0.2 && !bat.charging;
    }
  } catch {}

  // Network API
  try {
    const conn = (navigator as any).connection;
    if (conn) {
      info.connection = conn.effectiveType || 'unknown';
      // Slow connection = limit model tier
      if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') {
        info.lowPower = true; // treat slow network same as low power
      }
    }
  } catch {}

  _cached = info;
  return info;
}

// Cached version (fast)
export function getCachedDeviceInfo(): DeviceInfo {
  return _cached || { lowPower: false, prefersReducedMotion: false };
}

// Suggest model tier based on device
export function suggestTierFromDevice(device: DeviceInfo): 'nano' | 'standard' | null {
  if (device.lowPower) return 'nano';
  if (device.connection === 'slow-2g' || device.connection === '2g') return 'nano';
  if (device.connection === '3g') return 'standard';
  return null; // let agentDispatcher decide
}

// Wake lock — screen on rakhna (voice mode mein useful)
export async function requestWakeLock(): Promise<boolean> {
  try {
    if (!('wakeLock' in navigator)) return false;
    _wakeLock = await (navigator as any).wakeLock.request('screen');
    return true;
  } catch { return false; }
}

export function releaseWakeLock(): void {
  try { _wakeLock?.release(); _wakeLock = null; } catch {}
}

// Battery toast message
export function getBatteryWarning(device: DeviceInfo): string | null {
  if (!device.battery) return null;
  if (device.battery < 0.1 && !device.charging) return '🔋 Battery 10% — fast mode on';
  if (device.battery < 0.2 && !device.charging) return '🔋 Battery low — nano mode preferred';
  return null;
}

// Network toast message
export function getNetworkWarning(device: DeviceInfo): string | null {
  if (device.connection === 'slow-2g') return '📶 Very slow connection — responses may be slow';
  if (device.connection === '2g')      return '📶 2G connection — using fast mode';
  return null;
}
