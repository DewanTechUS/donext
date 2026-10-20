import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as NativeSpeech } from '@capacitor-community/speech-recognition';

/**
 * Voice-to-text abstraction.
 *  - Native iOS/Android (Capacitor): @capacitor-community/speech-recognition (on-device OS recognisers).
 *  - Browsers: the Web Speech API (Chrome, Edge, Safari). Note that Chrome sends audio to Google's servers.
 *  - Otherwise: unsupported → the UI falls back to typing.
 */

export type SpeechSupport = 'native' | 'web' | 'none';
export type MicPermission = 'granted' | 'denied' | 'prompt' | 'unknown';
export type SpeechErrorCode = 'permission-denied' | 'no-speech' | 'no-microphone' | 'network' | 'unsupported' | 'unknown';

export class SpeechError extends Error {
  constructor(
    public code: SpeechErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export interface SpeechHandlers {
  /** Called with the full transcript so far (interim results included). */
  onTranscript: (text: string) => void;
  onError: (err: SpeechError) => void;
  /** Called once when listening stops for any reason. */
  onEnd: () => void;
}

export interface SpeechSession {
  stop: () => void;
}

export interface SpeechService {
  support: () => SpeechSupport;
  permission: () => Promise<MicPermission>;
  start: (handlers: SpeechHandlers, lang?: string) => Promise<SpeechSession>;
}

// ---- Web Speech API (minimal typings; not in lib.dom for all TS versions) ----
interface WebRecognitionResultList {
  length: number;
  [i: number]: { 0: { transcript: string }; isFinal: boolean };
}
interface WebRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: WebRecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type WebRecognitionCtor = new () => WebRecognition;

function webRecognitionCtor(): WebRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: WebRecognitionCtor; webkitSpeechRecognition?: WebRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function mapWebError(code: string): SpeechError {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return new SpeechError('permission-denied');
    case 'no-speech':
      return new SpeechError('no-speech');
    case 'audio-capture':
      return new SpeechError('no-microphone');
    case 'network':
      return new SpeechError('network');
    default:
      return new SpeechError('unknown', code);
  }
}

const isNative = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SpeechRecognition');

export const speechService: SpeechService = {
  support() {
    if (isNative()) return 'native';
    if (webRecognitionCtor()) return 'web';
    return 'none';
  },

  async permission() {
    if (isNative()) {
      try {
        const { speechRecognition } = await NativeSpeech.checkPermissions();
        return speechRecognition === 'granted' ? 'granted' : speechRecognition === 'denied' ? 'denied' : 'prompt';
      } catch {
        return 'unknown';
      }
    }
    try {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return status.state as MicPermission;
    } catch {
      return 'unknown'; // Safari/Firefox may not support querying the microphone permission
    }
  },

  async start(handlers, lang = typeof navigator !== 'undefined' ? navigator.language : 'en-US') {
    if (isNative()) return startNative(handlers, lang);
    const Ctor = webRecognitionCtor();
    if (!Ctor) throw new SpeechError('unsupported');

    const rec = new Ctor();
    rec.lang = lang;
    // Keep listening through pauses until the user taps stop or send. Android Chrome repeats
    // phrases in continuous mode, so there it stops after each phrase (tap the mic to add more).
    const android = /Android/i.test(navigator.userAgent);
    rec.continuous = !android;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let ended = false;
    let userStopped = false;
    // On Android each round ends at a pause; rounds are joined like the native app.
    let committed = '';
    let current = '';
    let heardThisRound = false;
    const startedAt = Date.now();
    const transcript = () => [committed, current].filter(Boolean).join(' ').trim();
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      current = text.trim();
      heardThisRound = true;
      handlers.onTranscript(transcript());
    };
    rec.onerror = (e) => {
      // Silence after something was said just means the user finished.
      if (e.error === 'aborted' || (e.error === 'no-speech' && transcript())) return;
      handlers.onError(mapWebError(e.error));
    };
    rec.onend = () => {
      if (ended) return;
      if (android && !userStopped && heardThisRound && !SAID_DONE.test(transcript()) && Date.now() - startedAt < MAX_LISTEN_MS) {
        committed = transcript();
        current = '';
        heardThisRound = false;
        try {
          rec.start();
          return;
        } catch {
          /* fall through and end */
        }
      }
      ended = true;
      handlers.onEnd();
    };
    try {
      rec.start();
    } catch (err) {
      throw new SpeechError('unknown', (err as Error).message);
    }
    return {
      stop: () => {
        userStopped = true;
        rec.stop();
      },
    };
  },
};

async function startNative(handlers: SpeechHandlers, lang: string): Promise<SpeechSession> {
  const { available } = await NativeSpeech.available();
  if (!available) throw new SpeechError('unsupported');

  let perm = (await NativeSpeech.checkPermissions()).speechRecognition;
  if (perm !== 'granted') perm = (await NativeSpeech.requestPermissions()).speechRecognition;
  if (perm !== 'granted') throw new SpeechError('permission-denied');

  // Android's recogniser stops after a second or two of silence. To let people pause mid-sentence,
  // keep listening in rounds and join them, until the user taps stop, says "add it", or a whole
  // round passes without speech.
  let ended = false;
  let userStopped = false;
  let committed = ''; // text from finished rounds
  let current = ''; // text heard in this round
  let heardThisRound = false;
  const startedAt = Date.now();
  const transcript = () => [committed, current].filter(Boolean).join(' ').trim();

  const finish = async () => {
    if (ended) return;
    ended = true;
    await NativeSpeech.removeAllListeners();
    handlers.onEnd();
  };

  const endOfRound = () => {
    if (ended) return;
    committed = transcript();
    current = '';
    const keepGoing =
      !userStopped && heardThisRound && !SAID_DONE.test(committed) && Date.now() - startedAt < MAX_LISTEN_MS;
    if (keepGoing) startRound();
    else void finish();
  };

  const startRound = () => {
    heardThisRound = false;
    NativeSpeech.start({ language: lang, partialResults: true, popup: false, maxResults: 1 })
      .then((res) => {
        if (res?.matches?.[0]) {
          current = res.matches[0];
          heardThisRound = true;
          handlers.onTranscript(transcript());
        }
      })
      .catch((err: Error) => {
        const msg = String(err?.message ?? '').toLowerCase();
        const noSpeech = msg.includes('match') || msg.includes('speech');
        // Silence after the user already said something just means they're done.
        if (!(noSpeech && committed)) {
          handlers.onError(new SpeechError(noSpeech ? 'no-speech' : 'unknown', err?.message));
        }
        void finish();
      });
  };

  await NativeSpeech.addListener('partialResults', (data: { matches?: string[] }) => {
    if (data.matches?.[0]) {
      current = data.matches[0];
      heardThisRound = true;
      handlers.onTranscript(transcript());
    }
  });
  await NativeSpeech.addListener('listeningState', (data: { status: 'started' | 'stopped' }) => {
    if (data.status === 'stopped') endOfRound();
  });

  startRound();

  return {
    stop: () => {
      userStopped = true;
      void NativeSpeech.stop().finally(() => void finish());
    },
  };
}

/** "…add it" / "save it" / "that's it": the user finished, so stop listening. */
const SAID_DONE = /\b(?:add it|save it|save (?:the |this )?task|add (?:the |this )?task|that'?s it|that'?s all|done adding)[\s.!]*$/i;
/** Never listen for longer than this in one go. */
const MAX_LISTEN_MS = 90_000;

export function speechErrorMessage(code: SpeechErrorCode, support: SpeechSupport): string {
  switch (code) {
    case 'permission-denied':
      return support === 'native'
        ? 'Microphone or speech recognition access is turned off. Enable it in your device Settings for DoNext, then try again — or type your task instead.'
        : 'Microphone access was blocked. Allow the microphone for this site in your browser settings (usually the lock icon in the address bar), then try again — or type your task instead.';
    case 'no-speech':
      return "We didn't hear anything. Tap the microphone and speak clearly, or type your task instead.";
    case 'no-microphone':
      return 'No microphone was found. Connect one, or type your task instead.';
    case 'network':
      return 'Voice recognition needs an internet connection in this browser. Type your task instead, or try again when online.';
    case 'unsupported':
      return "Voice input isn't available on this device or browser. You can type your task instead.";
    default:
      return 'Voice input stopped unexpectedly. Please try again or type your task instead.';
  }
}
