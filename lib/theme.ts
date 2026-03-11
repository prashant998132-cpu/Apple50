// lib/theme.ts — JARVIS Theme System v23
// 4 themes: dark | light | amoled | ocean
// CSS vars on :root — works with inline styles via var()

export type Theme = 'dark' | 'light' | 'amoled' | 'ocean'
const THEME_KEY = 'jarvis_theme_v2'

export const THEME_META: Record<Theme, { label: string; icon: string; desc: string }> = {
  dark:   { label: 'Dark',   icon: '🌑', desc: 'Classic dark' },
  light:  { label: 'Light',  icon: '☀️',  desc: 'Clean white' },
  amoled: { label: 'AMOLED', icon: '⬛', desc: 'Pure black' },
  ocean:  { label: 'Ocean',  icon: '🌊', desc: 'Deep blue' },
}

export const THEMES: Record<Theme, Record<string, string>> = {
  dark: {
    '--bg':         '#090d18',
    '--bg-card':    '#0c1422',
    '--bg-surface': 'rgba(255,255,255,.04)',
    '--bg-input':   'rgba(255,255,255,.04)',
    '--border':     'rgba(255,255,255,.07)',
    '--border-acc': 'rgba(0,229,255,.25)',
    '--text':       '#e8f4ff',
    '--text-dim':   '#c8e2f5',
    '--text-muted': '#2a5070',
    '--text-faint': '#1a3050',
    '--accent':     '#00e5ff',
    '--accent-bg':  'rgba(0,229,255,.12)',
    '--accent-dim': 'rgba(0,229,255,.06)',
    '--user-bg':    'rgba(0,229,255,.13)',
    '--user-border':'rgba(0,229,255,.3)',
    '--grid-color': 'rgba(0,229,255,.022)',
    '--header-bg':  'rgba(9,13,24,.96)',
    '--overlay':    'rgba(9,13,24,.97)',
    '--shadow':     '0 2px 20px rgba(0,0,0,.4)',
    '--jarvis-text':'#c8e8ff',
  },
  light: {
    '--bg':         '#f5f7fa',
    '--bg-card':    '#ffffff',
    '--bg-surface': 'rgba(0,0,0,.04)',
    '--bg-input':   '#ffffff',
    '--border':     'rgba(0,0,0,.09)',
    '--border-acc': 'rgba(0,122,255,.3)',
    '--text':       '#0d1a2e',
    '--text-dim':   '#1a2a3e',
    '--text-muted': '#6b7a8d',
    '--text-faint': '#aab5c0',
    '--accent':     '#0078d4',
    '--accent-bg':  'rgba(0,120,212,.1)',
    '--accent-dim': 'rgba(0,120,212,.06)',
    '--user-bg':    'rgba(0,120,212,.1)',
    '--user-border':'rgba(0,120,212,.3)',
    '--grid-color': 'rgba(0,0,0,.04)',
    '--header-bg':  'rgba(245,247,250,.97)',
    '--overlay':    'rgba(245,247,250,.98)',
    '--shadow':     '0 2px 20px rgba(0,0,0,.08)',
    '--jarvis-text':'#1a2a3e',
  },
  amoled: {
    '--bg':         '#000000',
    '--bg-card':    '#0a0a0a',
    '--bg-surface': 'rgba(255,255,255,.03)',
    '--bg-input':   'rgba(255,255,255,.03)',
    '--border':     'rgba(255,255,255,.06)',
    '--border-acc': 'rgba(0,255,200,.25)',
    '--text':       '#e8fff8',
    '--text-dim':   '#b0d8c8',
    '--text-muted': '#1a4030',
    '--text-faint': '#0f2820',
    '--accent':     '#00ffc8',
    '--accent-bg':  'rgba(0,255,200,.1)',
    '--accent-dim': 'rgba(0,255,200,.05)',
    '--user-bg':    'rgba(0,255,200,.08)',
    '--user-border':'rgba(0,255,200,.25)',
    '--grid-color': 'rgba(0,255,200,.018)',
    '--header-bg':  'rgba(0,0,0,.97)',
    '--overlay':    'rgba(0,0,0,.98)',
    '--shadow':     '0 2px 20px rgba(0,0,0,.8)',
    '--jarvis-text':'#b0f0e0',
  },
  ocean: {
    '--bg':         '#0a1628',
    '--bg-card':    '#0f1e35',
    '--bg-surface': 'rgba(100,160,255,.05)',
    '--bg-input':   'rgba(100,160,255,.06)',
    '--border':     'rgba(100,160,255,.1)',
    '--border-acc': 'rgba(100,200,255,.3)',
    '--text':       '#d0e8ff',
    '--text-dim':   '#a8ccea',
    '--text-muted': '#2a5070',
    '--text-faint': '#1a3850',
    '--accent':     '#4db8ff',
    '--accent-bg':  'rgba(77,184,255,.12)',
    '--accent-dim': 'rgba(77,184,255,.06)',
    '--user-bg':    'rgba(77,184,255,.12)',
    '--user-border':'rgba(77,184,255,.3)',
    '--grid-color': 'rgba(77,184,255,.025)',
    '--header-bg':  'rgba(10,22,40,.97)',
    '--overlay':    'rgba(10,22,40,.98)',
    '--shadow':     '0 2px 20px rgba(0,10,30,.5)',
    '--jarvis-text':'#b8d8f8',
  },
}

export function getTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  return (localStorage.getItem(THEME_KEY) as Theme) || 'dark'
}

export function applyTheme(t: Theme): void {
  const root = document.documentElement
  const vars = THEMES[t]
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
  root.setAttribute('data-theme', t)
}

export function setTheme(t: Theme): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(THEME_KEY, t)
  applyTheme(t)
}

export function toggleTheme(): Theme {
  const order: Theme[] = ['dark', 'light', 'amoled', 'ocean']
  const cur = getTheme()
  const next = order[(order.indexOf(cur) + 1) % order.length]
  setTheme(next)
  return next
}

export function initTheme(): void {
  if (typeof window === 'undefined') return
  applyTheme(getTheme())
}
