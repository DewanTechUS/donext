import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { CalendarDialog } from '../components/CalendarDialog';
import { FilterBar } from '../components/FilterBar';
import { MailIcon, PlusIcon, UsersIcon } from '../components/Icons';
import { Modal } from '../components/Modal';
import { PageLoader } from '../components/Spinner';
import { TaskForm, emptyFields } from '../components/TaskForm';
import { TaskItem } from '../components/TaskItem';
import { useAuth } from '../context/AuthContext';
import { useTasks } from '../context/TasksContext';
import { categoriesOf, defaultFilters, filterTasks, type TaskFilters } from '../lib/filters';
import type { SharedList, Task } from '../lib/types';
import { agendaText, confirmationText, findTask, type VoiceCommand } from '../lib/voiceCommand';
import { Toast } from '../components/Toast';
import { IS_LOCAL } from '../lib/api';

/** Which tasks to show: my personal tasks, one shared list, or everything. */
type Scope = 'personal' | 'all' | string;

/** I can delete tasks I created, or any task in a list I own. Offline-created tasks have no creator id yet. */
function canDelete(task: Task, meId: string, lists: Map<string, SharedList>) {
  if (!task.createdBy || task.createdBy === meId) return true;
  return Boolean(task.listId && lists.get(task.listId)?.role === 'owner');
}

export default function TasksPage() {
  const { user } = useAuth();
  const { store, tasks, lists, invites, sync, loading, storageError } = useTasks();
  const [scope, setScope] = useState<Scope>('personal');
  const [filters, setFilters] = useState<TaskFilters>(defaultFilters);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [scheduling, setScheduling] = useState<Task | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** "✓ Added Job, Tomorrow at 9:00 AM…", shown briefly after saving. */
  const [toast, setToast] = useState<string | null>(null);
  const location = useLocation();
  const [passwordReset, setPasswordReset] = useState(() => Boolean((location.state as { passwordReset?: boolean } | null)?.passwordReset));

  const listsById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);
  // If the selected list disappears (left/removed/deleted), fall back to personal tasks.
  const activeScope: Scope = scope === 'personal' || scope === 'all' || listsById.has(scope) ? scope : 'personal';
  const inScope = useMemo(
    () => tasks.filter((t) => (activeScope === 'all' ? true : activeScope === 'personal' ? !t.listId : t.listId === activeScope)),
    [tasks, activeScope],
  );
  const categories = useMemo(() => categoriesOf(inScope), [inScope]);
  const visible = useMemo(() => filterTasks(inScope, filters), [inScope, filters]);
  const activeCount = inScope.filter((t) => !t.completed).length;
  const currentList = listsById.get(activeScope);

  const run = async (fn: () => Promise<unknown>) => {
    try {
      setActionError(null);
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  /** "Mark the job as done" / "What do I have today?", said or typed into the new-task box. */
  const runCommand = async (cmd: Exclude<VoiceCommand, { kind: 'add' }>) => {
    if (cmd.kind === 'agenda') return { text: agendaText(tasks, cmd.range) };
    const task = findTask(tasks, cmd.query);
    if (!task) return { text: `I couldn’t find an open task called “${cmd.query}”.` };
    await store!.update(task.id, { completed: true });
    return { text: `Marked “${task.title}” as done. Nice work!`, done: true };
  };

  if (storageError) return <Alert>{storageError}</Alert>;
  if (loading || !store || !user) return <PageLoader label="Loading your tasks…" />;

  const person = (list: SharedList | undefined, id: string | null) => {
    const m = id ? list?.members.find((x) => x.id === id) : undefined;
    return m ? { id: m.id, name: m.name } : undefined;
  };

  const tabs: { value: Scope; label: string }[] = [
    { value: 'personal', label: 'Personal' },
    ...lists.map((l) => ({ value: l.id, label: l.name })),
    ...(lists.length ? [{ value: 'all' as Scope, label: 'All' }] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{user.name === 'Me' ? 'Hi there' : `Hi, ${user.name.split(' ')[0]}`}</h1>
          <p className="text-slate-600 dark:text-slate-400" aria-live="polite">
            {inScope.length === 0 ? 'No tasks here yet.' : `${activeCount} active · ${inScope.length - activeCount} done`}
          </p>
        </div>
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setCreating(true)}>
          <PlusIcon /> New task
        </button>
      </div>

      {invites.length > 0 && (
        <Alert kind="info">
          <span className="inline-flex items-center gap-1.5">
            <MailIcon width={16} height={16} />
            {invites.length === 1
              ? `${invites[0].invitedBy} invited you to “${invites[0].listName}”.`
              : `You have ${invites.length} invitations to shared lists.`}
          </span>{' '}
          <Link to="/lists" className="font-semibold underline">
            View invitations
          </Link>
        </Alert>
      )}
      {sync.error && (
        <Alert kind="warning">
          {sync.error}{' '}
          <button type="button" className="font-semibold underline" onClick={() => void store.syncNow()}>
            Retry
          </button>
        </Alert>
      )}
      {passwordReset && (
        <Alert kind="success" onDismiss={() => setPasswordReset(false)}>
          Your password has been changed and you're signed in. Other devices have been signed out.
        </Alert>
      )}
      {actionError && <Alert onDismiss={() => setActionError(null)}>{actionError}</Alert>}

      {!IS_LOCAL && (
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Which list to show" className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={activeScope === t.value}
              onClick={() => setScope(t.value)}
              className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-lg px-4 text-sm font-medium ${
                activeScope === t.value
                  ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-600 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Link to="/lists" className="btn-ghost text-sm">
          <UsersIcon width={18} height={18} /> {lists.length ? 'Manage lists' : 'Share with others'}
        </Link>
      </div>
      )}

      {currentList && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Shared with {currentList.members.map((m) => (m.id === user.id ? 'you' : m.name)).join(', ')}.
        </p>
      )}

      {inScope.length > 0 && <FilterBar filters={filters} categories={categories} onChange={setFilters} />}

      {inScope.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <p className="text-lg font-semibold">{currentList ? `“${currentList.name}” is empty` : 'Your list is empty'}</p>
          <p className="max-w-sm text-slate-600 dark:text-slate-400">
            {currentList
              ? 'Tasks you add here are visible to everyone in this list.'
              : 'Add your first task by typing or with the microphone. Personal tasks are only visible to you.'}
          </p>
          <button type="button" className="btn-primary mt-2" onClick={() => setCreating(true)}>
            <PlusIcon /> Add a task
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <p className="font-medium">No tasks match your search or filters.</p>
          <button type="button" className="btn-secondary mt-4" onClick={() => setFilters(defaultFilters)}>
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Tasks">
          {visible.map((task) => {
            const list = task.listId ? listsById.get(task.listId) : undefined;
            return (
              <TaskItem
                key={task.id}
                task={task}
                meId={user.id}
                listName={activeScope === 'all' ? list?.name : undefined}
                addedBy={task.createdBy && task.createdBy !== user.id ? person(list, task.createdBy) : undefined}
                assignee={person(list, task.assigneeId)}
                onToggle={() => void run(() => store.toggle(task.id))}
                onToggleSubtask={(sid) => void run(() => store.toggleSubtask(task.id, sid))}
                onEdit={() => setEditing(task)}
                onCalendar={() => setScheduling(task)}
                onDelete={canDelete(task, user.id, listsById) ? () => setDeleting(task) : undefined}
              />
            );
          })}
        </ul>
      )}

      {creating && (
        <Modal title="New task" onClose={() => setCreating(false)}>
          <TaskForm
            voice
            initial={{ ...emptyFields, listId: currentList?.id ?? null }}
            categories={categories}
            lists={lists}
            meId={user.id}
            submitLabel="Add task"
            onCommand={runCommand}
            onCancel={() => setCreating(false)}
            onSubmit={async (fields) => {
              await store.create(fields);
              setCreating(false);
              setToast(confirmationText(fields));
            }}
          />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit task" onClose={() => setEditing(null)}>
          <TaskForm
            initial={editing}
            categories={categories}
            lists={lists}
            meId={user.id}
            submitLabel="Save changes"
            onCancel={() => setEditing(null)}
            onSubmit={async (fields) => {
              await store.update(editing.id, fields);
              setToast(`Saved “${fields.title.trim()}”.`);
              setEditing(null);
            }}
          />
        </Modal>
      )}

      {scheduling && <CalendarDialog task={scheduling} onClose={() => setScheduling(null)} />}

      {deleting && (
        <Modal title="Delete task?" onClose={() => setDeleting(null)}>
          <p className="mb-5 text-slate-700 dark:text-slate-300">
            “{deleting.title}” will be deleted{deleting.listId ? ' for everyone in the list' : ' from all your devices'}. This can't be
            undone.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                const id = deleting.id;
                setDeleting(null);
                void run(() => store.remove(id));
              }}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
