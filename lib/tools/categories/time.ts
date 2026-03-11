// categories/time.ts
import { get_datetime as _gdt, get_public_holidays as _gph, get_sunrise_sunset as _gss } from '../no-key/index'
export async function get_datetime(args?: { timezone?: string; format?: string }) { return _gdt(args || {}) }
export async function get_public_holidays(args?: { country?: string; year?: number }) { return _gph(args || {}) }
export async function get_sunrise_sunset(args?: { lat?: number; lon?: number; date?: string }) { return _gss(args || {}) }
