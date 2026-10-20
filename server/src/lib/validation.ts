import { z } from 'zod';
import { PRIORITIES } from '../models/Task.js';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(128),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'This reset link is invalid. Request a new one.'),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(128),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required to delete your account').max(128),
});

const uuid = z.string().uuid('Task id must be a UUID');
const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid person');
const isoDateTime = z.string().datetime({ offset: true });
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'Invalid due date');

const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM');

const subtaskSchema = z
  .object({
    id: z.string().min(1).max(64),
    title: z.string().trim().min(1, 'Sub-items need a title').max(200, 'Sub-items must be at most 200 characters'),
    done: z.boolean().default(false),
  })
  .strict();

export const taskFieldsSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),
    description: z.string().max(2000, 'Description must be at most 2000 characters').default(''),
    dueDate: calendarDate.nullable().default(null),
    dueTime: clockTime.nullable().default(null),
    // Minutes before the due time (up to 30 days); -1 = no reminder; null = the user's default.
    reminderMinutes: z.number().int().min(-1).max(43_200).nullable().default(null),
    priority: z.enum(PRIORITIES).default('medium'),
    category: z.string().trim().max(50, 'Category must be at most 50 characters').default(''),
    completed: z.boolean().default(false),
    subtasks: z.array(subtaskSchema).max(50, 'A task can have at most 50 sub-items').default([]),
    listId: z.string().uuid('Invalid list').nullable().default(null),
    assigneeId: objectId.nullable().default(null),
  })
  .strict();

export const createTaskSchema = taskFieldsSchema.extend({ id: uuid.optional() });

export const updateTaskSchema = taskFieldsSchema
  .partial()
  .strict()
  .refine((o) => Object.keys(o).length > 0, 'No fields to update');

export const listQuerySchema = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(['all', 'active', 'completed']).default('all'),
  priority: z.enum(PRIORITIES).optional(),
  category: z.string().max(50).optional(),
});

export const syncChangeSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('upsert'),
    id: uuid,
    updatedAt: isoDateTime,
    createdAt: isoDateTime.optional(),
    data: taskFieldsSchema,
  }),
  z.object({ op: z.literal('delete'), id: uuid, updatedAt: isoDateTime }),
]);

export const createListSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1, 'Give the list a name').max(60, 'List name must be at most 60 characters'),
  })
  .strict();

export const renameListSchema = z.object({ name: createListSchema.shape.name }).strict();

export const inviteSchema = z.object({ email: emailSchema }).strict();

export const syncRequestSchema = z.object({
  since: isoDateTime.nullable().default(null),
  // Each change is validated individually so one bad entry doesn't block the rest.
  changes: z.array(z.unknown()).max(500, 'Send at most 500 changes per sync').default([]),
});

export type SyncChange = z.infer<typeof syncChangeSchema>;
