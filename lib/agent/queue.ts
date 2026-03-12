// lib/agent/queue.ts — Background task queue (IndexedDB based)
// Stores plans, retry logic, progress state
'use client'

import type { AgentPlan } from './planner'

const DB_NAME = 'jarvis_agent'
const STORE = 'plans'
let _db: IDBDatabase | null = null

async function getDB(): Promise<IDBDatabase> {
  if (_db) return _db
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('status', 'status')
        store.createIndex('createdAt', 'createdAt')
      }
    }
    req.onsuccess = () => { _db = req.result; resolve(req.result) }
    req.onerror = () => reject(req.error)
  })
}

export interface QueuedPlan extends AgentPlan {
  id: string
  retries: number
}

export async function enqueue(plan: AgentPlan): Promise<QueuedPlan> {
  const db = await getDB()
  const item: QueuedPlan = {
    ...plan,
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
    retries: 0,
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(item)
    tx.oncomplete = () => resolve(item)
    tx.onerror = () => reject(tx.error)
  })
}

export async function updatePlan(id: string, updates: Partial<QueuedPlan>): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  const existing = await new Promise<QueuedPlan>((res, rej) => {
    const r = store.get(id)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
  if (existing) store.put({ ...existing, ...updates })
}

export async function getAllPlans(): Promise<QueuedPlan[]> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.createdAt - a.createdAt))
    req.onerror = () => reject(req.error)
  })
}

export async function deletePlan(id: string): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearAll(): Promise<void> {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
