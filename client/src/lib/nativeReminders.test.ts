import { describe, expect, it } from 'vitest';
import { notificationId, plannedReminders } from './nativeReminders';
import { DEFAULT_REMINDER_SETTINGS, reminderMoment } from './reminders';
import type { Task } from './types';

const now = new Date(2026, 9, 13, 10, 0);
let n = 0;
const task = (over: Partial<Task>): Task => ({
  id: `task-${++n}`,
  title: 'Task',
  description: '',
  dueDate: '2026-10-14',
  dueTime: '09:00',
  reminderMinutes: null,
  priority: 'medium',
  category: '',
  completed: false,
  subtasks: [],
  listId: null,
  assigneeId: null,
  createdBy: 'me',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  deletedAt: null,
  ...over,
});

describe('phone reminders', () => {
  it('uses the task’s own reminder, else the default lead time', () => {
    const settings = { ...DEFAULT_REMINDER_SETTINGS, lead: 30 };
    expect(reminderMoment(task({ reminderMinutes: 60 }), settings)).toEqual(new Date(2026, 9, 14, 8, 0));
    expect(reminderMoment(task({}), settings)).toEqual(new Date(2026, 9, 14, 8, 30));
    expect(reminderMoment(task({ reminderMinutes: -1 }), settings)).toBeNull();
    expect(reminderMoment(task({ dueDate: null }), settings)).toBeNull();
  });

  it('plans only future reminders for open tasks, soonest first', () => {
    const later = task({ title: 'Later', dueDate: '2026-10-20' });
    const soon = task({ title: 'Soon', dueTime: '08:00' });
    const plan = plannedReminders(
      [later, soon, task({ title: 'Done', completed: true }), task({ title: 'Past', dueDate: '2026-10-12' }), task({ title: 'Off', reminderMinutes: -1 })],
      DEFAULT_REMINDER_SETTINGS,
      now,
    );
    expect(plan.map((p) => p.task.title)).toEqual(['Soon', 'Later']);
    expect(plannedReminders([soon], { ...DEFAULT_REMINDER_SETTINGS, enabled: false }, now)).toEqual([]);
  });

  it('gives each task a stable positive notification id', () => {
    const id = notificationId('3f2b6c1e-9a7d-4c1e-8b2a-1c2d3e4f5a6b');
    expect(id).toBe(notificationId('3f2b6c1e-9a7d-4c1e-8b2a-1c2d3e4f5a6b'));
    expect(id).toBeGreaterThan(0);
    expect(id).toBeLessThanOrEqual(2_000_000_000);
  });
});
