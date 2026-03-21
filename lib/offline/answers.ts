'use client'
export const OFFLINE_ANSWERS: Record<string, string | (() => string)> = {
  // Time & Date
  'time': () => '🕐 Abhi ' + new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) + ' baj rahe hain.',
  'date': () => '📅 Aaj ' + new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) + ' hai.',
  'aaj kya din': () => new Date().toLocaleDateString('en-IN', { weekday:'long' }) + ' hai aaj.',
  'kitne baje': () => 'Abhi ' + new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) + ' baje hain.',
  'kal kya din': () => { const d = new Date(); d.setDate(d.getDate()+1); return 'Kal ' + d.toLocaleDateString('en-IN', { weekday:'long' }) + ' hai.'; },

  // Greetings
  'hello': 'Hello boss! Internet nahi hai — basic cheezein poochh sakta hoon.',
  'hi': 'Hi boss! Offline hoon abhi.',
  'kya haal': 'Sab theek! Tu bata, kya kaam hai?',
  'good morning': 'Good morning! Naya din, naye kaam. Bata kya karna hai.',
  'good night': 'Good night boss! So jao, kal fresh start.',
  'namaste': 'Namaste boss! Kya haal hain?',

  // Math
  'calculator': 'Math ke liye type karo: "calculate 25 * 4" — offline bhi kaam karta hai!',
  'pi': 'π = 3.14159265358979... (irrational number)',
  'e value': 'e = 2.71828... (Euler ka number)',

  // Physics
  'speed of light': '🔬 Speed of light = 3 × 10⁸ m/s (3 lakh km/sec)',
  'gravity': '🌍 g = 9.8 m/s² (Earth ka gravitational acceleration)',
  'newton laws': '📚 1st: Object rest mein rahta hai\n2nd: F = ma\n3rd: Har action ka equal opposite reaction',
  'ohm law': '⚡ V = IR (Voltage = Current × Resistance)',
  'power formula': '💡 P = VI = I²R = V²/R',
  'kinetic energy': '🏃 KE = ½mv²',
  'potential energy': '⬆️ PE = mgh',
  'pressure formula': '💧 P = F/A (Force / Area)',
  'density formula': '🧊 Density = Mass / Volume',

  // Chemistry
  'water formula': '💧 Paani = H₂O (2 Hydrogen + 1 Oxygen)',
  'salt formula': '🧂 Namak = NaCl (Sodium Chloride)',
  'acid base': '🧪 pH < 7 = Acidic, pH = 7 = Neutral, pH > 7 = Basic',
  'periodic table': '⚗️ 118 elements hain. H He Li Be B C N O F Ne...',
  'co2': '🌿 Carbon Dioxide = CO₂',
  'glucose': '🍬 Glucose = C₆H₁₂O₆',
  'methane': '🔥 Methane = CH₄',
  'ammonia': 'Ammonia = NH₃',

  // Biology
  'cell': '🔬 Cell life ki basic unit hai. Plant = cell wall + chloroplast. Animal = nahi.',
  'dna': '🧬 DNA = Deoxyribonucleic Acid. Hereditary info. Double helix.',
  'photosynthesis': '🌱 6CO₂ + 6H₂O + sunlight → C₆H₁₂O₆ + 6O₂',
  'mitochondria': '⚡ Mitochondria = Powerhouse of the cell. ATP banata hai.',
  'heart chambers': '❤️ Heart mein 4 chambers: 2 atria + 2 ventricles',
  'blood groups': '🩸 Blood groups: A, B, AB, O. O = Universal donor. AB = Universal recipient.',
  'bones count': '🦴 Human body mein 206 bones hain (adult).',
  'human cells': '🔬 ~37 trillion cells hain human body mein.',
  'chromosomes': '🧬 Humans mein 46 chromosomes (23 pairs) hote hain.',

  // Math Formulas
  'area circle': '📐 Circle area = πr²',
  'area rectangle': '📐 Rectangle area = length × breadth',
  'area triangle': '📐 Triangle area = ½ × base × height',
  'pythagoras': '📐 a² + b² = c² (right triangle)',
  'quadratic formula': '📐 x = (-b ± √(b²-4ac)) / 2a',
  'compound interest': '💰 A = P(1 + r/n)^(nt)',
  'simple interest': '💰 SI = (P × R × T) / 100',
  'volume sphere': '📐 V = (4/3)πr³',
  'volume cylinder': '📐 V = πr²h',
  'volume cube': '📐 V = a³',
  'surface area sphere': '📐 SA = 4πr²',

  // Indian GK
  'india capital': '🏛️ India ki capital = New Delhi',
  'india pm': '👤 India ke PM = Narendra Modi (2014 se, 2024 mein re-elected)',
  'india president': '👤 India ki President = Droupadi Murmu (2022 se)',
  'india population': '👥 India ki aabadi ~1.44 arab — world #1',
  'india independence': '🇮🇳 15 August 1947 ko aazadi mili',
  'india constitution': '📜 26 January 1950 — Republic Day',
  'india states': '🗺️ 28 states + 8 Union Territories',
  'india area': '📏 India ka area = 32.87 lakh km²',
  'india currency': '💰 India ki currency = Indian Rupee (₹)',
  'india national animal': '🐯 National Animal = Royal Bengal Tiger',
  'india national bird': '🦚 National Bird = Peacock (Mayur)',
  'india national flower': '🌸 National Flower = Lotus (Kamal)',
  'india national tree': '🌳 National Tree = Banyan (Bargad)',
  'india national sport': '🏑 National Sport = Hockey',
  'india national song': '🎵 National Song = Vande Mataram',
  'india national anthem': '🎶 National Anthem = Jana Gana Mana',
  'highest peak india': '⛰️ Kangchenjunga = 8,586m (India ka highest)',
  'longest river india': '🌊 Ganga = India ki sabse lambi nadi',
  'largest state india': '🗺️ Rajasthan = India ka sabse bada state',
  'smallest state india': '🗺️ Goa = India ka sabse chhota state',
  'india neighboring countries': '🌏 Pakistan, China, Nepal, Bhutan, Bangladesh, Myanmar, Sri Lanka, Maldives',

  // World GK
  'world capital': '🌍 World mein 195 countries hain.',
  'usa capital': '🏛️ USA capital = Washington D.C.',
  'china capital': '🏛️ China capital = Beijing',
  'japan capital': '🏛️ Japan capital = Tokyo',
  'uk capital': '🏛️ UK capital = London',
  'france capital': '🏛️ France capital = Paris',
  'russia capital': '🏛️ Russia capital = Moscow',
  'australia capital': '🏛️ Australia capital = Canberra',
  'highest mountain': '⛰️ Mount Everest = 8,848.86m — world ka highest',
  'deepest ocean': '🌊 Mariana Trench = 11km — Pacific Ocean mein',
  'largest continent': '🌏 Asia = largest continent',
  'largest ocean': '🌊 Pacific Ocean = largest',
  'largest country': '🗺️ Russia = largest country by area',
  'most populated country': '👥 India = most populated (2024 se)',
  'richest country': '💰 Luxembourg = highest GDP per capita',
  'solar system planets': '🪐 Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune (8 planets)',

  // Health & Fitness  
  'bmi formula': '⚖️ BMI = Weight(kg) / Height(m)². Normal = 18.5-24.9',
  'calories in rice': '🍚 100g rice = ~130 calories',
  'calories in roti': '🫓 1 roti = ~70-80 calories',
  'water daily': '💧 Din mein 8-10 glass paani piyo (2-2.5 litre)',
  'sleep': '😴 7-8 ghante ki neend zaruri hai. Less sleep = slow brain.',
  'exercise': '🏃 30 min daily exercise = better mood + focus',
  'protein foods': '💪 Protein: Eggs, Daal, Chicken, Paneer, Soya, Nuts',

  // Tech
  'ip address': '🌐 IP address = unique number jo device ko internet pe identify karta hai',
  'what is ram': '💾 RAM = Random Access Memory. Running programs store hote hain.',
  'what is rom': '💾 ROM = Read Only Memory. Permanent storage.',
  'cpu': '🖥️ CPU = Central Processing Unit. Computer ka brain.',
  'what is ai': '🤖 AI = Artificial Intelligence. Machines ko sikhana ki woh human jaisi soch sake.',
  'what is ml': '🧠 ML = Machine Learning. AI ka subset — data se sikhna.',
  'what is api': '🔌 API = Application Programming Interface. Apps ko connect karta hai.',
  'what is cloud': '☁️ Cloud = Remote servers pe data/apps store karna. Internet se access.',
  'what is blockchain': '⛓️ Blockchain = Distributed ledger. Data secure + transparent.',
  'what is python': '🐍 Python = Programming language. Easy syntax, powerful. AI/ML mein use hota hai.',
  '5g speed': '📶 5G = upto 10 Gbps speed. 4G se 100x fast.',

  // Motivation
  'motivation': '💪 Boss, har bada kaam chhoti shuruat se hota hai. Aaj ka ek step kafi hai. Chal!',
  'demotivated': '☕ Ek break lo. Chai piyo. 10 min rest karo. Sab ho jaayega.',
  'thak gaya': '😮‍💨 Thakna normal hai — matlab kuch kar raha tha. Break le, wapas aa.',
  'neend aa rahi': '😴 So jao boss. Neend mein bhi brain kaam karta hai.',
  'stressed': '🧘 Deep breath lo: 4 sec inhale, 4 hold, 4 exhale. 3 baar karo.',
  'give up': '🔥 Kabhi mat chhodo boss. Har expert pehle beginner tha.',

  // Quick calculations
  '100 usd': '💱 ~8,300 INR (approximate)',
  '1 kg to gram': '⚖️ 1 kg = 1000 grams',
  '1 meter to cm': '📏 1 meter = 100 cm',
  '1 km to meter': '📏 1 km = 1000 meters',
  '1 liter to ml': '💧 1 liter = 1000 ml',
  '1 hour to minutes': '⏰ 1 hour = 60 minutes = 3600 seconds',
  '1 year to days': '📅 1 year = 365 days (366 leap year mein)',

  // Practical
  'focus tips': '🎯 Pomodoro: 25 min kaam, 5 min break. Repeat 4x. 1 ghante mein 2 pomodoros.',
  'study tips': '📚 Active recall + spaced repetition = best study method. Notes mat sirf padho — khud se poochho.',
  'sleep better': '😴 Regular time pe so, phone band, room dark. 7-8 ghante zaruri.',
  'coding tips': '💻 Pehle problem samjho, phir code karo. Google karna weakness nahi.',
  'interview tips': '🎤 STAR method: Situation, Task, Action, Result.',
}

export function getOfflineAnswer(query: string): string | null {
  const q = query.toLowerCase().trim()
    .replace(/[?!।]/g, '')
    .replace(/\s+/g, ' ')

  // Direct match
  for (const [key, val] of Object.entries(OFFLINE_ANSWERS)) {
    if (q.includes(key)) {
      return typeof val === 'function' ? val() : val
    }
  }

  // Word-by-word match
  for (const [key, val] of Object.entries(OFFLINE_ANSWERS)) {
    const words = key.split(' ')
    if (words.length > 1 && words.every(w => q.includes(w))) {
      return typeof val === 'function' ? val() : val
    }
  }

  return null
}
