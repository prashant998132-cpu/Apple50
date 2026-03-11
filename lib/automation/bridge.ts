// lib/automation/bridge.ts — Phone Automation Bridge v1
// MacroDroid webhook integration — free, Android only
// MacroDroid mein webhook trigger banao → JARVIS us pe command bhejta hai
'use client'

export interface AutomationAction {
  type: 'wifi_on' | 'wifi_off' | 'bluetooth_on' | 'bluetooth_off'
       | 'open_app' | 'call' | 'sms' | 'alarm' | 'volume'
       | 'torch' | 'notification' | 'custom'
  payload?: Record<string, any>
}

// MacroDroid webhook URL format:
// https://trigger.macrodroid.com/{DEVICE_ID}/{WEBHOOK_NAME}
// User apna device ID settings mein save karega

function getMacroDroidId(): string | null {
  try { return localStorage.getItem('jarvis_macrodroid_id') } catch { return null }
}

export async function triggerMacro(action: AutomationAction): Promise<{ ok: boolean; msg: string }> {
  const deviceId = getMacroDroidId()
  if (!deviceId) {
    return { ok: false, msg: 'MacroDroid Device ID set nahi hai. Settings → Automation mein daalo.' }
  }

  // Map action type to webhook name
  const webhookMap: Record<string, string> = {
    wifi_on:        'jarvis_wifi_on',
    wifi_off:       'jarvis_wifi_off',
    bluetooth_on:   'jarvis_bt_on',
    bluetooth_off:  'jarvis_bt_off',
    open_app:       'jarvis_open_app',
    alarm:          'jarvis_alarm',
    torch:          'jarvis_torch',
    notification:   'jarvis_notify',
    volume:         'jarvis_volume',
    custom:         action.payload?.webhook || 'jarvis_custom',
  }

  const webhook = webhookMap[action.type] || 'jarvis_custom'
  const url = `https://trigger.macrodroid.com/${deviceId}/${webhook}`

  try {
    // Add payload as query params if present
    const params = new URLSearchParams()
    if (action.payload) {
      Object.entries(action.payload).forEach(([k, v]) => params.append(k, String(v)))
    }
    const fullUrl = action.payload ? `${url}?${params}` : url

    const res = await fetch(fullUrl, { method: 'GET', signal: AbortSignal.timeout(8000) })
    if (res.ok) return { ok: true, msg: `✅ ${action.type} triggered!` }
    return { ok: false, msg: `❌ MacroDroid error: ${res.status}` }
  } catch (e: any) {
    return { ok: false, msg: `❌ Network error: ${e.message}` }
  }
}

// Intent-based automation — text se action detect karo
export function detectAutomationIntent(text: string): AutomationAction | null {
  const t = text.toLowerCase()

  if (/wifi (on|chalu|start|kholo)/.test(t))   return { type: 'wifi_on' }
  if (/wifi (off|band|stop|bando)/.test(t))     return { type: 'wifi_off' }
  if (/bluetooth (on|chalu)/.test(t))           return { type: 'bluetooth_on' }
  if (/bluetooth (off|band)/.test(t))           return { type: 'bluetooth_off' }
  if (/torch|flashlight|torch (on|chalu)/.test(t)) return { type: 'torch', payload: { state: 'on' } }
  if (/torch (off|band)/.test(t))               return { type: 'torch', payload: { state: 'off' } }
  if (/alarm|alarm lagao/.test(t)) {
    const timeMatch = t.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|baje)?/)
    return { type: 'alarm', payload: { time: timeMatch?.[0] || '' } }
  }
  if (/volume (up|badha|zyada)/.test(t))        return { type: 'volume', payload: { dir: 'up' } }
  if (/volume (down|kam|chota)/.test(t))        return { type: 'volume', payload: { dir: 'down' } }

  // Open app
  const appMatch = t.match(/(?:open|kholo|start|launch)\s+(\w+)/)
  if (appMatch) return { type: 'open_app', payload: { app: appMatch[1] } }

  return null
}

// Notification via Web Push (if permission granted)
export async function sendLocalNotification(title: string, body: string, icon = '/icons/icon-192.png') {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window)) return false

  let perm = Notification.permission
  if (perm === 'default') perm = await Notification.requestPermission()
  if (perm !== 'granted') return false

  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg) {
      await reg.showNotification(title, { body, icon, badge: icon, vibrate: [200, 100, 200] })
    } else {
      new Notification(title, { body, icon })
    }
    return true
  } catch { return false }
}

// Schedule notification (setTimeout based, works while tab open)
export function scheduleNotification(title: string, body: string, delayMs: number): void {
  setTimeout(() => sendLocalNotification(title, body), delayMs)
}

// MacroDroid setup guide
export const MACRODROID_SETUP = `
📱 MacroDroid Setup Guide:

1. MacroDroid install karo (free hai Play Store pe)
2. New Macro banao
3. Trigger: "Webhook" choose karo
4. Identifier mein daalo: jarvis_wifi_on (or any action name)
5. Action: "WiFi" → "Enable WiFi"
6. Device ID milega: MacroDroid → Menu → Account → Device ID
7. JARVIS Settings mein Device ID paste karo

Available webhooks:
• jarvis_wifi_on / jarvis_wifi_off
• jarvis_bt_on / jarvis_bt_off  
• jarvis_torch (payload: state=on/off)
• jarvis_alarm (payload: time=7:00am)
• jarvis_open_app (payload: app=youtube)
• jarvis_volume (payload: dir=up/down)
`
