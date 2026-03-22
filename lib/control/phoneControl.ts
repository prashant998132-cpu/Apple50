'use client'

export const APP_INTENTS: Record<string, (param?: string) => string> = {
  'whatsapp':      (num?) => num ? 'whatsapp://send?phone=91' + num : 'whatsapp://',
  'call':          (num?) => 'tel:' + (num||''),
  'sms':           (num?) => 'sms:' + (num||''),
  'telegram':      (user?) => user ? 'tg://resolve?domain=' + user : 'tg://',
  'instagram':     () => 'instagram://',
  'gmail':         (to?) => 'mailto:' + (to||''),
  'maps':          (q?) => 'https://maps.google.com/maps?q=' + encodeURIComponent(q||'Maihar MP'),
  'navigate':      (d?) => 'https://maps.google.com/maps?q=' + encodeURIComponent(d||'') + '&navigate=yes',
  'youtube':       (q?) => q ? 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) : 'vnd.youtube:',
  'spotify':       (q?) => q ? 'spotify:search:' + encodeURIComponent(q) : 'spotify://',
  'netflix':       () => 'nflx://',
  'hotstar':       () => 'https://www.hotstar.com',
  'amazon':        (q?) => 'https://www.amazon.in/s?k=' + encodeURIComponent(q||''),
  'flipkart':      (q?) => 'https://www.flipkart.com/search?q=' + encodeURIComponent(q||''),
  'zomato':        () => 'zomato://',
  'swiggy':        () => 'https://www.swiggy.com',
  'phonepe':       (upi?) => upi ? 'phonepe://pay?pa=' + upi : 'phonepe://',
  'gpay':          () => 'tez://upi/collect',
  'paytm':         () => 'paytmmp://',
  'ola':           () => 'olacabs://',
  'uber':          () => 'uber://',
  'irctc':         () => 'https://www.irctc.co.in',
  'redbus':        () => 'https://www.redbus.in',
  'settings':      () => 'android-app://com.android.settings',
  'calculator':    () => 'android-app://com.android.calculator2',
  'clock':         () => 'android-app://com.android.deskclock',
  'contacts':      () => 'android-app://com.android.contacts',
  'camera_app':    () => 'android-app://com.android.camera2',
  'files':         () => 'android-app://com.android.documentsui',
  'play_store':    (q?) => q ? 'market://search?q=' + encodeURIComponent(q) : 'market://apps',
  'twitter':       () => 'twitter://',
  'linkedin':      () => 'linkedin://',
  'truecaller':    (num?) => num ? 'truecaller://call/' + num : 'truecaller://',
  'cricbuzz':      () => 'https://www.cricbuzz.com',
  'bbc':           () => 'https://www.bbc.com/hindi',
  'inshorts':      () => 'https://inshorts.com',
  'jiocinema':     () => 'https://www.jiocinema.com',
  'myntra':        () => 'https://www.myntra.com',
  'meesho':        () => 'https://www.meesho.com',
}

export function openApp(app: string, param?: string): string {
  if (typeof window === 'undefined') return app + ' kholne ki koshish...'
  const key = app.toLowerCase().trim()
  const fn = APP_INTENTS[key]
  if (fn) {
    try { window.location.href = fn(param) } catch {}
    return app + ' khul raha hai boss!'
  }
  // Web fallback
  const web: Record<string,string> = { google:'https://google.com', facebook:'https://facebook.com', github:'https://github.com', chatgpt:'https://chat.openai.com' }
  if (web[key]) { window.open(web[key],'_blank'); return app + ' khol raha hoon!' }
  return app + ' ka link nahi pata. Manual kholna padega.'
}

export function makeCall(number: string): void {
  if (typeof window !== 'undefined') window.location.href = 'tel:' + number.replace(/\D/g,'')
}

export function sendWhatsApp(number: string, message: string): void {
  if (typeof window === 'undefined') return
  const n = number.replace(/\D/g,'')
  const num = n.startsWith('91') ? n : '91'+n
  window.location.href = 'whatsapp://send?phone=' + num + '&text=' + encodeURIComponent(message)
}

export function sendSMS(number: string, message: string): void {
  if (typeof window !== 'undefined') window.location.href = 'sms:' + number + '?body=' + encodeURIComponent(message)
}

export function setAlarm(hour: number, minute: number, label = 'JARVIS Alarm'): void {
  if (typeof window === 'undefined') return
  window.location.href = 'intent://alarm#Intent;scheme=android.alarmclock;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=' + hour + ';i.android.intent.extra.alarm.MINUTES=' + minute + ';S.android.intent.extra.alarm.MESSAGE=' + encodeURIComponent(label) + ';end'
}

export function navigateTo(destination: string): void {
  if (typeof window !== 'undefined') window.location.href = 'https://maps.google.com/maps?q=' + encodeURIComponent(destination) + '&navigate=yes'
}

export async function shareContent(title: string, text: string, url?: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  try { await navigator.share({ title, text, url }); return true }
  catch { try { await navigator.clipboard.writeText(text); return true } catch { return false } }
}
