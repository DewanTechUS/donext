import { useEffect, useId, useState } from 'react';
import { canSpeak, listVoices, speak, type VoiceOption } from '../lib/sound';
import { loadVoicePrefs, saveVoicePrefs, SPEEDS, type VoicePrefs } from '../lib/voicePrefs';

const chip = (active: boolean) =>
  `min-h-[40px] rounded-full border px-4 text-sm font-medium transition-colors ${
    active
      ? 'border-brand-600 bg-brand-600 text-white'
      : 'border-slate-200 text-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
  }`;

const SAMPLE = 'Job, tomorrow at 9 AM. High priority. I’ll remind you 1 hour before.';

/** Pick the voice and speed for reading aloud; try them with "Test voice". */
export function VoiceChoice() {
  const [prefs, setPrefs] = useState<VoicePrefs>(loadVoicePrefs);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const id = useId();

  useEffect(() => {
    void listVoices().then(setVoices, () => setVoices([]));
  }, []);

  if (!canSpeak()) return null;

  const update = (patch: Partial<VoicePrefs>, test = true) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveVoicePrefs(next);
    if (test) speak(SAMPLE);
  };

  return (
    <div className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      {voices.length > 1 && (
        <div>
          <label htmlFor={`${id}-voice`} className="label">
            Voice
          </label>
          <select id={`${id}-voice`} className="input" value={prefs.voiceId} onChange={(e) => update({ voiceId: e.target.value })}>
            <option value="">Phone’s default voice</option>
            {voices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Try a few: some voices sound much more natural than others.</p>
        </div>
      )}
      <div role="radiogroup" aria-labelledby={`${id}-speed`}>
        <p id={`${id}-speed`} className="label">
          Speaking speed
        </p>
        <div className="flex flex-wrap gap-2">
          {SPEEDS.map((s) => (
            <button key={s.value} type="button" role="radio" aria-checked={prefs.rate === s.value} className={chip(prefs.rate === s.value)} onClick={() => update({ rate: s.value })}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="btn-secondary" onClick={() => speak(SAMPLE)}>
        Test voice
      </button>
    </div>
  );
}
