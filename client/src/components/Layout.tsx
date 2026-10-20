import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { IS_DEMO, IS_LOCAL } from '../lib/api';
import { REPO_URL } from '../lib/brand';
import { Alert } from './Alert';
import { Footer } from './Footer';
import { Header } from './Header';
import { ReminderCenter } from './ReminderCenter';

export function Layout() {
  const { status, sessionExpired } = useAuth();
  const online = useOnlineStatus();

  return (
    <div className="safe-x flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:shadow dark:focus:bg-slate-800"
      >
        Skip to content
      </a>
      <Header />
      {IS_DEMO && (
        <div role="note" className="border-b border-brand-100 bg-brand-50 px-4 py-2 text-center text-xs text-brand-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 sm:text-sm">
          <strong>Live demo</strong> — everything you add stays in this browser only. Free & open source (MIT).{' '}
          <a href={REPO_URL} rel="noopener" className="font-semibold underline">
            Get the code
          </a>
        </div>
      )}
      <main id="main" className="safe-pb-6 mx-auto w-full max-w-5xl flex-1 px-4 pt-6">
        {!online && status === 'authenticated' && !IS_LOCAL && (
          <Alert kind="warning" className="mb-4">
            You're offline. You can keep adding and editing tasks — they'll sync automatically when you reconnect.
          </Alert>
        )}
        {sessionExpired && (
          <Alert kind="warning" className="mb-4">
            Your session has expired, so syncing is paused. Your tasks on this device are safe.{' '}
            <Link to="/login" className="font-semibold underline">
              Log in again
            </Link>{' '}
            to resume syncing.
          </Alert>
        )}
        <Outlet />
      </main>
      <Footer />
      {status === 'authenticated' && <ReminderCenter />}
    </div>
  );
}
