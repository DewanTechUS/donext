import { beforeEach, describe, expect, it, vi } from 'vitest';

// A fake Android speech recogniser: each start() is one "round" that the test ends by hand.
type Listener = (data: unknown) => void;
const listeners: Record<string, Listener> = {};
const native = {
  available: vi.fn(async () => ({ available: true })),
  checkPermissions: vi.fn(async () => ({ speechRecognition: 'granted' })),
  requestPermissions: vi.fn(async () => ({ speechRecognition: 'granted' })),
  start: vi.fn(async () => ({})),
  stop: vi.fn(async () => {}),
  addListener: vi.fn(async (name: string, fn: Listener) => {
    listeners[name] = fn;
    return { remove: async () => {} };
  }),
  removeAllListeners: vi.fn(async () => {}),
};
vi.mock('@capacitor-community/speech-recognition', () => ({ SpeechRecognition: native }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true } }));

const { speechService } = await import('./speech');

const hear = (text: string) => listeners.partialResults({ matches: [text] });
const pause = () => listeners.listeningState({ status: 'stopped' });
const flush = () => new Promise((r) => setTimeout(r, 0));

function session() {
  const heard: string[] = [];
  const onEnd = vi.fn();
  const onError = vi.fn();
  return { heard, onEnd, onError, handlers: { onTranscript: (t: string) => heard.push(t), onEnd, onError } };
}

describe('native speech keeps listening through pauses', () => {
  beforeEach(() => {
    native.start.mockClear();
    native.stop.mockClear();
  });

  it('joins rounds until a round passes in silence', async () => {
    const s = session();
    await speechService.start(s.handlers, 'en-US');
    expect(native.start).toHaveBeenCalledTimes(1);

    hear('I have a job');
    pause(); // Android stopped at a short pause…
    expect(native.start).toHaveBeenCalledTimes(2); // …so DoNext listens again
    hear('tomorrow at 9');
    pause();
    expect(s.heard.at(-1)).toBe('I have a job tomorrow at 9');
    expect(native.start).toHaveBeenCalledTimes(3);

    pause(); // a round with no speech: the user is done
    await flush();
    expect(s.onEnd).toHaveBeenCalledTimes(1);
    expect(native.start).toHaveBeenCalledTimes(3);
    expect(s.onError).not.toHaveBeenCalled();
  });

  it('stops right away after "add it"', async () => {
    const s = session();
    await speechService.start(s.handlers, 'en-US');
    hear('dentist friday at 3 add it');
    pause();
    await flush();
    expect(s.onEnd).toHaveBeenCalledTimes(1);
    expect(native.start).toHaveBeenCalledTimes(1);
  });

  it('stops when the user taps stop', async () => {
    const s = session();
    const handle = await speechService.start(s.handlers, 'en-US');
    hear('call mom');
    handle.stop();
    pause();
    await flush();
    expect(native.stop).toHaveBeenCalled();
    expect(s.onEnd).toHaveBeenCalledTimes(1);
    expect(native.start).toHaveBeenCalledTimes(1);
  });
});
