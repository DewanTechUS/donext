import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { OutboxEntry, Task } from './types';

interface TodoDB extends DBSchema {
  tasks: { key: string; value: Task };
  /** One entry per task id: later edits replace earlier unsent ones. */
  outbox: { key: string; value: OutboxEntry };
  meta: { key: string; value: string | null };
}

/** Each account gets its own database so tasks never leak between users on a shared device. */
// Historical name, kept so existing users keep their offline tasks. Never shown to users.
export const dbName = (userId: string) => `dewantech-todo-${userId}`;

export class LocalStore {
  private constructor(private db: IDBPDatabase<TodoDB>) {}

  static async open(userId: string): Promise<LocalStore> {
    const db = await openDB<TodoDB>(dbName(userId), 1, {
      upgrade(db) {
        db.createObjectStore('tasks', { keyPath: 'id' });
        db.createObjectStore('outbox', { keyPath: 'id' });
        db.createObjectStore('meta');
      },
    });
    return new LocalStore(db);
  }

  static async destroy(userId: string) {
    await deleteDB(dbName(userId));
  }

  close() {
    this.db.close();
  }

  getTasks() {
    return this.db.getAll('tasks');
  }

  getTask(id: string) {
    return this.db.get('tasks', id);
  }

  getOutbox() {
    return this.db.getAll('outbox');
  }

  countOutbox() {
    return this.db.count('outbox');
  }

  async getMeta(key: string) {
    return (await this.db.get('meta', key)) ?? null;
  }

  async setMeta(key: string, value: string | null) {
    await this.db.put('meta', value, key);
  }

  /** Writes a local edit and queues it for sync in one transaction. */
  async putTaskAndQueue(task: Task, entry: OutboxEntry) {
    const tx = this.db.transaction(['tasks', 'outbox'], 'readwrite');
    await Promise.all([tx.objectStore('tasks').put(task), tx.objectStore('outbox').put(entry), tx.done]);
  }

  async deleteTaskAndQueue(id: string, entry: OutboxEntry) {
    const tx = this.db.transaction(['tasks', 'outbox'], 'readwrite');
    await Promise.all([tx.objectStore('tasks').delete(id), tx.objectStore('outbox').put(entry), tx.done]);
  }

  /**
   * Applies a sync response atomically:
   *  1. drops outbox entries that were sent (only if not edited again since — matched by rev),
   *  2. applies server tasks, except those that still have a newer pending local edit.
   */
  async applySync(
    sent: OutboxEntry[],
    serverTasks: Task[],
    cursor: string,
    /** Lists I currently belong to; tasks of any other list are removed from this device. */
    extras: { listIds?: string[]; removedTaskIds?: string[] } = {},
  ) {
    const tx = this.db.transaction(['tasks', 'outbox', 'meta'], 'readwrite');
    const outbox = tx.objectStore('outbox');
    const tasks = tx.objectStore('tasks');

    for (const entry of sent) {
      const current = await outbox.get(entry.id);
      if (current && current.rev === entry.rev) await outbox.delete(entry.id);
    }
    for (const t of serverTasks) {
      if (await outbox.get(t.id)) continue;
      if (t.deletedAt) await tasks.delete(t.id);
      else await tasks.put(t);
    }
    for (const id of extras.removedTaskIds ?? []) {
      await tasks.delete(id);
      await outbox.delete(id);
    }
    if (extras.listIds) {
      const mine = new Set(extras.listIds);
      for (const t of await tasks.getAll()) {
        if (t.listId && !mine.has(t.listId)) {
          await tasks.delete(t.id);
          await outbox.delete(t.id);
        }
      }
    }
    await tx.objectStore('meta').put(cursor, 'cursor');
    await tx.done;
  }
}
