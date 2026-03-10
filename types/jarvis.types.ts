/* types/jarvis.types.ts — Centralized types for JARVIS Apple50
 * Rule R-B: Yahan se import karo — duplicate types mat banao
 */

// ── AI Provider Types ──────────────────────────────────────────────────────
export type RouterMode   = 'flash' | 'think' | 'deep';
export type AppMode      = 'auto'  | RouterMode;
export type ModelTier    = 'nano'  | 'standard' | 'powerful' | 'reasoning';
export type StorageLayer = 'indexeddb' | 'puter' | 'localstorage';

// ── Message Types ──────────────────────────────────────────────────────────
export interface JarvisMessage {
  id:        string;
  role:      'user' | 'assistant' | 'system';
  content:   string;
  timestamp: number;
  provider?: string;
  model?:    string;
  card?:     RichCard;
  thinking?: string;   // DeepSeek R1 thinking block
}

export interface ChatSession {
  id?:          number;
  sessionId:    string;
  title:        string;
  createdAt:    number;
  updatedAt:    number;
  messageCount: number;
}

// ── Rich Card ──────────────────────────────────────────────────────────────
export interface RichCard {
  type:      CardType;
  title?:    string;
  subtitle?: string;
  imageUrl?: string;
  linkUrl?:  string;
  extra?:    Record<string, any>;
}

export type CardType =
  | 'image' | 'music' | 'movie' | 'gif' | 'weather' | 'github'
  | 'news'  | 'book'  | 'youtube' | 'maps' | 'links' | 'canva'
  | 'wiki'  | 'crypto' | 'stock' | 'recipe' | 'pokemon';

// ── User Profile ───────────────────────────────────────────────────────────
export interface UserProfile {
  id?:       number;
  name?:     string;
  location?: string;
  job?:      string;
  interests?:string[];
  exam?:     'NEET' | 'JEE' | 'UPSC' | 'CAT' | string;
  examDate?: number;
  language?: 'hi' | 'en' | 'hinglish';
  updatedAt: number;
}

// ── Agent / Router ─────────────────────────────────────────────────────────
export interface RouterResult {
  text:        string;
  provider:    string;
  model:       string;
  tier?:       ModelTier;
  tokensUsed?: number;
  fromCache?:  boolean;
  latencyMs?:  number;
}

export interface AgentDecision {
  tier:      ModelTier;
  provider:  string;
  model:     string;
  reason:    string;
  maxTokens: number;
}

// ── Query Classification ───────────────────────────────────────────────────
export type QueryCategory =
  | 'local'        // zero API — calc, QR, UUID, base64
  | 'api_tool'     // cached external API — weather, news, crypto
  | 'ai_simple'    // flash LLM
  | 'ai_reason'    // think/deep LLM — NEET, math, code

export interface ClassifiedQuery {
  category:  QueryCategory;
  confidence:number;
  tool?:     string;
  args?:     Record<string, any>;
}

// ── Device Context ─────────────────────────────────────────────────────────
export interface DeviceInfo {
  battery?:         number;   // 0–1
  charging?:        boolean;
  connection?:      'slow-2g' | '2g' | '3g' | '4g' | 'wifi' | 'unknown';
  lowPower:         boolean;
  prefersReducedMotion: boolean;
}

// ── Storage ────────────────────────────────────────────────────────────────
export interface MemoryFact {
  id?:        number;
  key:        string;
  value:      string;
  importance: number;
  createdAt:  number;
  updatedAt:  number;
}

export interface Goal {
  id?:         number;
  text:        string;
  completed:   boolean;
  createdAt:   number;
  completedAt?:number;
}

export interface LocationData {
  id?:     number;
  lat:     number;
  lon:     number;
  city?:   string;
  region?: string;
  country?:string;
  updatedAt: number;
}

// ── Toast ──────────────────────────────────────────────────────────────────
export interface ToastData {
  id:      string;
  message: string;
  type:    'default' | 'ok' | 'err' | 'info' | 'warn';
  icon?:   string;
}

// ── Tool ───────────────────────────────────────────────────────────────────
export interface ToolDefinition {
  name:        string;
  description: string;
  category:    ToolCategory;
  free:        boolean;
  needsKey?:   string;       // env var name
  cacheTtl?:   number;       // ms
  execute:     (args: Record<string, any>) => Promise<ToolResult>;
}

export type ToolCategory =
  | 'utility' | 'weather' | 'news' | 'finance' | 'entertainment'
  | 'education'| 'india'  | 'dev'  | 'media'   | 'search';

export interface ToolResult {
  success:  boolean;
  data?:    any;
  card?:    RichCard;
  text?:    string;
  error?:   string;
}

// ── API Response ───────────────────────────────────────────────────────────
export interface StreamEvent {
  type:      'delta' | 'done' | 'card' | 'error' | 'thinking' | 'appCommand';
  text?:     string;
  card?:     RichCard;
  provider?: string;
  model?:    string;
  command?:  string;
}
