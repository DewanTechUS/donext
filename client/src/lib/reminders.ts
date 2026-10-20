import { formatTime } from './filters';
import { storage } from './storage';
import type { Task } from './types';

export type ReminderSound = 'chime' | 'bell' | 'beep' | 'none';

/** In-app reminder preferences, kept per device. */
export interface ReminderSettings {
  enabled: boolean;
  /** Minutes before the due time. */
  lead: number;
  sound: ReminderSound;
  /** Read the reminder aloud with the device's voice. */
  speak: boolean;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { enabled: true, lead: 0, sound: 'chime', speak: false };

export const LEAD_OPTIONS = [
  { value: 0, label: 'At the due time' },
  { value: 10, label: '10 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
];

/** Tasks with a date but no time are reminded at this time on their day. */
export const DATE_ONLY_TIME = '09:00';

/** How long after its moment a reminder still fires (e.g. when the app is opened a bit late). */
export const GRACE_MS = 15 * 60_000;

const SETTINGS_KEY = 'dt.reminders';
const STATE_KEY = 'dt.reminders.state';

export function loadReminderSettings(): ReminderSettings {
  return { ...DEFAULT_REMINDER_SETTINGS, ...(storage.get<Partial<ReminderSettings>>(SETTINGS_KEY) ?? {}) };
}

export function saveReminderSettings(s: ReminderSettings) {
  storage.set(SETTINGS_KEY, s);
  window.dispatchEvent(new Event('donext:reminder-settings'));
}

/** When the task is due, as a local time. */
export function dueMoment(task: Pick<Task, 'dueDate'> & { dueTime?: string | null }): Date | null {
  if (!task.dueDate) return null;
  const [y, m, d] = task.dueDate.split('-').map(Number);
  const [h, mi] = (task.dueTime ?? DATE_ONLY_TIME).split(':').map(Number);
  return new Date(y, m - 1, d, h, mi);
}

/** Minutes before the due time to remind for this task, or null for no reminder. */
export function reminderLead(task: Pick<Task, 'reminderMinutes'>, settings: ReminderSettings): number | null {
  const lead = task.reminderMinutes ?? settings.lead;
  return lead < 0 ? null : lead;
}

/** When this task's reminder should go off, or null (no due date, or no reminder). */
export function reminderMoment(task: Task, settings: ReminderSettings): Date | null {
  const due = dueMoment(task);
  const lead = reminderLead(task, settings);
  return due && lead !== null ? new Date(due.getTime() - lead * 60_000) : null;
}

/** "1 hour before", "At the due time"… for a lead in minutes. */
export function describeLead(minutes: number): string {
  if (minutes < 0) return 'No reminder';
  if (minutes === 0) return 'At the due time';
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? '' : 's'} before`;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? '' : 's'} before`;
  return `${minutes} minutes before`;
}

/** Identifies one reminder; changes when the task's due date/time or the lead changes, so it can fire again. */
export const reminderKey = (task: Task, lead: number) => `${task.id}|${task.dueDate}|${task.dueTime ?? ''}|${lead}`;

/** Reminders already shown, and snoozed ones (key → time to show again). */
export interface ReminderState {
  fired: Record<string, number>;
  snoozed: Record<string, number>;
}

export function loadReminderState(now = Date.now()): ReminderState {
  const s = storage.get<ReminderState>(STATE_KEY) ?? { fired: {}, snoozed: {} };
  // Forget anything older than three days.
  const fresh = (o: Record<string, number> = {}) => Object.fromEntries(Object.entries(o).filter(([, t]) => now - t < 3 * 86_400_000));
  return { fired: fresh(s.fired), snoozed: s.snoozed ?? {} };
}

export const saveReminderState = (s: ReminderState) => storage.set(STATE_KEY, s);

/** Tasks whose reminder should be shown now. */
export function dueReminders(tasks: Task[], now: Date, settings: ReminderSettings, state: ReminderState): Array<{ task: Task; key: string }> {
  if (!settings.enabled) return [];
  const t = now.getTime();
  const out: Array<{ task: Task; key: string }> = [];
  for (const task of tasks) {
    if (task.completed || task.deletedAt) continue;
    const due = dueMoment(task);
    if (!due) continue;
    const lead = reminderLead(task, settings);
    if (lead === null) continue;
    const key = reminderKey(task, lead);
    const snoozedUntil = state.snoozed[key];
    if (snoozedUntil !== undefined) {
      if (t >= snoozedUntil) out.push({ task, key });
      continue;
    }
    if (state.fired[key]) continue;
    const at = due.getTime() - lead * 60_000;
    if (t >= at && t < at + GRACE_MS) out.push({ task, key });
  }
  return out;
}

/** "Pay rent is due in 10 minutes, at 5:00 PM." */
export function reminderText(task: Pick<Task, 'title' | 'dueDate'> & { dueTime?: string | null }, now = new Date()): string {
  const due = dueMoment(task);
  if (!due) return task.title;
  if (!task.dueTime) return `${task.title} is due today.`;
  const mins = Math.round((due.getTime() - now.getTime()) / 60_000);
  const at = ` at ${formatTime(task.dueTime)}`;
  if (mins > 1) {
    const amount = mins >= 60 ? `${Math.round(mins / 60)} hour${Math.round(mins / 60) === 1 ? '' : 's'}` : `${mins} minutes`;
    return `${task.title} is due in ${amount},${at}.`;
  }
  if (mins >= -1) return `${task.title} is due now.`;
  return `${task.title} was due${at}.`;
}
