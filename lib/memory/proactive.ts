/* lib/memory/proactive.ts
 * Proactive Memory — Cross-session learning
 * JARVIS khud user ko yaad rakhta hai, bina poochhe suggest karta hai
 * Rule G30: IndexedDB → Puter KV → localStorage chain
 */
'use client';

import { rememberFact, getMemory, getProfile, updateProfile } from '@/lib/storage';

// ── Auto-extract facts from conversation ────────────────────────────────
interface ExtractedFact {
  key:        string;
  value:      string;
  importance: number;
}

// Pattern-based extraction (zero API, instant)
export function extractFactsFromMessage(msg: string): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const m = msg.toLowerCase();

  // Name
  const nameMatch = msg.match(/(?:main|mera naam|my name is|i am|i'm)\s+([A-Z][a-z]+)/i);
  if (nameMatch) facts.push({ key: 'user_name', value: nameMatch[1], importance: 10 });

  // Location
  const locMatch = msg.match(/(?:main|mein|i live in|i'm from|rahta hun|rehti hun)\s+(\w+(?:\s+\w+)?)\s+(?:mein|se|from|in)/i);
  if (locMatch) facts.push({ key: 'user_location', value: locMatch[1], importance: 8 });

  // Exam
  if (/\bneet\b/i.test(m)) facts.push({ key: 'user_exam', value: 'NEET', importance: 9 });
  if (/\bjee\b/i.test(m))  facts.push({ key: 'user_exam', value: 'JEE',  importance: 9 });
  if (/\bupsc\b/i.test(m)) facts.push({ key: 'user_exam', value: 'UPSC', importance: 9 });

  // Study time
  if (/raat.*padh|night.*stud|study.*night|late night/i.test(m))
    facts.push({ key: 'study_time', value: 'night', importance: 6 });
  if (/subah.*padh|morning.*stud|study.*morning/i.test(m))
    facts.push({ key: 'study_time', value: 'morning', importance: 6 });

  // Subject interest
  if (/biology|bio/i.test(m))   facts.push({ key: 'strong_subject', value: 'Biology',   importance: 5 });
  if (/chemistry|chem/i.test(m))facts.push({ key: 'strong_subject', value: 'Chemistry', importance: 5 });
  if (/physics|phy/i.test(m))   facts.push({ key: 'strong_subject', value: 'Physics',   importance: 5 });
  if (/maths?|math/i.test(m))   facts.push({ key: 'strong_subject', value: 'Math',       importance: 5 });

  // Language preference
  if (/hindi mein|hindi me|in hindi/i.test(m))
    facts.push({ key: 'pref_language', value: 'hindi', importance: 7 });
  if (/english mein|in english/i.test(m))
    facts.push({ key: 'pref_language', value: 'english', importance: 7 });

  // Hobby/interest
  const hobbies = ['cricket', 'coding', 'music', 'gaming', 'drawing', 'cooking', 'football', 'chess'];
  hobbies.forEach(h => {
    if (m.includes(h)) facts.push({ key: `interest_${h}`, value: h, importance: 4 });
  });

  return facts;
}

// Save extracted facts silently (background)
export async function learnFromMessage(userMsg: string): Promise<void> {
  const facts = extractFactsFromMessage(userMsg);
  if (facts.length === 0) return;

  for (const fact of facts) {
    await rememberFact(fact.key, fact.value, fact.importance);

    // Also update profile for high-importance facts
    if (fact.importance >= 8) {
      if (fact.key === 'user_name')     await updateProfile({ name: fact.value });
      if (fact.key === 'user_location') await updateProfile({ location: fact.value });
      if (fact.key === 'user_exam')     await updateProfile({ exam: fact.value });
    }
  }
}

// Build context string from memory (inject into system prompt)
export async function buildMemoryContext(): Promise<string> {
  const [memory, profile] = await Promise.all([getMemory(15), getProfile()]);
  if (memory.length === 0 && !profile) return '';

  const lines: string[] = ['[User ke baare mein jo JARVIS jaanta hai:]'];

  if (profile?.name)     lines.push(`• Naam: ${profile.name}`);
  if (profile?.location) lines.push(`• Location: ${profile.location}`);
  if (profile?.exam)     lines.push(`• Exam: ${profile.exam} ki taiyari`);
  if (profile?.language) lines.push(`• Language preference: ${profile.language}`);

  // Top memory facts
  memory
    .filter(f => !['user_name','user_location','user_exam'].includes(f.key))
    .slice(0, 8)
    .forEach(f => lines.push(`• ${f.key.replace(/_/g,' ')}: ${f.value}`));

  return lines.join('\n');
}

// Proactive suggestions — background check karo, relevant ho toh suggest karo
export async function getProactiveSuggestion(
  currentMsg: string,
  hour: number = new Date().getHours(),
): Promise<string | null> {
  const profile = await getProfile();
  const m = currentMsg.toLowerCase();

  // Study reminder (raat ko)
  if (profile?.exam && hour >= 22 && hour <= 23) {
    if (!m.includes('study') && !m.includes('padh')) {
      return `📚 Raat ka ${hour} baj gaya — ${profile.exam} ki taiyari ho rahi hai? Koi MCQ chahiye?`;
    }
  }

  // Morning motivation
  if (profile?.exam && hour >= 6 && hour <= 8) {
    if (!m.includes('morning') && !m.includes('subah')) {
      return `🌅 Good morning! Aaj ka ${profile.exam} revision session shuru karna hai?`;
    }
  }

  return null;
}
