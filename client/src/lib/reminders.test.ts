import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_REMINDER_SETTINGS,
  dueMoment,
  dueReminders,
  loadReminderSettings,
  loadReminderState,
  reminderKey,
  reminderText,
  saveReminderSettings,
  type ReminderState,
} from './reminders';
import type { Task } from './types';

const task = (over: Partial<Task>): Task => ({
  id: 't1',
  title: 'Pay rent',
  description: '',
  dueDate: '2026-10-13',
  dueTime: '17:00',
  reminderMinutes: null,
  priority: 'medium',
  category: '',
  completed: false,
  subtasks: [],
  listId: null,
  assigneeId: null,
  createdBy: 'u',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  deletedAt: null,
  ...over,
});

const at = (h: number, m = 0) => new Date(2026, 9, 13, h, m);
const empty = (): ReminderState => ({ fired: {}, snoozed: {} });
const settings = { ...DEFAULT_REMINDER_SETTINGS };

describe('reminders', () => {
  beforeEach(() => localStorage.clear());

  it('fires at the due time, within a short grace period, once', () => {
    const t = task({});
    expect(dueReminders([t], at(16, 59), settings, empty())).toEqual([]);
    expect(dueReminders([t], at(17, 0), settings, empty())).toEqual([{ task: t, key: reminderKey(t, 0) }]);
    expect(dueReminders([t], at(17, 14), settings, empty())).toHaveLength(1);
    expect(dueReminders([t], at(17, 16), settings, empty())).toEqual([]); // too late: don't nag about old tasks
    const fired = { fired: { [reminderKey(t, 0)]: 1 }, snoozed: {} };
    expect(dueReminders([t], at(17, 1), settings, fired)).toEqual([]);
  });

  it('respects the lead time, completed tasks, undated tasks and the on/off switch', () => {
    expect(dueReminders([task({})], at(16, 30), { ...settings, lead: 30 }, empty())).toHaveLength(1);
    expect(dueReminders([task({ completed: true })], at(17), settings, empty())).toEqual([]);
    expect(dueReminders([task({ dueDate: null })], at(17), settings, empty())).toEqual([]);
    expect(dueReminders([task({})], at(17), { ...settings, enabled: false }, empty())).toEqual([]);
  });

  it('reminds date-only tasks at 9:00 AM', () => {
    expect(dueMoment({ dueDate: '2026-10-13', dueTime: null })).toEqual(at(9));
    expect(dueReminders([task({ dueTime: null })], at(9, 5), settings, empty())).toHaveLength(1);
  });

  it('fires a snoozed reminder again when the snooze ends', () => {
    const t = task({});
    const key = reminderKey(t, 0);
    const state = { fired: { [key]: at(17).getTime() }, snoozed: { [key]: at(17, 10).getTime() } };
    expect(dueReminders([t], at(17, 9), settings, state)).toEqual([]);
    expect(dueReminders([t], at(17, 10), settings, state)).toHaveLength(1);
  });

  it('reminds again after the due date or time changes', () => {
    const t = task({});
    const state = { fired: { [reminderKey(t, 0)]: 1 }, snoozed: {} };
    const moved = task({ dueTime: '18:00' });
    expect(dueReminders([moved], at(18), settings, state)).toHaveLength(1);
  });

  it('writes a sentence to show and read aloud', () => {
    expect(reminderText(task({}), at(17))).toBe('Pay rent is due now.');
    expect(reminderText(task({}), at(16, 50))).toBe('Pay rent is due in 10 minutes, at 5:00 PM.');
    expect(reminderText(task({}), at(16))).toBe('Pay rent is due in 1 hour, at 5:00 PM.');
    expect(reminderText(task({}), at(17, 10))).toBe('Pay rent was due at 5:00 PM.');
    expect(reminderText(task({ dueTime: null }), at(9))).toBe('Pay rent is due today.');
  });

  it('saves settings and forgets old reminder history', () => {
    saveReminderSettings({ ...settings, sound: 'bell', speak: true });
    expect(loadReminderSettings()).toMatchObject({ sound: 'bell', speak: true, enabled: true });
    const now = Date.now();
    localStorage.setItem('dt.reminders.state', JSON.stringify({ fired: { old: now - 4 * 86_400_000, recent: now }, snoozed: {} }));
    expect(Object.keys(loadReminderState(now).fired)).toEqual(['recent']);
  });
});
