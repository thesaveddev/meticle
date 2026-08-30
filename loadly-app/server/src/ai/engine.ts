import { v4 as uuid } from 'uuid';
import OpenAI from 'openai';
import db from '../db.js';

// ─── Types ───
export interface QuoteContext {
  serviceType: string;
  propertyType: string;
  propertySize: string;
  rooms: number;
  bathrooms: number;
  condition: string;
  extras: string[];
  postcode: string;
  timing: string;
  specialRequirements: string;
}

export interface QuoteResult {
  response: string;
  estimatedPrice: number | null;
  confidence: number;
  breakdown: { label: string; amount: number }[];
  isComplete: boolean;
  context: QuoteContext;
  sessionId: string;
}

interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ─── In-memory session store (production would use Redis) ───
const sessions = new Map<string, {
  context: QuoteContext;
  messages: ConversationMessage[];
  step: number;
}>();

// ─── Pricing database ───
const PRICING: Record<string, { base: number; perRoom: number; perBath: number; extras: Record<string, number> }> = {
  'end-of-tenancy': { base: 120, perRoom: 25, perBath: 20, extras: { carpet: 40, oven: 25, window: 15, fridge: 20 } },
  'regular-cleaning': { base: 45, perRoom: 8, perBath: 10, extras: { fridge: 10, oven: 15, ironing: 12, laundry: 8 } },
  'office-cleaning': { base: 60, perRoom: 12, perBath: 15, extras: { kitchen: 20, carpet: 30, window: 25 } },
  'deep-cleaning': { base: 150, perRoom: 20, perBath: 25, extras: { carpet: 40, oven: 25, window: 20, fridge: 20, grout: 30 } },
  'carpet-cleaning': { base: 0, perRoom: 80, perBath: 0, extras: { 'stain-treatment': 25, deodorise: 15 } },
  'post-construction': { base: 200, perRoom: 30, perBath: 30, extras: { 'exterior-windows': 50, garage: 40 } },
};

// ─── Property size multipliers ───
const SIZE_MULTIPLIER: Record<string, number> = {
  'studio': 0.7,
  '1-bed': 0.85,
  '2-bed': 1.0,
  '3-bed': 1.15,
  '4-bed': 1.3,
  '5-bed': 1.5,
  'small': 0.8,
  'medium': 1.0,
  'large': 1.3,
  'xlarge': 1.6,
};

// ─── Service detection keywords ───
const SERVICE_KEYWORDS: Record<string, string[]> = {
  'end-of-tenancy': ['moving out', 'moving out', 'end of tenancy', 'tenancy', 'landlord', 'deposit', 'rental', 'tenant', 'check out', 'checkout'],
  'regular-cleaning': ['regular', 'weekly', 'fortnightly', 'monthly', 'routine', 'recurring', 'ongoing', 'keep clean'],
  'office-cleaning': ['office', 'workspace', 'workplace', 'commercial', 'desk', 'business', 'company'],
  'deep-cleaning': ['deep clean', 'deep-clean', 'thorough', 'spring clean', 'intensive', 'top to bottom', 'pre-sale'],
  'carpet-cleaning': ['carpet', 'rug', 'stain', 'steam clean', 'carpets'],
  'post-construction': ['builders', 'construction', 'renovation', 'refurbishment', 'after building', 'builder clean', 'new build'],
};

const ROOM_KEYWORDS: Record<string, number> = {
  'studio': 1, '1 bed': 1, '1-bed': 1,
  '2 bed': 2, '2-bed': 2, 'two bed': 2,
  '3 bed': 3, '3-bed': 3, 'three bed': 3,
  '4 bed': 4, '4-bed': 4, 'four bed': 4,
  '5 bed': 5, '5-bed': 5, 'five bed': 5,
};

const POSTCODE_AREAS: Record<string, string> = {
  'cf': 'Cardiff',
  'cf10': 'Cardiff City Centre',
  'cf11': 'Cardiff Butetown',
  'cf14': 'Cardiff Heath',
  'cf15': 'Cardiff Llandaff',
  'cf23': 'Cardiff Penylan',
  'cf24': 'Cardiff Roath',
  'cf3': 'Cardiff East',
  'cf5': 'Cardiff Canton',
  'cf62': 'Barry',
  'cf63': 'Barry',
  'cf64': 'Penarth',
  'cf71': 'Cowbridge',
  'cf72': 'Llantwit Major',
  'cf81': 'Caerphilly',
  'cf82': 'Caerphilly',
  'np': 'Newport',
  'sa': 'Swansea',
};

function detectServiceType(input: string): string {
  const lower = input.toLowerCase();
  for (const [service, keywords] of Object.entries(SERVICE_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return service;
    }
  }
  // Default to regular cleaning if ambiguous
  if (lower.includes('clean')) return 'regular-cleaning';
  return 'regular-cleaning';
}

function detectRooms(input: string): number {
  const lower = input.toLowerCase();
  for (const [pattern, count] of Object.entries(ROOM_KEYWORDS)) {
    if (lower.includes(pattern)) return count;
  }
  // Try to find a number followed by bed/bedroom/room
  const match = lower.match(/(\d+)\s*(?:bed|bedroom|room)/);
  if (match) return parseInt(match[1]);
  return 0;
}

function detectPropertyType(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('flat') || lower.includes('apartment') || lower.includes('apt')) return 'flat';
  if (lower.includes('house') || lower.includes('terraced') || lower.includes('semi')) return 'house';
  if (lower.includes('studio')) return 'studio';
  if (lower.includes('office')) return 'office';
  if (lower.includes('commercial')) return 'commercial';
  if (lower.includes('bungalow')) return 'bungalow';
  return 'unknown';
}

function detectPostcode(input: string): string {
  const match = input.toUpperCase().match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/);
  if (match) return match[1];
  // Check for area names
  const lower = input.toLowerCase();
  for (const [code, area] of Object.entries(POSTCODE_AREAS)) {
    if (lower.includes(area.toLowerCase())) return code;
  }
  return '';
}

function detectExtras(input: string): string[] {
  const lower = input.toLowerCase();
  const extras: string[] = [];
  if (lower.includes('carpet')) extras.push('carpet');
  if (lower.includes('oven')) extras.push('oven');
  if (lower.includes('window')) extras.push('window');
  if (lower.includes('fridge')) extras.push('fridge');
  if (lower.includes('ironing')) extras.push('ironing');
  if (lower.includes('laundry')) extras.push('laundry');
  if (lower.includes('stain')) extras.push('stain-treatment');
  return extras;
}

function detectCondition(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('very dirty') || lower.includes('terrible') || lower.includes('filthy') || lower.includes('disgusting')) return 'poor';
  if (lower.includes('dirty') || lower.includes('messy') || lower.includes('needs work')) return 'average';
  if (lower.includes('not too bad') || lower.includes('okay') || lower.includes('just needs')) return 'good';
  return 'average';
}

function updateContext(context: QuoteContext, input: string): QuoteContext {
  const updated = { ...context };

  // Detect service if not set
  if (!updated.serviceType || updated.serviceType === 'regular-cleaning') {
    const detected = detectServiceType(input);
    if (detected !== 'regular-cleaning' || input.toLowerCase().includes('clean')) {
      updated.serviceType = detected;
    }
  }

  // Detect property type
  const propType = detectPropertyType(input);
  if (propType !== 'unknown') updated.propertyType = propType;

  // Detect rooms
  const rooms = detectRooms(input);
  if (rooms > 0) updated.rooms = rooms;

  // Detect property size
  const lower = input.toLowerCase();
  for (const size of ['studio', '1-bed', '2-bed', '3-bed', '4-bed', '5-bed']) {
    if (lower.includes(size.replace('-', ' ')) || lower.includes(size)) {
      updated.propertySize = size;
      if (updated.rooms === 0) updated.rooms = parseInt(size) || 1;
      break;
    }
  }

  // Detect bathrooms
  const bathMatch = lower.match(/(\d+)\s*(?:bath|toilet|wc)/);
  if (bathMatch) updated.bathrooms = parseInt(bathMatch[1]);
  if (updated.bathrooms === 0 && updated.rooms > 0) {
    updated.bathrooms = updated.rooms <= 2 ? 1 : updated.rooms <= 4 ? 2 : 3;
  }

  // Detect extras
  const extras = detectExtras(input);
  updated.extras = [...new Set([...updated.extras, ...extras])];

  // Detect condition
  const condition = detectCondition(input);
  if (condition !== 'average') updated.condition = condition;

  // Detect postcode
  const postcode = detectPostcode(input);
  if (postcode) updated.postcode = postcode;

  // Detect timing
  if (lower.includes('asap') || lower.includes('urgent') || lower.includes('today') || lower.includes('tomorrow')) {
    updated.timing = 'urgent';
  } else if (lower.includes('this week') || lower.includes('next few days')) {
    updated.timing = 'this-week';
  } else if (lower.includes('flexible') || lower.includes('no rush')) {
    updated.timing = 'flexible';
  }

  return updated;
}

function calculatePrice(context: QuoteContext): { price: number; breakdown: { label: string; amount: number }[] } {
  const pricing = PRICING[context.serviceType] || PRICING['regular-cleaning'];
  const breakdown: { label: string; amount: number }[] = [];

  // Base price
  breakdown.push({ label: `${context.serviceType.replace(/-/g, ' ')} base rate`, amount: pricing.base });

  // Per room
  const roomCount = context.rooms || 2;
  const roomTotal = pricing.perRoom * roomCount;
  breakdown.push({ label: `${roomCount} room${roomCount !== 1 ? 's' : ''} × £${pricing.perRoom}`, amount: roomTotal });

  // Bathrooms
  const bathCount = context.bathrooms || 1;
  if (pricing.perBath > 0) {
    const bathTotal = pricing.perBath * bathCount;
    breakdown.push({ label: `${bathCount} bathroom${bathCount !== 1 ? 's' : ''} × £${pricing.perBath}`, amount: bathTotal });
  }

  // Extras
  for (const extra of context.extras) {
    const extraPrice = pricing.extras[extra] || 0;
    if (extraPrice > 0) {
      breakdown.push({ label: extra.replace(/-/g, ' '), amount: extraPrice });
    }
  }

  // Size multiplier
  const multiplier = SIZE_MULTIPLIER[context.propertySize] || 1.0;
  const subtotal = breakdown.reduce((sum, b) => sum + b.amount, 0);
  let total = subtotal * multiplier;

  // Urgency surcharge
  if (context.timing === 'urgent') {
    const urgencyFee = Math.round(total * 0.15);
    breakdown.push({ label: 'Urgent booking (+15%)', amount: urgencyFee });
    total += urgencyFee;
  }

  // Condition surcharge for poor condition
  if (context.condition === 'poor') {
    const conditionFee = Math.round(total * 0.2);
    breakdown.push({ label: 'Extra attention required (+20%)', amount: conditionFee });
    total += conditionFee;
  }

  total = Math.round(total);
  return { price: total, breakdown };
}

function determineNextQuestion(context: QuoteContext, step: number): string | null {
  // Build a list of what we still need
  const missing: string[] = [];

  if (!context.serviceType) missing.push('service');
  if (context.rooms === 0) missing.push('rooms');
  if (context.propertyType === 'unknown') missing.push('property');
  if (context.extras.length === 0 && context.serviceType === 'end-of-tenancy') missing.push('extras');
  if (context.bathrooms === 0) missing.push('bathrooms');

  // Step-based questioning
  if (step === 0) return null; // First message, no questions yet

  if (step === 1) {
    if (context.rooms === 0) return 'How many bedrooms does the property have?';
    if (context.propertyType === 'unknown') return 'Is it a flat, house, or office?';
  }

  if (step === 2) {
    if (context.extras.length === 0 && context.serviceType === 'end-of-tenancy') {
      return 'Does this include carpet cleaning, oven cleaning, or window cleaning?';
    }
    if (context.bathrooms === 0) return 'How many bathrooms?';
  }

  if (step === 3) {
    if (!context.postcode) return 'Which area or postcode is the property in? (e.g. CF10, Penarth, Barry)';
    if (context.condition === 'average') {
      return 'How would you describe the current condition? (e.g. "not too bad", "quite dirty", "needs a lot of work")';
    }
  }

  if (step === 4) {
    return 'When do you need this done? (e.g. ASAP, this week, flexible)';
  }

  return null;
}

function buildResponse(context: QuoteContext, question: string | null, price: { price: number; breakdown: { label: string; amount: number }[] }, step: number): { text: string; isComplete: boolean } {
  const serviceName = (context.serviceType || 'cleaning').replace(/-/g, ' ');
  const locationStr = context.postcode ? ` in ${POSTCODE_AREAS[context.postcode.toLowerCase()] || context.postcode}` : '';

  if (question) {
    // Still gathering info
    if (step === 1) {
      const greetings = [
        `Got it — ${serviceName}${locationStr}. To give you an accurate quote, I need a few details.`,
        `Thanks! ${serviceName}${locationStr} — understood. Let me ask a couple of questions.`,
      ];
      return {
        text: `${greetings[0]}\n\n${question}`,
        isComplete: false,
      };
    }
    return {
      text: question,
      isComplete: false,
    };
  }

  // Build the final quote
  const breakdownLines = price.breakdown.map(b => `  ${b.label} — £${b.amount}`).join('\n');
  const sizeNote = context.propertySize ? ` (${context.propertySize} ${context.propertyType || 'property'})` : '';
  const extraNote = context.extras.length > 0 ? `\nExtras: ${context.extras.join(', ').replace(/-/g, ' ')}` : '';

  return {
    text: `Here's your estimate for ${serviceName}${sizeNote}${locationStr}:\n\n${breakdownLines}\n  ──────────────\n  Total: £${price.price}\n${extraNote}\n\nThis includes all standard items for a ${context.rooms || 2}-bedroom ${context.propertyType || 'property'}. The final price may vary slightly after we assess the property.\n\nWould you like to book this? I'll need your name and phone number to confirm.`,
    isComplete: true,
  };
}

export function createSession(): string {
  const id = uuid();
  const emptyContext: QuoteContext = {
    serviceType: '',
    propertyType: 'unknown',
    propertySize: '',
    rooms: 0,
    bathrooms: 0,
    condition: 'average',
    extras: [],
    postcode: '',
    timing: '',
    specialRequirements: '',
  };
  sessions.set(id, { context: emptyContext, messages: [], step: 0 });
  return id;
}

export async function processMessage(sessionId: string, userMessage: string): Promise<QuoteResult> {
  let session = sessions.get(sessionId);
  if (!session) {
    const id = createSession();
    session = sessions.get(id)!;
    sessionId = id;
  }

  session.messages.push({ role: 'user', content: userMessage });
  session.step++;

  // Try OpenAI first
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      return await processWithOpenAI(sessionId, session, userMessage);
    } catch (err) {
      console.error('OpenAI failed, falling back to rule-based:', err);
    }
  }

  // Rule-based engine
  return processWithRules(sessionId, session, userMessage);
}

async function processWithOpenAI(sessionId: string, session: any, userMessage: string): Promise<QuoteResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = `You are Loadly's intelligent quoting assistant. You help customers get accurate cleaning quotes for properties in Cardiff and South Wales.

Current conversation context:
- Service: ${session.context.serviceType || 'not determined'}
- Property: ${session.context.propertyType} ${session.context.propertySize} ${session.context.rooms} bed ${session.context.bathrooms} bath
- Location: ${session.context.postcode || 'not provided'}
- Condition: ${session.context.condition}
- Extras: ${session.context.extras.join(', ') || 'none'}
- Timing: ${session.context.timing || 'flexible'}
- Step: ${session.step}

RULES:
1. Ask ONE question at a time, never more
2. Be conversational and friendly
3. After 2-4 exchanges, provide a price estimate
4. Base prices: end-of-tenancy from £120, regular from £45/session, office from £60, deep clean from £150, carpet from £80/room, post-construction from £200
5. Ask about: property type, number of rooms, specific needs (carpet, oven, windows), location, timing
6. When you have enough info, respond with [QUOTE:£XXX] where XXX is the estimated price
7. Never make up fake discounts or urgency pressure
8. Keep responses concise (2-3 sentences max per response)
9. If they want to book, ask for name, phone, and email`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...session.messages.slice(-10),
    ],
    max_tokens: 300,
    temperature: 0.7,
  });

  const aiResponse = response.choices[0].message.content || 'Sorry, could you try again?';
  session.messages.push({ role: 'assistant', content: aiResponse });

  // Extract price if quoted
  let estimatedPrice: number | null = null;
  const priceMatch = aiResponse.match(/\[QUOTE:£(\d+)\]/);
  if (priceMatch) {
    estimatedPrice = parseInt(priceMatch[1]);
  }

  const isComplete = !!priceMatch || session.step >= 5;

  return {
    response: aiResponse.replace(/\[QUOTE:£\d+\]/g, '').trim(),
    estimatedPrice,
    confidence: priceMatch ? 0.85 : 0.5,
    breakdown: estimatedPrice ? [
      { label: 'AI-estimated total', amount: estimatedPrice },
    ] : [],
    isComplete,
    context: session.context,
    sessionId,
  };
}

function processWithRules(sessionId: string, session: any, userMessage: string): QuoteResult {
  // Update context from user message
  session.context = updateContext(session.context, userMessage);

  // Determine if we need more info
  const nextQuestion = determineNextQuestion(session.context, session.step);
  const isComplete = !nextQuestion && session.step >= 2;
  const price = calculatePrice(session.context);
  const { text, isComplete: responseComplete } = buildResponse(session.context, nextQuestion, price, session.step);

  session.messages.push({ role: 'assistant', content: text });

  const finalComplete = isComplete || responseComplete;

  return {
    response: text,
    estimatedPrice: finalComplete ? price.price : null,
    confidence: finalComplete ? 0.75 : 0.3,
    breakdown: finalComplete ? price.breakdown : [],
    isComplete: finalComplete,
    context: session.context,
    sessionId,
  };
}

export function getSession(sessionId: string) {
  return sessions.get(sessionId);
}
