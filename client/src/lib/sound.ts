import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import type { ReminderSound } from './reminders';

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

/** Reads text aloud with the device's voice (after the sound, if any). */
export function speak(text: string, delayMs = 0) {
  if (!canSpeak()) return;
  setTimeout(() => {
    if (nativeTts()) {
      void TextToSpeech.stop()
        .catch(() => undefined)
        .then(() => TextToSpeech.speak({ text, lang: navigator.language || 'en-US', rate: 1, category: 'playback' }))
        .catch(() => undefined);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    window.speechSynthesis.speak(u);
  }, delayMs);
}
