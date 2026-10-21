import { useEffect, useId, useState } from 'react';
import { LEAD_OPTIONS, loadReminderSettings, saveReminderSettings, type ReminderSettings, type ReminderSound } from '../lib/reminders';
import { canSpeak, playSound, speak, unlockAudio } from '../lib/sound';
import { BellIcon } from './Icons';
import { testReminder } from './ReminderCenter';
import { useReadAloud } from '../lib/voicePrefs';
import { VoiceChoice } from './VoiceChoice';
import {
  exactAlarmsAllowed,
  hasNativeNotifications,
  notificationPermission,
  openExactAlarmSettings,
  requestNotificationPermission,
  type NotifyPermission,
} from '../lib/nativeReminders';

const SOUNDS: Array<{ value: ReminderSound; label: string }> = [
  { value: 'chime', label: 'Chime' },
  { value: 'bell', label: 'Bell' },
  { value: 'beep', label: 'Beep' },
  { value: 'none', label: 'No sound' },
];

const chip = (active: boolean) =>
  `min-h-[40px] rounded-full border px-4 text-sm font-medium transition-colors ${
    active
      ? 'border-brand-600 bg-brand-600 text-white'
      : 'border-slate-200 text-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
  }`;

type Permission = NotificationPermission | 'unsupported';
const webNotificationPermission = (): Permission => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

/** Account → Reminders: sound, read aloud, timing and notifications (saved on this device). */
export function ReminderSettingsSection() {
  const [s, setS] = useState<ReminderSettings>(loadReminderSettings);
  const [permission, setPermission] = useState<Permission>(webNotificationPermission);
  const id = useId();
  const voice = canSpeak();
  const native = hasNativeNotifications();
  const [readAloud, setReadAloud] = useReadAloud();

  useEffect(() => saveReminderSettings(s), [s]);
  // Opened from a reminder's Settings link: scroll here.
  useEffect(() => {
    if (window.location.hash === '#reminders') document.getElementById('reminders')?.scrollIntoView({ block: 'start' });
  }, []);

  const update = (patch: Partial<ReminderSettings>) => setS((prev) => ({ ...prev, ...patch }));

  return (
    <section id="reminders" className="card scroll-mt-20 space-y-4 p-5" aria-labelledby={`${id}-h`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-h`} className="flex items-center gap-2 text-lg font-semibold">
            <BellIcon /> Reminders &amp; voice
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Get a sound or hear the task read aloud when it's due. Saved on this device.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            role="switch"
            className="peer sr-only"
            checked={s.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          <span
            aria-hidden
            className="relative h-7 w-12 rounded-full bg-slate-300 transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-brand-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2 dark:bg-slate-600"
          />
          <span>{s.enabled ? 'On' : 'Off'}</span>
          <span className="sr-only">Reminders</span>
        </label>
      </div>

      <fieldset disabled={!s.enabled} className="space-y-4 disabled:opacity-50">
        <div>
          <label htmlFor={`${id}-lead`} className="label">
            Remind me
          </label>
          <select id={`${id}-lead`} className="input" value={s.lead} onChange={(e) => update({ lead: Number(e.target.value) })}>
            {LEAD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tasks with a date but no time remind you at 9:00 AM that day.</p>
        </div>

        <div role="radiogroup" aria-labelledby={`${id}-sound`}>
          <p id={`${id}-sound`} className="label">
            Sound
          </p>
          <div className="flex flex-wrap gap-2">
            {SOUNDS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={s.sound === o.value}
                className={chip(s.sound === o.value)}
                onClick={() => {
                  unlockAudio();
                  update({ sound: o.value });
                  playSound(o.value); // preview
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <label className={`flex items-start gap-3 ${voice ? 'cursor-pointer' : ''}`}>
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 rounded accent-brand-600"
            checked={voice && readAloud}
            disabled={!voice}
            onChange={(e) => {
              setReadAloud(e.target.checked);
              if (e.target.checked) speak('Reminder. Pay the bills is due now.');
            }}
          />
          <span>
            <span className="font-medium">Read aloud</span>
            <span className="block text-sm text-slate-600 dark:text-slate-400">
              {voice
                ? 'Your device says reminders, confirmations (“Added Job, tomorrow at 9:00 AM”) and answers out loud. Also switchable with 🔊 in New task.'
                : 'Reading aloud isn’t supported in this browser.'}
            </span>
          </span>
        </label>

        {readAloud && <VoiceChoice />}

        {native && <PhoneNotifications />}

        {!native && permission !== 'unsupported' && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
            <span>
              <span className="font-medium">Notifications</span>
              <span className="block text-slate-600 dark:text-slate-400">
                {permission === 'granted'
                  ? 'On. You’ll also get a notification when DoNext is in a background tab.'
                  : permission === 'denied'
                    ? 'Blocked. Allow notifications for this site in your browser settings.'
                    : 'Also show a notification when DoNext is in a background tab.'}
              </span>
            </span>
            {permission === 'default' && (
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-sm"
                onClick={() => void Notification.requestPermission().then(setPermission, () => undefined)}
              >
                Allow
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            unlockAudio();
            testReminder();
          }}
        >
          <BellIcon width={18} height={18} /> Test reminder
        </button>
      </fieldset>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {native ? (
          <>
            Reminders ring as phone notifications, even when DoNext is closed. Read-aloud works while the app is open, or when you tap a
            reminder.
          </>
        ) : (
          <>
            Sound and read-aloud work while DoNext is open, even in a background tab. To be alerted when it's closed, use{' '}
            <strong>📅 Add to calendar</strong> on a task: your calendar app will ring at the time you choose.
          </>
        )}
      </p>
    </section>
  );
}

/** Phone app: notification permission and exact-time alarms (Android 12+). */
function PhoneNotifications() {
  const [perm, setPerm] = useState<NotifyPermission | null>(null);
  const [exact, setExact] = useState(true);

  const refresh = () => {
    void notificationPermission().then(setPerm);
    void exactAlarmsAllowed().then(setExact);
  };
  useEffect(refresh, []);
  // Coming back from the system settings screen.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const row = 'flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60';
  return (
    <div className="space-y-2">
      <div className={row}>
        <span>
          <span className="font-medium">Phone notifications</span>
          <span className="block text-slate-600 dark:text-slate-400">
            {perm === 'granted'
              ? 'On. Reminders ring even when DoNext is closed.'
              : perm === 'denied'
                ? 'Off. Turn on notifications for DoNext in your phone’s Settings → Apps → DoNext → Notifications.'
                : 'Allow notifications so reminders ring even when DoNext is closed.'}
          </span>
        </span>
        {perm === 'prompt' && (
          <button
            type="button"
            className="btn-secondary px-4 py-2 text-sm"
            onClick={() => void requestNotificationPermission().then((p) => {
              setPerm(p);
              window.dispatchEvent(new Event('donext:reminder-settings')); // reschedule
            })}
          >
            Allow
          </button>
        )}
      </div>
      {perm === 'granted' && !exact && (
        <div className={row}>
          <span>
            <span className="font-medium">Exact times</span>
            <span className="block text-slate-600 dark:text-slate-400">
              Allow “Alarms &amp; reminders” so reminders ring exactly on time instead of a few minutes late.
            </span>
          </span>
          <button
            type="button"
            className="btn-secondary px-4 py-2 text-sm"
            onClick={() => void openExactAlarmSettings().then((ok) => {
              setExact(ok);
              window.dispatchEvent(new Event('donext:reminder-settings'));
            })}
          >
            Allow
          </button>
        </div>
      )}
    </div>
  );
}
