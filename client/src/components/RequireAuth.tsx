import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IS_LOCAL } from '../lib/api';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  // The local app has no log-in page: its welcome screen is at "/".
  if (status !== 'authenticated') return <Navigate to={IS_LOCAL ? '/' : '/login'} replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { status, sessionExpired } = useAuth();
  // The local app has no accounts, so no log-in, sign-up or password pages.
  if (IS_LOCAL) return <Navigate to="/" replace />;
  // An expired session may log in again (to resume syncing) even though local data is loaded.
  if (status === 'authenticated' && !sessionExpired) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Pages that need the server (shared lists, password reset): not part of the local app. */
export function ServerOnly({ children }: { children: ReactNode }) {
  if (IS_LOCAL) return <Navigate to="/" replace />;
  return <>{children}</>;
}
