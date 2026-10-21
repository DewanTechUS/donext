import { useEffect, useState } from 'react';
import { storage } from './storage';

/**
 * "Read aloud": when on, DoNext speaks confirmations ("Added Job, tomorrow at 9…"), answers
 * ("You have 2 tasks today…") and reminders. One switch, saved on this device. On by default.
 */
const KEY = 'dt.readAloud';
const EVENT = 'donext:read-aloud';

export const readAloudEnabled = () => storage.get<boolean>(KEY) ?? true;

export function setReadAloud(on: boolean) {
  storage.set(KEY, on);
  window.dispatchEvent(new Event(EVENT));
}

/** The setting, kept in sync between every switch on screen. */
export function useReadAloud(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(readAloudEnabled);
  useEffect(() => {
    const sync = () => setOn(readAloudEnabled());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return [on, setReadAloud];
}
