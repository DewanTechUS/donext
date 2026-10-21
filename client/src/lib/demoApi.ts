import type { Api } from './api';
import { ApiError } from './apiError';
import { uuid } from './id';
import type { ListInvite, Session, SharedList, SyncChange, SyncResponse, Task, User } from './types';

/**
 * In-browser imitation of the DoNext server, used by the no-server demo build
 * (VITE_DEMO=true). It follows the same rules as the real API — private personal
 * tasks, shared lists, invitations, assignees, delete permissions — but keeps all
 * data in this browser's localStorage. Nothing is sent anywhere.
 *
 * Passwords are hashed before storing, but this is a demo: anyone with access to
 * the browser can read its storage. Real deployments use the Node.js server.
 */

interface DemoUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  tokenVersion: number;
  createdAt: string;
}

interface DemoList {
  id: string;
  name: string;
  ownerId: string;
  members: { userId: string; role: 'owner' | 'member' }[];
  invites: { email: string; invitedBy: string; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
}

interface DemoDB {
  users: DemoUser[];
  tasks: Task[];
  lists: DemoList[];
  resets: { token: string; userId: string; expires: number }[];
}

export const DEMO_STORAGE_KEY = 'donext.demo.v1';

/** Where the data lives: the demo and the local (app-store) build use separate keys. */
let storageKey = DEMO_STORAGE_KEY;

const empty = (): DemoDB => ({ users: [], tasks: [], lists: [], resets: [] });

function load(): DemoDB {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? { ...empty(), ...(JSON.parse(raw) as DemoDB) } : empty();
  } catch {
    return empty();
  }
}

function save(db: DemoDB) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(db));
  } catch {
    throw new ApiError(507, 'This browser has no space left for the demo. Clear some site data and try again.');
  }
}

/** Small delay so loading states behave like a real network. */
const pause = () => new Promise((r) => setTimeout(r, 120));

async function hash(password: string) {
  const data = new TextEncoder().encode(`donext-demo:${password}`);
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 0;
  for (const b of data) h = (h * 31 + b) >>> 0;
  return `weak-${h.toString(16)}`;
}

const now = () => new Date().toISOString();
const emailOk = (e: string) => /^\S+@\S+\.\S+$/.test(e);
const passwordProblem = (p: string) =>
  p.length < 8 || !/[A-Za-z]/.test(p) || !/\d/.test(p) ? 'Password must be at least 8 characters and include a letter and a number.' : null;

const publicUser = (u: DemoUser): User => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt });
const issue = (u: DemoUser) => `demo.${u.id}.${u.tokenVersion}.${uuid()}`;
const session = (u: DemoUser): Session => ({ token: issue(u), user: publicUser(u) });

function authed(db: DemoDB, token: string): DemoUser {
  const [prefix, id, ver] = token.split('.');
  const user = db.users.find((u) => u.id === id);
  if (prefix !== 'demo' || !user || String(user.tokenVersion) !== ver) {
    throw new ApiError(401, 'Your session has expired. Please log in again.');
  }
  return user;
}

// ---------- access rules (same as the server) ----------

const myLists = (db: DemoDB, userId: string) => db.lists.filter((l) => l.members.some((m) => m.userId === userId));
const canSee = (t: Task, userId: string, lists: DemoList[]) =>
  t.listId ? lists.some((l) => l.id === t.listId) : t.createdBy === userId;
const canDelete = (t: Task, userId: string, lists: DemoList[]) =>
  canSee(t, userId, lists) && (t.createdBy === userId || lists.some((l) => l.id === t.listId && l.ownerId === userId));

function listDTO(db: DemoDB, l: DemoList, viewerId: string): SharedList {
  const owner = l.ownerId === viewerId;
  return {
    id: l.id,
    name: l.name,
    ownerId: l.ownerId,
    role: owner ? 'owner' : 'member',
    members: l.members
      .map((m) => ({ m, u: db.users.find((u) => u.id === m.userId) }))
      .filter((x): x is { m: DemoList['members'][number]; u: DemoUser } => Boolean(x.u))
      .map(({ m, u }) => ({ id: u.id, name: u.name, email: u.email, role: m.role })),
    invites: owner ? l.invites.map((i) => ({ email: i.email, createdAt: i.createdAt })) : [],
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}

function invitesFor(db: DemoDB, email: string): ListInvite[] {
  return db.lists.flatMap((l) =>
    l.invites
      .filter((i) => i.email === email)
      .map((i) => ({
        listId: l.id,
        listName: l.name,
        invitedBy: db.users.find((u) => u.id === i.invitedBy)?.name ?? 'Someone',
        createdAt: i.createdAt,
      })),
  );
}

function memberList(db: DemoDB, id: string, userId: string) {
  const list = db.lists.find((l) => l.id === id);
  if (!list || !list.members.some((m) => m.userId === userId)) throw new ApiError(404, 'List not found.');
  return list;
}
function ownedList(db: DemoDB, id: string, userId: string) {
  const list = memberList(db, id, userId);
  if (list.ownerId !== userId) throw new ApiError(403, 'Only the list owner can do that.');
  return list;
}
const unassign = (db: DemoDB, listId: string, userId: string) => {
  for (const t of db.tasks) if (t.listId === listId && t.assigneeId === userId) Object.assign(t, { assigneeId: null, updatedAt: now() });
};

// ---------- the API ----------

export function createDemoApi(opts: { storageKey?: string } = {}): Api {
  storageKey = opts.storageKey ?? DEMO_STORAGE_KEY;
  /** Runs an operation against the stored database and saves it afterwards. */
  const tx = async <T,>(fn: (db: DemoDB) => T | Promise<T>): Promise<T> => {
    await pause();
    const db = load();
    const result = await fn(db);
    save(db);
    return result;
  };

  const signupUser = async (db: DemoDB, name: string, email: string, password: string) => {
    const clean = email.trim().toLowerCase();
    const fields: Record<string, string> = {};
    if (!name.trim()) fields.name = 'Name is required';
    if (!emailOk(clean)) fields.email = 'Enter a valid email address';
    const pw = passwordProblem(password);
    if (pw) fields.password = pw;
    if (Object.keys(fields).length) throw new ApiError(400, Object.values(fields)[0], fields);
    if (db.users.some((u) => u.email === clean)) {
      throw new ApiError(409, 'An account with this email already exists. Try logging in instead.');
    }
    const user: DemoUser = { id: uuid(), name: name.trim().slice(0, 80), email: clean, passwordHash: await hash(password), tokenVersion: 0, createdAt: now() };
    db.users.push(user);
    return user;
  };

  const api: Api = {
    signup: ({ name, email, password }) => tx(async (db) => session(await signupUser(db, name, email, password))),

    login: ({ email, password }) =>
      tx(async (db) => {
        const user = db.users.find((u) => u.email === email.trim().toLowerCase());
        if (!user || user.passwordHash !== (await hash(password))) throw new ApiError(401, 'Incorrect email or password.');
        return session(user);
      }),

    me: (token) => tx((db) => ({ user: publicUser(authed(db, token)) })),

    logoutAll: (token) =>
      tx((db) => {
        authed(db, token).tokenVersion += 1;
      }),

    deleteAccount: (token, password) =>
      tx(async (db) => {
        const user = authed(db, token);
        if (user.passwordHash !== (await hash(password))) throw new ApiError(403, 'Incorrect password. Your account was not deleted.');
        const owned = new Set(db.lists.filter((l) => l.ownerId === user.id).map((l) => l.id));
        db.lists = db.lists.filter((l) => !owned.has(l.id));
        for (const l of db.lists) {
          for (const t of db.tasks) if (t.listId === l.id && t.createdBy === user.id) t.createdBy = l.ownerId;
          unassign(db, l.id, user.id);
          l.members = l.members.filter((m) => m.userId !== user.id);
          l.invites = l.invites.filter((i) => i.invitedBy !== user.id && i.email !== user.email);
        }
        db.tasks = db.tasks.filter((t) => !(t.listId && owned.has(t.listId)) && !(t.createdBy === user.id && !t.listId));
        db.users = db.users.filter((u) => u.id !== user.id);
      }),

    forgotPassword: (email) =>
      tx((db) => {
        const user = db.users.find((u) => u.email === email.trim().toLowerCase());
        const message = "If an account exists for that email, we've sent a link to reset your password.";
        if (!user) return { message };
        const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
        db.resets.push({ token, userId: user.id, expires: Date.now() + 60 * 60_000 });
        return { message: 'Demo version: no email is sent. Use the link below to choose a new password.', resetPath: `/reset-password?token=${token}` };
      }),

    resetPassword: (token, password) =>
      tx(async (db) => {
        const pw = passwordProblem(password);
        if (pw) throw new ApiError(400, pw, { password: pw });
        const reset = db.resets.find((r) => r.token === token && r.expires > Date.now());
        const user = reset && db.users.find((u) => u.id === reset.userId);
        if (!user) throw new ApiError(400, 'This reset link is invalid or has expired. Request a new one.');
        db.resets = db.resets.filter((r) => r !== reset);
        user.passwordHash = await hash(password);
        user.tokenVersion += 1;
        return session(user);
      }),

    updateProfile: (token, name) =>
      tx((db) => {
        const user = authed(db, token);
        if (!name.trim()) throw new ApiError(400, 'Name is required', { name: 'Name is required' });
        user.name = name.trim().slice(0, 80);
        return { user: publicUser(user) };
      }),

    changePassword: (token, currentPassword, newPassword) =>
      tx(async (db) => {
        const user = authed(db, token);
        if (user.passwordHash !== (await hash(currentPassword))) {
          throw new ApiError(403, 'Your current password is incorrect.', { currentPassword: 'Incorrect password' });
        }
        const pw = passwordProblem(newPassword);
        if (pw) throw new ApiError(400, pw, { newPassword: pw });
        user.passwordHash = await hash(newPassword);
        user.tokenVersion += 1;
        return session(user);
      }),

    exportData: (token) =>
      tx((db) => {
        const user = authed(db, token);
        return {
          exportedAt: now(),
          app: 'DoNext (demo)',
          user: publicUser(user),
          tasks: db.tasks.filter((t) => t.createdBy === user.id && !t.deletedAt),
        };
      }),

    sync: (token, { changes }) =>
      tx((db): SyncResponse => {
        const user = authed(db, token);
        const lists = myLists(db, user.id);
        const ts = now();
        const results: SyncResponse['results'] = [];

        for (const c of changes as SyncChange[]) {
          const existing = db.tasks.find((t) => t.id === c.id);
          if (existing && !canSee(existing, user.id, lists)) {
            results.push({ id: c.id, status: 'rejected', reason: "You don't have access to this task." });
            continue;
          }
          if (c.op === 'delete') {
            if (existing && !existing.deletedAt) {
              if (!canDelete(existing, user.id, lists)) {
                results.push({ id: c.id, status: 'rejected', reason: 'Only the person who created this task, or the list owner, can delete it.' });
                continue;
              }
              Object.assign(existing, { deletedAt: c.updatedAt, updatedAt: c.updatedAt });
            }
            results.push({ id: c.id, status: 'applied' });
            continue;
          }
          if (existing && (existing.deletedAt || existing.updatedAt >= c.updatedAt)) {
            results.push({ id: c.id, status: 'stale' });
            continue;
          }
          const list = c.data.listId ? lists.find((l) => l.id === c.data.listId) : undefined;
          if (c.data.listId && !list) {
            results.push({ id: c.id, status: 'rejected', reason: "You're not a member of that list." });
            continue;
          }
          if (existing?.listId && !c.data.listId && existing.createdBy !== user.id) {
            results.push({ id: c.id, status: 'rejected', reason: 'Only the person who created this task can move it out of the shared list.' });
            continue;
          }
          const assigneeId = list && c.data.assigneeId && list.members.some((m) => m.userId === c.data.assigneeId) ? c.data.assigneeId : null;
          const fields = { ...c.data, assigneeId, updatedAt: c.updatedAt > ts ? ts : c.updatedAt, deletedAt: null };
          if (existing) Object.assign(existing, fields);
          else db.tasks.push({ id: c.id, ...fields, createdBy: user.id, createdAt: c.createdAt });
          results.push({ id: c.id, status: 'applied' });
        }

        // The demo database is tiny, so every sync simply returns everything this person can see.
        const visible = db.tasks.filter((t) => canSee(t, user.id, lists));
        return {
          tasks: visible,
          results,
          cursor: ts,
          lists: lists.map((l) => listDTO(db, l, user.id)),
          invites: invitesFor(db, user.email),
          removedTaskIds: db.tasks.filter((t) => !canSee(t, user.id, lists)).map((t) => t.id),
        };
      }),

    lists: {
      all: (token) =>
        tx((db) => {
          const user = authed(db, token);
          return { lists: myLists(db, user.id).map((l) => listDTO(db, l, user.id)), invites: invitesFor(db, user.email) };
        }),
      create: (token, name) =>
        tx((db) => {
          const user = authed(db, token);
          if (!name.trim()) throw new ApiError(400, 'Give the list a name');
          const ts = now();
          const list: DemoList = { id: uuid(), name: name.trim().slice(0, 60), ownerId: user.id, members: [{ userId: user.id, role: 'owner' }], invites: [], createdAt: ts, updatedAt: ts };
          db.lists.push(list);
          return { list: listDTO(db, list, user.id) };
        }),
      rename: (token, id, name) =>
        tx((db) => {
          const user = authed(db, token);
          const list = ownedList(db, id, user.id);
          if (!name.trim()) throw new ApiError(400, 'Give the list a name');
          Object.assign(list, { name: name.trim().slice(0, 60), updatedAt: now() });
          return { list: listDTO(db, list, user.id) };
        }),
      remove: (token, id) =>
        tx((db) => {
          const user = authed(db, token);
          ownedList(db, id, user.id);
          db.tasks = db.tasks.filter((t) => t.listId !== id);
          db.lists = db.lists.filter((l) => l.id !== id);
        }),
      invite: (token, id, email) =>
        tx((db) => {
          const user = authed(db, token);
          const list = ownedList(db, id, user.id);
          const clean = email.trim().toLowerCase();
          if (!emailOk(clean)) throw new ApiError(400, 'Enter a valid email address');
          const memberEmails = list.members.map((m) => db.users.find((u) => u.id === m.userId)?.email);
          if (memberEmails.includes(clean)) throw new ApiError(409, 'That person is already in this list.');
          if (list.invites.some((i) => i.email === clean)) throw new ApiError(409, 'That person has already been invited.');
          list.invites.push({ email: clean, invitedBy: user.id, createdAt: now() });
          list.updatedAt = now();
          // The demo has no server, so no email is sent.
          return { list: listDTO(db, list, user.id), emailSent: false };
        }),
      cancelInvite: (token, id, email) =>
        tx((db) => {
          const user = authed(db, token);
          const list = ownedList(db, id, user.id);
          list.invites = list.invites.filter((i) => i.email !== email.toLowerCase());
          return { list: listDTO(db, list, user.id) };
        }),
      accept: (token, id) =>
        tx((db) => {
          const user = authed(db, token);
          const list = db.lists.find((l) => l.id === id && l.invites.some((i) => i.email === user.email));
          if (!list) throw new ApiError(404, 'This invitation is no longer available.');
          list.invites = list.invites.filter((i) => i.email !== user.email);
          if (!list.members.some((m) => m.userId === user.id)) list.members.push({ userId: user.id, role: 'member' });
          list.updatedAt = now();
          return { list: listDTO(db, list, user.id) };
        }),
      decline: (token, id) =>
        tx((db) => {
          const user = authed(db, token);
          const list = db.lists.find((l) => l.id === id);
          if (list) list.invites = list.invites.filter((i) => i.email !== user.email);
        }),
      removeMember: (token, id, memberId) =>
        tx((db) => {
          const user = authed(db, token);
          const list = ownedList(db, id, user.id);
          if (memberId === user.id) throw new ApiError(400, 'You own this list. Delete it instead of removing yourself.');
          list.members = list.members.filter((m) => m.userId !== memberId);
          unassign(db, id, memberId);
          return { list: listDTO(db, list, user.id) };
        }),
      leave: (token, id) =>
        tx((db) => {
          const user = authed(db, token);
          const list = memberList(db, id, user.id);
          if (list.ownerId === user.id) throw new ApiError(400, 'You own this list. Delete it instead of leaving.');
          list.members = list.members.filter((m) => m.userId !== user.id);
          unassign(db, id, user.id);
        }),
    },

    /** One tap to explore: a guest account with sample personal tasks and a shared list with "Alex". */
    localStart: (name: string) =>
      tx(async (db) => {
        const user = await signupUser(db, name.trim().slice(0, 80) || 'Me', `${uuid()}@device.local`, `local-${uuid()}`);
        const ts = now();
        db.tasks.push({
          id: uuid(),
          title: 'Welcome to DoNext 👋',
          description: 'Tap the blue mic and just say what you need to do.',
          dueDate: null,
          dueTime: null,
          reminderMinutes: null,
          priority: 'medium',
          category: 'Getting started',
          completed: false,
          subtasks: [],
          listId: null,
          assigneeId: null,
          createdBy: user.id,
          createdAt: ts,
          updatedAt: ts,
          deletedAt: null,
        });
        return session(user);
      }),

    /** Everyone using DoNext on this device. */
    localProfiles: () =>
      tx((db) => ({
        profiles: db.users
          .map((u) => ({
            id: u.id,
            name: u.name,
            createdAt: u.createdAt,
            open: db.tasks.filter((t) => t.createdBy === u.id && !t.deletedAt && !t.completed).length,
          }))
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      })),

    /** Switch to another person's tasks (no password: it's one shared device). */
    localSwitch: (userId: string) =>
      tx((db) => {
        const user = db.users.find((u) => u.id === userId);
        if (!user) throw new ApiError(404, 'That person is no longer on this device.');
        return session(user);
      }),

    /** Every person's open tasks, so reminders ring for everyone on the device. */
    localAllTasks: () =>
      tx((db) => ({
        tasks: db.tasks
          .filter((t) => !t.deletedAt)
          .map((t) => ({ ...t, ownerName: db.users.find((u) => u.id === t.createdBy)?.name ?? '' })),
      })),

    localErase: (token: string) =>
      tx((db) => {
        const user = authed(db, token);
        db.tasks = db.tasks.filter((t) => t.createdBy !== user.id);
        db.lists = db.lists.filter((l) => l.ownerId !== user.id);
        db.users = db.users.filter((u) => u.id !== user.id);
      }),

    demoStart: () =>
      tx(async (db) => {
        const tag = uuid().slice(0, 8);
        const guest = await signupUser(db, 'Guest', `guest-${tag}@demo.donext`, `guest-${tag}-1`);
        const alex = await signupUser(db, 'Alex (demo)', `alex-${tag}@demo.donext`, `alex-${tag}-1`);
        const ts = now();
        const day = (offset: number) => {
          const d = new Date();
          d.setDate(d.getDate() + offset);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        const list: DemoList = {
          id: uuid(),
          name: 'Weekend trip',
          ownerId: guest.id,
          members: [
            { userId: guest.id, role: 'owner' },
            { userId: alex.id, role: 'member' },
          ],
          invites: [],
          createdAt: ts,
          updatedAt: ts,
        };
        db.lists.push(list);
        const task = (title: string, extra: Partial<Task>): Task => ({
          id: uuid(),
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
          createdBy: guest.id,
          createdAt: ts,
          updatedAt: ts,
          deletedAt: null,
          ...extra,
        });
        db.tasks.push(
          task('Try adding a task with the microphone 🎙️', { priority: 'high', category: 'Getting started', dueDate: day(0) }),
          task('Renew library books', { category: 'Personal', dueDate: day(-1) }),
          task('Plan next week', { category: 'Personal', dueDate: day(3), priority: 'low' }),
          task('Buy groceries', {
            category: 'Home',
            dueDate: day(0),
            dueTime: '18:00',
            subtasks: [
              { id: uuid(), title: 'Milk', done: true },
              { id: uuid(), title: 'Eggs', done: false },
              { id: uuid(), title: 'Bread', done: false },
            ],
          }),
          task('Read the DoNext README on GitHub', { category: 'Getting started', completed: true }),
          task('Book the cabin', { listId: list.id, priority: 'high', dueDate: day(2), dueTime: '10:00', assigneeId: guest.id, createdBy: alex.id }),
          task('Pack snacks and water', {
            listId: list.id,
            assigneeId: alex.id,
            subtasks: [
              { id: uuid(), title: 'Trail mix', done: false },
              { id: uuid(), title: 'Water bottles', done: false },
            ],
          }),
        );
        return session(guest);
      }),
  };
  return api;
}
