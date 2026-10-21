import { beforeEach, describe, expect, it, vi } from 'vitest';

// A fake speech recogniser (iOS path): each start() is one "round" that the test ends by hand.
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

// DoNext's Android plugin.
const androidListeners: Record<string, Listener> = {};
const continuous = {
  start: vi.fn(async () => {}),
  stop: vi.fn(async () => {}),
  addListener: vi.fn(async (name: string, fn: Listener) => {
    androidListeners[name] = fn;
    return { remove: async () => {} };
  }),
};
let platform = 'ios';
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true, getPlatform: () => platform },
  registerPlugin: () => continuous,
}));

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

describe('iOS speech keeps listening through pauses', () => {
  beforeEach(() => {
    platform = 'ios';
    native.start.mockClear();
    native.stop.mockClear();
  });

  it('joins rounds until a round passes in silence', async () => {
    const s = session();
    await speechService.start(s.handlers, 'en-US');
    expect(native.start).toHaveBeenCalledTimes(1);

    hear('I have a job');
    pause(); // the recogniser stopped at a short pause…
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

describe('Android uses DoNext’s continuous dictation plugin', () => {
  beforeEach(() => {
    platform = 'android';
    continuous.start.mockClear();
    continuous.stop.mockClear();
    native.start.mockClear();
  });

  it('shows everything heard and ends when the plugin ends', async () => {
    const s = session();
    await speechService.start(s.handlers, 'en-US');
    expect(continuous.start).toHaveBeenCalledWith({ language: 'en-US' });
    expect(native.start).not.toHaveBeenCalled();

    androidListeners.partial({ text: 'I have a job' });
    androidListeners.partial({ text: 'I have a job tomorrow at 9' }); // joined across a pause by the plugin
    expect(s.heard.at(-1)).toBe('I have a job tomorrow at 9');

    androidListeners.end({ text: 'I have a job tomorrow at 9' });
    expect(s.onEnd).toHaveBeenCalledTimes(1);
  });

  it('asks the plugin to stop after "add it" and when the user taps stop', async () => {
    const s = session();
    const handle = await speechService.start(s.handlers, 'en-US');
    androidListeners.partial({ text: 'call the bank add it' });
    expect(continuous.stop).toHaveBeenCalledTimes(1);
    handle.stop(); // already stopping: not sent twice
    expect(continuous.stop).toHaveBeenCalledTimes(1);
  });

  it('passes errors on', async () => {
    const s = session();
    await speechService.start(s.handlers, 'en-US');
    androidListeners.error({ code: 'no-speech' });
    expect(s.onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'no-speech' }));
  });
});
