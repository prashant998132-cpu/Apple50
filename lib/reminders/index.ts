/* lib/reminders/index.ts — Reminder system */
'use client';

export interface Reminder {
  id: string;
  message: string;
  fireAt: number;
  repeat?: 'daily' | 'weekly' | 'monthly';
  fired?: boolean;
}

const STORAGE_KEY = 'jarvis_reminders';

function loadReminders(): Reminder[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveReminders(reminders: Reminder[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

export function addReminder(message: string, fireAt: number, repeat?: 'daily' | 'weekly' | 'monthly'): Reminder {
  const reminder: Reminder = {
    id: `rem_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    message,
    fireAt,
    repeat,
    fired: false,
  };
  const reminders = loadReminders();
  reminders.push(reminder);
  saveReminders(reminders);
  return reminder;
}

export function getReminders(): Reminder[] {
  return loadReminders().filter(r => !r.fired);
}

export function deleteReminder(id: string): void {
  const reminders = loadReminders().filter(r => r.id !== id);
  saveReminders(reminders);
}

export function checkAndFireReminders(onFire: (r: Reminder) => void): void {
  const now = Date.now();
  const reminders = loadReminders();
  let changed = false;

  for (const r of reminders) {
    if (!r.fired && r.fireAt <= now) {
      onFire(r);
      if (r.repeat) {
        const delta = r.repeat === 'daily' ? 86400000
          : r.repeat === 'weekly' ? 604800000
          : 2592000000;
        r.fireAt = now + delta;
      } else {
        r.fired = true;
      }
      changed = true;
    }
  }

  if (changed) saveReminders(reminders);
}

// Parse natural language reminder: "kal 8 baje gym" → timestamp
export function parseReminderTime(text: string): number | null {
  const now = new Date();
  const lower = text.toLowerCase();

  // "kal" = tomorrow
  if (lower.includes('kal') || lower.includes('tomorrow')) {
    const match = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje|baj)?/);
    if (match) {
      let hour = parseInt(match[1]);
      const min = parseInt(match[2] || '0');
      const ampm = match[3];
      if (ampm === 'pm' && hour < 12) hour += 12;
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(hour, min, 0, 0);
      return d.getTime();
    }
  }

  // "X minutes" / "X ghante"
  const minMatch = lower.match(/(\d+)\s*(min|minute|mint)/);
  if (minMatch) return now.getTime() + parseInt(minMatch[1]) * 60000;

  const hrMatch = lower.match(/(\d+)\s*(hour|hr|ghante|ghanta)/);
  if (hrMatch) return now.getTime() + parseInt(hrMatch[1]) * 3600000;

  // "aaj X baje"
  const todayMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje|baj)/);
  if (todayMatch) {
    let hour = parseInt(todayMatch[1]);
    const min = parseInt(todayMatch[2] || '0');
    const ampm = todayMatch[3];
    if (ampm === 'pm' && hour < 12) hour += 12;
    const d = new Date(now);
    d.setHours(hour, min, 0, 0);
    if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  return null;
}
