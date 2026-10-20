import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { sentMail, signup, useTestApp } from './helpers.js';
import { List } from '../src/models/List.js';
import { Task } from '../src/models/Task.js';

const { app } = useTestApp();

type Person = Awaited<ReturnType<typeof person>>;
async function person(name: string) {
  const s = await signup(app(), { name });
  return { ...s, auth: { Authorization: `Bearer ${s.token}` } };
}

const api = (p: Person) => ({
  get: (url: string) => request(app()).get(url).set(p.auth),
  post: (url: string, body?: object) => request(app()).post(url).set(p.auth).send(body ?? {}),
  patch: (url: string, body: object) => request(app()).patch(url).set(p.auth).send(body),
  del: (url: string, body?: object) => request(app()).delete(url).set(p.auth).send(body ?? {}),
});

/** Owner creates a list and the others join it through invitations. */
async function team(...names: string[]) {
  const [owner, ...others] = await Promise.all(names.map(person));
  const created = await api(owner).post('/api/lists', { name: 'Family' });
  const listId = created.body.list.id as string;
  for (const o of others) {
    await api(owner).post(`/api/lists/${listId}/invites`, { email: o.email });
    const accepted = await api(o).post(`/api/lists/${listId}/accept`);
    expect(accepted.status).toBe(200);
  }
  return { owner, others, listId };
}

const fields = (title: string, extra: object = {}) => ({
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

describe('shared lists', () => {
  it('invites by email: the invitee sees a pending invite and an email, then joins', async () => {
    const owner = await person('Rocky');
    const sara = await person('Sara');
    const { body } = await api(owner).post('/api/lists', { name: 'Family' });
    const listId = body.list.id;
    expect(body.list).toMatchObject({ name: 'Family', role: 'owner', members: [expect.objectContaining({ name: 'Rocky', role: 'owner' })] });

    const invite = await api(owner).post(`/api/lists/${listId}/invites`, { email: sara.email.toUpperCase() });
    expect(invite.status).toBe(201);
    expect(invite.body.list.invites).toEqual([expect.objectContaining({ email: sara.email })]);
    expect(invite.body.emailSent).toBe(true);
    await new Promise((r) => setTimeout(r, 20));
    expect(sentMail.at(-1)).toMatchObject({ to: sara.email, subject: expect.stringContaining('Rocky invited you to “Family”') });

    const pending = await api(sara).get('/api/lists');
    expect(pending.body.invites).toEqual([expect.objectContaining({ listId, listName: 'Family', invitedBy: 'Rocky' })]);
    expect(pending.body.lists).toEqual([]);

    const accepted = await api(sara).post(`/api/lists/${listId}/accept`);
    expect(accepted.body.list).toMatchObject({ role: 'member', invites: [] });
    expect(accepted.body.list.members.map((m: { name: string }) => m.name)).toEqual(['Rocky', 'Sara']);
    await new Promise((r) => setTimeout(r, 20));
    expect(sentMail.at(-1)).toMatchObject({ to: owner.email, subject: 'Sara joined “Family” on DoNext' });
    expect((await api(sara).post(`/api/lists/${listId}/accept`)).status).toBe(404); // already used
  });

  it('works for people who sign up after being invited', async () => {
    const owner = await person('Rocky');
    const { body } = await api(owner).post('/api/lists', { name: 'Work' });
    await api(owner).post(`/api/lists/${body.list.id}/invites`, { email: 'newcomer@example.com' });
    const newcomer = await person('Newbie').then(() => null); // unrelated signup shouldn't see it
    void newcomer;
    const s = await signup(app(), { name: 'Late', email: 'newcomer@example.com' });
    const res = await request(app()).get('/api/lists').set('Authorization', `Bearer ${s.token}`);
    expect(res.body.invites).toEqual([expect.objectContaining({ listName: 'Work' })]);
  });

  it('validates invitations', async () => {
    const { owner, others, listId } = await team('Rocky', 'Sara');
    const outsider = await person('Eve');
    expect((await api(owner).post(`/api/lists/${listId}/invites`, { email: others[0].email })).status).toBe(409);
    await api(owner).post(`/api/lists/${listId}/invites`, { email: 'x@example.com' });
    expect((await api(owner).post(`/api/lists/${listId}/invites`, { email: 'x@example.com' })).status).toBe(409);
    expect((await api(owner).post(`/api/lists/${listId}/invites`, { email: 'not-an-email' })).status).toBe(400);
    expect((await api(others[0]).post(`/api/lists/${listId}/invites`, { email: 'y@example.com' })).status).toBe(403);
    expect((await api(outsider).post(`/api/lists/${listId}/invites`, { email: 'z@example.com' })).status).toBe(404);
    expect((await api(outsider).post(`/api/lists/${listId}/accept`)).status).toBe(404); // not invited
  });

  it('shares list tasks with members only, and keeps personal tasks private', async () => {
    const { owner, others, listId } = await team('Rocky', 'Sara');
    const [sara] = others;
    const outsider = await person('Eve');

    await api(owner).post('/api/tasks', fields('Rocky private'));
    const shared = await api(owner).post('/api/tasks', fields('Groceries', { listId }));
    expect(shared.status).toBe(201);
    expect(shared.body.task).toMatchObject({ listId, createdBy: owner.user.id });

    const saraTasks = (await api(sara).get('/api/tasks')).body.tasks.map((t: { title: string }) => t.title);
    expect(saraTasks).toEqual(['Groceries']);
    expect((await api(outsider).get('/api/tasks')).body.tasks).toEqual([]);
    expect((await api(outsider).get(`/api/tasks/${shared.body.task.id}`)).status).toBe(404);
    expect((await api(outsider).post('/api/tasks', fields('Sneaky', { listId }))).status).toBe(403);
  });

  it('lets members edit shared tasks; only the creator or list owner can delete', async () => {
    const { owner, others, listId } = await team('Rocky', 'Sara', 'Ali');
    const [sara, ali] = others;
    const t = (await api(sara).post('/api/tasks', fields('Sara task', { listId }))).body.task;

    expect((await api(ali).patch(`/api/tasks/${t.id}`, { completed: true })).body.task.completed).toBe(true);
    expect((await api(ali).del(`/api/tasks/${t.id}`)).status).toBe(403);
    expect((await api(owner).del(`/api/tasks/${t.id}`)).status).toBe(204);

    const t2 = (await api(owner).post('/api/tasks', fields('Owner task', { listId }))).body.task;
    expect((await api(sara).del(`/api/tasks/${t2.id}`)).status).toBe(403);
    expect((await api(owner).del(`/api/tasks/${t2.id}`)).status).toBe(204);
  });

  it('only assigns tasks to list members', async () => {
    const { owner, others, listId } = await team('Rocky', 'Sara');
    const outsider = await person('Eve');
    const ok = await api(owner).post('/api/tasks', fields('For Sara', { listId, assigneeId: others[0].user.id }));
    expect(ok.body.task.assigneeId).toBe(others[0].user.id);
    expect((await api(owner).post('/api/tasks', fields('Bad', { listId, assigneeId: outsider.user.id }))).status).toBe(400);
    const personal = await api(owner).post('/api/tasks', fields('Mine', { assigneeId: others[0].user.id }));
    expect(personal.body.task.assigneeId).toBeNull(); // personal tasks can't be assigned
  });

  it('only the creator can move a shared task back to their personal tasks', async () => {
    const { owner, others, listId } = await team('Rocky', 'Sara');
    const t = (await api(owner).post('/api/tasks', fields('Shared', { listId }))).body.task;
    expect((await api(others[0]).patch(`/api/tasks/${t.id}`, { listId: null })).status).toBe(403);
    expect((await api(owner).patch(`/api/tasks/${t.id}`, { listId: null })).body.task.listId).toBeNull();
    expect((await api(others[0]).get(`/api/tasks/${t.id}`)).status).toBe(404);
  });
});

describe('shared lists and sync', () => {
  const sync = (p: Person, since: string | null, changes: object[] = []) => api(p).post('/api/tasks/sync', { since, changes });
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

  it('returns lists and invitations, and syncs shared tasks between members', async () => {
    const { owner, others, listId } = await team('Rocky', 'Sara');
    const id = randomUUID();
    const pushed = await sync(owner, null, [{ op: 'upsert', id, updatedAt: ago(1000), data: fields('Via sync', { listId }) }]);
    expect(pushed.body.results[0].status).toBe('applied');
    expect(pushed.body.lists).toEqual([expect.objectContaining({ id: listId, role: 'owner' })]);

    const saraSync = await sync(others[0], null);
    expect(saraSync.body.tasks.map((t: { id: string }) => t.id)).toEqual([id]);
    expect(saraSync.body.lists[0]).toMatchObject({ id: listId, role: 'member' });
  });

  it('sends a newly joined member all of the list’s existing tasks, not just recent changes', async () => {
    const owner = await person('Rocky');
    const sara = await person('Sara');
    const listId = (await api(owner).post('/api/lists', { name: 'Old list' })).body.list.id;
    await api(owner).post('/api/tasks', fields('Old task', { listId }));

    const first = await sync(sara, null);
    const cursor = first.body.cursor;
    await new Promise((r) => setTimeout(r, 10));
    // Pretend the task is old: it changed well before Sara's cursor.
    await Task.updateMany({ listId }, { $set: { serverUpdatedAt: new Date(Date.now() - 3600_000) } });

    await api(owner).post(`/api/lists/${listId}/invites`, { email: sara.email });
    expect(first.body.invites).toEqual([]);
    await api(sara).post(`/api/lists/${listId}/accept`);
    const next = await sync(sara, cursor);
    expect(next.body.tasks.map((t: { title: string }) => t.title)).toEqual(['Old task']);
  });

  it('stops syncing a list after the member is removed, and rejects their edits', async () => {
    const { owner, others, listId } = await team('Rocky', 'Sara');
    const [sara] = others;
    const t = (await api(owner).post('/api/tasks', fields('Team task', { listId, assigneeId: sara.user.id }))).body.task;

    const removed = await api(owner).del(`/api/lists/${listId}/members/${sara.user.id}`);
    expect(removed.body.list.members.map((m: { name: string }) => m.name)).toEqual(['Rocky']);
    expect((await Task.findById(t.id).lean())?.assignee).toBeNull();

    const s = await sync(sara, null, [{ op: 'upsert', id: t.id, updatedAt: ago(0), data: fields('Hijack', { listId }) }]);
    expect(s.body.results[0]).toMatchObject({ status: 'rejected' });
    expect(s.body.lists).toEqual([]);
    expect(s.body.tasks).toEqual([]);
  });

  it('tells other members to drop a task that was moved out of their list', async () => {
    const { owner, others, listId } = await team('Rocky', 'Sara');
    const t = (await api(owner).post('/api/tasks', fields('Will move', { listId }))).body.task;
    const cursor = (await sync(others[0], null)).body.cursor;
    await api(owner).patch(`/api/tasks/${t.id}`, { listId: null });
    const res = await sync(others[0], cursor);
    expect(res.body.removedTaskIds).toEqual([t.id]);
    expect(res.body.tasks.find((x: { id: string }) => x.id === t.id)).toBeUndefined();
  });

  it('owner deletes the list and its tasks for everyone; members can leave; owner cannot leave', async () => {
    const { owner, others, listId } = await team('Rocky', 'Sara', 'Ali');
    const [sara, ali] = others;
    await api(owner).post('/api/tasks', fields('In list', { listId }));

    expect((await api(owner).post(`/api/lists/${listId}/leave`)).status).toBe(400);
    expect((await api(ali).post(`/api/lists/${listId}/leave`)).status).toBe(204);
    expect((await api(ali).get('/api/tasks')).body.tasks).toEqual([]);

    expect((await api(sara).del(`/api/lists/${listId}`)).status).toBe(403);
    expect((await api(owner).del(`/api/lists/${listId}`)).status).toBe(204);
    expect(await Task.countDocuments({ listId })).toBe(0);
    expect((await api(sara).get('/api/lists')).body.lists).toEqual([]);
  });

  it('account deletion: owned lists are removed; tasks in others’ lists stay with the team', async () => {
    const { owner, others, listId } = await team('Rocky', 'Sara');
    const [sara] = others;
    const sarasTask = (await api(sara).post('/api/tasks', fields('Sara added', { listId }))).body.task;
    const saraList = (await api(sara).post('/api/lists', { name: 'Sara own' })).body.list.id;

    expect((await api(sara).del('/api/auth/me', { password: sara.password })).status).toBe(204);
    expect(await List.exists({ _id: saraList })).toBeNull();
    const kept = await Task.findById(sarasTask.id).lean();
    expect(String(kept?.user)).toBe(owner.user.id);
    const list = (await api(owner).get('/api/lists')).body.lists[0];
    expect(list.members.map((m: { name: string }) => m.name)).toEqual(['Rocky']);
  });
});

describe('invitations without an email service', () => {
  it('still invites in the app, and says the email was not sent', async () => {
    const { createApp } = await import('../src/app.js');
    const { testConfig } = await import('./helpers.js');
    const quiet = createApp(testConfig, { authRateLimit: 1000, mailer: { enabled: false, send: async () => {} } });
    const owner = await signup(quiet, { name: 'Rocky' });
    const auth = { Authorization: `Bearer ${owner.token}` };
    const { body } = await request(quiet).post('/api/lists').set(auth).send({ name: 'Team' });
    const res = await request(quiet).post(`/api/lists/${body.list.id}/invites`).set(auth).send({ email: 'pat@example.com' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ emailSent: false, list: { invites: [expect.objectContaining({ email: 'pat@example.com' })] } });
  });
});
