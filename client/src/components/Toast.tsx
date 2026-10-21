import { useEffect, useRef } from 'react';
import { CheckIcon, CloseIcon } from './Icons';

/** A short confirmation at the bottom of the screen that disappears by itself. */
export function Toast({ message, onDone, ms = 5000 }: { message: string; onDone: () => void; ms?: number }) {
  // The timer restarts only for a new message, not when the page re-renders.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const id = setTimeout(() => done.current(), ms);
    return () => clearTimeout(id);
  }, [message, ms]);

  return (
    <div className="safe-pb-3 pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-3">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl bg-slate-900 p-3 pl-4 text-sm text-white shadow-2xl dark:bg-slate-100 dark:text-slate-900"
      >
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-500 text-white">
          <CheckIcon width={14} height={14} strokeWidth={3} />
        </span>
        <p className="min-w-0 flex-1 break-words py-0.5">{message}</p>
        <button type="button" onClick={onDone} className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg opacity-70 hover:opacity-100" aria-label="Dismiss">
          <CloseIcon width={16} height={16} />
        </button>
      </div>
    </div>
  );
}
