/**
 * Install the generated brand assets into the apps.
 *
 * ## Why this is a script rather than a copy-paste
 *
 * `brand/build-from-supplied.mjs` writes everything into `brand/png/`. The
 * mobile and web apps each reference a subset by their own names, and three of
 * those references are SVGs that wrap a raster. Doing that by hand means the
 * wiring can drift from the generator without anything noticing — the assets
 * would still look plausible while being last season's brand.
 *
 * Running build then install in that order makes "the artwork in the apps came
 * from the supplied kit" a checkable claim rather than a memory.
 *
 * ## The SVG wrappers
 *
 * The web references `/logo.svg`, `/logo-mark.svg` and `/icons/icon-*.svg`, but
 * the brand kit is raster. Rather than rename every reference, each of those
 * keeps its path and becomes a minimal SVG that embeds the generated PNG.
 *
 * `/logo.svg` deliberately wraps the *mark*, not the full lockup. `Nav.tsx`
 * already renders "MeticleCare" as text beside the image, in the same navy and
 * teal as the supplied lockup — embedding the whole lockup would print the
 * wordmark twice. The previous `/logo.svg` did exactly that, and compounded it
 * with a 500x120 viewBox around a 1535x1024 image, so the logo was additionally
 * letterboxed down to about a third of its box.
 *
 * Run: node brand/install-assets.mjs   (after npm run brand:build)
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readPngHeader } from './png.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PNG = join(HERE, 'png');

const MOBILE = join(ROOT, 'apps', 'mobile', 'assets');
const WEB_PUBLIC = join(ROOT, 'apps', 'web', 'public');
const WEB_ICONS = join(WEB_PUBLIC, 'icons');
const STORE = join(ROOT, 'store-assets');

/** Straight renames: generated name -> destination path. */
const COPIES = [
  ['icon.png', join(MOBILE, 'icon.png')],
  ['adaptive-icon-foreground.png', join(MOBILE, 'adaptive-icon-foreground.png')],
  ['monochrome-icon.png', join(MOBILE, 'monochrome-icon.png')],
  ['favicon.png', join(MOBILE, 'favicon.png')],
  ['notification-icon.png', join(MOBILE, 'notification-icon.png')],
  ['splash-icon.png', join(MOBILE, 'splash-icon.png')],
  ['splash-icon-dark.png', join(MOBILE, 'splash-icon-dark.png')],

  ['meticle-logo-horizontal@760.png', join(WEB_PUBLIC, 'meticle-logo.png')],
  ['meticle-mark@512.png', join(WEB_PUBLIC, 'logo-mark.png')],

  // The two files the Play Console is fed by hand.
  ['play-icon-512@512.png', join(STORE, 'play-icon-512.png')],
  ['play-feature-graphic-1024x500@1024.png', join(STORE, 'play-feature-graphic-1024x500.png')],
  ['google-play-badge.png', join(STORE, 'google-play-badge.png')],
];

/**
 * SVG files that wrap a generated raster, so existing references keep working.
 *
 * `square: true` gives the wrapper a square viewBox, which is what an icon
 * needs. Without it a non-square raster inside a square viewBox is letterboxed
 * and renders smaller than its box, which is how the old nav logo ended up
 * shrunk to a third of its width.
 */
const WRAPPERS = [
  {
    raster: 'meticle-mark@512.png',
    out: join(WEB_PUBLIC, 'logo.svg'),
    name: 'MeticleCare mark',
    square: true,
  },
  {
    raster: 'meticle-mark@512.png',
    out: join(WEB_PUBLIC, 'logo-mark.svg'),
    name: 'MeticleCare mark',
    square: true,
  },
  {
    raster: 'icon-192.png',
    out: join(WEB_ICONS, 'icon-192.svg'),
    name: 'MeticleCare app icon',
    square: true,
  },
  {
    raster: 'icon-512.png',
    out: join(WEB_ICONS, 'icon-512.svg'),
    name: 'MeticleCare app icon',
    square: true,
  },
  {
    raster: 'og-image.png',
    out: join(WEB_PUBLIC, 'og-image.png'),
    name: null, // written directly, not wrapped
  },
];

let failures = 0;
const fail = (message) => {
  console.log(`  FAIL  ${message}`);
  failures++;
};

for (const dir of [MOBILE, WEB_PUBLIC, WEB_ICONS, STORE]) mkdirSync(dir, { recursive: true });

console.log('Copying generated assets');
for (const [from, to] of COPIES) {
  const src = join(PNG, from);
  if (!existsSync(src)) {
    fail(`missing ${from} — run: npm run brand:build`);
    continue;
  }
  copyFileSync(src, to);
  console.log(`  ok    ${to.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
}

console.log('\nWriting SVG wrappers');
for (const w of WRAPPERS) {
  const src = join(PNG, w.raster);
  if (!existsSync(src)) {
    fail(`missing ${w.raster} — run: npm run brand:build`);
    continue;
  }

  if (!w.name) {
    // A raster destination, listed here so the install is one list to read.
    copyFileSync(src, w.out);
    console.log(`  ok    ${w.out.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
    continue;
  }

  const header = readPngHeader(readFileSync(src));
  const vbW = w.square ? Math.max(header.width, header.height) : header.width;
  const vbH = w.square ? Math.max(header.width, header.height) : header.height;
  const uri = `data:image/png;base64,${readFileSync(src).toString('base64')}`;

  writeFileSync(
    w.out,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" ` +
      `width="${vbW}" height="${vbH}" role="img" aria-label="${w.name}">\n` +
      `  <!-- Generated by brand/install-assets.mjs from Store assets/. Do not hand-edit. -->\n` +
      `  <image href="${uri}" width="${vbW}" height="${vbH}" preserveAspectRatio="xMidYMid meet"/>\n` +
      `</svg>\n`,
  );
  console.log(
    `  ok    ${w.out.replace(ROOT + '\\', '').replace(ROOT + '/', '')}  ` +
      `(${vbW}x${vbH} viewBox)`,
  );
}

console.log(
  failures === 0
    ? '\nBrand assets installed into apps/mobile, apps/web and store-assets.'
    : `\n${failures} install step(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);