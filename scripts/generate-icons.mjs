#!/usr/bin/env node
/**
 * Builds every app icon, splash screen and in-app logo from the source artwork in branding/.
 *
 *   branding/donext-logo.png     DoNext app logo (square, full-bleed navy background)
 *
 * Outputs:
 *   client/public/icons/*   PWA icons, favicon, apple-touch-icon
 *   client/src/assets/*     logos used inside the UI (header, menu, footer)
 *   client/assets/*         sources for `npm run cap:assets -w client` (iOS/Android icons + splash)
 *
 * Replace the files in branding/ (same names, square, ≥1024px) and run `npm run icons`.
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP_LOGO = join(root, 'branding/donext-logo.png');
const NAVY = '#012360'; // background colour of the DoNext logo

async function out(rel, pipeline) {
  const file = join(root, rel);
  mkdirSync(dirname(file), { recursive: true });
  await pipeline.png({ compressionLevel: 9 }).toFile(file);
  console.log('wrote', rel);
}

const square = (src, size) => sharp(src).resize(size, size, { fit: 'cover', kernel: 'lanczos3' });

/** Logo centred on a solid canvas (splash screens). */
async function centred(size, logoFraction, background) {
  const logo = await square(APP_LOGO, Math.round(size * logoFraction)).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background } }).composite([{ input: logo, gravity: 'center' }]);
}

// PWA / web. The artwork sits inside the central ~55%, so the same image is also a valid maskable icon.
await out('client/public/icons/icon-192.png', square(APP_LOGO, 192));
await out('client/public/icons/icon-512.png', square(APP_LOGO, 512));
await out('client/public/icons/maskable-512.png', square(APP_LOGO, 512));
await out('client/public/icons/apple-touch-icon.png', square(APP_LOGO, 180));
await out('client/public/icons/favicon-48.png', square(APP_LOGO, 48));

// In-app logos (2x the largest display size for sharp rendering on high-density screens)
await out('client/src/assets/donext-logo.png', square(APP_LOGO, 128));

// Capacitor native icons and splash screens
await out('client/assets/icon-only.png', square(APP_LOGO, 1024));
await out('client/assets/icon-foreground.png', square(APP_LOGO, 1024));
await out('client/assets/icon-background.png', sharp({ create: { width: 1024, height: 1024, channels: 3, background: NAVY } }));
await out('client/assets/splash.png', await centred(2732, 0.3, NAVY));
await out('client/assets/splash-dark.png', await centred(2732, 0.3, NAVY));
