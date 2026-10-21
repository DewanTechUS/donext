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

/** The voice and speed used for reading aloud (saved on this device). */
export interface VoicePrefs {
  /** A voice id from listVoices(), or '' for the device's default. */
  voiceId: string;
  rate: number;
}
const VOICE_KEY = 'dt.voice';
export const SPEEDS = [
  { value: 0.85, label: 'Slower' },
  { value: 1, label: 'Normal' },
  { value: 1.15, label: 'Faster' },
];
export const loadVoicePrefs = (): VoicePrefs => ({ voiceId: '', rate: 1, ...(storage.get<Partial<VoicePrefs>>(VOICE_KEY) ?? {}) });
export const saveVoicePrefs = (p: VoicePrefs) => storage.set(VOICE_KEY, p);
