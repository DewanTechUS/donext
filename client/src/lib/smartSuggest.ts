import { todayISO } from './filters';
import type { Priority } from './types';

/**
 * Smart suggestions: reads a task title such as "milk eggs and bread" or "pay rent tomorrow 5pm"
 * and suggests a cleaner title, category, priority, due date/time and sub-items.
 *
 * Runs entirely on the device with simple rules — no AI service, no network, no cost —
 * so it also works offline and in the live demo.
 */
export interface Suggestion {
  title?: string;
  category?: string;
  priority?: Priority;
  dueDate?: string;
  dueTime?: string;
  subtasks?: string[];
  /** Minutes before the due time ("remind me 1 hour before"); -1 = "no reminder". */
  reminderMinutes?: number;
  /** "with a note …" */
  description?: string;
}

interface CategoryRule {
  name: string;
  words: string[];
}

// Order matters on a tie: earlier categories win ("water bill" → Bills, "buy milk" → Groceries).
const CATEGORIES: CategoryRule[] = [
  {
    name: 'Bills',
    words: ['bill', 'rent', 'mortgage', 'invoice', 'electricity', 'utilities', 'insurance', 'tax', 'taxes', 'credit card', 'loan', 'subscription', 'bank', 'pay'],
  },
  {
    name: 'Groceries',
    words: [
      'grocery', 'groceries', 'supermarket', 'milk', 'egg', 'bread', 'butter', 'cheese', 'yogurt', 'rice', 'pasta', 'flour', 'sugar',
      'salt', 'coffee', 'tea', 'juice', 'fruit', 'apple', 'banana', 'orange', 'grape', 'berries', 'vegetable', 'veggies', 'tomato',
      'tomatoes', 'onion', 'potato', 'potatoes', 'garlic', 'lettuce', 'spinach', 'carrot', 'chicken', 'beef', 'fish', 'meat', 'cereal',
      'oats', 'snack', 'water', 'honey', 'cream', 'lentils', 'beans',
    ],
  },
  {
    name: 'Health',
    words: ['doctor', 'dentist', 'pharmacy', 'medicine', 'meds', 'prescription', 'gym', 'workout', 'exercise', 'yoga', 'checkup', 'hospital', 'vitamin', 'therapy', 'appointment'],
  },
  {
    name: 'Work',
    words: ['meeting', 'email', 'report', 'client', 'presentation', 'deadline', 'project', 'boss', 'office', 'proposal', 'standup', 'slides', 'interview', 'resume'],
  },
  {
    name: 'Home',
    words: ['clean', 'cleaning', 'laundry', 'dishes', 'vacuum', 'trash', 'garbage', 'repair', 'fix', 'plumber', 'mow', 'lawn', 'garden', 'organize', 'move', 'moving'],
  },
  {
    name: 'Family',
    words: ['mom', 'dad', 'mother', 'father', 'kid', 'kids', 'son', 'daughter', 'wife', 'husband', 'grandma', 'grandpa', 'family', 'birthday', 'anniversary', 'school'],
  },
  {
    name: 'Travel',
    words: ['flight', 'trip', 'travel', 'hotel', 'pack', 'passport', 'visa', 'airport', 'vacation', 'holiday'],
  },
  { name: 'Car', words: ['car', 'oil change', 'tire', 'tires', 'car wash', 'mechanic', 'registration'] },
  { name: 'Learning', words: ['study', 'homework', 'exam', 'course', 'class', 'learn', 'lesson', 'read', 'library'] },
  { name: 'Shopping', words: ['buy', 'order', 'amazon', 'return', 'gift', 'clothes', 'shoes', 'shop', 'shopping'] },
  { name: 'Errands', words: ['post office', 'mail', 'package', 'pick up', 'drop off'] },
];

/** Ready-made checklists for common tasks. */
const TEMPLATES: Array<{ match: RegExp; subtasks: string[] }> = [
  { match: /\b(trip|travel|vacation|holiday)\b/, subtasks: ['Book tickets', 'Book a place to stay', 'Pack bag', 'Passport / ID', 'Chargers'] },
  { match: /\bclean\w*\b.*\b(house|home|apartment|flat|room)\b/, subtasks: ['Kitchen', 'Bathroom', 'Vacuum floors', 'Take out trash'] },
  { match: /\b(party|birthday)\b/, subtasks: ['Guest list', 'Invitations', 'Food & drinks', 'Decorations', 'Gift'] },
  { match: /\b(meeting|presentation)\b/, subtasks: ['Prepare agenda', 'Make slides', 'Send invite'] },
  { match: /\b(moving|move (house|out|in|apartments?))\b/, subtasks: ['Boxes and tape', 'Change address', 'Book movers', 'Set up utilities'] },
  { match: /\b(job application|apply for|resume)\b/, subtasks: ['Update resume', 'Write cover letter', 'Submit application'] },
  { match: /^(buy |get )?groceries$/, subtasks: ['Milk', 'Eggs', 'Bread', 'Fruit', 'Vegetables'] },
];

const HIGH = /\b(urgent|asap|important|critical|immediately|high priority|top priority|priority (?:is |level |as |of )?(?:high|urgent|top))\b|!{2,}/;
const LOW = /\b(someday|maybe|eventually|whenever|no rush|low priority|priority (?:is |level |as |of )?low)\b/;
const MEDIUM = /\b(medium priority|normal priority|priority (?:is |level |as |of )?(?:medium|normal))\b/;
// Words that only express urgency and are dropped from the title.
const PRIORITY_NOISE =
  /\b(?:with\s+)?(?:a\s+)?(?:priority (?:is |level |as |of )?(?:high|medium|normal|low|urgent|top)|(?:high|medium|normal|low|top) priority|urgent(?:ly)?|asap|no rush|someday|eventually|whenever)\b|!+/gi;

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_RX = /\b(?:on |this |next )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/;

const pad = (n: number) => String(n).padStart(2, '0');
const addDays = (now: Date, days: number) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12);
  return todayISO(d);
};
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const wordRx = (w: string) => new RegExp(`\\b${w.replace(/ /g, '\\s+')}(e?s)?\\b`, 'i');

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';

/** A real calendar date as YYYY-MM-DD, or undefined (e.g. Feb 30). Without a year: this year, or next year if it's well past. */
function makeDate(month: number, day: number, year: number | undefined, now: Date): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  let y = year === undefined ? now.getFullYear() : year < 100 ? 2000 + year : year;
  let d = new Date(y, month - 1, day, 12);
  if (year === undefined && now.getTime() - d.getTime() > 7 * 86_400_000) {
    y += 1;
    d = new Date(y, month - 1, day, 12);
  }
  return d.getMonth() === month - 1 ? todayISO(d) : undefined;
}

/** "2026-10-20", "Oct 20", "20 October 2026", "10/20", "10/20/2026" (month first, unless that's impossible). */
function explicitDate(take: (rx: RegExp) => RegExpMatchArray | null, now: Date): string | undefined {
  let m = take(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return makeDate(Number(m[2]), Number(m[3]), Number(m[1]), now);
  m = take(new RegExp(`\\b(?:on )?${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?\\b`, 'i'));
  if (m) return makeDate(MONTHS.indexOf(m[1].toLowerCase()) + 1, Number(m[2]), m[3] ? Number(m[3]) : undefined, now);
  m = take(new RegExp(`\\b(?:on )?(?:the )?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of )?${MONTH}(?:,?\\s*(\\d{4}))?\\b`, 'i'));
  if (m) return makeDate(MONTHS.indexOf(m[2].toLowerCase()) + 1, Number(m[1]), m[3] ? Number(m[3]) : undefined, now);
  m = take(/\b(?:on )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/);
  if (m) {
    let [a, b] = [Number(m[1]), Number(m[2])];
    if (a > 12 && b <= 12) [a, b] = [b, a]; // 20/10 → Oct 20
    return makeDate(a, b, m[3] ? Number(m[3]) : undefined, now);
  }
  return undefined;
}

/**
 * Reads a typed due date such as "tomorrow 5pm", "Oct 20", "10/20 3:30 pm" or "friday evening".
 * Returns null when the text isn't (only) a date; an empty box means "no due date".
 */
export function parseDue(text: string, now = new Date()): { date: string | null; time: string | null } | null {
  const t = text.trim();
  if (!t || /^(none|no( due)? date|clear)$/i.test(t)) return { date: null, time: null };
  const w = parseWhen(t, now);
  const leftover = w.text.replace(/\b(due|on|at|by|the|of|this)\b|[,.@–-]/gi, ' ').trim();
  if (!w.dueDate || leftover) return null;
  return { date: w.dueDate, time: w.dueTime ?? null };
}

function parseWhen(text: string, now: Date): { text: string; dueDate?: string; dueTime?: string; inferredDate?: boolean } {
  let t = ` ${text} `;
  let dueDate: string | undefined;
  let dueTime: string | undefined;
  const take = (rx: RegExp): RegExpMatchArray | null => {
    const m = t.match(rx);
    if (m) t = t.replace(m[0], ' ');
    return m;
  };

  // Time first, so "5pm" isn't confused with a date.
  let m = take(/\b(?:at |by |@ ?)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.?|p\.m\.?)(?![a-z])/i);
  if (m) {
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase().startsWith('p')) h += 12;
    const min = Number(m[2] ?? 0);
    if (h < 24 && min < 60) dueTime = `${pad(h)}:${pad(min)}`;
  } else if ((m = take(/\b(?:at |by )?([01]?\d|2[0-3]):([0-5]\d)\b/i))) {
    dueTime = `${pad(Number(m[1]))}:${m[2]}`;
  } else if ((m = take(/\bin (\d{1,2}) (hours?|hrs?|minutes?|mins?)\b/i))) {
    const at = new Date(now.getTime() + Number(m[1]) * (/^h/i.test(m[2]) ? 3_600_000 : 60_000));
    dueTime = `${pad(at.getHours())}:${pad(at.getMinutes())}`;
    dueDate = todayISO(at);
  } else if ((m = take(/\b(?:at|by) (\d{1,2})\b(?![:/.\d]|\s*(?:am|pm|a\.m|p\.m|days?|hours?|hrs?|mins?|minutes?|weeks?)\b)/i))) {
    // "at 9" with no am/pm: 7–12 as said, 1–6 means afternoon or evening.
    const h = Number(m[1]);
    if (h >= 1 && h <= 12) dueTime = `${pad(h <= 6 ? h + 12 : h)}:00`;
  } else if (take(/\b(?:at )?noon\b/i)) dueTime = '12:00';
  else if (take(/\b(?:this |in the )?morning\b/i)) dueTime = '09:00';
  else if (take(/\b(?:this |in the )?afternoon\b/i)) dueTime = '14:00';
  else if (take(/\b(?:this |in the )?evening\b/i)) dueTime = '18:00';

  const explicit = dueDate ? undefined : explicitDate(take, now);
  if (dueDate) {
    // already set by "in 3 hours"
  } else if (explicit) {
    dueDate = explicit;
    take(new RegExp(DAY_RX.source, 'i')); // "Friday, Oct 16": the weekday is redundant
  } else if (take(/\btonight\b/i)) {
    dueDate = addDays(now, 0);
    dueTime ??= '20:00';
  } else if (take(/\btoday\b/i)) dueDate = addDays(now, 0);
  else if (take(/\b(tomorrow|tmrw|tmr)\b/i)) dueDate = addDays(now, 1);
  else if (take(/\bnext week\b/i)) dueDate = addDays(now, 7);
  else if (take(/\b(this )?weekend\b/i)) dueDate = addDays(now, [0, 6].includes(now.getDay()) ? 0 : 6 - now.getDay());
  else if ((m = take(/\bin (\d{1,2}) days?\b/i))) dueDate = addDays(now, Number(m[1]));
  else if ((m = take(new RegExp(DAY_RX.source, 'i')))) {
    const target = DAYS.indexOf(m[1].toLowerCase());
    let diff = (target - now.getDay() + 7) % 7;
    if (diff === 0 && /next/i.test(m[0])) diff = 7;
    dueDate = addDays(now, diff);
  }

  // A time with no day: today if it's still ahead, otherwise tomorrow.
  let inferredDate = false;
  if (dueTime && !dueDate) {
    dueDate = dueTime > `${pad(now.getHours())}:${pad(now.getMinutes())}` ? addDays(now, 0) : addDays(now, 1);
    inferredDate = true;
  }
  return { text: t, dueDate, dueTime, inferredDate };
}

function categorize(lower: string, existing: string[]): string | undefined {
  let best: { name: string; score: number } | undefined;
  for (const c of CATEGORIES) {
    const score = c.words.filter((w) => wordRx(w).test(lower)).length;
    if (score > 0 && (!best || score > best.score)) best = { name: c.name, score };
  }
  // Reuse the user's own categories (e.g. "groceries" or a custom one) when the name matches.
  for (const e of existing) {
    if (e.trim() && wordRx(e.trim().toLowerCase()).test(lower)) return e;
  }
  if (!best) return undefined;
  return existing.find((e) => e.trim().toLowerCase() === best!.name.toLowerCase()) ?? best.name;
}

const GROCERY_WORDS = CATEGORIES.find((c) => c.name === 'Groceries')!.words;
// Describing words allowed in a grocery item ("oat milk", "brown rice").
const FOOD_ADJECTIVES = new Set(['fresh', 'organic', 'whole', 'brown', 'white', 'green', 'red', 'almond', 'soy', 'peanut', 'olive', 'oat', 'frozen', 'sparkling', 'greek']);
const isFoodWord = (w: string) => FOOD_ADJECTIVES.has(w) || GROCERY_WORDS.some((g) => !g.includes(' ') && wordRx(g).test(w));
/** Every word is food (or describes it): "oat milk" yes, "pack snacks" no. */
const isGrocery = (item: string) => {
  const words = item.toLowerCase().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= 3 && words.every(isFoodWord) && words.some((w) => !FOOD_ADJECTIVES.has(w));
};

/** "milk, eggs and bread" / "milk eggs bread" → ['Milk', 'Eggs', 'Bread'] (only when every item is food). */
function groceryItems(text: string): string[] | undefined {
  const body = text
    .toLowerCase()
    .replace(/^\s*(buy|get|grab|pick up|need|we need|i need)\s+/, '')
    .replace(/\b(some|the|a|an|more)\b/g, ' ')
    .trim();
  const items = body
    .split(/\s*(?:,|\band\b|&|\+)\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    // Spoken lists often have no commas ("milk eggs and bread"): split a part into words
    // when every word is a food on its own. "oat milk" stays one item.
    .flatMap((part) => {
      const words = part.split(/\s+/);
      return words.length >= 2 && words.every((w) => isGrocery(w)) ? words : [part];
    });
  if (items.length < 2 || !items.every(isGrocery)) return undefined;
  return [...new Set(items)].map(capitalize);
}

// ---- Spoken commands ("Hey DoNext, I have a job tomorrow at 9, priority high, remind me 1 hour before") ----

/** "Hey DoNext," / "OK DoNext" at the start. */
const WAKE_WORD = /^\s*(?:(?:hey|hi|hello|ok|okay)[\s,]+)?do\s?next\b[\s,.:;!-]*/i;

/** "…, add it" / "save it" / "that's it" at the end: save the task right away. */
export const SUBMIT_PHRASE = /[\s,.;:!-]*\b(?:and\s+)?(?:add it|save it|save (?:the |this )?task|add (?:the |this )?task|that'?s it|that'?s all|done adding)[\s.!]*$/i;

/** Words people say before the actual task. */
const LEADING_FILLERS = [
  /^(?:please|can you|could you|would you|i want you to)\s+/i,
  /^(?:add|create|make|put|set up|start)\s+(?:a\s+)?(?:new\s+)?(?:task|to-?do|reminder)\s*(?:to|for|called|named|:)?\s*/i,
  /^new\s+(?:task|to-?do)\s*:?\s*/i,
  /^add\s+/i,
  /^(?:remind me to|remember to|don'?t (?:let me )?forget to)\s+/i,
  /^i(?:'ve| have)? got\s+(?:to\s+|a\s+|an\s+)?/i,
  /^i\s+(?:have|need|must|should|want)\s+(?:to\s+|a\s+|an\s+|the\s+|my\s+)?/i,
  /^there(?:'s| is)\s+(?:a\s+|an\s+)/i,
];

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  fifteen: 15, twenty: 20, thirty: 30, 'forty five': 45, 'forty-five': 45,
};

const REMINDER_VERB = String.raw`(?:(?:set\s+)?(?:a\s+)?reminder|remind me|alert me|notify me)`;
const REMIND_NONE = /[\s,;]*(?:and\s+)?(?:with\s+)?no\s+reminders?\b/i;
const REMIND_BEFORE = new RegExp(
  String.raw`[\s,;]*(?:and\s+)?${REMINDER_VERB}\s+(half an hour|(\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty[- ]five)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?))\s+(?:before|earlier|ahead|prior)\b(?:\s+(?:it|that|the (?:due date|deadline|task|time)))?`,
  'i',
);
const REMIND_AT = new RegExp(
  String.raw`[\s,;]*(?:and\s+)?${REMINDER_VERB}\s+((?:(?:on|at|for|tomorrow|today|tonight|this|next|(?:sun|mon|tues|wednes|thurs|fri|satur)day|morning|evening|afternoon|noon)\b[\s,]*|\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.?|p\.m\.?)?(?![\w])[\s,]*)+)`,
  'i',
);
const REMIND_PLAIN = /[\s,;]*(?:and\s+)?(?:with\s+a\s+reminder|set\s+(?:a\s+)?reminder|add\s+(?:a\s+)?reminder|remind me)\b(?!\s+to\b)/i;

interface ReminderPhrase {
  text: string;
  minutes?: number;
  at?: { date?: string; time: string };
}

/** Pulls "remind me 1 hour before" / "remind me at 8am" / "no reminder" out of the text. */
function extractReminder(text: string, now: Date): ReminderPhrase {
  let m = text.match(REMIND_NONE);
  if (m) return { text: text.replace(m[0], ' '), minutes: -1 };
  m = text.match(REMIND_BEFORE);
  if (m) {
    let minutes: number;
    if (/^half/i.test(m[1])) minutes = 30;
    else {
      const n = /^\d+$/.test(m[2]) ? Number(m[2]) : (NUMBER_WORDS[m[2].toLowerCase()] ?? 1);
      const unit = m[3].toLowerCase();
      minutes = n * (unit.startsWith('w') ? 10_080 : unit.startsWith('d') ? 1440 : unit.startsWith('h') ? 60 : 1);
    }
    return { text: text.replace(m[0], ' '), minutes: Math.min(minutes, 43_200) };
  }
  m = text.match(REMIND_AT);
  if (m) {
    const when = parseWhen(m[1], now);
    if (when.dueTime) {
      return { text: text.replace(m[0], ' '), at: { date: when.inferredDate ? undefined : when.dueDate, time: when.dueTime } };
    }
  }
  m = text.match(REMIND_PLAIN);
  if (m) return { text: text.replace(m[0], ' ') };
  return { text };
}

const atMinutes = (date: string, time: string) => {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi).getTime() / 60_000;
};

/** The due moment used for reminders: the due time, or 9:00 AM for date-only tasks (as in reminders.ts). */
const dueAtMinutes = (date: string, time?: string) => atMinutes(date, time ?? '09:00');

/** Splits "milk, eggs and bread" into ["Milk", "Eggs", "Bread"]. */
const splitItems = (list: string) =>
  list
    .split(/\s*(?:,|;|\band\b|&|\+)\s*/i)
    .map((x) => x.trim().replace(/[.!]+$/, ''))
    .filter(Boolean)
    .map(capitalize)
    .slice(0, 50);

export function suggestTask(input: string, opts: { now?: Date; categories?: string[] } = {}): Suggestion {
  const now = opts.now ?? new Date();
  const raw = input.trim();
  if (raw.length < 2) return {};
  const s: Suggestion = {};

  // Spoken wrapper words: "Hey DoNext, …, add it".
  let text = raw.replace(WAKE_WORD, '').replace(SUBMIT_PHRASE, '');

  // "with sub-items A, B and C" and "with a note …" usually come last.
  let m = text.match(/[\s,;]*(?:with\s+)?(?:the\s+)?(?:sub[- ]?items?|sub[- ]?tasks?|(?:a\s+)?checklist)\s*(?:of|:)?\s+(.+)$/i);
  if (m) {
    s.subtasks = splitItems(m[1]);
    text = text.replace(m[0], ' ');
  }
  m = text.match(/[\s,;]*(?:(?:and\s+)?with\s+(?:a\s+|the\s+)?notes?|notes?\s*:|description\s*:)\s*(?:that\s+|saying\s+)?(.+)$/i);
  if (m) {
    s.description = capitalize(m[1].trim()).slice(0, 2000);
    text = text.replace(m[0], ' ');
  }

  // Reminder phrases first, so "remind me at 8am" isn't read as the due time.
  const reminder = extractReminder(text, now);
  text = reminder.text;

  // Explicit category: "category work".
  m = text.match(/[\s,;]*(?:(?:in|under|to|with)\s+(?:the\s+)?)?category\s+(?:is\s+|of\s+)?([a-z][\w-]*)\b/i);
  let spokenCategory: string | undefined;
  if (m) {
    spokenCategory = m[1];
    text = text.replace(m[0], ' ');
  }

  const when = parseWhen(text, now);
  if (when.dueDate) s.dueDate = when.dueDate;
  if (when.dueTime) s.dueTime = when.dueTime;

  // Turn "remind me at 8am" into minutes before the due time.
  if (reminder.minutes !== undefined) s.reminderMinutes = reminder.minutes;
  else if (reminder.at) {
    const remindDate = reminder.at.date ?? s.dueDate ?? addDays(now, reminder.at.time > `${pad(now.getHours())}:${pad(now.getMinutes())}` ? 0 : 1);
    if (!s.dueDate) {
      // No due date: the reminder time is when it's due.
      s.dueDate = remindDate;
      s.dueTime = reminder.at.time;
      s.reminderMinutes = 0;
    } else {
      const before = dueAtMinutes(s.dueDate, s.dueTime) - atMinutes(remindDate, reminder.at.time);
      if (before >= 0) s.reminderMinutes = Math.round(before);
      else if (!s.dueTime && remindDate === s.dueDate) {
        s.dueTime = reminder.at.time; // "tomorrow, remind me at 6pm" → due tomorrow at 6 PM
        s.reminderMinutes = 0;
      } else s.reminderMinutes = 0;
    }
  }

  const lower = text.toLowerCase();
  if (HIGH.test(lower)) s.priority = 'high';
  else if (LOW.test(lower)) s.priority = 'low';
  else if (MEDIUM.test(lower)) s.priority = 'medium';
  else if (s.dueDate === todayISO(now)) s.priority = 'high';

  let title = when.text.replace(PRIORITY_NOISE, ' ');
  if (when.dueDate) {
    // "due date Friday", "end date is Friday", "deadline Friday": the date itself is already taken.
    title = title.replace(/\b(?:with\s+)?(?:the\s+|a\s+)?(?:due date|end date|deadline|due|ends?|ending)(?:\s+(?:is|on|at|by|of))?\b/gi, ' ');
  }
  title = title
    .replace(/\s*[,;](?:\s*[,;])+/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '');
  for (let i = 0; i < 3; i++) {
    const before = title;
    for (const rx of LEADING_FILLERS) title = title.replace(rx, '');
    title = title
      .replace(/(?:[\s,]+(?:on|at|by|for|this|next|and|with|the|is))+\s*$/i, '')
      .replace(/^(?:and|with|for|to)\s+/i, '')
      .replace(/[\s,.;:-]+$/, '')
      .trim();
    if (title === before) break;
  }

  s.category = spokenCategory
    ? (opts.categories ?? []).find((c) => c.toLowerCase() === spokenCategory!.toLowerCase()) ?? capitalize(spokenCategory.toLowerCase())
    : categorize(title.toLowerCase(), opts.categories ?? []);

  // Sub-items the user said themselves win over grocery lists and templates.
  const items = s.subtasks ? undefined : groceryItems(title);
  if (items) {
    if (!spokenCategory) s.category = categorize('groceries', opts.categories ?? []);
    s.subtasks = items;
    title = 'Buy groceries';
  } else {
    if (s.category && /^groceries$/i.test(s.category) && isGrocery(title)) title = `Buy ${title.toLowerCase()}`; // "milk" → "Buy milk"
    const template = s.subtasks ? undefined : TEMPLATES.find((tpl) => tpl.match.test(title.toLowerCase()));
    if (template) s.subtasks = template.subtasks;
  }

  if (title) {
    title = capitalize(title);
    if (title.toLowerCase() !== raw.toLowerCase()) s.title = title; // not just a capital letter
  }
  if (!s.category) delete s.category;
  return s;
}
