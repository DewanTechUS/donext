import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import type { ReminderSound } from './reminders';
import { loadVoicePrefs } from './voicePrefs';

/**
 * Reminder sounds are synthesised with the Web Audio API (no audio files), and reminders
 * can be read aloud with the device's built-in voice (Speech Synthesis). Both are free and offline.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  const AC = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

/**
 * Browsers only allow sound after the user has interacted with the page.
 * Call this from a tap or key press (we do it on the first interaction).
 */
export function unlockAudio() {
  const c = audio();
  if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
}

interface Note {
  freq: number;
  start: number;
  length: number;
  type?: OscillatorType;
  volume?: number;
}

const SOUNDS: Record<Exclude<ReminderSound, 'none'>, Note[]> = {
  // Two soft rising notes.
  chime: [
    { freq: 880, start: 0, length: 0.9 },
    { freq: 1318.5, start: 0.18, length: 1.1 },
  ],
  // A bell with an overtone, rung twice.
  bell: [
    { freq: 660, start: 0, length: 1.6, type: 'triangle', volume: 0.35 },
    { freq: 1320, start: 0, length: 0.9, volume: 0.12 },
    { freq: 660, start: 0.9, length: 1.6, type: 'triangle', volume: 0.35 },
    { freq: 1320, start: 0.9, length: 0.9, volume: 0.12 },
  ],
  // Three short beeps.
  beep: [0, 0.25, 0.5].map((start) => ({ freq: 1000, start, length: 0.14, type: 'square' as const, volume: 0.12 })),
};

export function playSound(kind: ReminderSound) {
  if (kind === 'none') return;
  const c = audio();
  if (!c) return;
  if (c.state === 'suspended') void c.resume().catch(() => undefined);
  const t0 = c.currentTime + 0.02;
  for (const n of SOUNDS[kind]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.value = n.freq;
    const v = n.volume ?? 0.25;
    gain.gain.setValueAtTime(0.0001, t0 + n.start);
    gain.gain.exponentialRampToValueAtTime(v, t0 + n.start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.start + n.length);
    osc.connect(gain).connect(c.destination);
    osc.start(t0 + n.start);
    osc.stop(t0 + n.start + n.length + 0.05);
  }
}

// Android's WebView has no Speech Synthesis, so the app uses the device's text-to-speech engine.
const nativeTts = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('TextToSpeech');
const webTts = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

export const canSpeak = () => nativeTts() || webTts();

/** A voice the user can pick in Account → Reminders & voice. */
export interface VoiceOption {
  id: string;
  label: string;
  lang: string;
}

const lang = () => (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
const sameLanguage = (v: { lang: string }) => v.lang.toLowerCase().replace('_', '-').startsWith(lang().slice(0, 2).toLowerCase());
const languageName = (code: string) => {
  try {
    return new Intl.DisplayNames([lang()], { type: 'language' }).of(code.replace('_', '-')) ?? code;
  } catch {
    return code;
  }
};

let nativeVoices: { voiceURI: string; name: string; lang: string }[] | null = null;
async function loadNativeVoices() {
  nativeVoices ??= (await TextToSpeech.getSupportedVoices()).voices;
  return nativeVoices;
}

function webVoices(): Promise<SpeechSynthesisVoice[]> {
  const now = window.speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  // Some browsers load voices a moment later.
  return new Promise((resolve) => {
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1000);
  });
}

/** Voices for the phone's language, best-sounding first. */
export async function listVoices(): Promise<VoiceOption[]> {
  if (!canSpeak()) return [];
  if (nativeTts()) {
    const voices = (await loadNativeVoices()).filter(sameLanguage);
    return voices.map((v, i) => ({
      id: v.voiceURI || v.name,
      // Android voice names look like "en-us-x-tpf-local"; show something readable.
      label: /^[a-z]{2,3}-[a-z]{2}-x-/i.test(v.name)
        ? `${languageName(v.lang)} · voice ${i + 1}${/network/i.test(v.name) ? ' (needs internet)' : ''}`
        : v.name,
      lang: v.lang,
    }));
  }
  const natural = /natural|neural|online|enhanced|premium/i;
  return (await webVoices())
    .filter(sameLanguage)
    .sort((a, b) => Number(natural.test(b.name)) - Number(natural.test(a.name)) || Number(b.localService) - Number(a.localService))
    .map((v) => ({ id: v.voiceURI || v.name, label: v.name, lang: v.lang }));
}

/** Makes text sound natural when spoken: "9:00 AM" → "9 AM". */
export const forSpeech = (text: string) => text.replace(/\b(\d{1,2}):00\s?(AM|PM)\b/gi, '$1 $2');

/** Reads text aloud with the chosen voice and speed (after the sound, if any). */
export function speak(text: string, delayMs = 0) {
  if (!canSpeak()) return;
  const { voiceId, rate } = loadVoicePrefs();
  const words = forSpeech(text);
  setTimeout(() => {
    if (nativeTts()) {
      void (async () => {
        await TextToSpeech.stop().catch(() => undefined);
        const voices = voiceId ? await loadNativeVoices().catch(() => []) : [];
        const index = voices.findIndex((v) => (v.voiceURI || v.name) === voiceId);
        await TextToSpeech.speak({ text: words, lang: lang(), rate, category: 'playback', ...(index >= 0 ? { voice: index } : {}) });
      })().catch(() => undefined);
      return;
    }
    void webVoices().then((voices) => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(words);
      u.rate = rate;
      // The chosen voice, or the most natural-sounding one for the language.
      const natural = /natural|neural|online|enhanced|premium/i;
      u.voice =
        voices.find((v) => (v.voiceURI || v.name) === voiceId) ??
        voices.find((v) => sameLanguage(v) && natural.test(v.name)) ??
        voices.find((v) => sameLanguage(v) && v.default) ??
        null;
      window.speechSynthesis.speak(u);
    });
  }, delayMs);
}
