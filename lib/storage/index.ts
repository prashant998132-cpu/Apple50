/* lib/storage/index.ts
 * Storage Chain (Best → Alternative → Optional):
 *   1. IndexedDB (Dexie)   PRIMARY   ~500MB-1GB, offline, fast
 *   2. Puter.js KV Store   ALTERNATIVE  free cloud, cross-session, zero setup
 *   3. localStorage        FALLBACK  5MB, micro-keys only
 *
 * Rule G30: Best option pehle try, fail → next alternative, NEVER crash app
 * Rule G31: IndexedDB PRIMARY — localStorage sirf micro-keys
 */
'use client';

import Dexie, { type Table } from 'dexie';

// ── Types ─────────────────────────────────────────────────────────────────
export interface ChatSession {
  id?: number;
  sessionId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface ChatMessage {
  id?: number;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  provider?: string;
  card?: RichCard;
}

export interface MemoryFact {
  id?: number;
  key: string;
  value: string;
  importance: number;
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  id?: number;
  name?: string;
  location?: string;
  job?: string;
  interests?: string[];
  exam?: string;       // 'NEET' | 'JEE' | 'UPSC' etc
  examDate?: number;
  language?: string;
  updatedAt: number;
}

export interface Goal {
  id?: number;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
}

export interface Habit {
  id?: number;
  name: string;
  streak: number;
  lastDone?: number;
  createdAt: number;
}

export interface LocationData {
  id?: number;
  lat: number;
  lon: number;
  city?: string;
  region?: string;
  country?: string;
  updatedAt: number;
}

export interface RichCard {
  type: 'image' | 'music' | 'movie' | 'gif' | 'weather' | 'github' | 'news'
      | 'book' | 'youtube' | 'maps' | 'links' | 'canva' | 'wiki';
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  linkUrl?: string;
  extra?: Record<string, any>;
}

// ── 1. PRIMARY: IndexedDB (Dexie) ─────────────────────────────────────────
class JarvisDB extends Dexie {
  chats!:    Table<ChatSession>;
  messages!: Table<ChatMessage>;
  memory!:   Table<MemoryFact>;
  profile!:  Table<UserProfile>;
  goals!:    Table<Goal>;
  habits!:   Table<Habit>;
  location!: Table<LocationData>;

  constructor() {
    super('jarvis_v10');
    (this as any).version(1).stores({
      chats:    '++id, sessionId, updatedAt',
      messages: '++id, sessionId, timestamp',
      memory:   '++id, key, importance',
      profile:  '++id',
      goals:    '++id, completed, createdAt',
      habits:   '++id, name',
      location: '++id',
    });
  }
}

let _db: JarvisDB | null = null;
let _idbFailed = false;

function getDB(): JarvisDB {
  if (!_db) _db = new JarvisDB();
  return _db;
}

async function idbOK(): Promise<boolean> {
  if (_idbFailed) return false;
  try {
    await getDB().chats.count();
    return true;
  } catch {
    _idbFailed = true;
    return false;
  }
}

// ── 2. ALTERNATIVE: Puter.js KV (free cloud, zero setup) ──────────────────
// Puter loaded via layout.tsx <script> tag
function puter(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).puter ?? null;
}

async function pvGet(key: string): Promise<any | null> {
  try {
    const p = puter();
    if (!p?.kv) return null;
    const v = await p.kv.get(`j:${key}`);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

async function pvSet(key: string, val: any): Promise<boolean> {
  try {
    const p = puter();
    if (!p?.kv) return false;
    await p.kv.set(`j:${key}`, JSON.stringify(val));
    return true;
  } catch { return false; }
}

async function pvDel(key: string): Promise<void> {
  try { const p = puter(); if (p?.kv) await p.kv.del(`j:${key}`); } catch {}
}

// ── 3. FALLBACK: localStorage ──────────────────────────────────────────────
function lsGet(key: string): any | null {
  try { const v = localStorage.getItem(`jv_${key}`); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
function lsSet(key: string, val: any): void {
  try { localStorage.setItem(`jv_${key}`, JSON.stringify(val)); } catch {}
}

// ── Universal read (IDB → Puter → LS) — only used as fallback lookup ──────
async function fallbackRead(key: string): Promise<any | null> {
  const pv = await pvGet(key);
  if (pv !== null) return pv;
  return lsGet(key);
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

// ── Chat sessions ──────────────────────────────────────────────────────────
export async function createSession(title = 'New Chat'): Promise<string> {
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const s: ChatSession = { sessionId, title, createdAt: Date.now(), updatedAt: Date.now(), messageCount: 0 };
  if (await idbOK()) {
    await getDB().chats.add(s);
  } else {
    const arr = (await pvGet('sessions') ?? lsGet('sessions') ?? []) as ChatSession[];
    arr.unshift(s);
    const ok = await pvSet('sessions', arr.slice(0, 100));
    if (!ok) lsSet('sessions', arr.slice(0, 50));
  }
  return sessionId;
}

export async function getSessions(): Promise<ChatSession[]> {
  if (await idbOK()) return getDB().chats.orderBy('updatedAt').reverse().limit(50).toArray();
  return (await fallbackRead('sessions')) ?? [];
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  try {
    if (await idbOK()) {
      const s = await getDB().chats.where('sessionId').equals(sessionId).first();
      if (s?.id) await getDB().chats.update(s.id, { title, updatedAt: Date.now() });
    }
  } catch {}
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    if (await idbOK()) {
      await getDB().chats.where('sessionId').equals(sessionId).delete();
      await getDB().messages.where('sessionId').equals(sessionId).delete();
    }
  } catch {}
}

// ── Messages ───────────────────────────────────────────────────────────────
export async function saveMessage(msg: Omit<ChatMessage, 'id'>): Promise<void> {
  if (await idbOK()) {
    await getDB().messages.add(msg);
    const s = await getDB().chats.where('sessionId').equals(msg.sessionId).first();
    if (s?.id) await getDB().chats.update(s.id, { updatedAt: Date.now(), messageCount: (s.messageCount || 0) + 1 });
  } else {
    const key = `msgs_${msg.sessionId}`;
    const arr = (await pvGet(key) ?? []) as ChatMessage[];
    arr.push(msg);
    const ok = await pvSet(key, arr.slice(-50));
    if (!ok) lsSet(key, arr.slice(-20));
  }
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  if (await idbOK()) return getDB().messages.where('sessionId').equals(sessionId).sortBy('timestamp');
  return (await pvGet(`msgs_${sessionId}`)) ?? lsGet(`msgs_${sessionId}`) ?? [];
}

// ── Memory facts ────────────────────────────────────────────────────────────
export async function rememberFact(key: string, value: string, importance = 5): Promise<void> {
  if (await idbOK()) {
    const existing = await getDB().memory.where('key').equals(key).first();
    if (existing?.id) {
      await getDB().memory.update(existing.id, { value, importance, updatedAt: Date.now() });
    } else {
      await getDB().memory.add({ key, value, importance, createdAt: Date.now(), updatedAt: Date.now() });
    }
  } else {
    const mem = (await pvGet('memory') ?? lsGet('memory') ?? {}) as Record<string, any>;
    mem[key] = { value, importance, updatedAt: Date.now() };
    const ok = await pvSet('memory', mem);
    if (!ok) lsSet('memory', mem);
  }
}

export async function getMemory(limit = 20): Promise<MemoryFact[]> {
  if (await idbOK()) return getDB().memory.orderBy('importance').reverse().limit(limit).toArray();
  const mem = (await pvGet('memory') ?? lsGet('memory') ?? {}) as Record<string, any>;
  return Object.entries(mem)
    .map(([k, v]: any) => ({ key: k, value: v.value, importance: v.importance ?? 5, createdAt: v.updatedAt, updatedAt: v.updatedAt }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, limit);
}

export async function forgetFact(key: string): Promise<void> {
  try {
    if (await idbOK()) { await getDB().memory.where('key').equals(key).delete(); return; }
    const mem = (await pvGet('memory') ?? {}) as Record<string, any>;
    delete mem[key];
    await pvSet('memory', mem);
  } catch {}
}

// ── Profile ─────────────────────────────────────────────────────────────────
export async function getProfile(): Promise<UserProfile | null> {
  if (await idbOK()) { const r = await getDB().profile.toArray(); return r[0] ?? null; }
  return await pvGet('profile') ?? lsGet('profile');
}

export async function updateProfile(data: Partial<UserProfile>): Promise<void> {
  if (await idbOK()) {
    const ex = await getProfile();
    if (ex?.id) { await getDB().profile.update(ex.id, { ...data, updatedAt: Date.now() }); }
    else { await getDB().profile.add({ ...data, updatedAt: Date.now() }); }
  } else {
    const ex = await pvGet('profile') ?? {};
    const merged = { ...ex, ...data, updatedAt: Date.now() };
    const ok = await pvSet('profile', merged);
    if (!ok) lsSet('profile', merged);
  }
}

// ── Goals ────────────────────────────────────────────────────────────────────
export async function addGoal(text: string): Promise<void> {
  const g: Goal = { text, completed: false, createdAt: Date.now() };
  if (await idbOK()) { await getDB().goals.add(g); return; }
  const arr = (await pvGet('goals') ?? []) as Goal[];
  arr.unshift(g);
  const ok = await pvSet('goals', arr);
  if (!ok) lsSet('goals', arr.slice(0, 30));
}

export async function getGoals(): Promise<Goal[]> {
  if (await idbOK()) return getDB().goals.orderBy('createdAt').reverse().toArray();
  return (await pvGet('goals')) ?? lsGet('goals') ?? [];
}

export async function completeGoal(id: number): Promise<void> {
  try { if (await idbOK()) await getDB().goals.update(id, { completed: true, completedAt: Date.now() }); } catch {}
}

export async function deleteGoal(id: number): Promise<void> {
  try { if (await idbOK()) await getDB().goals.delete(id); } catch {}
}

// ── Location ─────────────────────────────────────────────────────────────────
export async function saveLocation(data: Omit<LocationData, 'id'>): Promise<void> {
  if (await idbOK()) { await getDB().location.clear(); await getDB().location.add(data); return; }
  const ok = await pvSet('location', data);
  if (!ok) lsSet('location', data);
}

export async function getLocation(): Promise<LocationData | null> {
  if (await idbOK()) { const r = await getDB().location.toArray(); return r[0] ?? null; }
  return await pvGet('location') ?? lsGet('location');
}

// ── Export all data ───────────────────────────────────────────────────────────
export async function exportAllData(): Promise<object> {
  if (await idbOK()) {
    const [chats, messages, memory, profile, goals, habits, location] = await Promise.all([
      getDB().chats.toArray(), getDB().messages.toArray(), getDB().memory.toArray(),
      getDB().profile.toArray(), getDB().goals.toArray(), getDB().habits.toArray(), getDB().location.toArray(),
    ]);
    return { chats, messages, memory, profile, goals, habits, location, exportedAt: Date.now(), source: 'IndexedDB' };
  }
  const [sessions, memory, profile, goals, location] = await Promise.all([
    pvGet('sessions'), pvGet('memory'), pvGet('profile'), pvGet('goals'), pvGet('location'),
  ]);
  return { sessions, memory, profile, goals, location, exportedAt: Date.now(), source: 'PuterKV' };
}

// ── Storage health status ─────────────────────────────────────────────────────
export async function getStorageStatus() {
  const idb = await idbOK();
  const p = puter();
  return {
    primary:     idb           ? '✅ IndexedDB'   : '❌ IndexedDB failed',
    alternative: p?.kv         ? '✅ Puter KV'    : '⚠️ Puter KV unavailable',
    fallback:                    '✅ localStorage',
    active:      idb ? 'IndexedDB' : p?.kv ? 'Puter KV' : 'localStorage',
  };
}
