import { canSpeak, speak } from '../lib/sound';
import { useReadAloud } from '../lib/voicePrefs';
import { SpeakerIcon, SpeakerOffIcon } from './Icons';

/** 🔊/🔇 switch for reading confirmations, answers and reminders aloud. */
export function ReadAloudToggle({ className = '' }: { className?: string }) {
  const [on, setOn] = useReadAloud();
  if (!canSpeak()) return null;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => {
        setOn(!on);
        if (!on) speak('Read aloud is on.');
      }}
      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors ${
        on
          ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-slate-600 dark:bg-slate-800 dark:text-brand-300'
          : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
      } ${className}`}
      title={on ? 'Read aloud is on' : 'Read aloud is off'}
    >
      {on ? <SpeakerIcon width={18} height={18} /> : <SpeakerOffIcon width={18} height={18} />}
      Read aloud {on ? 'on' : 'off'}
    </button>
  );
}
