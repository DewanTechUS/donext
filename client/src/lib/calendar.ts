/**
 * "Add to calendar" for tasks. The user's own calendar app (Google Calendar, Apple
 * Calendar, Outlook…) stores the event and shows the reminder, so this works on every
 * device with no server, push service or extra permissions.
 */

export interface CalendarEvent {
  title: string;
  description: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24-hour, in the user's local time */
  time: string;
  durationMinutes: number;
  /** Minutes before the start to remind (0 = at the start time). */
  reminderMinutes: number;
  /** Stable id so re-adding the same task updates rather than duplicates (where supported). */
  uid: string;
}

export type CalendarPlatform = 'apple' | 'android' | 'windows' | 'other';

interface PlatformHints {
  /** Capacitor platform when running as a native app ('ios' | 'android' | 'web'). */
  nativePlatform?: string;
  userAgent?: string;
  /** navigator.userAgentData.platform where available (Chromium). */
  uaPlatform?: string;
  maxTouchPoints?: number;
}

/**
 * Picks the calendar this device most likely uses, so the right button can be offered first:
 * iPhone/iPad/Mac → Apple Calendar, Android → Google Calendar, Windows → Outlook/Windows Calendar.
 */
export function detectCalendarPlatform(h: PlatformHints = {}): CalendarPlatform {
  if (h.nativePlatform === 'ios') return 'apple';
  if (h.nativePlatform === 'android') return 'android';
  const ua = h.userAgent ?? '';
  const platform = (h.uaPlatform ?? '').toLowerCase();
  if (platform === 'android' || /Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'apple';
  // iPadOS reports itself as a Mac; Macs and iPads both use Apple Calendar.
  if (platform === 'macos' || /Macintosh|Mac OS X/i.test(ua)) return 'apple';
  if (platform === 'windows' || /Windows/i.test(ua)) return 'windows';
  return 'other';
}

export const REMINDER_OPTIONS: { minutes: number; label: string }[] = [
  { minutes: 0, label: 'At the time' },
  { minutes: 10, label: '10 minutes before' },
  { minutes: 30, label: '30 minutes before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 1440, label: '1 day before' },
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local wall-clock start/end as "YYYYMMDDTHHMMSS" (no time zone = the device's local time). */
function localStamps(e: CalendarEvent) {
  const [y, m, d] = e.date.split('-').map(Number);
  const [hh, mm] = e.time.split(':').map(Number);
  const start = new Date(y, m - 1, d, hh, mm);
  const end = new Date(start.getTime() + e.durationMinutes * 60_000);
  const fmt = (t: Date) => `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}T${pad(t.getHours())}${pad(t.getMinutes())}00`;
  return { start: fmt(start), end: fmt(end) };
}

/** Link that opens Google Calendar's "new event" screen, pre-filled. */
export function googleCalendarUrl(e: CalendarEvent, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  const { start, end } = localStamps(e);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${start}/${end}`,
    details: e.description,
  });
  if (timeZone) params.set('ctz', timeZone);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Escapes text for an iCalendar property value (RFC 5545 §3.3.11). */
export function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds long lines at 75 octets (RFC 5545 §3.1), continuing with a space. */
export function icsFold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  for (const ch of line) {
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes.encode(current + ch).length > limit) {
      parts.push(current);
      current = ch;
    } else current += ch;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

/** A standard .ics calendar file with one event and a reminder (works with Apple Calendar, Outlook, Google…). */
export function icsFile(e: CalendarEvent, now = new Date()): string {
  const { start, end } = localStamps(e);
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dewan Mahmud//DoNext//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}@donext`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsEscape(e.title)}`,
    ...(e.description ? [`DESCRIPTION:${icsEscape(e.description)}`] : []),
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(e.title)}`,
    `TRIGGER:${e.reminderMinutes === 0 ? 'PT0M' : `-PT${e.reminderMinutes}M`}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

/** Safe file name from a task title. */
export function icsFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${slug || 'task'}.ics`;
}
