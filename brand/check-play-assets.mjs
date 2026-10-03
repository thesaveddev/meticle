/**
 * Validate the generated store assets against Google Play's published
 * requirements, reading the files that are actually on disk.
 *
 *   node brand/check-play-assets.mjs
 *
 * Exits non-zero if anything fails, so this can gate an upload.
 *
 * The requirements are quoted from:
 *   Icon           — developer.android.com/distribute/google-play/resources/icon-design-specifications
 *   Icon + graphic — support.google.com/googleplay/android-developer/answer/9866151
 *
 * Play's wording is easy to get backwards, so the two that catch people are
 * spelled out here:
 *
 *   * Icon — "32-bit PNG (with alpha)", yet the same page says the background
 *     "doesn't include any transparency". Not a contradiction: the *container*
 *     carries an alpha channel, the *artwork* inside it is opaque. An icon with
 *     genuinely translucent pixels gets composited over Play's own UI
 *     background and renders differently on every surface.
 *   * Feature graphic — "JPEG or 24-bit PNG (no alpha)". An alpha channel here
 *     is a rejection, not a nicety, which is the opposite of the icon.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { decodePng, readPngHeader, fullyOpaque, translucentPixelCount } from './png.mjs';

const PNG_DIR = join(dirname(fileURLToPath(import.meta.url)), 'png');

/**
 * Each entry states the rule, then how to test it. `alpha: 'required'` means
 * the channel must exist; `'forbidden'` means it must not; `'n/a'` means the
 * file has no alpha channel and the artwork-opacity rule does not apply.
 */
const ASSETS = [
  {
    file: 'play-icon-512@512.png',
    label: 'App icon',
    width: 512,
    height: 512,
    maxBytes: 1024 * 1024,
    alpha: 'required',
    opaqueArtwork: true,
    notes: 'Full square, no baked-in corner radius, no drop shadow — Play applies both.',
  },
  {
    file: 'play-feature-graphic-1024x500@1024.png',
    label: 'Feature graphic',
    width: 1024,
    height: 500,
    maxBytes: 1024 * 1024,
    alpha: 'forbidden',
    opaqueArtwork: false,
    notes: 'Play crops this per surface, so keep meaningful content centred.',
  },
];

let failed = 0;
const pad = (s, n) => String(s).padEnd(n);

for (const asset of ASSETS) {
  const path = join(PNG_DIR, asset.file);
  console.log(`\n${asset.label} — ${asset.file}`);

  if (!existsSync(path)) {
    console.log(`  FAIL  missing. Run: npm run brand:build`);
    failed++;
    continue;
  }

  const buffer = readFileSync(path);
  const checks = [];

  const h = readPngHeader(buffer);
  checks.push([h.width === asset.width && h.height === asset.height, `dimensions ${h.width}x${h.height} (need ${asset.width}x${asset.height})`]);
  checks.push([!h.interlaced, 'not interlaced']);
  checks.push([h.bitDepth === 8, `bit depth ${h.bitDepth} (need 8)`]);

  if (asset.alpha === 'required') {
    checks.push([h.colourType === 6, `colour type ${h.colourType} = ${h.colourType === 6 ? '32-bit RGBA' : 'not 32-bit RGBA'} (need 32-bit PNG with alpha)`]);
  } else if (asset.alpha === 'forbidden') {
    checks.push([h.colourType === 2, `colour type ${h.colourType} = ${h.colourType === 2 ? '24-bit RGB' : 'has an alpha channel'} (need 24-bit PNG, no alpha)`]);
  }

  const kb = buffer.length / 1024;
  checks.push([buffer.length <= asset.maxBytes, `${kb.toFixed(0)}KB (limit ${asset.maxBytes / 1024}KB)`]);

  if (asset.opaqueArtwork) {
    // Decode rather than trust: this is the property that silently regresses.
    const decoded = decodePng(buffer);
    const translucent = fullyOpaque(decoded.pixels) ? 0 : translucentPixelCount(decoded.pixels);
    checks.push([translucent === 0, translucent === 0 ? 'artwork fully opaque (no visible transparency)' : `${translucent} translucent pixels would show Play's UI through the icon`]);
  }

  for (const [ok, message] of checks) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${message}`);
    if (!ok) failed++;
  }
  if (asset.notes) console.log(`  note  ${asset.notes}`);
}

console.log(
  failed === 0
    ? '\nAll store assets meet Play’s published requirements.'
    : `\n${failed} check(s) failed.`,
);
process.exit(failed === 0 ? 0 : 1);