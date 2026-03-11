// categories/productivity.ts

// Wrap sync functions as async (required for executor compatibility)
import { set_reminder as _set_reminder, get_quote as _get_quote } from '../no-key/index'

export async function set_reminder(args: { message: string; time: string }) {
  return _set_reminder(args)
}
export async function get_quote(args?: { category?: string }) {
  return _get_quote()
}
export async function save_memory(args: { key: string; value: string }) {
  return { action: 'SAVE_MEMORY', key: args.key, value: args.value, note: 'Memory saved. Client will persist.' }
}
export async function recall_memory(args: { query: string }) {
  return { action: 'RECALL_MEMORY', query: args.query, note: 'Memory retrieval handled client-side.' }
}
