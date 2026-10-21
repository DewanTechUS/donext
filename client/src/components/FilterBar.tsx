import { useId, useState } from 'react';
import { defaultFilters, type SortKey, type StatusFilter, type TaskFilters } from '../lib/filters';
import { PRIORITIES, type Priority } from '../lib/types';
import { FilterIcon, SearchIcon } from './Icons';

interface FilterBarProps {
  filters: TaskFilters;
  categories: string[];
  onChange: (f: TaskFilters) => void;
}

const statuses: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Done' },
];

export function FilterBar({ filters, categories, onChange }: FilterBarProps) {
  const id = useId();
  const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch });
  const isFiltered =
    filters.query || filters.status !== 'all' || filters.priority !== 'all' || filters.category || filters.sort !== 'due';
  // How many filters (besides search) are changed, shown on the Filters button.
  const changed = [filters.status !== 'all', filters.priority !== 'all', !!filters.category, filters.sort !== 'due'].filter(Boolean).length;
  const [open, setOpen] = useState(false);

  return (
    <section aria-label="Search and filter tasks" className="space-y-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <label htmlFor={`${id}-q`} className="sr-only">
            Search tasks
          </label>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id={`${id}-q`}
            type="search"
            className="input pl-10"
            placeholder="Search tasks"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
          />
        </div>
        <button
          type="button"
          className={`btn-secondary shrink-0 px-3 ${changed ? 'border-brand-400 text-brand-700 dark:text-brand-300' : ''}`}
          aria-expanded={open}
          aria-controls={`${id}-filters`}
          onClick={() => setOpen((o) => !o)}
        >
          <FilterIcon width={18} height={18} />
          <span className="hidden sm:inline">Filters</span>
          {changed > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">{changed}</span>}
          <span className="sr-only sm:hidden">Filters</span>
        </button>
      </div>

      {open && (
      <div id={`${id}-filters`} className="flex flex-wrap items-end gap-2">
        <div role="group" aria-label="Status" className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {statuses.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={filters.status === s.value}
              onClick={() => set({ status: s.value })}
              className={`min-h-[40px] rounded-lg px-4 text-sm font-medium ${
                filters.status === s.value
                  ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-600 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="min-w-[8rem] flex-1 sm:flex-none">
          <label htmlFor={`${id}-p`} className="sr-only">
            Priority
          </label>
          <select
            id={`${id}-p`}
            className="input"
            value={filters.priority}
            onChange={(e) => set({ priority: e.target.value as Priority | 'all' })}
          >
            <option value="all">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p[0].toUpperCase() + p.slice(1)} priority
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[8rem] flex-1 sm:flex-none">
          <label htmlFor={`${id}-c`} className="sr-only">
            Category
          </label>
          <select id={`${id}-c`} className="input" value={filters.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[8rem] flex-1 sm:flex-none">
          <label htmlFor={`${id}-s`} className="sr-only">
            Sort by
          </label>
          <select id={`${id}-s`} className="input" value={filters.sort} onChange={(e) => set({ sort: e.target.value as SortKey })}>
            <option value="due">Sort: Due date</option>
            <option value="priority">Sort: Priority</option>
            <option value="newest">Sort: Newest</option>
          </select>
        </div>

        {isFiltered && (
          <button type="button" className="btn-ghost text-sm" onClick={() => onChange(defaultFilters)}>
            Clear filters
          </button>
        )}
      </div>
      )}
    </section>
  );
}
