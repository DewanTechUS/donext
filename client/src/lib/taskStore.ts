import { ApiError } from './api';
import { uuid } from './id';
import type { LocalStore } from './db';
import type { ListInvite, OutboxEntry, SharedList, SyncRequest, SyncResponse, Task, TaskFields } from './types';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  pending: number;
  lastSyncedAt: string | null;
  error: string | null;
}

export interface TaskStoreDeps {
  store: LocalStore;
  /** The signed-in user (recorded as the creator of new tasks). */
  userId?: string;
  sync: (req: SyncRequest) => Promise<SyncResponse>;
  isOnline?: () => boolean;
  onUnauthorized?: () => void;
  now?: () => Date;
  /** Delay before pushing after a local edit, so rapid edits are batched. */
  debounceMs?: number;
}

const MAX_BATCH = 500;
let revCounter = 0;
const nextRev = () => Date.now() * 1000 + (revCounter++ % 1000);

const pickFields = (t: TaskFields): TaskFields => ({
  title: t.title.trim(),
  description: t.description,
  dueDate: t.dueDate || null,
  dueTime: (t.dueDate && t.dueTime) || null,
  reminderMinutes: t.dueDate && typeof t.reminderMinutes === 'number' ? t.reminderMinutes : null,
  priority: t.priority,
  category: t.category.trim(),
  completed: t.completed,
  subtasks: (t.subtasks ?? [])
    .map((s) => ({ id: s.id, title: s.title.trim(), done: Boolean(s.done) }))
    .filter((s) => s.title)
    .slice(0, 50),
  listId: t.listId ?? null,
  // Only shared-list tasks can be assigned.
  assigneeId: t.listId ? (t.assigneeId ?? null) : null,
});

/** Fills in fields added after a task was stored (older tasks have no time or sub-items). */
export const withDefaults = (t: Task): Task => ({
  ...t,
  dueTime: t.dueTime ?? null,
  reminderMinutes: t.reminderMinutes ?? null,
  subtasks: t.subtasks ?? [],
});

const parseJSON =<T,>(raw: string | null, fallback: T): T => {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Offline-first task repository. Every edit is written to IndexedDB first and
 * queued in an outbox; the outbox is pushed to the server whenever we're online.
 * The UI subscribes to changes and never waits on the network.
 */
export class TaskStore {
  tasks: Task[] = [];
  /** Shared lists I belong to (as of the last sync; kept offline). */
  lists: SharedList[] = [];
  /** Invitations waiting for me. */
  invites: ListInvite[] = [];
  state: SyncState = { status: 'idle', pending: 0, lastSyncedAt: null, error: null };

  private listeners = new Set<() => void>();
  private inflight: Promise<void> | null = null;
  private rerun = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private deps: TaskStoreDeps) {}

  private get now() {
    return (this.deps.now ?? (() => new Date()))();
  }

  private isOnline() {
    return this.deps.isOnline ? this.deps.isOnline() : typeof navigator === 'undefined' || navigator.onLine;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit() {
    // New references so React notices the change.
    this.tasks = [...this.tasks];
    this.lists = [...this.lists];
    this.invites = [...this.invites];
    this.state = { ...this.state };
    this.listeners.forEach((fn) => fn());
  }

  private setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  async init() {
    const [tasks, pending, lastSyncedAt, lists, invites] = await Promise.all([
      this.deps.store.getTasks(),
      this.deps.store.countOutbox(),
      this.deps.store.getMeta('lastSyncedAt'),
      this.deps.store.getMeta('lists'),
      this.deps.store.getMeta('invites'),
    ]);
    this.tasks = tasks.map(withDefaults);
    this.lists = parseJSON<SharedList[]>(lists, []);
    this.invites = parseJSON<ListInvite[]>(invites, []);
    this.state = { ...this.state, pending, lastSyncedAt, status: this.isOnline() ? 'idle' : 'offline' };
    this.emit();
  }

  async create(fields: TaskFields): Promise<Task> {
    const ts = this.now.toISOString();
    const data = pickFields(fields);
    const task: Task = { id: uuid(), ...data, createdBy: this.deps.userId ?? '', createdAt: ts, updatedAt: ts, deletedAt: null };
    await this.deps.store.putTaskAndQueue(task, { op: 'upsert', id: task.id, updatedAt: ts, createdAt: ts, data, rev: nextRev() });
    this.tasks.push(task);
    await this.afterLocalChange();
    return task;
  }

  async update(id: string, patch: Partial<TaskFields>): Promise<Task> {
    const found = this.tasks.find((t) => t.id === id) ?? (await this.deps.store.getTask(id));
    const existing = found && withDefaults(found);
    if (!existing) throw new Error('This task no longer exists. It may have been deleted on another device.');
    const ts = this.now.toISOString();
    const data = pickFields({ ...existing, ...patch });
    const task: Task = { ...existing, ...data, updatedAt: ts };
    await this.deps.store.putTaskAndQueue(task, {
      op: 'upsert',
      id,
      updatedAt: ts,
      createdAt: existing.createdAt,
      data,
      rev: nextRev(),
    });
    this.tasks = this.tasks.map((t) => (t.id === id ? task : t));
    await this.afterLocalChange();
    return task;
  }

  toggle(id: string) {
    const t = this.tasks.find((x) => x.id === id);
    return this.update(id, { completed: !t?.completed });
  }

  toggleSubtask(id: string, subtaskId: string) {
    const t = this.tasks.find((x) => x.id === id);
    const subtasks = (t?.subtasks ?? []).map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s));
    return this.update(id, { subtasks });
  }

  async remove(id: string) {
    const ts = this.now.toISOString();
    await this.deps.store.deleteTaskAndQueue(id, { op: 'delete', id, updatedAt: ts, rev: nextRev() });
    this.tasks = this.tasks.filter((t) => t.id !== id);
    await this.afterLocalChange();
  }

  private async afterLocalChange() {
    this.state.pending = await this.deps.store.countOutbox();
    this.emit();
    this.scheduleSync();
  }

  scheduleSync() {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.syncNow(), this.deps.debounceMs ?? 400);
  }

  /** Pushes queued edits and pulls remote changes. Concurrent calls coalesce into one extra run. */
  syncNow(): Promise<void> {
    if (this.inflight) {
      this.rerun = true;
      return this.inflight;
    }
    this.inflight = (async () => {
      do {
        this.rerun = false;
        await this.runOnce();
      } while (this.rerun && this.state.status === 'idle' && !this.stopped);
    })().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async runOnce() {
    if (!this.isOnline()) {
      this.setState({ status: 'offline' });
      return;
    }
    this.setState({ status: 'syncing' });

    const { store } = this.deps;
    const outbox = await store.getOutbox();
    const sent: OutboxEntry[] = outbox.slice(0, MAX_BATCH);
    if (outbox.length > MAX_BATCH) this.rerun = true;
    const since = await store.getMeta('cursor');

    try {
      const res = await this.deps.sync({ since, changes: sent.map(({ rev: _rev, ...change }) => change) });
      if (this.stopped) return;
      await store.applySync(sent, res.tasks, res.cursor, {
        listIds: res.lists?.map((l) => l.id),
        removedTaskIds: res.removedTaskIds,
      });
      const syncedAt = this.now.toISOString();
      await store.setMeta('lastSyncedAt', syncedAt);
      if (res.lists) {
        this.lists = res.lists;
        await store.setMeta('lists', JSON.stringify(res.lists));
      }
      if (res.invites) {
        this.invites = res.invites;
        await store.setMeta('invites', JSON.stringify(res.invites));
      }

      const rejected = res.results.filter((r) => r.status === 'rejected');
      this.tasks = (await store.getTasks()).map(withDefaults);
      this.setState({
        status: 'idle',
        pending: await store.countOutbox(),
        lastSyncedAt: syncedAt,
        error: rejected.length
          ? `${rejected.length} change${rejected.length > 1 ? 's were' : ' was'} rejected by the server${rejected[0].reason ? `: ${rejected[0].reason}` : '.'}`
          : null,
      });
    } catch (err) {
      if (this.stopped) return;
      if (err instanceof ApiError && err.status === 401) {
        this.setState({ status: 'error', error: 'Your session has expired. Log in again to sync your changes.' });
        this.deps.onUnauthorized?.();
      } else if (err instanceof ApiError && err.isNetwork) {
        this.setState({ status: 'offline', error: null });
      } else {
        this.setState({ status: 'error', error: err instanceof Error ? err.message : 'Sync failed.' });
      }
    }
  }

  /** Stops any pending or future background syncs. */
  dispose() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  /** Starts background sync: on reconnect, when the app regains focus, and periodically. */
  start(intervalMs = 60_000) {
    this.stopped = false;
    const onOnline = () => void this.syncNow();
    const onOffline = () => this.setState({ status: 'offline' });
    const onVisible = () => document.visibilityState === 'visible' && void this.syncNow();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(() => void this.syncNow(), intervalMs);
    void this.syncNow();
    return () => {
      this.dispose();
      clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }
}
