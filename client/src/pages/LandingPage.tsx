import { useState, type ComponentType, type FormEvent, type SVGProps } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Alert } from '../components/Alert';
import { AppLogo, AuthorLine } from '../components/Brand';
import { CheckIcon, CloudIcon, MicIcon, ShieldIcon } from '../components/Icons';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { IS_DEMO, IS_LOCAL } from '../lib/api';
import { APP_NAME, REPO_URL } from '../lib/brand';

/** Inside the iOS/Android app, browser-only tips (Add to Home Screen) don't apply. */
const isNativeApp = Capacitor.isNativePlatform();

const features: { title: string; text: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { title: 'Just say it', text: 'Tap the mic and talk — your words appear as you speak. Fix anything, then tap the arrow.', Icon: MicIcon },
  { title: 'Works offline', text: 'Add and edit tasks with no connection. Everything syncs when you are back online.', Icon: CloudIcon },
  { title: 'Stay organised', text: 'Due dates, priorities, categories, search and filters keep the right task next.', Icon: CheckIcon },
  { title: 'Private by design', text: 'Your tasks are visible only to you. We never sell your data or record your voice.', Icon: ShieldIcon },
];

/** First screen of the app-store app: no account, just a name and "Get started". */
function LocalWelcome() {
  const { startLocal } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const begin = async (e: FormEvent) => {
    e.preventDefault();
    setStarting(true);
    setError(null);
    try {
      await startLocal(name);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get started. Please try again.');
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-6 text-center sm:py-12">
      <AppLogo size={96} />
      <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-brand-900 dark:text-white">
        Know what to <span className="text-brand-600 dark:text-brand-400">do next</span>.
      </h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
        The to-do list you can talk to. Say <em>“I have a job tomorrow at 9, priority high, remind me 1 hour before”</em> and it’s
        done.
      </p>

      <ul className="mt-8 w-full space-y-3 text-left">
        {[
          { Icon: MicIcon, text: 'Add and manage tasks with your voice' },
          { Icon: CheckIcon, text: 'Due dates, priorities, sub-items and reminders' },
          { Icon: ShieldIcon, text: 'Private: your tasks stay on this device. No account needed.' },
        ].map(({ Icon, text }) => (
          <li key={text} className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-300">
              <Icon width={20} height={20} />
            </span>
            <span className="text-slate-700 dark:text-slate-200">{text}</span>
          </li>
        ))}
      </ul>

      <form onSubmit={(e) => void begin(e)} className="mt-8 w-full space-y-3 text-left">
        <div>
          <label htmlFor="welcome-name" className="label">
            What should we call you? <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
          </label>
          <input
            id="welcome-name"
            className="input"
            value={name}
            maxLength={80}
            autoComplete="given-name"
            placeholder="Your first name"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {error && <Alert onDismiss={() => setError(null)}>{error}</Alert>}
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
          <strong>Your tasks are saved only on this device.</strong> We can’t back them up or recover them. Uninstalling the app,
          clearing its data or changing phones deletes them, so you’re responsible for keeping anything important.
        </p>
        <button type="submit" className="btn-primary w-full text-lg" disabled={starting}>
          {starting && <Spinner className="h-5 w-5" label="Getting started" />}
          Get started
        </button>
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          By continuing you agree to the{' '}
          <Link to="/terms" className="underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>

      <footer className="mt-10 flex flex-col items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <AuthorLine />
      </footer>
    </div>
  );
}

/** Public home page for visitors who are not signed in. */
export default function LandingPage() {
  if (IS_LOCAL) return <LocalWelcome />;
  return <WebLanding />;
}

function WebLanding() {
  const { startDemo } = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tryDemo = async () => {
    setStarting(true);
    setError(null);
    try {
      await startDemo();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the demo.');
      setStarting(false);
    }
  };

  return (
    <div className="space-y-14 py-4 sm:py-10">
      <section className="flex flex-col items-center text-center">
        <AppLogo size={96} />
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-brand-900 dark:text-white sm:text-5xl">
          Know what to <span className="text-brand-600 dark:text-brand-400">do next</span>.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-300">
          {APP_NAME} is the simple to-do list you can talk to. Capture tasks by voice or typing on your phone, tablet or computer — online
          or offline.
        </p>
        <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          {IS_DEMO ? (
            <>
              <button type="button" className="btn-primary px-8 text-lg" onClick={() => void tryDemo()} disabled={starting}>
                {starting && <Spinner className="h-5 w-5" label="Starting demo" />}
                Try it instantly — no sign-up
              </button>
              <Link to="/signup" className="btn-secondary px-8 text-lg">
                Create an account
              </Link>
            </>
          ) : (
            <>
              <Link to="/signup" className="btn-primary px-8 text-lg">
                Get started — it’s free
              </Link>
              <Link to="/login" className="btn-secondary px-8 text-lg">
                Log in
              </Link>
            </>
          )}
        </div>
        {IS_DEMO && (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Open source · MIT License ·{' '}
            <a href={REPO_URL} rel="noopener" className="font-semibold text-brand-700 underline dark:text-brand-300">
              View the code on GitHub
            </a>
          </p>
        )}
        {error && (
          <Alert className="mt-4 w-full max-w-md text-left" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
      </section>

      <section aria-labelledby="features-h">
        <h2 id="features-h" className="sr-only">
          Features
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {features.map(({ title, text, Icon }) => (
            <li key={title} className="card flex gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-slate-800 dark:text-brand-300">
                <Icon width={24} height={24} />
              </span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card flex flex-col items-center gap-4 bg-gradient-to-br from-brand-900 to-brand-700 p-8 text-center text-white dark:from-brand-900 dark:to-slate-900">
        {isNativeApp ? (
          <>
            <h2 className="text-2xl font-bold">Your tasks, everywhere</h2>
            <p className="max-w-lg text-brand-100">
              Sign in on your phone, tablet or computer — your tasks and shared lists stay in sync, even after working offline.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold">Install it like an app</h2>
            <p className="max-w-lg text-brand-100">
              On your phone, open {APP_NAME} in your browser and choose <strong>Add to Home Screen</strong> (iPhone: Share menu · Android:
              ⋮ menu). It opens full-screen and works offline.
            </p>
          </>
        )}
        <Link to="/signup" className="btn bg-white text-brand-900 hover:bg-brand-50">
          Create your free account
        </Link>
      </section>

      <footer className="flex flex-col items-center gap-1.5 border-t border-slate-200 pt-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 lg:hidden">
        <AuthorLine />
      </footer>
    </div>
  );
}
