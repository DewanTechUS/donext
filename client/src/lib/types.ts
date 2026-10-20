export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** One item of a task's checklist. */
export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskFields {
  title: string;
  description: string;
  /** Calendar date, YYYY-MM-DD */
  dueDate: string | null;
  /** Local time HH:MM (only with a due date). */
  dueTime: string | null;
  /** Minutes before the due time to remind; null = my default setting, -1 = no reminder. */
  reminderMinutes: number | null;
  priority: Priority;
  category: string;
  completed: boolean;
  /** Checklist of sub-items. */
  subtasks: Subtask[];
  /** Shared list the task belongs to; null = my private personal task. */
  listId: string | null;
  /** List member the task is assigned to (shared-list tasks only). */
  assigneeId: string | null;
}

export interface Task extends TaskFields {
  id: string;
  /** User who created the task. */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ListMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'member';
}

export interface SharedList {
  id: string;
  name: string;
  ownerId: string;
  /** My role in this list. */
  role: 'owner' | 'member';
  members: ListMember[];
  /** Pending invitations (only visible to the owner). */
  invites: { email: string; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
}

/** An invitation waiting for me to accept or decline. */
export interface ListInvite {
  listId: string;
  listName: string;
  invitedBy: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Session {
  token: string;
  user: User;
}

export type SyncChange =
  | { op: 'upsert'; id: string; updatedAt: string; createdAt: string; data: TaskFields }
  | { op: 'delete'; id: string; updatedAt: string };

/** A queued change waiting to be pushed. `rev` guards against removing a newer edit made mid-sync. */
export type OutboxEntry = SyncChange & { rev: number };

export interface SyncRequest {
  since: string | null;
  changes: SyncChange[];
}

export interface SyncResponse {
  tasks: Task[];
  results: Array<{ id: string | null; status: 'applied' | 'stale' | 'rejected'; reason?: string }>;
  cursor: string;
  /** Shared lists I belong to (tasks of any other list are removed locally). */
  lists?: SharedList[];
  invites?: ListInvite[];
  /** Tasks moved somewhere I can no longer see. */
  removedTaskIds?: string[];
}
