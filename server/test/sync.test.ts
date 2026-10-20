import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { signup, useTestApp } from './helpers.js';

const { app } = useTestApp();

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
  ...extra,
});
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

async function authed() {
  const { token } = await signup(app());
  return { Authorization: `Bearer ${token}` };
}

function sync(auth: Record<string, string>, body: object) {
  return request(app()).post('/api/tasks/sync').set(auth).send(body);
}

describe('offline sync', () => {
  it('pushes offline-created tasks and returns them with a cursor', async () => {
    const auth = await authed();
    const id = randomUUID();
    const res = await sync(auth, {
      since: null,
      changes: [{ op: 'upsert', id, updatedAt: ago(60_000), createdAt: ago(60_000), data: fields('Offline task') }],
    });
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([{ id, status: 'applied' }]);
    expect(res.body.tasks).toEqual([expect.objectContaining({ id, title: 'Offline task' })]);
    expect(Date.parse(res.body.cursor)).not.toBeNaN();
  });

  it('is idempotent when the same change is retried', async () => {
    const auth = await authed();
    const change = { op: 'upsert', id: randomUUID(), updatedAt: ago(1000), data: fields('Retry me') };
    await sync(auth, { changes: [change] });
    const again = await sync(auth, { changes: [change] });
    expect(again.status).toBe(200);
    expect((await request(app()).get('/api/tasks').set(auth)).body.tasks).toHaveLength(1);
  });

  it('resolves conflicts with last-write-wins and returns the winning version', async () => {
    const auth = await authed();
    const id = randomUUID();
    await sync(auth, { changes: [{ op: 'upsert', id, updatedAt: ago(10_000), data: fields('Newer (device A)') }] });

    // Device B edited earlier while offline and syncs later: it loses.
    const res = await sync(auth, {
      since: new Date().toISOString(),
      changes: [{ op: 'upsert', id, updatedAt: ago(60_000), data: fields('Older (device B)') }],
    });
    expect(res.body.results[0].status).toBe('stale');
    expect(res.body.tasks.find((t: { id: string }) => t.id === id).title).toBe('Newer (device A)');

    // A genuinely newer edit wins.
    const newer = await sync(auth, { changes: [{ op: 'upsert', id, updatedAt: ago(0), data: fields('Newest') }] });
    expect(newer.body.results[0].status).toBe('applied');
  });

  it('clamps future client timestamps so a skewed clock cannot win forever', async () => {
    const auth = await authed();
    const id = randomUUID();
    const future = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    await sync(auth, { changes: [{ op: 'upsert', id, updatedAt: future, data: fields('From the future') }] });
    const res = await sync(auth, { changes: [{ op: 'upsert', id, updatedAt: new Date(Date.now() + 1000).toISOString(), data: fields('Later edit') }] });
    expect(res.body.results[0].status).toBe('applied');
  });

  it('propagates deletions as tombstones to other devices, and deletions are sticky', async () => {
    const auth = await authed();
    const id = randomUUID();
    const first = await sync(auth, { changes: [{ op: 'upsert', id, updatedAt: ago(5000), data: fields('Delete me') }] });
    const cursor = first.body.cursor;

    await sync(auth, { changes: [{ op: 'delete', id, updatedAt: ago(1000) }] });

    const otherDevice = await sync(auth, { since: cursor, changes: [] });
    const tomb = otherDevice.body.tasks.find((t: { id: string }) => t.id === id);
    expect(tomb.deletedAt).toEqual(expect.any(String));

    const resurrect = await sync(auth, { changes: [{ op: 'upsert', id, updatedAt: ago(0), data: fields('Back?') }] });
    expect(resurrect.body.results[0].status).toBe('stale');
    expect((await request(app()).get('/api/tasks').set(auth)).body.tasks).toHaveLength(0);
  });

  it('rejects invalid changes individually without blocking valid ones', async () => {
    const auth = await authed();
    const good = randomUUID();
    const res = await sync(auth, {
      changes: [
        { op: 'upsert', id: 'not-a-uuid', updatedAt: ago(0), data: fields('Bad id') },
        { op: 'upsert', id: randomUUID(), updatedAt: ago(0), data: fields('') },
        { op: 'explode', id: randomUUID() },
        { op: 'upsert', id: good, updatedAt: ago(0), data: fields('Good') },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.results.map((r: { status: string }) => r.status)).toEqual(['rejected', 'rejected', 'rejected', 'applied']);
    expect(res.body.tasks.map((t: { id: string }) => t.id)).toEqual([good]);
  });

  it("never lets one user overwrite or read another user's task via sync", async () => {
    const alice = await authed();
    const bob = await authed();
    const id = randomUUID();
    await sync(alice, { changes: [{ op: 'upsert', id, updatedAt: ago(5000), data: fields('Alice only') }] });

    const res = await sync(bob, {
      since: null,
      changes: [
        { op: 'upsert', id, updatedAt: ago(0), data: fields('Bob wins?') },
        { op: 'delete', id, updatedAt: ago(0) },
      ],
    });
    expect(res.body.results.map((r: { status: string }) => r.status)).toEqual(['rejected', 'rejected']);
    expect(res.body.tasks).toEqual([]);
    const aliceTasks = (await request(app()).get('/api/tasks').set(alice)).body.tasks;
    expect(aliceTasks[0].title).toBe('Alice only');
  });

  it('limits batch size', async () => {
    const auth = await authed();
    const changes = Array.from({ length: 501 }, () => ({ op: 'delete', id: randomUUID(), updatedAt: ago(0) }));
    expect((await sync(auth, { changes })).status).toBe(400);
  });
});
