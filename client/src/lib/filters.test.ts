import { describe, expect, it } from 'vitest';
import { categoriesOf, defaultFilters, filterTasks, formatDueDate, isOverdue, timeLeft } from './filters';
import type { Task } from './types';

let n = 0;
const task = (overrides: Partial<Task>): Task => {
  n += 1;
  return {
    id: `id-${n}`,
    title: `Task ${n}`,
    description: '',
    dueDate: null,
    dueTime: null,
    reminderMinutes: null,
    priority: 'medium',
    category: '',
    completed: false,
    subtasks: [],
    createdAt: new Date(2026, 0, n).toISOString(),
    updatedAt: new Date(2026, 0, n).toISOString(),
    deletedAt: null,
    listId: null,
    assigneeId: null,
    createdBy: "me",
    ...overrides,
  };
};

describe('filterTasks', () => {
  const tasks = [
    task({ title: 'Write quarterly report', category: 'Work', priority: 'high', dueDate: '2026-10-05' }),
    task({ title: 'Buy groceries', description: 'milk, eggs', category: 'Home', priority: 'low' }),
    task({ title: 'Gym', category: 'health', completed: true, dueDate: '2026-09-01' }),
    task({ title: 'Email Sam', description: 'about the report', category: 'work', dueDate: '2026-10-02' }),
    task({ title: 'Deleted', deletedAt: '2026-01-01T00:00:00.000Z' }),
  ];
  const titles = (f: Partial<typeof defaultFilters>) => filterTasks(tasks, { ...defaultFilters, ...f }).map((t) => t.title);

  it('hides deleted tasks and sorts open tasks first, then by due date (undated last)', () => {
    expect(titles({})).toEqual(['Email Sam', 'Write quarterly report', 'Buy groceries', 'Gym']);
  });

  it('searches title, description and category case-insensitively', () => {
    expect(titles({ query: 'REPORT' })).toEqual(['Email Sam', 'Write quarterly report']);
    expect(titles({ query: 'eggs' })).toEqual(['Buy groceries']);
    expect(titles({ query: '  home ' })).toEqual(['Buy groceries']);
  });

  it('filters by status, priority and category', () => {
    expect(titles({ status: 'completed' })).toEqual(['Gym']);
    expect(titles({ status: 'active', priority: 'high' })).toEqual(['Write quarterly report']);
    expect(titles({ category: 'WORK' })).toEqual(['Email Sam', 'Write quarterly report']);
  });

  it('sorts by priority and by newest', () => {
    expect(titles({ sort: 'priority' })).toEqual(['Write quarterly report', 'Email Sam', 'Buy groceries', 'Gym']);
    expect(titles({ sort: 'newest' })[0]).toBe('Email Sam');
  });
});

describe('date helpers', () => {
  it('flags overdue only for incomplete tasks with a past due date', () => {
    expect(isOverdue({ dueDate: '2026-09-30', completed: false }, '2026-10-01')).toBe(true);
    expect(isOverdue({ dueDate: '2026-10-01', completed: false }, '2026-10-01')).toBe(false);
    expect(isOverdue({ dueDate: '2026-09-30', completed: true }, '2026-10-01')).toBe(false);
    expect(isOverdue({ dueDate: null, completed: false }, '2026-10-01')).toBe(false);
  });

  it('counts a task due earlier today as overdue once its time has passed', () => {
    const t = { dueDate: '2026-10-01', dueTime: '14:00', completed: false };
    expect(isOverdue(t, '2026-10-01', '13:59')).toBe(false);
    expect(isOverdue(t, '2026-10-01', '14:00')).toBe(true);
    expect(isOverdue({ ...t, dueTime: null }, '2026-10-01', '23:59')).toBe(false);
  });

  it('sorts by time within a day (timed tasks first) and searches sub-items', () => {
    const late = task({ title: 'late', dueDate: '2026-10-05', dueTime: '18:00' });
    const early = task({ title: 'early', dueDate: '2026-10-05', dueTime: '08:00' });
    const allDay = task({ title: 'all day', dueDate: '2026-10-05' });
    expect(filterTasks([allDay, late, early], defaultFilters).map((t) => t.title)).toEqual(['early', 'late', 'all day']);

    const groceries = task({ title: 'Groceries', subtasks: [{ id: 'a', title: 'Oat milk', done: false }] });
    expect(filterTasks([groceries, late], { ...defaultFilters, query: 'oat' })).toEqual([groceries]);
  });

  it('says how much time is left', () => {
    const now = new Date(2026, 9, 13, 10, 0); // Oct 13, 10:00
    const left = (dueDate: string | null, dueTime: string | null = null, completed = false) =>
      timeLeft({ dueDate, dueTime, completed }, now);
    expect(left(null)).toBeNull();
    expect(left('2026-10-20', null, true)).toBeNull();
    expect(left('2026-10-13')).toEqual({ text: 'Due today', tone: 'soon' });
    expect(left('2026-10-14')).toEqual({ text: '1 day left', tone: 'soon' });
    expect(left('2026-10-20')).toEqual({ text: '7 days left', tone: 'later' });
    expect(left('2026-10-11')).toEqual({ text: '2 days overdue', tone: 'overdue' });
    expect(left('2026-10-13', '10:45')).toEqual({ text: '45 mins left', tone: 'soon' });
    expect(left('2026-10-13', '15:00')).toEqual({ text: '5 hours left', tone: 'soon' });
    expect(left('2026-10-14', '09:00')).toEqual({ text: '23 hours left', tone: 'soon' });
    expect(left('2026-10-16', '09:00')).toEqual({ text: '3 days left', tone: 'later' });
    expect(left('2026-10-13', '09:00')).toEqual({ text: '1 hour overdue', tone: 'overdue' });
    expect(left('2026-10-13', '09:59')).toEqual({ text: '1 min overdue', tone: 'overdue' });
    expect(left('2026-10-13', '10:00')).toEqual({ text: 'Due now', tone: 'overdue' });
    // Agrees with isOverdue at the due minute.
    expect(isOverdue({ dueDate: '2026-10-13', dueTime: '10:00', completed: false }, '2026-10-13', '10:00')).toBe(true);
  });

  it('formats today and tomorrow in words', () => {
    expect(formatDueDate('2026-10-01', '2026-10-01')).toBe('Today');
    expect(formatDueDate('2026-10-02', '2026-10-01')).toBe('Tomorrow');
    expect(formatDueDate('2026-11-01', '2026-10-31')).toBe('Tomorrow'); // month rollover
  });

  it('lists unique categories case-insensitively', () => {
    expect(categoriesOf([task({ category: 'Work' }), task({ category: 'work' }), task({ category: 'Home' })])).toEqual([
      'Home',
      'Work',
    ]);
  });
});
