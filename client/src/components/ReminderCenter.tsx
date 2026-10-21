import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTasks } from '../context/TasksContext';
import { api, IS_LOCAL } from '../lib/api';
import { formatDueDate, formatTime } from '../lib/filters';
import {
  dueReminders,
  loadReminderSettings,
  loadReminderState,
  reminderText,
  saveReminderState,
  type ReminderState,
} from '../lib/reminders';
import {
  hasNativeNotifications,
  nativeNotificationsActive,
  notificationPermission,
  onReminderTapped,
  plannedReminders,
  requestNotificationPermission,
  syncNativeReminders,
} from '../lib/nativeReminders';
import { playSound, speak, unlockAudio } from '../lib/sound';
import { storage } from '../lib/storage';
import { readAloudEnabled } from '../lib/voicePrefs';

const NOTIFY_ASKED = 'dt.notifyAsked';

/**
 * Local app: phone reminders ring for everyone on this device, not just the person who has the
 * app open. With several people, each reminder starts with the person's name ("Sara: Dentist").
 */
async function everyonesTasks(mine: Task[]): Promise<Task[]> {
  if (!IS_LOCAL || !api.localAllTasks) return mine;
  try {
    const { tasks } = await api.localAllTasks();
    const people = new Set(tasks.map((t) => t.createdBy));
    return tasks.map(({ ownerName, ...t }) => (people.size > 1 && ownerName ? { ...t, title: `${ownerName}: ${t.title}` } : t));
  } catch {
    return mine;
  }
}
import type { Task } from '../lib/types';
import { BellIcon, CloseIcon } from './Icons';

interface Shown {
  key: string;
  task: Pick<Task, 'id' | 'title' | 'dueDate' | 'dueTime'>;
  text: string;
  test?: boolean;
}

const CHECK_EVERY_MS = 20_000;
export const SNOOZE_MINUTES = 10;

/** Fires a test reminder (from the settings). */
export const testReminder = () => window.dispatchEvent(new Event('donext:test-reminder'));

/**
 * Watches due tasks while DoNext is open and, at reminder time, plays a sound, can read the
 * reminder aloud, and shows a card with Done / Snooze. In a background tab it also shows a
 * system notification if the user allowed them.
 */
export function ReminderCenter() {
  const { store, tasks } = useTasks();
  const [shown, setShown] = useState<Shown[]>([]);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const alert = useCallback((items: Shown[]) => {
    if (!items.length) return;
    const settings = loadReminderSettings();
    setShown((s) => [...s.filter((x) => !items.some((i) => i.key === x.key)), ...items]);
    // In the phone app the system notification already plays the chime.
    const systemRings = nativeNotificationsActive && items.some((i) => !i.test);
    if (!systemRings) playSound(settings.sound);
    if (readAloudEnabled()) speak(items.map((i) => `Reminder. ${i.text}`).join(' '), settings.sound === 'none' ? 0 : 900);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
      for (const i of items) {
        try {
          new Notification('DoNext reminder', { body: i.text, tag: i.key, icon: `${import.meta.env.BASE_URL}icons/icon-192.png` });
        } catch {
          /* some browsers only allow notifications from a service worker */
        }
      }
    }
  }, []);

  const check = useCallback(() => {
    const now = new Date();
    const state = loadReminderState(now.getTime());
    const due = dueReminders(tasksRef.current, now, loadReminderSettings(), state);
    if (!due.length) return;
    for (const { key } of due) {
      state.fired[key] = now.getTime();
      delete state.snoozed[key];
    }
    saveReminderState(state);
    alert(due.map(({ task, key }) => ({ key, task, text: reminderText(task, now) })));
  }, [alert]);

  useEffect(() => {
    // Browsers only allow sound after the first tap or key press.
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    const onTest = () =>
      alert([
        {
          key: `test-${Date.now()}`,
          task: { id: '', title: 'Test reminder', dueDate: null, dueTime: null },
          text: 'This is how your reminders will look and sound.',
          test: true,
        },
      ]);
    window.addEventListener('donext:test-reminder', onTest);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    const id = setInterval(check, CHECK_EVERY_MS);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('donext:test-reminder', onTest);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(id);
    };
  }, [alert, check]);

  // Check soon after tasks load or change.
  useEffect(() => {
    if (!store) return;
    const id = setTimeout(check, 500);
    return () => clearTimeout(id);
  }, [store, tasks, check]);

  // Phone app: (re)schedule system notifications so reminders ring even when DoNext is closed.
  const [settingsVersion, setSettingsVersion] = useState(0);
  useEffect(() => {
    const onSettings = () => setSettingsVersion((v) => v + 1);
    window.addEventListener('donext:reminder-settings', onSettings);
    return () => window.removeEventListener('donext:reminder-settings', onSettings);
  }, []);
  useEffect(() => {
    if (!store || !hasNativeNotifications()) return;
    const id = setTimeout(() => {
      void (async () => {
        const settings = loadReminderSettings();
        // Ask for notification permission the first time there's a reminder to deliver.
        if (plannedReminders(tasks, settings).length && !storage.get<boolean>(NOTIFY_ASKED)) {
          storage.set(NOTIFY_ASKED, true);
          if ((await notificationPermission()) === 'prompt') await requestNotificationPermission();
        }
        await syncNativeReminders(await everyonesTasks(tasks), settings);
      })();
    }, 800);
    return () => clearTimeout(id);
  }, [store, tasks, settingsVersion]);

  // Tapping a reminder notification opens the app on its reminder card.
  useEffect(
    () =>
      onReminderTapped((taskId) => {
        const task = tasksRef.current.find((t) => t.id === taskId);
        if (task) setShown((s) => [...s.filter((x) => x.task.id !== taskId), { key: `tap-${taskId}-${Date.now()}`, task, text: reminderText(task) }]);
      }),
    [],
  );

  const close = (key: string) => setShown((s) => s.filter((x) => x.key !== key));

  const snooze = (item: Shown) => {
    if (!item.test) {
      const state: ReminderState = loadReminderState();
      state.snoozed[item.key] = Date.now() + SNOOZE_MINUTES * 60_000;
      saveReminderState(state);
    }
    close(item.key);
  };

  if (!shown.length) return null;

  return (
    <div
      className="safe-pb-3 pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 px-3"
      aria-live="assertive"
    >
      {shown.map((item) => (
        <div
          key={item.key}
          role="alert"
          className="pointer-events-auto w-full max-w-md rounded-2xl border border-amber-300 bg-white p-4 shadow-2xl dark:border-amber-700 dark:bg-slate-900"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 motion-safe:animate-ring items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
              <BellIcon />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Reminder</p>
              <p className="break-words font-semibold">{item.task.title}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {item.task.dueDate
                  ? `Due ${formatDueDate(item.task.dueDate)}${item.task.dueTime ? `, ${formatTime(item.task.dueTime)}` : ''}`
                  : item.text}
              </p>
            </div>
            <button
              type="button"
              className="-m-2 flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              aria-label="Dismiss reminder"
              onClick={() => close(item.key)}
            >
              <CloseIcon width={18} height={18} />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 pl-[3.25rem]">
            {!item.test && store && (
              <button
                type="button"
                className="btn-primary px-4 py-2 text-sm"
                onClick={() => {
                  void store.update(item.task.id, { completed: true }).catch(() => undefined);
                  close(item.key);
                }}
              >
                Mark done
              </button>
            )}
            <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={() => snooze(item)}>
              Snooze {SNOOZE_MINUTES} min
            </button>
            {item.test && (
              <Link to="/account#reminders" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300" onClick={() => close(item.key)}>
                Settings
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
