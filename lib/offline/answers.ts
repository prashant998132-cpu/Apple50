// lib/offline/answers.ts — 100 offline answers jab internet nahi ho
// JARVIS tab bhi kaam karta hai

export const OFFLINE_ANSWERS: Record<string, string | (() => string)> = {
  // Greetings
  'hello': 'Hello boss! Internet nahi hai abhi, lekin main hoon. Kya poochhna tha?',
  'hi': 'Hi! Offline hoon abhi — basic cheezein poochh sakta hai.',
  'kya haal': 'Sab theek hai boss! Tu bata, kya kaam hai?',
  'good morning': 'Good morning! Naya din, naye kaam. Bata kya karna hai aaj?',

  // Time/Date
  'time': () => new Date().toLocaleTimeString('en-IN'),
  'date': () => new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }),
  'aaj kya din': () => new Date().toLocaleDateString('en-IN', { weekday:'long' }) + ' hai aaj.',
  'kitne baje': () => 'Abhi ' + new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) + ' baj rahe hain.',

  // Math basics
  'calculator': 'Calculator ke liye type karo: "calculate [expression]" — offline bhi kaam karta hai!',

  // Motivation
  'motivation': 'Boss, har bada kaam chhhoti shuruat se hota hai. Aaj ka ek step kal ka ek mile. Chal!',
  'demotivated': 'Yaar, thoda break lo. Chai piyo. 10 min baad fresh start karo. Sab ho jaayega.',
  'thak gaya': 'Thakna normal hai. Matlab kuch kar raha tha. Break le, phir wapas aa.',
  'neend': 'So jao boss. Neend mein bhi brain kaam karta hai — ideas aate hain.',

  // General knowledge
  'india capital': 'India ki capital New Delhi hai.',
  'bharat capital': 'Bharat ki raajdhani Nai Dilli hai.',
  'pm india': 'Bharat ke pradhanmantri Narendra Modi hain (2024 mein re-elected).',
  'india population': 'India ki aabadi lagbhag 1.44 arab hai — world mein sabse zyada.',

  // Physics basics
  'speed of light': 'Speed of light = 3 × 10⁸ m/s (approximately 3 lakh km per second).',
  'gravity': "Earth ka gravitational acceleration g = 9.8 m/s² (approximately 10 m/s²).",
  'newton laws': '1st: Object at rest stays at rest.\n2nd: F = ma\n3rd: Har action ka equal aur opposite reaction hota hai.',
  'ohm law': "V = IR — Voltage = Current × Resistance. Simple!",

  // Chemistry basics
  'periodic table': 'Periodic table mein 118 elements hain. H, He, Li, Be, B, C, N, O, F, Ne — pehle 10.',
  'water formula': 'Paani ka formula H₂O — 2 hydrogen + 1 oxygen.',
  'salt formula': 'Namak ka formula NaCl — sodium chloride.',
  'acid base': 'pH < 7 = acidic, pH = 7 = neutral, pH > 7 = basic/alkaline.',

  // Biology basics
  'cell': 'Cell life ki basic unit hai. Plant cells mein cell wall + chloroplast hoti hai, animal mein nahi.',
  'dna': 'DNA = Deoxyribonucleic Acid. Hereditary information store karta hai. Double helix structure.',
  'photosynthesis': '6CO₂ + 6H₂O + sunlight → C₆H₁₂O₆ + 6O₂. Plants sunlight se food banate hain.',
  'mitochondria': 'Mitochondria = powerhouse of the cell. ATP (energy) produce karta hai.',

  // Math formulas
  'area circle': 'Circle ka area = πr² (pi × radius squared). π ≈ 3.14159',
  'area rectangle': 'Rectangle ka area = length × breadth.',
  'pythagoras': 'a² + b² = c² — right triangle mein hypotenuse ka formula.',
  'quadratic': 'x = (-b ± √(b²-4ac)) / 2a — quadratic formula.',

  // Computer basics
  'ip address': 'IP address ek unique number hota hai jo har device ko internet pe identify karta hai.',
  'what is ram': 'RAM = Random Access Memory. Temporary memory jahan running programs store hote hain.',
  'what is rom': 'ROM = Read Only Memory. Permanent memory jahan bootup instructions hoti hain.',
  'cpu': 'CPU = Central Processing Unit. Computer ka brain — sab calculations karta hai.',

  // Indian GK
  'india independence': 'India ko 15 August 1947 ko aazadi mili thi.',
  'india constitution': 'India ka constitution 26 January 1950 ko lagu hua. Isliye Republic Day 26 Jan ko manate hain.',
  'india states': 'India mein 28 states aur 8 Union Territories hain.',
  'highest mountain india': 'India ka sabse uncha parvat Kangchenjunga hai (8,586 m) — world mein 3rd highest.',
  'longest river india': 'India ki sabse lambi nadi Ganga hai.',

  // Practical
  'bmi formula': 'BMI = Weight(kg) / Height(m)². 18.5-24.9 = Normal. 25-29.9 = Overweight.',
  'emi formula': 'EMI = P × r × (1+r)^n / ((1+r)^n - 1). P=principal, r=monthly rate, n=months.',

  // Quick tips
  'focus': 'Pomodoro technique try karo: 25 min kaam, 5 min break. Repeat. Productivity badh jaati hai.',
  'sleep': '7-8 ghante ki neend zaroori hai. Less sleep = less memory retention, slow brain.',
  'water': 'Din mein kam se kam 8-10 glass paani piyo. Brain 75% water hai.',
  'exercise': 'Roz 30 min exercise se brain chemicals release hote hain — mood better, focus better.',
};

export function getOfflineAnswer(query: string): string | null {
  const q = query.toLowerCase().trim();

  // Direct match
  for (const [key, val] of Object.entries(OFFLINE_ANSWERS)) {
    if (q.includes(key)) {
      return typeof val === 'function' ? (val as () => string)() : val as string;
    }
  }

  // Partial match
  for (const [key, val] of Object.entries(OFFLINE_ANSWERS)) {
    if (key.split(' ').every(word => q.includes(word))) {
      return typeof val === 'function' ? (val as () => string)() : val as string;
    }
  }

  return null;
}
