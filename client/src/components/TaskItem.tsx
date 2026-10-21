import { useEffect, useRef, useState } from 'react';
import { formatDueDate, formatTime, isOverdue, nowTime, timeLeft, todayISO } from '../lib/filters';
import { useNow } from '../hooks/useNow';
import type { Task } from '../lib/types';
import { Avatar } from './Avatar';
import { CalendarIcon, CheckIcon, ClockIcon, HourglassIcon, EditIcon, FlagIcon, MoreIcon, TagIcon, TrashIcon, UsersIcon } from './Icons';

interface Person {
  id: string;
  name: string;
}

const priorityStyle = {
  high: { stripe: 'bg-red-500', text: 'text-red-700 dark:text-red-300', label: 'High' },
  medium: { stripe: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-300', label: 'Medium' },
  low: { stripe: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', label: 'Low' },
};

const LEFT_STYLE = {
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200',
  soon: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  later: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

/** Sub-items shown before "Show more". */
const SUBTASK_PREVIEW = 4;

interface TaskItemProps {
  task: Task;
  /** Name of the shared list, shown when tasks from several lists are mixed. */
  listName?: string;
  /** Who added the task, when it wasn't me. */
  addedBy?: Person;
  /** Who it's assigned to. */
  assignee?: Person;
  meId?: string;
  onToggle: () => void;
  /** Ticks or unticks one sub-item. */
  onToggleSubtask?: (subtaskId: string) => void;
  onEdit: () => void;
  /** Opens "Add to calendar" (reminder). */
  onCalendar?: () => void;
  /** Omit when I'm not allowed to delete this task. */
  onDelete?: () => void;
}

const meta = 'inline-flex items-center gap-1 whitespace-nowrap';
const personChip = 'inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

export function TaskItem({ task, listName, addedBy, assignee, meId, onToggle, onToggleSubtask, onEdit, onCalendar, onDelete }: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const now = useNow(!!task.dueDate && !task.completed);
  const overdue = isOverdue(task, todayISO(now), nowTime(now));
  const left = timeLeft(task, now);
  const dueToday = task.dueDate === todayISO(now);
  const p = priorityStyle[task.priority];
  const subtasks = task.subtasks ?? [];
  const doneCount = subtasks.filter((s) => s.done).length;
  const shown = expanded ? subtasks : subtasks.slice(0, SUBTASK_PREVIEW);

  return (
    <li className="card relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2 overflow-visible p-3 pl-4 sm:gap-x-3 sm:p-4 sm:pl-5">
      {/* Priority stripe */}
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 rounded-l-2xl ${task.completed ? 'bg-slate-300 dark:bg-slate-700' : p.stripe}`} />

      <button
        type="button"
        role="checkbox"
        aria-checked={task.completed}
        aria-label={`Mark “${task.title}” as ${task.completed ? 'not done' : 'done'}`}
        onClick={onToggle}
        className="-m-1 flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-xl"
      >
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${
            task.completed
              ? 'border-success-500 bg-success-500 text-white'
              : 'border-slate-300 bg-white hover:border-success-500 dark:border-slate-500 dark:bg-transparent'
          }`}
        >
          {task.completed && <CheckIcon width={16} height={16} strokeWidth={3} />}
        </span>
      </button>

      <div className="min-w-0 flex-1 pt-2">
        <p
          className={`break-words font-semibold leading-snug ${task.completed ? 'text-slate-400 line-through dark:text-slate-500' : ''}`}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-400">
            {task.description}
          </p>
        )}

        {/* Date, time, priority and category */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-600 dark:text-slate-400">
          {task.dueDate && (
            <span
              className={`${meta} ${
                overdue ? 'font-semibold text-red-600 dark:text-red-400' : dueToday && !task.completed ? 'text-brand-700 dark:text-brand-300' : ''
              }`}
            >
              <CalendarIcon width={14} height={14} />
              <span className="sr-only">Due </span>
              <time dateTime={task.dueTime ? `${task.dueDate}T${task.dueTime}` : task.dueDate}>
                {formatDueDate(task.dueDate)}
              </time>
              {task.dueTime && (
                <>
                  <ClockIcon width={14} height={14} className="ml-1.5" />
                  {formatTime(task.dueTime)}
                </>
              )}
            </span>
          )}
          {left && (
            <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 ${LEFT_STYLE[left.tone]}`}>
              <HourglassIcon width={12} height={12} />
              {left.text}
            </span>
          )}
          <span className={`${meta} ${task.completed ? '' : p.text}`}>
            <FlagIcon width={14} height={14} />
            <span className="sr-only">Priority: </span>
            {p.label}
          </span>
          {task.category && (
            <span className={meta}>
              <TagIcon width={14} height={14} />
              <span className="sr-only">Category: </span>
              {task.category}
            </span>
          )}
        </div>

        {/* Sub-items */}
        {subtasks.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex max-w-sm items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>
                {doneCount} of {subtasks.length} done
              </span>
              <span
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                role="progressbar"
                aria-label="Sub-items done"
                aria-valuemin={0}
                aria-valuemax={subtasks.length}
                aria-valuenow={doneCount}
              >
                <span
                  className="block h-full rounded-full bg-success-500 transition-[width]"
                  style={{ width: `${(doneCount / subtasks.length) * 100}%` }}
                />
              </span>
            </div>
            <ul aria-label={`Sub-items of “${task.title}”`}>
              {shown.map((s) => (
                <li key={s.id}>
                  <label className="-mx-1 flex min-h-[36px] cursor-pointer items-center gap-2.5 rounded-lg px-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 cursor-pointer rounded accent-success-500"
                      checked={s.done}
                      onChange={() => onToggleSubtask?.(s.id)}
                      disabled={!onToggleSubtask}
                    />
                    <span className={`break-words ${s.done ? 'text-slate-400 line-through dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                      {s.title}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {subtasks.length > SUBTASK_PREVIEW && (
              <button
                type="button"
                className="mt-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                aria-expanded={expanded}
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? 'Show less' : `Show ${subtasks.length - SUBTASK_PREVIEW} more`}
              </button>
            )}
          </div>
        )}

        {/* Sharing */}
        {(listName || addedBy || assignee) && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
            {listName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-brand-700 dark:bg-slate-800 dark:text-brand-300">
                <UsersIcon width={12} height={12} />
                <span className="sr-only">List: </span>
                {listName}
              </span>
            )}
            {addedBy && (
              <span className={personChip}>
                <Avatar name={addedBy.name} seed={addedBy.id} size={20} /> From {addedBy.name}
              </span>
            )}
            {assignee && (
              <span className={personChip}>
                <Avatar name={assignee.name} seed={assignee.id} size={20} />
                {assignee.id === meId ? 'Assigned to you' : `For ${assignee.name}`}
              </span>
            )}
          </div>
        )}

      </div>

      <TaskMenu title={task.title} onEdit={onEdit} onCalendar={onCalendar && !task.completed ? onCalendar : undefined} onDelete={onDelete} />
    </li>
  );
}

/** The ⋯ menu on a task: Edit, Add to calendar, Delete. */
function TaskMenu({ title, onEdit, onCalendar, onDelete }: { title: string; onEdit: () => void; onCalendar?: () => void; onDelete?: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const item = 'flex min-h-touch w-full items-center gap-3 px-4 text-left text-[15px] hover:bg-slate-50 dark:hover:bg-slate-800';
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={box} className="relative -mr-1">
      <button
        type="button"
        className="btn-ghost"
        aria-label={`More for “${title}”`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreIcon />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <button type="button" role="menuitem" className={item} onClick={run(onEdit)} aria-label={`Edit “${title}”`}>
            <EditIcon width={18} height={18} /> Edit
          </button>
          {onCalendar && (
            <button type="button" role="menuitem" className={item} onClick={run(onCalendar)} aria-label={`Add “${title}” to calendar`}>
              <CalendarIcon width={18} height={18} /> Add to calendar
            </button>
          )}
          {onDelete && (
            <button type="button" role="menuitem" className={`${item} text-red-600 dark:text-red-400`} onClick={run(onDelete)} aria-label={`Delete “${title}”`}>
              <TrashIcon width={18} height={18} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
