import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from 'react';
import { KEYS, storage } from '../lib/storage';
import { SpeechError, speechErrorMessage, speechService, type SpeechService, type SpeechSession } from '../lib/speech';
import { Alert } from './Alert';
import { ArrowUpIcon, MicIcon, StopIcon } from './Icons';
import { Spinner } from './Spinner';

type Phase = 'idle' | 'explain' | 'starting' | 'listening';

interface VoiceInputProps {
  /** Text in the composer box (the task title). */
  value: string;
  onChange: (text: string) => void;
  /** Listening stopped after hearing something; gets the final text (for hands-free commands). */
  onSpeechEnd?: (text: string) => void;
  /** Start listening right away. */
  autoStart?: boolean;
  /** id for the text box, so labels and error messages can point at it. */
  inputId: string;
  /** Validation error for the text, shown under the box. */
  error?: string;
  /** Disables the send arrow while the task is being saved. */
  submitting?: boolean;
  /** Injected for tests. */
  speech?: SpeechService;
}

/**
 * Chat-style voice composer: a large centred mic, a text box that fills in live
 * while you speak, and a send arrow. Nothing is saved until the arrow (or Enter)
 * submits the surrounding form, so the box doubles as the editable preview and
 * as the typing fallback when voice isn't available.
 */
export const VoiceInput = forwardRef<HTMLTextAreaElement | null, VoiceInputProps>(function VoiceInput(
  { value, onChange, onSpeechEnd, autoStart, inputId, error, submitting, speech = speechService },
  ref,
) {
  const support = speech.support();
  const [phase, setPhase] = useState<Phase>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => textRef.current as HTMLTextAreaElement);

  const session = useRef<SpeechSession | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const baseRef = useRef(''); // text that was already in the box when listening started
  const heardRef = useRef(false);
  const erroredRef = useRef(false);
  const ignoreRef = useRef(false); // set when the user sends or edits mid-dictation
  const heardTextRef = useRef(''); // latest text, including what was heard (state may lag behind)

  const listening = phase === 'listening' || phase === 'starting';

  useEffect(() => () => session.current?.stop(), []);

  // Opened from the mic button: start listening (after the one-time explanation, if needed).
  useEffect(() => {
    if (autoStart && support !== 'none') void onMicClick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Grow the box with its content, like a chat composer.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const stopListening = (discardLateResults: boolean) => {
    if (discardLateResults) ignoreRef.current = true;
    session.current?.stop();
  };

  const begin = async () => {
    storage.set(KEYS.micExplained, true);
    setNotice(null);
    const current = valueRef.current.trim();
    baseRef.current = current ? `${current} ` : '';
    heardRef.current = false;
    erroredRef.current = false;
    ignoreRef.current = false;
    setPhase('starting');
    try {
      session.current = await speech.start({
        onTranscript: (text) => {
          if (ignoreRef.current) return;
          heardRef.current = true;
          heardTextRef.current = `${baseRef.current}${text}`.slice(0, 200);
          onChange(heardTextRef.current);
          setPhase('listening');
        },
        onError: (err) => {
          erroredRef.current = true;
          setNotice(speechErrorMessage(err.code, support));
        },
        onEnd: () => {
          session.current = null;
          if (!heardRef.current && !erroredRef.current && !ignoreRef.current) {
            setNotice(speechErrorMessage('no-speech', support));
          }
          setPhase('idle');
          if (heardRef.current && !ignoreRef.current) onSpeechEnd?.(heardTextRef.current);
        },
      });
      setPhase((p) => (p === 'starting' ? 'listening' : p));
    } catch (err) {
      setNotice(speechErrorMessage(err instanceof SpeechError ? err.code : 'unknown', support));
      session.current = null;
      setPhase('idle');
    }
  };

  const onMicClick = async () => {
    if (listening) return stopListening(false);
    const permission = await speech.permission();
    if (permission === 'denied' && support === 'web') {
      setNotice(speechErrorMessage('permission-denied', support));
      return;
    }
    if (permission !== 'granted' && !storage.get<boolean>(KEYS.micExplained)) {
      setPhase('explain');
      return;
    }
    void begin();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter is ignored (titles are single-line).
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!e.shiftKey && value.trim()) {
        if (listening) stopListening(true);
        e.currentTarget.form?.requestSubmit();
      }
    }
  };

  const status =
    phase === 'starting'
      ? 'Starting microphone…'
      : phase === 'listening'
        ? 'Listening… take your time. Say “add it” to save, or tap stop'
        : support === 'none'
          ? "Voice isn't available in this browser — type your task below"
          : value.trim()
            ? 'Tap the mic to keep talking, or the arrow to add your task'
            : 'Tap the mic and say your task';

  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-4">
      {support !== 'none' && (
        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="relative flex h-24 w-24 items-center justify-center">
            {listening && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/25" aria-hidden />}
            <button
              type="button"
              onClick={() => void onMicClick()}
              aria-pressed={listening}
              aria-label={listening ? 'Stop listening' : 'Speak your task'}
              className={`relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-colors ${
                listening ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
              }`}
            >
              {phase === 'starting' ? (
                <Spinner className="h-7 w-7" label="Starting microphone" />
              ) : listening ? (
                <StopIcon width={28} height={28} />
              ) : (
                <MicIcon width={34} height={34} />
              )}
            </button>
          </div>

          <div className="flex h-6 items-center gap-1" aria-hidden>
            {phase === 'listening' &&
              [0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="h-6 w-1.5 origin-center animate-wave rounded-full bg-red-500"
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
              ))}
          </div>
        </div>
      )}

      <p className="text-center text-sm text-slate-600 dark:text-slate-400" aria-live="polite">
        {status}
      </p>

      {phase === 'explain' && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="mb-2 font-semibold text-slate-900 dark:text-white">Allow microphone access?</p>
          <p className="mb-3 text-slate-700 dark:text-slate-300">
            Your {support === 'native' ? 'device' : 'browser'} will ask for permission to use the microphone
            {support === 'native' ? ' and speech recognition' : ''}. Speech is turned into text by your{' '}
            {support === 'native' ? "device's" : "browser's"} speech service
            {support === 'web' ? ' (some browsers, such as Chrome, send audio to their provider)' : ''}. DoNext
            never records or stores audio — only the text you send.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-primary" onClick={() => void begin()}>
              Continue
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setPhase('idle');
                textRef.current?.focus();
              }}
            >
              Type instead
            </button>
          </div>
        </div>
      )}

      {notice && (
        <Alert kind="warning" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <div>
        <label htmlFor={inputId} className="sr-only">
          Task
        </label>
        <div
          className={`flex items-end gap-2 rounded-3xl border bg-white p-2 pl-4 transition-colors focus-within:border-brand-500 dark:bg-slate-900 ${
            error
              ? 'border-red-500'
              : listening
                ? 'border-red-400 dark:border-red-500'
                : 'border-slate-300 dark:border-slate-600'
          }`}
        >
          <textarea
            id={inputId}
            ref={textRef}
            rows={1}
            value={value}
            maxLength={200}
            onChange={(e) => {
              // Typing while dictating: stop the mic so speech doesn't overwrite the edit.
              if (listening) stopListening(true);
              onChange(e.target.value);
            }}
            onKeyDown={onKeyDown}
            placeholder={listening ? 'Listening…' : support === 'none' ? 'Type your task' : 'Speak or type your task'}
            enterKeyHint="send"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className="max-h-[200px] min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-lg leading-snug text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-slate-100"
          />
          <button
            type="submit"
            aria-label="Add task"
            disabled={!value.trim() || submitting}
            onClick={() => {
              if (listening) stopListening(true);
            }}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-700"
          >
            {submitting ? <Spinner className="h-5 w-5" label="Adding task" /> : <ArrowUpIcon width={24} height={24} strokeWidth={2.5} />}
          </button>
        </div>
        {error && (
          <p id={errorId} className="field-error px-4">
            {error}
          </p>
        )}
      </div>
    </div>
  );
});
