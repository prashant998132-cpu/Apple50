// lib/automation/bridge.ts — Phone Automation Bridge v2
// Priority: IFTTT (easy, no app needed) → URL Schemes → Browser APIs → MacroDroid (optional)
'use client'

export interface AutomationAction {
  type: 'wifi_on' | 'wifi_off' | 'bluetooth_on' | 'bluetooth_off'
       | 'open_app' | 'call' | 'sms' | 'alarm' | 'volume'
       | 'torch' | 'notification' | 'vibrate' | 'custom'
  payload?: Record<string, any>
}

// ── IFTTT Webhook ─────────────────────────────────────────
function getIFTTTKey(): string | null {
  try { return localStorage.getItem('jarvis_ifttt_key') } catch { return null }
}

export async function triggerIFTTT(event: string, value1 = '', value2 = '', value3 = ''): Promise<{ ok: boolean; msg: string }> {
  const key = getIFTTTKey()
  if (!key) return { ok: false, msg: 'IFTTT key nahi hai. Settings → Automation mein daalo.' }
  try {
    const res = await fetch(`https://maker.ifttt.com/trigger/${event}/with/key/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value1, value2, value3 }),
    })
    return res.ok ? { ok: true, msg: 'IFTTT trigger sent!' } : { ok: false, msg: `IFTTT error: ${res.status}` }
  } catch (e) {
    return { ok: false, msg: 'IFTTT network error' }
  }
}

// ── URL Schemes — app open (browser intent) ───────────────
export function openApp(app: string, extra = ''): { ok: boolean; msg: string } {
  const schemes: Record<string, string> = {
    whatsapp:   `whatsapp://send?text=${encodeURIComponent(extra)}`,
    whatsapp_call: `whatsapp://call?phone=${extra}`,
    telegram:   `tg://msg?text=${encodeURIComponent(extra)}`,
    phone:      `tel:${extra}`,
    sms:        `sms:${extra}`,
    maps:       `geo:0,0?q=${encodeURIComponent(extra)}`,
    youtube:    `vnd.youtube:${extra}`,
    instagram:  'instagram://',
    camera:     'intent://camera#Intent;scheme=android-app;package=com.android.camera;end',
    settings:   'intent://settings#Intent;scheme=android-app;end',
    gmail:      `mailto:${extra}`,
    chrome:     `googlechrome://navigate?url=${encodeURIComponent(extra)}`,
    spotify:    `spotify://`,
    upi:        `upi://pay?pa=${extra}`,
    calculator: 'intent://calculator#Intent;scheme=android-app;end',
  }
  const url = schemes[app.toLowerCase()]
  if (!url) return { ok: false, msg: `Unknown app: ${app}` }
  try {
    window.location.href = url
    return { ok: true, msg: `Opening ${app}...` }
  } catch {
    return { ok: false, msg: 'App open failed' }
  }
}

// ── Browser Vibrate API ───────────────────────────────────
export function vibrate(pattern: number | number[] = 200): boolean {
  if (typeof window === 'undefined' || !navigator.vibrate) return false
  navigator.vibrate(pattern)
  return true
}

// ── PWA Push Notification ─────────────────────────────────
export async function showNotification(title: string, body: string, icon = '/icon-192.png'): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window)) return false
  if (Notification.permission === 'denied') return false
  if (Notification.permission !== 'granted') {
    const p = await Notification.requestPermission()
    if (p !== 'granted') return false
  }
  try {
    const reg = await navigator.serviceWorker?.ready
    if (reg?.showNotification) {
      await reg.showNotification(title, { body, icon, badge: '/icon-192.png' })
    } else {
      new Notification(title, { body, icon })
    }
    return true
  } catch { return false }
}

// ── Battery Monitor ──────────────────────────────────────
export async function getBatteryInfo(): Promise<{ level: number; charging: boolean } | null> {
  try {
    const nav = navigator as any
    if (!nav.getBattery) return null
    const bat = await nav.getBattery()
    return { level: Math.round(bat.level * 100), charging: bat.charging }
  } catch { return null }
}

export async function checkBatteryAlert(onAlert: (msg: string) => void): Promise<void> {
  const bat = await getBatteryInfo()
  if (!bat) return
  if (bat.level <= 15 && !bat.charging) {
    const msg = `Boss, battery ${bat.level}% pe hai! Charge lagao jaldi.`
    onAlert(msg)
    vibrate([200, 100, 200])
    showNotification('⚡ Battery Low!', msg)
  }
}

// ── MacroDroid (optional fallback) ───────────────────────
function getMacroDroidId(): string | null {
  try { return localStorage.getItem('jarvis_macrodroid_id') } catch { return null }
}

export async function triggerMacro(action: AutomationAction): Promise<{ ok: boolean; msg: string }> {
  // Try IFTTT first
  const iftttMap: Record<string, string> = {
    wifi_on: 'jarvis_wifi_on', wifi_off: 'jarvis_wifi_off',
    bluetooth_on: 'jarvis_bt_on', bluetooth_off: 'jarvis_bt_off',
    alarm: 'jarvis_alarm', notification: 'jarvis_notify',
    volume: 'jarvis_volume', torch: 'jarvis_torch',
    sms: 'jarvis_sms', custom: action.payload?.event || 'jarvis_custom',
  }
  const iftttEvent = iftttMap[action.type]
  if (iftttEvent && getIFTTTKey()) {
    return triggerIFTTT(
      iftttEvent,
      action.payload?.value1 || '',
      action.payload?.value2 || '',
      action.payload?.value3 || '',
    )
  }

  // Vibrate — no setup needed
  if (action.type === 'vibrate') {
    vibrate(action.payload?.pattern || 200)
    return { ok: true, msg: 'Vibrated!' }
  }

  // Notification — browser native
  if (action.type === 'notification') {
    const ok = await showNotification(
      action.payload?.title || 'JARVIS',
      action.payload?.body || '',
    )
    return { ok, msg: ok ? 'Notification sent!' : 'Notification permission nahi hai' }
  }

  // App open via URL scheme
  if (action.type === 'open_app' && action.payload?.app) {
    return openApp(action.payload.app, action.payload.extra || '')
  }

  // Phone call
  if (action.type === 'call' && action.payload?.number) {
    window.location.href = `tel:${action.payload.number}`
    return { ok: true, msg: `Calling ${action.payload.number}...` }
  }

  // SMS
  if (action.type === 'sms' && action.payload?.number) {
    window.location.href = `sms:${action.payload.number}?body=${encodeURIComponent(action.payload.text || '')}`
    return { ok: true, msg: 'SMS app open ho raha hai...' }
  }

  // MacroDroid fallback
  const deviceId = getMacroDroidId()
  if (deviceId) {
    const webhookMap: Record<string, string> = {
      wifi_on: 'jarvis_wifi_on', wifi_off: 'jarvis_wifi_off',
      bluetooth_on: 'jarvis_bt_on', bluetooth_off: 'jarvis_bt_off',
      alarm: 'jarvis_alarm', torch: 'jarvis_torch', volume: 'jarvis_volume',
      custom: action.payload?.webhook || 'jarvis_custom',
    }
    const webhook = webhookMap[action.type] || 'jarvis_custom'
    try {
      const params = new URLSearchParams()
      if (action.payload) Object.entries(action.payload).forEach(([k, v]) => params.append(k, String(v)))
      const url = `https://trigger.macrodroid.com/${deviceId}/${webhook}`
      const fullUrl = action.payload ? `${url}?${params}` : url
      const res = await fetch(fullUrl, { method: 'GET' })
      return res.ok ? { ok: true, msg: 'MacroDroid triggered!' } : { ok: false, msg: `MacroDroid error ${res.status}` }
    } catch { return { ok: false, msg: 'MacroDroid network error' } }
  }

  return { ok: false, msg: 'Koi automation setup nahi. Settings → Automation mein IFTTT key daalo.' }
}

// ── detectAutomationIntent — parse chat text for automation commands ───
export function detectAutomationIntent(text: string): AutomationAction | null {
  const t = text.toLowerCase()
  if (/wifi on|wifi chalu/.test(t)) return { type: 'wifi_on' }
  if (/wifi off|wifi band/.test(t)) return { type: 'wifi_off' }
  if (/bluetooth on|bt on/.test(t)) return { type: 'bluetooth_on' }
  if (/bluetooth off|bt off/.test(t)) return { type: 'bluetooth_off' }
  if (/torch on|flashlight on|torch chalu/.test(t)) return { type: 'torch', payload: { state: 'on' } }
  if (/torch off|flashlight off/.test(t)) return { type: 'torch', payload: { state: 'off' } }
  if (/alarm|reminder set|yaad dilao/.test(t)) return { type: 'alarm', payload: { text } }
  if (/whatsapp kholo|open whatsapp/.test(t)) return { type: 'open_app', payload: { app: 'whatsapp' } }
  if (/maps kholo|open maps/.test(t)) return { type: 'open_app', payload: { app: 'maps' } }
  if (/youtube kholo|open youtube/.test(t)) return { type: 'open_app', payload: { app: 'youtube' } }
  if (/vibrate|vibration/.test(t)) return { type: 'vibrate' }
  return null
}

// ── sendLocalNotification — alias for showNotification ────────────────
export async function sendLocalNotification(title: string, body: string): Promise<boolean> {
  return showNotification(title, body)
}
