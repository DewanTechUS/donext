import { formatDueDate, formatTime, isOverdue, todayISO } from './filters';
import { describeLead } from './reminders';
import { SUBMIT_PHRASE } from './smartSuggest';
import type { Task, TaskFields } from './types';

/**
 * Hands-free voice commands, on top of adding tasks:
 *   "Mark the job as done" · "I finished the report" · "Check off groceries"
 *   "What do I have today?" · "What's due tomorrow?" · "Anything overdue?" · "Read my tasks"
 * and "…, add it" / "save it" at the end of a new task to save it without touching the screen.
 */
export type AgendaRange = 'today' | 'tomorrow' | 'overdue' | 'all';

export type VoiceCommand =
  | { kind: 'complete'; query: string }
  | { kind: 'agenda'; range: AgendaRange }
  | { kind: 'add'; text: string; submit: boolean };

const WAKE = /^\s*(?:(?:hey|hi|hello|ok|okay)[\s,]+)?do\s?next\b[\s,.:;!-]*/i;

export function parseVoiceCommand(input: string): VoiceCommand {
  const text = input.replace(WAKE, '').trim();
  const submit = SUBMIT_PHRASE.test(text);
  const body = text.replace(SUBMIT_PHRASE, '').trim().replace(/[.?!]+$/, '');

  // Completing a task. Only clear phrasings, so "complete the tax form" can still be a new task.
  const done =
    body.match(/^(?:please\s+)?(?:mark|set)\s+(.+?)\s+(?:as\s+)?(?:done|complete(?:d)?|finished)$/i) ??
    body.match(/^(?:please\s+)?(?:check|tick|cross)\s+off\s+(.+)$/i) ??
    body.match(/^i(?:'ve| have)?\s+(?:just\s+)?(?:finished|completed|done with)\s+(.+)$/i);
  if (done) {
    const query = done[1].replace(/^(?:the|my|a)\s+/i, '').replace(/\s+(?:task|item)$/i, '').trim();
    if (query) return { kind: 'complete', query };
  }

  // Asking what's on the list.
  if (
    /^(?:what(?:'s| is| do i have| have i got| are my| else)|read|tell me|show me|list|any(?:thing)?|do i have)\b/i.test(body) &&
    /\b(today|tonight|tomorrow|overdue|late|tasks?|to-?dos?|list|agenda|plans?|schedule|due)\b/i.test(body)
  ) {
    const range: AgendaRange = /\btomorrow\b/i.test(body)
      ? 'tomorrow'
      : /\b(overdue|late)\b/i.test(body)
        ? 'overdue'
        : /\b(today|tonight)\b/i.test(body)
          ? 'today'
          : 'all';
    return { kind: 'agenda', range };
  }

  return { kind: 'add', text: body, submit };
}

/** groceries → grocery, reports → report: so singular and plural match. */
const stem = (w: string) => (w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !['the', 'a', 'an', 'my', 'to', 'for', 'of'].includes(w))
    .map(stem);

/** The open task that best matches what was said, or null. */
export function findTask(tasks: Task[], query: string): Task | null {
  const q = words(query);
  if (!q.length) return null;
  let best: { task: Task; score: number } | null = null;
  for (const task of tasks) {
    if (task.completed || task.deletedAt) continue;
    const t = words(task.title);
    if (!t.length) continue;
    const shared = q.filter((w) => t.some((x) => x === w || (w.length > 3 && (x.startsWith(w) || w.startsWith(x))))).length;
    let score = shared / Math.max(q.length, t.length);
    if (t.join(' ') === q.join(' ')) score = 2;
    else if (t.join(' ').includes(q.join(' '))) score = Math.max(score, 0.9);
    if (!best || score > best.score) best = { task, score };
  }
  return best && best.score >= 0.5 ? best.task : null;
}

const when = (t: Pick<Task, 'dueDate' | 'dueTime'>, today: string) =>
  t.dueTime ? `${t.dueDate === today ? '' : `${formatDueDate(t.dueDate!, today)} `}at ${formatTime(t.dueTime)}`.trim() : '';

const listOut = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** A short spoken summary: "You have 2 tasks today: Job at 9:00 AM and Pay rent. 1 is overdue: …" */
export function agendaText(tasks: Task[], range: AgendaRange, now = new Date()): string {
  const today = todayISO(now);
  const tomorrow = todayISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12));
  const open = tasks.filter((t) => !t.completed && !t.deletedAt);
  // Timed tasks first within a day; plain comparison (localeCompare would sort '~' before digits).
  const key = (t: Task) => `${t.dueDate} ${t.dueTime ?? '~'}`;
  const byTime = (a: Task, b: Task) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
  const name = (t: Task, day: string) => [t.title, when(t, day)].filter(Boolean).join(' ');
  const overdue = open.filter((t) => isOverdue(t, today, `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)).sort(byTime);
  const overdueText = overdue.length
    ? ` ${overdue.length === 1 ? '1 task is' : `${overdue.length} tasks are`} overdue: ${listOut(overdue.slice(0, 5).map((t) => t.title))}.`
    : '';

  if (range === 'overdue') return overdue.length ? overdueText.trim() : 'Nothing is overdue. Nice work!';
  if (range === 'all') {
    if (!open.length) return 'Your list is empty. Tap the mic to add a task.';
    const first = [...open].sort((a, b) => (!a.dueDate ? 1 : !b.dueDate ? -1 : byTime(a, b))).slice(0, 5);
    return `You have ${open.length} open task${open.length === 1 ? '' : 's'}. Next up: ${listOut(first.map((t) => t.title))}.${overdueText}`;
  }
  const day = range === 'today' ? today : tomorrow;
  const due = open.filter((t) => t.dueDate === day && !overdue.includes(t)).sort(byTime);
  const label = range === 'today' ? 'today' : 'tomorrow';
  const main = due.length
    ? `You have ${due.length} task${due.length === 1 ? '' : 's'} ${label}: ${listOut(due.slice(0, 6).map((t) => name(t, day)))}.`
    : `Nothing is due ${label}.`;
  return `${main}${range === 'today' ? overdueText : ''}`;
}

/** What DoNext says after saving a task hands-free: "Added Job, tomorrow at 9:00 AM, high priority, reminder 1 hour before." */
export function confirmationText(f: Pick<TaskFields, 'title' | 'dueDate' | 'dueTime' | 'priority' | 'reminderMinutes' | 'subtasks'>, now = new Date()): string {
  const today = todayISO(now);
  const parts = [`Added ${f.title.trim()}`];
  if (f.dueDate) parts.push(`${formatDueDate(f.dueDate, today)}${f.dueTime ? ` at ${formatTime(f.dueTime)}` : ''}`);
  if (f.priority !== 'medium') parts.push(`${f.priority} priority`);
  if (f.dueDate && f.reminderMinutes !== null) parts.push(f.reminderMinutes < 0 ? 'no reminder' : `reminder ${describeLead(f.reminderMinutes).toLowerCase()}`);
  if (f.subtasks.length) parts.push(`${f.subtasks.length} sub-item${f.subtasks.length === 1 ? '' : 's'}`);
  return `${parts.join(', ')}.`;
}

/**
 * The spoken version, in short natural sentences and without "Added":
 * "Job, tomorrow at 9:00 AM. High priority. I'll remind you 1 hour before."
 */
export function spokenConfirmation(f: Parameters<typeof confirmationText>[0], now = new Date()): string {
  const today = todayISO(now);
  const when = f.dueDate
    ? `${formatDueDate(f.dueDate, today).replace(/^(Today|Tomorrow)$/, (d) => d.toLowerCase())}${f.dueTime ? ` at ${formatTime(f.dueTime)}` : ''}`
    : '';
  const sentences = [when ? `${f.title.trim()}, ${when}.` : `${f.title.trim()}.`];
  if (f.priority !== 'medium') sentences.push(`${f.priority === 'high' ? 'High' : 'Low'} priority.`);
  if (f.dueDate && f.reminderMinutes !== null) {
    sentences.push(
      f.reminderMinutes < 0
        ? 'No reminder.'
        : f.reminderMinutes === 0
          ? 'I’ll remind you at that time.'
          : `I’ll remind you ${describeLead(f.reminderMinutes).toLowerCase()}.`,
    );
  }
  if (f.subtasks.length) sentences.push(`${f.subtasks.length} sub-item${f.subtasks.length === 1 ? '' : 's'}.`);
  return sentences.join(' ');
}
