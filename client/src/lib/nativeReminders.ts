import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { reminderMoment, reminderText, type ReminderSettings } from './reminders';
import type { Task } from './types';

/**
 * Phone notifications for reminders (Android/iOS app): scheduled on the device with the
 * system alarm service, so they ring at reminder time even when DoNext is closed.
 * The in-app card, sound and read-aloud (ReminderCenter) still work while the app is open.
 */
export const hasNativeNotifications = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');

export type NotifyPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

const CHANNEL = 'reminders';
/** Android limits pending alarms per app; the next 60 reminders are plenty (re-planned on every change). */
const MAX_SCHEDULED = 60;

/** Set once permission is known to be granted: the system notification then plays the sound. */
export let nativeNotificationsActive = false;

export async function notificationPermission(): Promise<NotifyPermission> {
  if (!hasNativeNotifications()) return 'unsupported';
  try {
    const { display } = await LocalNotifications.checkPermissions();
    nativeNotificationsActive = display === 'granted';
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
  } catch {
    return 'unsupported';
  }
}

export async function requestNotificationPermission(): Promise<NotifyPermission> {
  if (!hasNativeNotifications()) return 'unsupported';
  const { display } = await LocalNotifications.requestPermissions();
  nativeNotificationsActive = display === 'granted';
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt';
}

/** Android 12+: reminders ring exactly on time only if "Alarms & reminders" is allowed. */
export async function exactAlarmsAllowed(): Promise<boolean> {
  if (Capacitor.getPlatform() !== 'android') return true;
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    return true;
  }
}

/** Opens the system screen where the user can allow exact alarms for DoNext. */
export async function openExactAlarmSettings(): Promise<boolean> {
  try {
    return (await LocalNotifications.changeExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    return false;
  }
}

let channelReady = false;
async function ensureChannel() {
  if (channelReady || Capacitor.getPlatform() !== 'android') return;
  await LocalNotifications.createChannel({
    id: CHANNEL,
    name: 'Reminders',
    description: 'Task reminders',
    importance: 5, // heads-up with sound
    visibility: 1,
    sound: 'chime.wav', // res/raw/chime.wav
    vibration: true,
    lights: true,
    lightColor: '#006FEF',
  });
  channelReady = true;
}

/** A stable notification id (positive 31-bit int) for a task. */
export function notificationId(taskId: string): number {
  let h = 0;
  for (let i = 0; i < taskId.length; i++) h = (Math.imul(h, 31) + taskId.charCodeAt(i)) | 0;
  return (Math.abs(h) % 2_000_000_000) + 1;
}

/** Upcoming reminders to schedule, soonest first. */
export function plannedReminders(tasks: Task[], settings: ReminderSettings, now = new Date()) {
  if (!settings.enabled) return [];
  return tasks
    .filter((t) => !t.completed && !t.deletedAt)
    .map((task) => ({ task, at: reminderMoment(task, settings) }))
    .filter((x): x is { task: Task; at: Date } => !!x.at && x.at.getTime() > now.getTime() + 5_000)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);
}

let running: Promise<void> = Promise.resolve();

/** Replaces all scheduled reminder notifications with the current plan. Calls are queued, never overlap. */
export function syncNativeReminders(tasks: Task[], settings: ReminderSettings): Promise<void> {
  running = running.then(async () => {
    if (!hasNativeNotifications()) return;
    try {
      if ((await notificationPermission()) !== 'granted') return;
      await ensureChannel();
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) {
        await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      }
      const plan = plannedReminders(tasks, settings);
      if (!plan.length) return;
      await LocalNotifications.schedule({
        notifications: plan.map(({ task, at }) => ({
          id: notificationId(task.id),
          title: task.title,
          body: reminderText(task, at),
          channelId: CHANNEL,
          sound: 'chime.wav',
          smallIcon: 'ic_stat_donext',
          iconColor: '#006FEF',
          schedule: { at, allowWhileIdle: true },
          extra: { taskId: task.id },
        })),
      });
    } catch (err) {
      console.warn('Could not schedule reminders', err);
    }
  });
  return running;
}

/** Calls `onOpen(taskId)` when the user taps a reminder notification. */
export function onReminderTapped(onOpen: (taskId: string) => void): () => void {
  if (!hasNativeNotifications()) return () => undefined;
  const handle = LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    const id = (e.notification.extra as { taskId?: string } | undefined)?.taskId;
    if (id) onOpen(id);
  });
  return () => void handle.then((h) => h.remove());
}
