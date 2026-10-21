import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTasks } from '../context/TasksContext';
import { api, type LocalProfile } from '../lib/api';
import { Alert } from './Alert';
import { Avatar } from './Avatar';
import { AppLogo } from './Brand';
import { PlusIcon } from './Icons';
import { Spinner } from './Spinner';

/** Set once someone picks who they are, so the picker isn't shown again until the app is reopened. */
export const PROFILE_CHOSEN = 'dt.profileChosen';
export const markProfileChosen = () => {
  try {
    sessionStorage.setItem(PROFILE_CHOSEN, '1');
  } catch {
    /* ignore */
  }
};
export const profileChosen = () => {
  try {
    return sessionStorage.getItem(PROFILE_CHOSEN) === '1';
  } catch {
    return true;
  }
};

/** Everyone using DoNext on this device (local app), or [] elsewhere. */
export function useProfiles() {
  const [profiles, setProfiles] = useState<LocalProfile[] | null>(null);
  const { store } = useTasks();
  useEffect(() => {
    let live = true;
    if (!api.localProfiles) {
      setProfiles([]);
      return;
    }
    // Save the current person's latest changes first, so their counts are right.
    void (store ? store.syncNow() : Promise.resolve())
      .catch(() => undefined)
      .then(() => api.localProfiles!())
      .then(
        (r) => live && setProfiles(r.profiles),
        () => live && setProfiles([]),
      );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return profiles;
}

/** "Who's using DoNext?": each person on this phone has their own tasks. */
export function ProfilePicker({ profiles }: { profiles: LocalProfile[] }) {
  const { user, switchProfile, startLocal } = useAuth();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { store } = useTasks();
  const choose = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await store?.syncNow().catch(() => undefined); // keep the current person's latest changes
      await switchProfile(id);
      markProfileChosen();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch. Please try again.');
      setBusy(null);
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy('new');
    setError(null);
    try {
      await startLocal(name);
      markProfileChosen();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this person.');
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-6 text-center sm:py-12">
      <AppLogo size={56} />
      <h1 className="mt-4 text-2xl font-bold tracking-tight">Who’s using DoNext?</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Everyone on this phone has their own tasks.</p>

      {error && (
        <Alert className="mt-4 w-full text-left" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <ul className="mt-6 grid w-full grid-cols-2 gap-3 sm:grid-cols-3" aria-label="People">
        {profiles.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => void choose(p.id)}
              disabled={busy !== null}
              aria-current={user?.id === p.id ? 'true' : undefined}
              className={`card flex w-full flex-col items-center gap-2 p-4 transition-colors hover:border-brand-400 ${
                user?.id === p.id ? 'border-brand-500 ring-2 ring-brand-500/30' : ''
              }`}
            >
              {busy === p.id ? <Spinner className="h-14 w-14" label="Opening" /> : <Avatar name={p.name} seed={p.id} size={56} />}
              <span className="max-w-full truncate font-semibold">{p.name}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {p.open === 0 ? 'No open tasks' : `${p.open} to do`}
              </span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={busy !== null}
            className="flex h-full min-h-[132px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 p-4 text-slate-600 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-300"
          >
            <PlusIcon width={28} height={28} />
            <span className="font-semibold">Add person</span>
          </button>
        </li>
      </ul>

      {adding && (
        <form onSubmit={(e) => void add(e)} className="mt-6 w-full space-y-3 text-left">
          <label htmlFor="new-person" className="label">
            Name
          </label>
          <input
            id="new-person"
            className="input"
            value={name}
            maxLength={80}
            autoFocus
            autoComplete="off"
            placeholder="e.g. Sara"
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={!name.trim() || busy !== null}>
              {busy === 'new' && <Spinner className="h-4 w-4" />}
              Add
            </button>
          </div>
        </form>
      )}

      <p className="mt-8 text-xs text-slate-500 dark:text-slate-400">
        Anyone using this phone can open any profile. Tasks are saved only on this device.
      </p>
    </div>
  );
}

