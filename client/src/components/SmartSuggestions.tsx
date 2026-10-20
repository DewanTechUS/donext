import { useMemo } from 'react';
import { formatDueDate, formatTime } from '../lib/filters';
import { describeLead } from '../lib/reminders';
import { suggestTask } from '../lib/smartSuggest';
import { uuid } from '../lib/id';
import type { TaskFields } from '../lib/types';
import { CloseIcon, SparkleIcon } from './Icons';

interface SmartSuggestionsProps {
  fields: TaskFields;
  categories: string[];
  /** Applies the suggested values. */
  onApply: (patch: Partial<TaskFields>) => void;
  /** Hidden by the user (for this title). */
  dismissed: boolean;
  onDismiss: () => void;
}

/**
 * What to fill in from the title, and the rows that describe it. Only fields the user
 * hasn't filled in themselves are suggested. Also used to apply suggestions automatically
 * when a task is saved hands-free.
 */
export function suggestionFor(fields: TaskFields, categories: string[]) {
  const s = suggestTask(fields.title, { categories });
  const patch: Partial<TaskFields> = {};
  const rows: Array<[string, string]> = [];
  if (s.title && s.title !== fields.title.trim()) {
    patch.title = s.title;
    rows.push(['Title', s.title]);
  }
  if (s.category && !fields.category.trim()) {
    patch.category = s.category;
    rows.push(['Category', s.category]);
  }
  if (s.priority && fields.priority === 'medium' && s.priority !== 'medium') {
    patch.priority = s.priority;
    rows.push(['Priority', s.priority === 'high' ? 'High' : 'Low']);
  }
  if (s.dueDate && !fields.dueDate) {
    patch.dueDate = s.dueDate;
    if (s.dueTime && !fields.dueTime) patch.dueTime = s.dueTime;
    rows.push(['Due', `${formatDueDate(s.dueDate)}${patch.dueTime ? `, ${formatTime(patch.dueTime)}` : ''}`]);
  } else if (s.dueTime && fields.dueDate && !fields.dueTime) {
    patch.dueTime = s.dueTime;
    rows.push(['Time', formatTime(s.dueTime)]);
  }
  if (s.reminderMinutes !== undefined && fields.reminderMinutes === null && (s.dueDate || fields.dueDate)) {
    patch.reminderMinutes = s.reminderMinutes;
    rows.push(['Reminder', describeLead(s.reminderMinutes)]);
  }
  if (s.subtasks && fields.subtasks.length === 0) {
    patch.subtasks = s.subtasks.map((title) => ({ id: uuid(), title, done: false }));
    rows.push(['Sub-items', s.subtasks.join(', ')]);
  }
  if (s.description && !fields.description.trim()) {
    patch.description = s.description;
    rows.push(['Note', s.description]);
  }
  return { patch, rows };
}

/**
 * Reads the title as you type or speak and offers to fill in the category, priority,
 * date/time, reminder and sub-items.
 */
export function SmartSuggestions({ fields, categories, onApply, dismissed, onDismiss }: SmartSuggestionsProps) {
  const { patch, rows } = useMemo(() => suggestionFor(fields, categories), [fields, categories]);

  if (rows.length === 0 || dismissed) return null;

  return (
    <section
      aria-label="Suggestions"
      className="rounded-2xl border border-brand-200 bg-brand-50/70 p-3 dark:border-slate-700 dark:bg-slate-800/60"
    >
      <div className="flex items-start gap-2">
        <SparkleIcon width={18} height={18} className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-300" />
        <dl className="min-w-0 flex-1 space-y-0.5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="w-20 shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
              <dd className="min-w-0 break-words font-medium text-slate-800 dark:text-slate-100">{value}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          className="-m-2 flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          aria-label="Dismiss suggestions"
          onClick={onDismiss}
        >
          <CloseIcon width={16} height={16} />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 pl-6">
        <p className="text-xs text-slate-500 dark:text-slate-400">Suggested on your device. You can change anything.</p>
        <button type="button" className="btn-primary shrink-0 px-4 py-1.5 text-sm" onClick={() => onApply(patch)}>
          Apply
        </button>
      </div>
    </section>
  );
}
