import { ApiError } from './apiError';
import { createDemoApi } from './demoApi';
import type { ListInvite, Session, SharedList, SyncRequest, SyncResponse, User } from './types';

export { ApiError };

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/**
 * Demo builds (VITE_DEMO=true, e.g. the GitHub Pages live demo) run without a server:
 * the API below is replaced by an in-browser imitation that stores everything in localStorage.
 */
export const IS_DEMO = import.meta.env.VITE_DEMO === 'true';

/**
 * App-store builds (VITE_LOCAL=true, e.g. the Google Play app) also run without a server:
 * tasks are stored on the device, there's no sign-up, and nothing is sent anywhere.
 */
export const IS_LOCAL = import.meta.env.VITE_LOCAL === 'true';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, { method = 'GET', body, token, signal }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError(0, "Can't reach the server. Check your internet connection and try again.");
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data?.error === 'string'
        ? data.error
        : res.status >= 500
          ? 'The server had a problem. Please try again shortly.'
          : `Request failed (${res.status}).`;
    throw new ApiError(res.status, message, data?.details?.fields ?? {});
  }
  return data as T;
}

const realApi = {
  signup: (body: { name: string; email: string; password: string }) =>
    apiFetch<Session>('/api/auth/signup', { method: 'POST', body }),
  login: (body: { email: string; password: string }) => apiFetch<Session>('/api/auth/login', { method: 'POST', body }),
  me: (token: string) => apiFetch<{ user: User }>('/api/auth/me', { token }),
  logoutAll: (token: string) => apiFetch<void>('/api/auth/logout-all', { method: 'POST', token }),
  deleteAccount: (token: string, password: string) =>
    apiFetch<void>('/api/auth/me', { method: 'DELETE', token, body: { password } }),
  forgotPassword: (email: string) =>
    apiFetch<{ message: string; /** demo only: no email is sent, so the link is returned */ resetPath?: string }>(
      '/api/auth/forgot-password',
      { method: 'POST', body: { email } },
    ),
  resetPassword: (token: string, password: string) =>
    apiFetch<Session>('/api/auth/reset-password', { method: 'POST', body: { token, password } }),
  updateProfile: (token: string, name: string) => apiFetch<{ user: User }>('/api/auth/me', { method: 'PATCH', token, body: { name } }),
  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    apiFetch<Session>('/api/auth/change-password', { method: 'POST', token, body: { currentPassword, newPassword } }),
  exportData: (token: string) => apiFetch<unknown>('/api/auth/export', { token }),
  sync: (token: string, body: SyncRequest) => apiFetch<SyncResponse>('/api/tasks/sync', { method: 'POST', token, body }),
  lists: {
    all: (token: string) => apiFetch<{ lists: SharedList[]; invites: ListInvite[] }>('/api/lists', { token }),
    create: (token: string, name: string) => apiFetch<{ list: SharedList }>('/api/lists', { method: 'POST', token, body: { name } }),
    rename: (token: string, id: string, name: string) =>
      apiFetch<{ list: SharedList }>(`/api/lists/${id}`, { method: 'PATCH', token, body: { name } }),
    remove: (token: string, id: string) => apiFetch<void>(`/api/lists/${id}`, { method: 'DELETE', token }),
    invite: (token: string, id: string, email: string) =>
      apiFetch<{ list: SharedList; emailSent?: boolean }>(`/api/lists/${id}/invites`, { method: 'POST', token, body: { email } }),
    cancelInvite: (token: string, id: string, email: string) =>
      apiFetch<{ list: SharedList }>(`/api/lists/${id}/invites/${encodeURIComponent(email)}`, { method: 'DELETE', token }),
    accept: (token: string, id: string) => apiFetch<{ list: SharedList }>(`/api/lists/${id}/accept`, { method: 'POST', token }),
    decline: (token: string, id: string) => apiFetch<void>(`/api/lists/${id}/decline`, { method: 'POST', token }),
    removeMember: (token: string, id: string, userId: string) =>
      apiFetch<{ list: SharedList }>(`/api/lists/${id}/members/${userId}`, { method: 'DELETE', token }),
    leave: (token: string, id: string) => apiFetch<void>(`/api/lists/${id}/leave`, { method: 'POST', token }),
  },
  /** Demo only: creates a ready-to-explore account with sample tasks and a shared list. */
  demoStart: undefined as undefined | (() => Promise<Session>),
  /** Local app only: creates the on-device profile (no account, no password). */
  localStart: undefined as undefined | ((name: string) => Promise<Session>),
  /** Local app only: erases the profile and all tasks on this device. */
  localErase: undefined as undefined | ((token: string) => Promise<void>),
};

export type Api = typeof realApi;

export const api: Api = IS_DEMO || IS_LOCAL ? createDemoApi(IS_LOCAL ? { storageKey: 'donext.local.v1' } : {}) : realApi;
