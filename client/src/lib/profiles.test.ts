import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoApi } from './demoApi';
import type { TaskFields } from './types';

const fields = (title: string): TaskFields => ({
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
});
const add = (api: ReturnType<typeof createDemoApi>, token: string, title: string) =>
  api.sync(token, {
    since: null,
    changes: [{ op: 'upsert', id: crypto.randomUUID(), updatedAt: new Date().toISOString(), createdAt: new Date().toISOString(), data: fields(title) }],
  });

describe('several people on one device (local app)', () => {
  beforeEach(() => localStorage.clear());

  it('lists everyone, switches between them and keeps their tasks apart', async () => {
    const api = createDemoApi({ storageKey: 'test.local' });
    const dewan = await api.localStart!('Dewan');
    const sara = await api.localStart!('Sara');
    await add(api, dewan.token, 'Job');
    await add(api, sara.token, 'Dentist');

    const { profiles } = await api.localProfiles!();
    expect(profiles.map((p) => [p.name, p.open])).toEqual([
      ['Dewan', 2], // welcome task + Job
      ['Sara', 2],
    ]);

    const back = await api.localSwitch!(dewan.user.id);
    expect(back.user.name).toBe('Dewan');
    const mine = await api.sync(back.token, { since: null, changes: [] });
    expect(mine.tasks.map((t) => t.title)).toContain('Job');
    expect(mine.tasks.map((t) => t.title)).not.toContain('Dentist');

    // Reminders need everyone's tasks, with the owner's name.
    const all = await api.localAllTasks!();
    expect(all.tasks.find((t) => t.title === 'Dentist')?.ownerName).toBe('Sara');
  });

  it('erasing one person keeps the others', async () => {
    const api = createDemoApi({ storageKey: 'test.local' });
    const dewan = await api.localStart!('Dewan');
    await api.localStart!('Sara');
    await api.localErase!(dewan.token);
    const { profiles } = await api.localProfiles!();
    expect(profiles.map((p) => p.name)).toEqual(['Sara']);
    await expect(api.localSwitch!(dewan.user.id)).rejects.toThrow(/no longer/);
  });
});
