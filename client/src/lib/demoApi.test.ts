import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from './apiError';
import { createDemoApi, DEMO_STORAGE_KEY } from './demoApi';
import { uuid } from './id';
import type { SyncChange, TaskFields } from './types';

const fields = (title: string, extra: Partial<TaskFields> = {}): TaskFields => ({
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
  ...extra,
});
const upsert = (title: string, extra: Partial<TaskFields> = {}): SyncChange => {
  const ts = new Date().toISOString();
  return { op: 'upsert', id: uuid(), updatedAt: ts, createdAt: ts, data: fields(title, extra) };
};

describe('demo API (no server)', () => {
  const api = createDemoApi();
  beforeEach(() => localStorage.removeItem(DEMO_STORAGE_KEY));

  it('signs up, logs in, and rejects wrong passwords and duplicates', async () => {
    const s = await api.signup({ name: 'Rocky', email: 'R@Example.com', password: 'secret123' });
    expect(s.user).toMatchObject({ name: 'Rocky', email: 'r@example.com' });
    expect((await api.me(s.token)).user.name).toBe('Rocky');
    await expect(api.login({ email: 'r@example.com', password: 'wrong999' })).rejects.toMatchObject({ status: 401 });
    await expect(api.signup({ name: 'X', email: 'r@example.com', password: 'secret123' })).rejects.toMatchObject({ status: 409 });
    await expect(api.signup({ name: 'X', email: 'x@example.com', password: 'short' })).rejects.toBeInstanceOf(ApiError);
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).not.toContain('secret123'); // passwords are hashed
  });

  it('keeps personal tasks private and shares list tasks after an invitation is accepted', async () => {
    const rocky = await api.signup({ name: 'Rocky', email: 'rocky@x.com', password: 'secret123' });
    const sara = await api.signup({ name: 'Sara', email: 'sara@x.com', password: 'secret123' });
    const { list } = await api.lists.create(rocky.token, 'Family');
    await api.lists.invite(rocky.token, list.id, 'sara@x.com');
    expect((await api.lists.all(sara.token)).invites).toEqual([expect.objectContaining({ listName: 'Family', invitedBy: 'Rocky' })]);
    await api.lists.accept(sara.token, list.id);

    await api.sync(rocky.token, { since: null, changes: [upsert('Private'), upsert('Shared', { listId: list.id, assigneeId: sara.user.id })] });
    const saraView = await api.sync(sara.token, { since: null, changes: [] });
    expect(saraView.tasks.map((t) => t.title)).toEqual(['Shared']);
    expect(saraView.tasks[0].assigneeId).toBe(sara.user.id);

    // Sara can edit but not delete Rocky's shared task.
    const shared = saraView.tasks[0];
    const del = await api.sync(sara.token, { since: null, changes: [{ op: 'delete', id: shared.id, updatedAt: new Date().toISOString() }] });
    expect(del.results[0].status).toBe('rejected');
  });

  it('forgot password returns a reset link instead of sending an email', async () => {
    await api.signup({ name: 'Rocky', email: 'rocky@x.com', password: 'secret123' });
    const res = await api.forgotPassword('rocky@x.com');
    expect(res.resetPath).toMatch(/^\/reset-password\?token=[a-f0-9]{64}$/);
    const token = res.resetPath!.split('=')[1];
    const s = await api.resetPassword(token, 'newpass123');
    expect(s.user.email).toBe('rocky@x.com');
    await expect(api.login({ email: 'rocky@x.com', password: 'newpass123' })).resolves.toBeTruthy();
    await expect(api.resetPassword(token, 'again1234')).rejects.toMatchObject({ status: 400 }); // single use
  });

  it('“Try it instantly” creates a guest with sample tasks and a shared list', async () => {
    const s = await api.demoStart!();
    const view = await api.sync(s.token, { since: null, changes: [] });
    expect(view.lists).toEqual([expect.objectContaining({ name: 'Weekend trip', role: 'owner' })]);
    expect(view.lists![0].members.map((m) => m.name)).toEqual(['Guest', 'Alex (demo)']);
    expect(view.tasks.length).toBeGreaterThanOrEqual(5);
    expect(view.tasks.some((t) => t.listId && t.assigneeId === s.user.id)).toBe(true);
  });

  it('deleting an account removes its private data and owned lists', async () => {
    const s = await api.signup({ name: 'Rocky', email: 'rocky@x.com', password: 'secret123' });
    await api.lists.create(s.token, 'Mine');
    await api.sync(s.token, { since: null, changes: [upsert('Gone')] });
    await api.deleteAccount(s.token, 'secret123');
    const db = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!);
    expect(db).toMatchObject({ users: [], tasks: [], lists: [] });
    await expect(api.me(s.token)).rejects.toMatchObject({ status: 401 });
  });
});
