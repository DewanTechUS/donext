import { describe, expect, it } from 'vitest';
import { agendaText, confirmationText, findTask, parseVoiceCommand } from './voiceCommand';
import type { Task } from './types';

const now = new Date(2026, 9, 13, 10, 0); // Tue Oct 13, 10:00

let n = 0;
const task = (title: string, over: Partial<Task> = {}): Task => ({
  id: `t${++n}`,
  title,
  description: '',
  dueDate: null,
  dueTime: null,
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

describe('parseVoiceCommand', () => {
  it('recognises completing a task', () => {
    expect(parseVoiceCommand('Hey DoNext, mark the job as done')).toEqual({ kind: 'complete', query: 'job' });
    expect(parseVoiceCommand('I finished the quarterly report.')).toEqual({ kind: 'complete', query: 'quarterly report' });
    expect(parseVoiceCommand('check off groceries')).toEqual({ kind: 'complete', query: 'groceries' });
  });

  it('recognises questions about the list', () => {
    expect(parseVoiceCommand('What do I have today?')).toEqual({ kind: 'agenda', range: 'today' });
    expect(parseVoiceCommand("hey donext what's due tomorrow")).toEqual({ kind: 'agenda', range: 'tomorrow' });
    expect(parseVoiceCommand('anything overdue?')).toEqual({ kind: 'agenda', range: 'overdue' });
    expect(parseVoiceCommand('read my tasks')).toEqual({ kind: 'agenda', range: 'all' });
  });

  it('treats everything else as a new task, saving it on "add it"', () => {
    expect(parseVoiceCommand('Hey DoNext, I have a job tomorrow, priority high, add it')).toEqual({
      kind: 'add',
      text: 'I have a job tomorrow, priority high',
      submit: true,
    });
    expect(parseVoiceCommand('complete the tax form by friday')).toMatchObject({ kind: 'add', submit: false });
  });
});

describe('findTask', () => {
  const tasks = [task('Job'), task('Submit the quarterly report'), task('Buy groceries'), task('Old job', { completed: true })];
  it('finds the best open match', () => {
    expect(findTask(tasks, 'job')?.title).toBe('Job');
    expect(findTask(tasks, 'quarterly report')?.title).toBe('Submit the quarterly report');
    expect(findTask(tasks, 'grocery')?.title).toBe('Buy groceries');
    expect(findTask(tasks, 'walk the dog')).toBeNull();
  });
});

describe('spoken replies', () => {
  const tasks = [
    task('Job', { dueDate: '2026-10-13', dueTime: '17:00' }),
    task('Pay rent', { dueDate: '2026-10-13' }),
    task('Dentist', { dueDate: '2026-10-14', dueTime: '15:00' }),
    task('Library books', { dueDate: '2026-10-12' }),
  ];
  it('summarises today, tomorrow and overdue tasks', () => {
    expect(agendaText(tasks, 'today', now)).toBe(
      'You have 2 tasks today: Job at 5:00 PM and Pay rent. 1 task is overdue: Library books.',
    );
    expect(agendaText(tasks, 'tomorrow', now)).toBe('You have 1 task tomorrow: Dentist at 3:00 PM.');
    expect(agendaText([], 'today', now)).toBe('Nothing is due today.');
  });

  it('confirms what was saved', () => {
    expect(
      confirmationText({ title: 'Job', dueDate: '2026-10-14', dueTime: '09:00', priority: 'high', reminderMinutes: 60, subtasks: [] }, now),
    ).toBe('Added Job, Tomorrow at 9:00 AM, high priority, reminder 1 hour before.');
  });
});

describe('spokenConfirmation', () => {
  it('reads like natural sentences', async () => {
    const { spokenConfirmation } = await import('./voiceCommand');
    const { forSpeech } = await import('./sound');
    const said = spokenConfirmation({ title: 'Job', dueDate: '2026-10-14', dueTime: '09:00', priority: 'high', reminderMinutes: 60, subtasks: [] }, now);
    expect(said).toBe('Job, tomorrow at 9:00 AM. High priority. I’ll remind you 1 hour before.');
    expect(forSpeech(said)).toBe('Job, tomorrow at 9 AM. High priority. I’ll remind you 1 hour before.');
    expect(spokenConfirmation({ title: 'Call the bank', dueDate: null, dueTime: null, priority: 'medium', reminderMinutes: null, subtasks: [] }, now)).toBe('Call the bank.');
  });
});
