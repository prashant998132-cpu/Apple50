/* lib/storage/index.ts — Unified IndexedDB storage with Dexie */
'use client';

import Dexie, { type Table } from 'dexie';

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
  exam?: string;
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
  type: 'image' | 'music' | 'movie' | 'gif' | 'weather' | 'github' | 'news' | 'book' | 'youtube' | 'maps' | 'links' | 'canva';
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  linkUrl?: string;
  extra?: Record<string, any>;
}

class JarvisDB extends Dexie {
  chats!: Table<ChatSession>;
  messages!: Table<ChatMessage>;
  memory!: Table<MemoryFact>;
  profile!: Table<UserProfile>;
  goals!: Table<Goal>;
  habits!: Table<Habit>;
  location!: Table<LocationData>;

  constructor() {
    super('jarvis_v10');
    this.version(1).stores({
      chats: '++id, sessionId, updatedAt',
      messages: '++id, sessionId, timestamp',
      memory: '++id, key, importance',
      profile: '++id',
      goals: '++id, completed, createdAt',
      habits: '++id, name',
      location: '++id',
    });
  }
}

let db: JarvisDB | null = null;

function getDB(): JarvisDB {
  if (!db) db = new JarvisDB();
  return db;
}

// ── Chat sessions ────────────────────────────────────────────────────────
export async function createSession(title = 'New Chat'): Promise<string> {
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await getDB().chats.add({
    sessionId,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
  });
  return sessionId;
}

export async function getSessions(): Promise<ChatSession[]> {
  return getDB().chats.orderBy('updatedAt').reverse().limit(50).toArray();
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  const sess = await getDB().chats.where('sessionId').equals(sessionId).first();
  if (sess?.id) await getDB().chats.update(sess.id, { title, updatedAt: Date.now() });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await getDB().chats.where('sessionId').equals(sessionId).delete();
  await getDB().messages.where('sessionId').equals(sessionId).delete();
}

// ── Messages ─────────────────────────────────────────────────────────────
export async function saveMessage(msg: Omit<ChatMessage, 'id'>): Promise<void> {
  await getDB().messages.add(msg);
  const sess = await getDB().chats.where('sessionId').equals(msg.sessionId).first();
  if (sess?.id) {
    await getDB().chats.update(sess.id, {
      updatedAt: Date.now(),
      messageCount: (sess.messageCount || 0) + 1,
    });
  }
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  return getDB().messages.where('sessionId').equals(sessionId).sortBy('timestamp');
}

// ── Memory facts ─────────────────────────────────────────────────────────
export async function rememberFact(key: string, value: string, importance = 5): Promise<void> {
  const existing = await getDB().memory.where('key').equals(key).first();
  if (existing?.id) {
    await getDB().memory.update(existing.id, { value, importance, updatedAt: Date.now() });
  } else {
    await getDB().memory.add({ key, value, importance, createdAt: Date.now(), updatedAt: Date.now() });
  }
}

export async function getMemory(limit = 20): Promise<MemoryFact[]> {
  return getDB().memory.orderBy('importance').reverse().limit(limit).toArray();
}

export async function forgetFact(key: string): Promise<void> {
  await getDB().memory.where('key').equals(key).delete();
}

// ── Profile ───────────────────────────────────────────────────────────────
export async function getProfile(): Promise<UserProfile | null> {
  const profiles = await getDB().profile.toArray();
  return profiles[0] || null;
}

export async function updateProfile(data: Partial<UserProfile>): Promise<void> {
  const existing = await getProfile();
  if (existing?.id) {
    await getDB().profile.update(existing.id, { ...data, updatedAt: Date.now() });
  } else {
    await getDB().profile.add({ ...data, updatedAt: Date.now() });
  }
}

// ── Goals ─────────────────────────────────────────────────────────────────
export async function addGoal(text: string): Promise<void> {
  await getDB().goals.add({ text, completed: false, createdAt: Date.now() });
}

export async function getGoals(): Promise<Goal[]> {
  return getDB().goals.orderBy('createdAt').reverse().toArray();
}

export async function completeGoal(id: number): Promise<void> {
  await getDB().goals.update(id, { completed: true, completedAt: Date.now() });
}

export async function deleteGoal(id: number): Promise<void> {
  await getDB().goals.delete(id);
}

// ── Location ──────────────────────────────────────────────────────────────
export async function saveLocation(data: Omit<LocationData, 'id'>): Promise<void> {
  await getDB().location.clear();
  await getDB().location.add(data);
}

export async function getLocation(): Promise<LocationData | null> {
  const locs = await getDB().location.toArray();
  return locs[0] || null;
}

// ── Export all data ──────────────────────────────────────────────────────
export async function exportAllData(): Promise<object> {
  const [chats, messages, memory, profile, goals, habits, location] = await Promise.all([
    getDB().chats.toArray(),
    getDB().messages.toArray(),
    getDB().memory.toArray(),
    getDB().profile.toArray(),
    getDB().goals.toArray(),
    getDB().habits.toArray(),
    getDB().location.toArray(),
  ]);
  return { chats, messages, memory, profile, goals, habits, location, exportedAt: Date.now() };
}
