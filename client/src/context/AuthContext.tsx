import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '../lib/api';
import { LocalStore } from '../lib/db';
import { KEYS, storage } from '../lib/storage';
import type { Session, User } from '../lib/types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthValue {
  status: AuthStatus;
  user: User | null;
  token: string | null;
  /** The stored token was rejected. Local tasks stay available; sync resumes after logging in again. */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  /** Signs out and erases this account's offline data from the device. */
  logout: () => Promise<void>;
  logoutEverywhere: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  /** Completes a password reset from an emailed link and signs in. */
  resetPassword: (resetToken: string, password: string) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  /** Changes the password; other devices are signed out, this one stays signed in. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  markExpired: () => void;
  /** Demo build only: signs in to a new guest account with sample data. */
  startDemo: () => Promise<void>;
  /** Local app only: creates the on-device profile. */
  startLocal: (name: string) => Promise<void>;
  /** Local app only: erases everything on this device and returns to the welcome screen. */
  eraseLocal: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => storage.get<Session>(KEYS.session));
  const [sessionExpired, setSessionExpired] = useState(false);
  const status: AuthStatus = session ? 'authenticated' : 'anonymous';

  // Validate a stored session in the background. Offline → keep working from local data.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    api
      .me(session.token)
      .then(({ user }) => {
        if (cancelled) return;
        const next = { ...session, user };
        storage.set(KEYS.session, next);
        setSession(next);
      })
      .catch((err) => {
        if (!cancelled && err instanceof ApiError && err.status === 401) setSessionExpired(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const start = useCallback((s: Session) => {
    const previous = storage.get<Session>(KEYS.session);
    storage.set(KEYS.session, s);
    setSessionExpired(false);
    setSession(s);
    // A different account logged in over an expired session: remove the old account's offline copy.
    if (previous && previous.user.id !== s.user.id) void LocalStore.destroy(previous.user.id).catch(() => undefined);
  }, []);

  const markExpired = useCallback(() => setSessionExpired(true), []);

  const clear = useCallback(async (userId: string | undefined) => {
    storage.remove(KEYS.session);
    setSession(null);
    setSessionExpired(false);
    if (userId) await LocalStore.destroy(userId).catch(() => undefined);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user: session?.user ?? null,
      token: session?.token ?? null,
      sessionExpired,
      login: async (email, password) => start(await api.login({ email, password })),
      signup: async (name, email, password) => start(await api.signup({ name, email, password })),
      logout: () => clear(session?.user.id),
      logoutEverywhere: async () => {
        if (session) await api.logoutAll(session.token);
        await clear(session?.user.id);
      },
      deleteAccount: async (password) => {
        if (!session) return;
        await api.deleteAccount(session.token, password);
        await clear(session.user.id);
      },
      markExpired,
      startDemo: async () => {
        if (!api.demoStart) throw new Error('The instant demo is only available in the demo version.');
        start(await api.demoStart());
      },
      startLocal: async (name) => {
        if (!api.localStart) throw new Error('Only available in the app.');
        start(await api.localStart(name));
      },
      eraseLocal: async () => {
        if (!session || !api.localErase) return;
        await api.localErase(session.token);
        await clear(session.user.id);
      },
      resetPassword: async (resetToken, password) => start(await api.resetPassword(resetToken, password)),
      updateName: async (name) => {
        if (!session) return;
        const { user } = await api.updateProfile(session.token, name);
        const next = { ...session, user };
        storage.set(KEYS.session, next);
        setSession(next);
      },
      changePassword: async (currentPassword, newPassword) => {
        if (!session) return;
        start(await api.changePassword(session.token, currentPassword, newPassword));
      },
    }),
    [status, session, sessionExpired, start, clear, markExpired],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
