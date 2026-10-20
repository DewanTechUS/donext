import { ReminderSettingsSection } from '../components/ReminderSettings';
import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { useTasks } from '../context/TasksContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { api, ApiError, IS_LOCAL } from '../lib/api';
import { Capacitor } from '@capacitor/core';

export default function AccountPage() {
  const { user, logout, logoutEverywhere, deleteAccount } = useAuth();
  const { sync } = useTasks();
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [busy, setBusy] = useState<null | 'all' | 'delete'>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const pwId = useId();
  const ackId = useId();

  if (!user) return null;

  const doLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const onLogout = () => (sync.pending > 0 ? setConfirmLogout(true) : void doLogout());

  const onLogoutAll = async () => {
    setBusy('all');
    setError(null);
    try {
      await logoutEverywhere();
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log out of all devices.');
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return setError('Enter your password to confirm.');
    if (!understood) return setError('Please confirm that you understand this cannot be undone.');
    setBusy('delete');
    setError(null);
    try {
      await deleteAccount(password);
      navigate('/signup', { replace: true, state: { deleted: true } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete your account.');
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Account</h1>
      {error && <Alert onDismiss={() => setError(null)}>{error}</Alert>}

      <ProfileSection />
      <ReminderSettingsSection />
      {!IS_LOCAL && <PasswordSection />}
      {/* Downloading a file isn't supported inside the Android app's web view. */}
      {!(IS_LOCAL && Capacitor.isNativePlatform()) && <DataSection />}
      {IS_LOCAL && <EraseLocalSection />}

      {!IS_LOCAL && (
      <>
      <section className="card space-y-3 p-5" aria-labelledby="session-h">
        <h2 id="session-h" className="text-lg font-semibold">
          Sessions
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Logging out removes your offline copy of tasks from this device. Your tasks stay safe in your account.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-secondary" onClick={onLogout}>
            Log out
          </button>
          <button type="button" className="btn-secondary" onClick={() => void onLogoutAll()} disabled={!online || busy !== null}>
            {busy === 'all' && <Spinner className="h-4 w-4" />}
            Log out of all devices
          </button>
        </div>
      </section>

      <section className="card space-y-4 border-red-300 p-5 dark:border-red-900" aria-labelledby="delete-h">
        <h2 id="delete-h" className="text-lg font-semibold text-red-700 dark:text-red-400">
          Delete account
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          This permanently deletes your account and every task in it from our servers and this device. It cannot be undone.
        </p>
        {!online && <Alert kind="warning">You need to be online to delete your account.</Alert>}
        <form onSubmit={onDelete} className="space-y-3" noValidate>
          <div>
            <label htmlFor={pwId} className="label">
              Confirm your password
            </label>
            <input
              id={pwId}
              type="password"
              className="input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex items-start gap-3">
            <input
              id={ackId}
              type="checkbox"
              className="mt-1 h-6 w-6 shrink-0 accent-red-600"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
            />
            <label htmlFor={ackId} className="text-sm">
              I understand my account and all my tasks will be permanently deleted.
            </label>
          </div>
          <button type="submit" className="btn-danger w-full sm:w-auto" disabled={!online || busy !== null}>
            {busy === 'delete' && <Spinner className="h-4 w-4" />}
            Delete my account
          </button>
        </form>
      </section>
      </>
      )}

      {confirmLogout && (
        <Modal title="Unsynced changes" onClose={() => setConfirmLogout(false)}>
          <p className="mb-5 text-slate-700 dark:text-slate-300">
            You have {sync.pending} change(s) that haven't synced yet. If you log out now, they will be lost. Connect to the
            internet and wait for syncing to finish to keep them.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={() => setConfirmLogout(false)}>
              Stay logged in
            </button>
            <button type="button" className="btn-danger" onClick={() => void doLogout()}>
              Log out and discard
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ProfileSection() {
  const { user, updateName } = useAuth();
  const { sync } = useTasks();
  const online = useOnlineStatus();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const nameId = useId();
  if (!user) return null;

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setMessage({ kind: 'error', text: 'Name is required.' });
    setBusy(true);
    setMessage(null);
    try {
      await updateName(name.trim());
      setEditing(false);
      setMessage({ kind: 'success', text: 'Name updated.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not update your name.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card space-y-3 p-5" aria-labelledby="profile-h">
      <h2 id="profile-h" className="text-lg font-semibold">
        Profile
      </h2>
      {message && (
        <Alert kind={message.kind} onDismiss={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}
      {editing ? (
        <form onSubmit={onSave} className="flex flex-col gap-2 sm:flex-row sm:items-end" noValidate>
          <div className="flex-1">
            <label htmlFor={nameId} className="label">
              Name
            </label>
            <input id={nameId} className="input" value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1" disabled={busy || (!online && !IS_LOCAL)}>
              {busy && <Spinner className="h-4 w-4" />}
              Save
            </button>
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => {
                setEditing(false);
                setName(user.name);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
        {!editing && (
          <>
            <dt className="text-slate-500 dark:text-slate-400">Name</dt>
            <dd className="flex items-center justify-between gap-2 font-medium">
              {user.name}
              <button type="button" className="btn-ghost min-h-[36px] text-sm" onClick={() => setEditing(true)} disabled={!online}>
                Edit
              </button>
            </dd>
          </>
        )}
        <dt className="text-slate-500 dark:text-slate-400">Email</dt>
        <dd className="break-all font-medium">{user.email}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Member since</dt>
        <dd className="font-medium">{new Date(user.createdAt).toLocaleDateString()}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Sync</dt>
        <dd className="font-medium">
          {sync.pending ? `${sync.pending} change(s) waiting to sync` : 'All changes synced'}
          {sync.lastSyncedAt && (
            <span className="block text-slate-500 dark:text-slate-400">Last synced {new Date(sync.lastSyncedAt).toLocaleString()}</span>
          )}
        </dd>
      </dl>
    </section>
  );
}

function PasswordSection() {
  const { changePassword } = useAuth();
  const online = useOnlineStatus();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const currentId = useId();
  const nextId = useId();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!current) return setMessage({ kind: 'error', text: 'Enter your current password.' });
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next))
      return setMessage({ kind: 'error', text: 'New password must be at least 8 characters and include a letter and a number.' });
    setBusy(true);
    setMessage(null);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setMessage({ kind: 'success', text: 'Password changed. Your other devices have been signed out.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof ApiError || err instanceof Error ? err.message : 'Could not change password.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card space-y-3 p-5" aria-labelledby="password-h">
      <h2 id="password-h" className="text-lg font-semibold">
        Password
      </h2>
      {message && (
        <Alert kind={message.kind} onDismiss={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2" noValidate>
        <div>
          <label htmlFor={currentId} className="label">
            Current password
          </label>
          <input id={currentId} type="password" className="input" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div>
          <label htmlFor={nextId} className="label">
            New password
          </label>
          <input id={nextId} type="password" className="input" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-secondary w-full sm:w-auto" disabled={busy || !online}>
            {busy && <Spinner className="h-4 w-4" />}
            Change password
          </button>
        </div>
      </form>
    </section>
  );
}

/** Local app: there is no account, so "delete my data" erases everything on this device. */
function EraseLocalSection() {
  const { eraseLocal } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const erase = async () => {
    setBusy(true);
    await eraseLocal();
    navigate('/', { replace: true });
  };

  return (
    <section className="card space-y-3 border-red-300 p-5 dark:border-red-900" aria-labelledby="erase-h">
      <h2 id="erase-h" className="text-lg font-semibold text-red-700 dark:text-red-400">
        Erase all data
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Your tasks are stored only on this device. Erasing removes your name, tasks and reminders from it. This can’t be undone.
        Uninstalling the app also erases everything.
      </p>
      <button type="button" className="btn-danger w-full sm:w-auto" onClick={() => setConfirming(true)}>
        Erase all data
      </button>
      {confirming && (
        <Modal title="Erase all data?" onClose={() => setConfirming(false)}>
          <p className="mb-5 text-slate-700 dark:text-slate-300">All your tasks and settings on this device will be permanently deleted.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button type="button" className="btn-danger" onClick={() => void erase()} disabled={busy}>
              {busy && <Spinner className="h-4 w-4" />}
              Erase everything
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function DataSection() {
  const { token } = useAuth();
  const online = useOnlineStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onExport = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const data = await api.exportData(token);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `donext-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download your data.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card space-y-3 p-5" aria-labelledby="data-h">
      <h2 id="data-h" className="text-lg font-semibold">
        Your data
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">Download a copy of your account details and all your tasks as a JSON file.</p>
      {error && <Alert onDismiss={() => setError(null)}>{error}</Alert>}
      <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => void onExport()} disabled={busy || (!online && !IS_LOCAL)}>
        {busy && <Spinner className="h-4 w-4" />}
        Download my data
      </button>
    </section>
  );
}
