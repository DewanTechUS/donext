import type { ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Link } from 'react-router-dom';
import { IS_LOCAL } from '../lib/api';
import { APP_NAME, COMPANY_LEGAL_NAME, LEGAL } from '../lib/brand';

const faqs: { q: string; a: ReactNode; webOnly?: boolean; serverOnly?: boolean }[] = [
  {
    q: 'How do I add a task by voice?',
    a: (
      <>
        Tap <strong>New task</strong>, then the microphone. Speak your task — the words appear as you talk. Say <strong>“add it”</strong> at
        the end to save it hands-free, or fix anything by typing and tap the arrow. Dates, times, priority and reminders you mention are
        filled in for you.
      </>
    ),
  },
  {
    q: 'What can I say?',
    a: (
      <ul className="list-disc space-y-1 pl-5">
        <li>“Hey DoNext, I have a job tomorrow at 9, priority high, remind me 1 hour before. Add it.”</li>
        <li>“Dentist Friday at 3pm, remind me 30 minutes before.”</li>
        <li>“Pay rent, due date October 30, no reminder.”</li>
        <li>“Pack for the trip with sub-items passport, charger and tickets.”</li>
        <li>“Milk, eggs and bread” (becomes a grocery list)</li>
        <li>“What do I have today?” · “What’s due tomorrow?” · “Anything overdue?”</li>
        <li>“Mark the job as done.” · “I finished the report.”</li>
      </ul>
    ),
  },
  {
    q: 'The microphone isn’t working.',
    a: (
      <>
        Make sure microphone access is allowed. <strong>In a browser:</strong> tap the lock icon in the address bar and allow the microphone.{' '}
        <strong>iPhone/iPad app:</strong> Settings → {APP_NAME} → turn on Microphone and Speech Recognition.{' '}
        <strong>Android app:</strong> Settings → Apps → {APP_NAME} → Permissions → Microphone. Voice input isn’t available in some browsers
        (such as Firefox) — you can always type instead.
      </>
    ),
  },
  {
    q: 'Does it work without internet?',
    a: IS_LOCAL
      ? 'Yes. Everything is stored on your device, so the app works fully offline. Voice input may need a connection, depending on your phone’s speech service.'
      : 'Yes. You can add, edit, complete and delete tasks offline. Changes are saved on your device and sync automatically when you reconnect. The menu shows how many changes are waiting.',
  },
  {
    q: 'How do I use it on several devices?',
    serverOnly: true,
    a: 'Log in with the same account on each device. Your tasks sync between them. If the same task is edited on two devices, the most recent change is kept.',
  },
  {
    q: 'I forgot my password.',
    serverOnly: true,
    a: (
      <>
        On the log in screen, tap <Link to="/forgot-password" className="font-semibold underline">Forgot password?</Link> and we’ll email you a
        link to choose a new one.
      </>
    ),
  },
  {
    q: 'How do I download or delete my data?',
    a: IS_LOCAL ? (
      <>
        Your tasks are stored only on this device. To delete everything, go to <Link to="/account" className="font-semibold underline">Account</Link>{' '}
        and tap <strong>Erase all data</strong>, or uninstall the app.
      </>
    ) : (
      <>
        Go to <Link to="/account" className="font-semibold underline">Account</Link>. Use <strong>Download my data</strong> for a copy of
        everything, or <strong>Delete account</strong> to permanently erase your account and all tasks.
      </>
    ),
  },
  {
    q: 'How do I install it on my phone?',
    webOnly: true,
    a: 'iPhone (Safari): tap Share → Add to Home Screen. Android (Chrome): tap ⋮ → Install app. It then opens like a regular app and works offline.',
  },
];

export default function SupportPage() {
  const email = LEGAL.supportEmail.trim();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Help & Support</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Answers to common questions about {APP_NAME}.</p>
      </div>

      <section aria-labelledby="faq-h">
        <h2 id="faq-h" className="sr-only">
          Frequently asked questions
        </h2>
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {faqs.filter((f) => !(f.webOnly && Capacitor.isNativePlatform()) && !(f.serverOnly && IS_LOCAL)).map(({ q, a }) => (
            <details key={q} className="group">
              <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 px-5 font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="text-xl text-slate-400 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="px-5 pb-5 text-slate-600 dark:text-slate-300">{a}</div>
            </details>
          ))}
        </div>
      </section>

      <section className="card space-y-2 p-5" aria-labelledby="contact-h">
        <h2 id="contact-h" className="text-lg font-semibold">
          Still need help?
        </h2>
        {email ? (
          <>
            <dl className="grid gap-x-4 gap-y-1 text-slate-600 dark:text-slate-300 sm:grid-cols-[10rem_1fr]">
              <dt className="font-medium text-slate-800 dark:text-slate-100">Support</dt>
              <dd>
                <a
                  href={`mailto:${email}?subject=${encodeURIComponent(`${APP_NAME} support`)}`}
                  className="font-semibold text-brand-700 underline dark:text-brand-300"
                >
                  {email}
                </a>
              </dd>
              {LEGAL.infoEmail && (
                <>
                  <dt className="font-medium text-slate-800 dark:text-slate-100">General information</dt>
                  <dd>
                    <a href={`mailto:${LEGAL.infoEmail}`} className="font-semibold text-brand-700 underline dark:text-brand-300">
                      {LEGAL.infoEmail}
                    </a>
                  </dd>
                </>
              )}
            </dl>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              We aim to respond within a reasonable timeframe. Response times are not guaranteed.
            </p>
          </>
        ) : (
          <p className="text-slate-600 dark:text-slate-300">
            Email us at <mark className="placeholder-mark">[SUPPORT CONTACT EMAIL — set LEGAL.supportEmail in client/src/lib/brand.ts]</mark>.
          </p>
        )}
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {APP_NAME} is provided by {COMPANY_LEGAL_NAME}. See our <Link to="/privacy" className="underline">Privacy Policy</Link> and{' '}
          <Link to="/terms" className="underline">Terms of Service</Link>.
        </p>
      </section>
    </div>
  );
}
