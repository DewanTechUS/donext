import mongoose, { Schema, type InferSchemaType } from 'mongoose';

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

/**
 * Task ids are UUIDs generated on the client so tasks can be created offline
 * and synchronised later without id remapping.
 *
 * - `updatedAt`        client-side modification time, used for last-write-wins conflict resolution.
 * - `serverUpdatedAt`  set by the server on every write; used as the pull cursor for sync.
 * - `deletedAt`        soft-delete tombstone so deletions propagate to other devices.
 */
const taskSchema = new Schema(
  {
    _id: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 2000 },
    dueDate: { type: String, default: null }, // YYYY-MM-DD (timezone-free calendar date)
    dueTime: { type: String, default: null }, // HH:MM local time, only with a dueDate
    /** Minutes before the due time to remind; null = the user's default, -1 = no reminder. */
    reminderMinutes: { type: Number, default: null },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    category: { type: String, default: '', trim: true, maxlength: 50 },
    completed: { type: Boolean, default: false },
    /** Checklist of sub-items. */
    subtasks: {
      type: [{ _id: false, id: String, title: { type: String, maxlength: 200 }, done: Boolean }],
      default: [],
    },
    /** Shared list this task belongs to; null = the creator's private personal task. */
    listId: { type: String, default: null },
    /** List member the task is assigned to (shared-list tasks only). */
    assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    /** Lists this task was moved out of, so those members' devices can remove their copy. */
    movedFrom: { type: [String], default: [] },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    deletedAt: { type: Date, default: null },
    serverUpdatedAt: { type: Date, required: true },
  },
  { versionKey: false },
);

taskSchema.index({ user: 1, serverUpdatedAt: 1 });
taskSchema.index({ listId: 1, serverUpdatedAt: 1 });

export type TaskAttrs = InferSchemaType<typeof taskSchema>;

export interface TaskDTO {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  dueTime: string | null;
  reminderMinutes: number | null;
  priority: Priority;
  category: string;
  completed: boolean;
  subtasks: Subtask[];
  listId: string | null;
  assigneeId: string | null;
  /** Who created the task. */
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export function toTaskDTO(t: TaskAttrs): TaskDTO {
  return {
    id: t._id,
    title: t.title,
    description: t.description ?? '',
    dueDate: t.dueDate ?? null,
    dueTime: t.dueDate ? (t.dueTime ?? null) : null,
    reminderMinutes: typeof t.reminderMinutes === 'number' ? t.reminderMinutes : null,
    priority: t.priority as Priority,
    category: t.category ?? '',
    completed: Boolean(t.completed),
    subtasks: (t.subtasks ?? []).map((s) => ({ id: String(s.id), title: s.title ?? '', done: Boolean(s.done) })),
    listId: t.listId ?? null,
    assigneeId: t.assignee ? String(t.assignee) : null,
    createdBy: String(t.user),
    createdAt: new Date(t.createdAt).toISOString(),
    updatedAt: new Date(t.updatedAt).toISOString(),
    deletedAt: t.deletedAt ? new Date(t.deletedAt).toISOString() : null,
  };
}

export const Task = mongoose.model('Task', taskSchema);
