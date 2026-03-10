/* lib/db/index.ts — Dexie wrapper (re-exports lib/storage for backwards compat) */
export * from '@/lib/storage';

// Additional DB utilities
export async function dbReady(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const { getSessions } = await import('@/lib/storage');
    await getSessions();
    return true;
  } catch {
    return false;
  }
}
