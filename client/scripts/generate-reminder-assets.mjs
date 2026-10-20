// Generates the Android reminder assets:
//   res/raw/chime.wav                  the notification sound (same two-note chime as the web app)
//   res/drawable-*/ic_stat_donext.png  the small white status-bar icon, cut from branding/donext-logo.png
// Run from the client folder: `node scripts/generate-reminder-assets.mjs` (re-run after changing the logo).
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const client = resolve(here, '..');
const res = resolve(client, 'android/app/src/main/res');
const require = createRequire(resolve(client, '../package.json'));
const sharp = require('sharp');

// ---- chime.wav: 44.1 kHz, 16-bit mono ----
const rate = 44_100;
const length = 1.5;
const notes = [
  { freq: 880, start: 0, dur: 0.9, vol: 0.45 },
  { freq: 1318.5, start: 0.18, dur: 1.2, vol: 0.4 },
];
const samples = new Int16Array(Math.round(rate * length));
for (let i = 0; i < samples.length; i++) {
  const t = i / rate;
  let v = 0;
  for (const n of notes) {
    const local = t - n.start;
    if (local < 0 || local > n.dur) continue;
    const attack = Math.min(1, local / 0.015); // soft start, no click
    const decay = Math.exp((-4.5 * local) / n.dur);
    v += n.vol * attack * decay * Math.sin(2 * Math.PI * n.freq * local);
  }
  samples[i] = Math.max(-1, Math.min(1, v)) * 32_000;
}
const wav = Buffer.alloc(44 + samples.length * 2);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + samples.length * 2, 4);
wav.write('WAVE', 8);
wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); // PCM
wav.writeUInt16LE(1, 22); // mono
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(samples.length * 2, 40);
Buffer.from(samples.buffer).copy(wav, 44);
mkdirSync(resolve(res, 'raw'), { recursive: true });
writeFileSync(resolve(res, 'raw/chime.wav'), wav);
console.log('✓ res/raw/chime.wav');

// ---- Status-bar icon: the logo's light shapes as white on transparent (Android tints it) ----
const logo = resolve(client, '../branding/donext-logo.png');
const { data, info } = await sharp(logo).resize(512, 512).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const rgba = Buffer.alloc(info.width * info.height * 4);
for (let p = 0; p < info.width * info.height; p++) {
  const [r, g, b] = [data[p * 3], data[p * 3 + 1], data[p * 3 + 2]];
  const light = 0.299 * r + 0.587 * g + 0.114 * b;
  const alpha = Math.max(0, Math.min(255, (light - 110) * 2.2)); // white and green parts become the glyph
  rgba.set([255, 255, 255, alpha], p * 4);
}
const glyph = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).trim().png().toBuffer();
for (const [folder, size] of [
  ['drawable-mdpi', 24],
  ['drawable-hdpi', 36],
  ['drawable-xhdpi', 48],
  ['drawable-xxhdpi', 72],
  ['drawable-xxxhdpi', 96],
]) {
  mkdirSync(resolve(res, folder), { recursive: true });
  const inner = Math.round(size * 0.84); // Android's recommended padding
  await sharp(glyph)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: Math.floor((size - inner) / 2),
      bottom: Math.ceil((size - inner) / 2),
      left: Math.floor((size - inner) / 2),
      right: Math.ceil((size - inner) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(resolve(res, folder, 'ic_stat_donext.png'));
}
console.log('✓ res/drawable-*/ic_stat_donext.png');
