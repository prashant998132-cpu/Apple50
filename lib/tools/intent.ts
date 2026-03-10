/* lib/tools/intent.ts — Intent detection for tool routing */

export interface IntentResult {
  categories: string[];
  confidence: number;
  extractedArgs: Record<string, string>;
  maxTools: number;
  skipTools: string[];
  reason: string;
}

type Intent = {
  category: string;
  patterns: RegExp[];
  argExtract?: (input: string) => Record<string, string>;
};

const INTENTS: Intent[] = [
  {
    category: 'weather',
    patterns: [/weather|mausam|baarish|temperature|garmi|sardi|barsat|forecast|dhoop/i],
    argExtract: (input) => {
      const city = input.replace(/weather|mausam|baarish|temperature|forecast|ka|ki|kya|hai|aaj|kal/gi, '').trim();
      return { city: city || 'auto' };
    },
  },
  {
    category: 'image',
    patterns: [/generate image|draw|create photo|image bana|photo bana|picture bana|ai image|dall-e/i],
    argExtract: (input) => ({ prompt: input.replace(/generate image|draw|create photo|image bana|photo bana|picture bana|ai image/gi, '').trim() }),
  },
  {
    category: 'news',
    patterns: [/news|khabar|samachar|headlines|latest|aaj ki news|breaking/i],
    argExtract: (input) => {
      const q = input.replace(/news|khabar|samachar|headlines|latest|aaj|ki|breaking/gi, '').trim();
      return { query: q || 'india' };
    },
  },
  {
    category: 'music',
    patterns: [/song|music|gana|play|spotify|youtube music|gaana/i],
    argExtract: (input) => ({ query: input.replace(/song|music|gana|play|spotify|gaana/gi, '').trim() }),
  },
  {
    category: 'movie',
    patterns: [/movie|film|cinema|imdb|rating|review|actor|actress/i],
    argExtract: (input) => ({ title: input.replace(/movie|film|cinema|imdb|rating|review|ka|ki|kya|hai/gi, '').trim() }),
  },
  {
    category: 'search',
    patterns: [/search|google|find|dhundhna|batao|kya hai|what is|who is|where is/i],
    argExtract: (input) => ({ query: input.replace(/search|google|find|dhundhna/gi, '').trim() }),
  },
  {
    category: 'maps',
    patterns: [/map|location|kahan|address|direction|navigate|route|nearest|nearby/i],
    argExtract: (input) => ({ query: input.replace(/map|location|kahan|address|direction|navigate|route/gi, '').trim() }),
  },
  {
    category: 'calculator',
    patterns: [/calculate|calc|math|[\d\+\-\*\/\(\)]+|formula|equation|solve|=\?/i],
    argExtract: (input) => ({ expression: input.replace(/calculate|calc|solve|kya hoga|equal|=\?/gi, '').trim() }),
  },
  {
    category: 'translate',
    patterns: [/translate|anuvad|meaning|ka matlab|hindi mein|english mein|in hindi|in english/i],
    argExtract: (input) => {
      const match = input.match(/translate\s+(.+)\s+(to|in|mein)\s+(\w+)/i);
      return { text: match?.[1] || input, targetLang: match?.[3] || 'English' };
    },
  },
  {
    category: 'reminder',
    patterns: [/remind|reminder|alarm|yaad|set reminder|notification|baje|kal|aaj|ghante mein/i],
    argExtract: (input) => ({ text: input }),
  },
  {
    category: 'stock',
    patterns: [/stock|share|nifty|sensex|nse|bse|reliance|tata|market|price/i],
    argExtract: (input) => ({ query: input.replace(/stock|share price|ka price|price|kya hai/gi, '').trim() }),
  },
  {
    category: 'crypto',
    patterns: [/crypto|bitcoin|btc|ethereum|eth|dogecoin|bnb|coin|token/i],
    argExtract: (input) => ({ coin: input.replace(/crypto|price|kya hai|ka price/gi, '').trim().toLowerCase() }),
  },
  {
    category: 'cricket',
    patterns: [/cricket|ipl|match|wicket|century|run|score|team india|odi|test match/i],
  },
  {
    category: 'recipe',
    patterns: [/recipe|khana|cook|banao|ingredients|dish|food|kaise banate|banana|khaana/i],
    argExtract: (input) => ({ dish: input.replace(/recipe|kaise banate|banana|ingredients/gi, '').trim() }),
  },
  {
    category: 'wiki',
    patterns: [/wikipedia|wiki|history|itihas|about|ke baare mein|biography|jivani/i],
    argExtract: (input) => ({ query: input.replace(/wikipedia|wiki|history|about|ke baare mein|biography/gi, '').trim() }),
  },
  {
    category: 'joke',
    patterns: [/joke|funny|haha|lol|mazak|hasao|comedy/i],
  },
  {
    category: 'quote',
    patterns: [/quote|motivation|inspire|suvichar|thought|anmol vachan/i],
  },
  {
    category: 'qr',
    patterns: [/qr|qr code|barcode|scan code|generate qr/i],
    argExtract: (input) => ({ text: input.replace(/qr code|qr|generate|banana|create/gi, '').trim() }),
  },
  {
    category: 'currency',
    patterns: [/currency|dollar|euro|rupee|exchange rate|convert|kitne|\$|€|£|₹/i],
    argExtract: (input) => {
      const match = input.match(/(\d+(?:\.\d+)?)\s*([a-z]+)\s*(?:to|mein|in)\s*([a-z]+)/i);
      return { amount: match?.[1] || '1', from: match?.[2] || 'USD', to: match?.[3] || 'INR' };
    },
  },
  {
    category: 'trivia',
    patterns: [/trivia|quiz|gk|general knowledge|question|kuch batao/i],
  },
  {
    category: 'space',
    patterns: [/space|nasa|star|planet|galaxy|isro|rocket|launch|astronaut|antriksh/i],
  },
  {
    category: 'anime',
    patterns: [/anime|manga|naruto|one piece|dragon ball|demon slayer|attack on titan/i],
    argExtract: (input) => ({ query: input.replace(/anime|manga|ke baare|about/gi, '').trim() }),
  },
];

export function detectIntent(input: string): IntentResult {
  const matched: string[] = [];
  const args: Record<string, string> = {};
  let confidence = 0;

  for (const intent of INTENTS) {
    for (const pattern of intent.patterns) {
      if (pattern.test(input)) {
        matched.push(intent.category);
        if (intent.argExtract) {
          Object.assign(args, intent.argExtract(input));
        }
        confidence = Math.max(confidence, 0.8);
        break;
      }
    }
  }

  if (matched.length === 0) {
    return {
      categories: ['chat'],
      confidence: 0.3,
      extractedArgs: {},
      maxTools: 0,
      skipTools: [],
      reason: 'General conversation',
    };
  }

  return {
    categories: matched,
    confidence,
    extractedArgs: args,
    maxTools: Math.min(matched.length * 2, 10),
    skipTools: [],
    reason: `Detected: ${matched.join(', ')}`,
  };
}

// Auto mode routing
export function autoRouteMode(input: string): 'flash' | 'think' | 'deep' {
  const lower = input.toLowerCase();

  // Think mode triggers
  if (/solve|neet|jee|math|reason|derive|explain\s+step|prove|calculate|formula|equation|physics|chemistry|biology/i.test(lower)) {
    return 'think';
  }

  // Deep mode triggers (tool-heavy)
  if (/news|weather|image|search|movie|song|map|live|cricket|stock|crypto|recipe|translate/i.test(lower)) {
    return 'deep';
  }

  return 'flash';
}
