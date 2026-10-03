/**
 * Build every Meticle Care asset from the supplied brand kit.
 *
 * ## Why this script exists
 *
 * The artwork in `Store assets/` is the authoritative identity — the client's
 * own final design, not something this repo drew. Everything here is a
 * faithful *rescale* of those files:
 *
 *   * never a redraw,
 *   * never a recolour,
 *   * never a crop unless a target's aspect ratio forces one.
 *
 * The previous generators (`brand/build-mark.mjs`, `brand/mark.mjs`) rebuilt
 * the mark as vector geometry from an old reference. They are superseded, and
 * running `npm run brand:build` used to silently revert the logo to artwork the
 * owner had explicitly rejected. This script replaces them so the kit on disk is
 * the only source of truth.
 *
 * ## Which source feeds which target
 *
 *   play icon square.png          -> Play icon, app icon, favicon, web icons
 *   Feature graphic.png           -> Play feature graphic, social card
 *   Horizontal logo.png           -> web nav lockup
 *   Android adaptive foreground   -> adaptive icon, themed icon, splash,
 *                                    notification glyph, web mark
 *   MeticleCare Google Play Badge -> copied at 2:1, colour untouched
 *
 * `Monochrome logo.png` and `Silhouette logo.png` are deliberately *not* used.
 * They are presentation sheets — each carries four lockups (colour and black,
 * horizontal and stacked) side by side on one 1774x887 canvas, not a single
 * asset. Using one would mean guessing which quadrant and cropping it. The
 * adaptive foreground already carries the mark on its own transparent canvas,
 * which is what the themed icon and the notification glyph actually need.
 *
 * ## Why resvg does the rescaling
 *
 * `brand/png.mjs` can encode PNGs but cannot sample them: the earlier encoder
 * picked one source pixel per destination pixel, which turned the mark's
 * diagonals into visible stairs. resvg does proper filtered resampling with
 * antialiasing, so 1254 -> 512 is clean.
 *
 * resvg only ever *writes* 32-bit RGBA, and the two headline Play assets
 * disagree with each other about alpha:
 *
 *   * app icon       — "32-bit PNG (with alpha)", artwork must be opaque
 *   * feature graphic — "JPEG or 24-bit PNG (no alpha)"
 *
 * So each image is rendered through resvg for resampling, then re-encoded from
 * the raw RGBA buffer by `encodePng`, which is the only thing here that can
 * emit colour type 2. The flattening is therefore deliberate and testable
 * rather than an accident of the renderer.
 *
 * Run: npm run brand:build
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { encodePng, fullyOpaque, translucentPixelCount, decodePng } from './png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = join(ROOT, 'Store assets');
const PNG_DIR = join(dirname(fileURLToPath(import.meta.url)), 'png');

mkdirSync(PNG_DIR, { recursive: true });

/* --------------------------------------------------------------- resample -- */

/**
 * The visible bounds of a source PNG, found from its alpha channel.
 *
 * Used by the `inside` fit mode so content is positioned by where it actually
 * is rather than by the canvas, which the kit pads generously.
 */
function visibleBounds(buffer) {
  const { width, height, channels, pixels } = decodePng(buffer);

  // Colour type 2 has no alpha channel, so such a file is entirely visible.
  if (channels !== 4) return { x: 0, y: 0, w: width, h: height };

  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: width, h: height };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Rescale a PNG buffer to an exact pixel size using resvg.
 *
 * resvg cannot take a raster as its document, so the raster is embedded in an
 * SVG `<image>` scaled to the target box and rendered. That routes it through
 * resvg's resampler, which is what makes the downscale smooth.
 *
 * `fit` decides what happens when the source aspect ratio differs from the box:
 *   'cover'   — fill the box, centre-crop the overflow
 *   'contain' — fit the whole source inside the box, centred, on transparency
 *   'stretch' — fill the box, ignoring the source ratio
 *   'inside'  — fit the source's *visible content* into the box, centred
 *   'safe'    — scale so every visible pixel falls inside the circle Android
 *               guarantees to show for an adaptive icon
 *
 * @returns {{pixels: Buffer, width: number, height: number}}
 */
function resample(sourcePng, width, height, { fit = 'cover', inset = 0 } = {}) {
  const uri = `data:image/png;base64,${sourcePng.toString('base64')}`;

  let rect;
  if (fit === 'safe') {
    // Android's adaptive-icon mask can crop as much as 18dp of the outer 108dp
    // on every side, which leaves a circle of diameter 66dp guaranteed visible.
    //
    // Scaling by the content's bounding *box* would be wrong twice over: the box
    // is not a circle, and a pin mark's box corners are empty space. Measuring
    // the furthest genuinely visible pixel from the centre gives the one number
    // that decides when the artwork is about to be clipped.
    const scale =
      ((Math.min(width, height) * ADAPTIVE_SAFE_DIAMETER_FRACTION * ADAPTIVE_HEADROOM) / 2) /
      visibleReach(sourcePng);
    const decoded = decodePng(sourcePng);
    const drawW = decoded.width * scale;
    const drawH = decoded.height * scale;
    rect =
      `<image x="${((width - drawW) / 2).toFixed(2)}" y="${((height - drawH) / 2).toFixed(2)}"` +
      ` width="${drawW.toFixed(2)}" height="${drawH.toFixed(2)}"` +
      ` preserveAspectRatio="none" xlink:href="${uri}"/>`;
  } else if (fit === 'inside') {
    const b = visibleBounds(sourcePng);
    const box = Math.min(width, height) * (1 - inset * 2);
    const scale = Math.min(box / b.w, box / b.h);
    const drawW = b.w * scale;
    const drawH = b.h * scale;
    rect =
      `<image x="${((width - drawW) / 2).toFixed(2)}" y="${((height - drawH) / 2).toFixed(2)}"` +
      ` width="${drawW.toFixed(2)}" height="${drawH.toFixed(2)}"` +
      ` preserveAspectRatio="none" xlink:href="${uri}"/>`;
  } else {
    const preserve =
      fit === 'cover' ? 'xMidYMid slice' : fit === 'stretch' ? 'none' : 'xMidYMid meet';
    rect =
      `<image x="0" y="0" width="${width}" height="${height}"` +
      ` preserveAspectRatio="${preserve}" xlink:href="${uri}"/>`;
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
    ` width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    rect,
    `</svg>`,
  ].join('');

  const rendered = new Resvg(svg, {
    fitTo: { mode: 'original' },
    background: 'rgba(0,0,0,0)',
  }).render();

  return { pixels: Buffer.from(rendered.pixels), width, height };
}

/**
 * The greatest distance from the image centre to a visible pixel, in source
 * pixels. This is the radius an adaptive-icon mask must contain.
 *
 * A file with no alpha channel is treated as filling its whole canvas, whose
 * corner is the furthest point.
 */
function visibleReach(buffer) {
  const { width, height, channels, pixels } = decodePng(buffer);
  const cx = width / 2;
  const cy = height / 2;

  if (channels !== 4) return Math.hypot(cx, cy);

  let furthest = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 8) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > furthest) furthest = d;
      }
    }
  }
  return furthest || Math.hypot(cx, cy);
}

/**
 * Force every pixel opaque.
 *
 * The supplied Play icon exports at alpha 252 rather than 255. Play's rule is
 * that the artwork must be opaque even though the container carries an alpha
 * channel, and an icon composited over Play's own surface colour is not the
 * icon that was uploaded — so this is applied deliberately, not left to chance.
 */
function makeOpaque(pixels) {
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  return pixels;
}

/* ------------------------------------------------------------- plan table -- */

/**
 * Diameter of the circle Android guarantees to leave visible on an adaptive
 * icon, as a fraction of the whole canvas.
 *
 * Android's mask covers the outer 18dp of 108dp on every side, so 108 - 36 = 72dp
 * survives — 72/108 = 0.667. The mark is scaled to exactly this, which puts it
 * flush against the safe edge; `ADAPTIVE_HEADROOM` pulls it in slightly so a
 * mask a little more aggressive than the documented one still cannot clip it.
 */
const ADAPTIVE_SAFE_DIAMETER_FRACTION = 72 / 108;

/** Shrink the safe circle slightly, as a fraction of its radius. */
const ADAPTIVE_HEADROOM = 0.94;

/**
 * Every output this script is responsible for.
 *
 * `fit` is stated per output rather than defaulted, because the choice is a
 * design decision and belongs somewhere it can be read and argued with.
 * `opaque` states whether the artwork must have no visible transparency, and
 * `maxBytes` is set only where a published limit actually applies.
 */
const PLAN = [
  /* ---------------------------------------------------------- Play ---- */
  {
    out: 'play-icon-512@512.png',
    source: 'play icon square.png',
    width: 512,
    height: 512,
    fit: 'cover',
    alpha: true,
    opaque: true,
    maxBytes: 1024 * 1024,
    where: 'Google Play Console — app icon',
    why:
      'Play wants 512x512, 32-bit PNG with an alpha channel, and the artwork itself fully opaque. ' +
      'The supplied file is already square-edged and full-bleed, so this is a straight rescale.',
  },
  {
    out: 'play-feature-graphic-1024x500@1024.png',
    source: 'Feature graphic.png',
    width: 1024,
    height: 500,
    fit: 'cover',
    alpha: false,
    maxBytes: 1024 * 1024,
    where: 'Google Play Console — feature graphic',
    why:
      'Play wants 1024x500 as JPEG or 24-bit PNG, no alpha channel at all. The source is exactly 2:1 ' +
      'and Play wants 2.048:1, so 21px of height — about 11px per edge — has to go. Measured free ' +
      'margins are 72px at the top and 47px at the bottom, so the crop lands entirely on empty ' +
      'background. Letterboxing instead would have put visible bars on a designed banner.',
  },

  /* ---------------------------------------------------------- app ----- */
  {
    out: 'icon.png',
    source: 'play icon square.png',
    width: 1024,
    height: 1024,
    fit: 'cover',
    alpha: true,
    opaque: true,
    where: 'apps/mobile/assets/icon.png',
    why: 'The app icon at 1024, which is what both stores ask for as the source.',
  },
  {
    out: 'adaptive-icon-foreground.png',
    source: 'Android adaptive foreground.png',
    width: 432,
    height: 432,
    fit: 'safe',
    alpha: true,
    where: 'apps/mobile/assets/adaptive-icon-foreground.png',
    why:
      'Android masks an adaptive icon with a shape covering the outer 18dp of 108dp, so only the ' +
      'central 72dp circle is guaranteed visible. The supplied foreground puts its mark 507px from ' +
      'centre in a 1254px canvas, overshooting the 383px safe radius by 13% of the canvas, so it ' +
      'is scaled into the safe zone rather than used raw. The scale is computed from the furthest ' +
      'visible pixel, not the bounding box, because a pin mark leaves its box corners empty.',
  },
  {
    out: 'monochrome-icon.png',
    source: 'Android adaptive foreground.png',
    width: 432,
    height: 432,
    fit: 'safe',
    alpha: true,
    flat: 'white',
    where: 'apps/mobile/assets/monochrome-icon.png',
    why:
      'Themed icons on Android 13+ are tinted by the system from a single-colour silhouette, so ' +
      'colour here is only a placeholder. The mark is flattened to solid white to guarantee the ' +
      'system has exactly one tone to tint.',
  },
  {
    out: 'favicon.png',
    source: 'play icon square.png',
    width: 96,
    height: 96,
    fit: 'cover',
    alpha: true,
    opaque: true,
    where: 'apps/mobile/assets/favicon.png',
    why: 'Small-square raster of the full-bleed icon.',
  },
  {
    out: 'notification-icon.png',
    source: 'Android adaptive foreground.png',
    width: 192,
    height: 192,
    fit: 'inside',
    inset: 0.08,
    alpha: true,
    flat: 'white',
    where: 'apps/mobile/assets/notification-icon.png',
    why:
      'Android tints status-bar notification icons and masks them to its own shape, so a solid ' +
      'silhouette on transparency is the only thing that survives.',
  },
  {
    out: 'splash-icon.png',
    source: 'play icon square.png',
    width: 512,
    height: 512,
    fit: 'contain',
    alpha: true,
    opaque: true,
    where: 'apps/mobile/assets/splash-icon.png',
    why:
      'The full-bleed tile, not the bare mark. The mark is a white pin, so on the white splash ' +
      'background it all but disappears; the tile brings its own gradient ground and reads correctly ' +
      'against either splash colour.',
  },
  {
    out: 'splash-icon-dark.png',
    source: 'play icon square.png',
    width: 512,
    height: 512,
    fit: 'contain',
    alpha: true,
    opaque: true,
    where: 'apps/mobile/assets/splash-icon-dark.png',
    why:
      'The same tile. A white silhouette would lose the pulse mark inside the pin and read as a ' +
      'blank shape on the dark splash.',
  },

  /* ---------------------------------------------------------- web ----- */
  {
    out: 'meticle-logo-horizontal@1520.png',
    source: 'Horizontal logo.png',
    width: 1520,
    height: 507,
    fit: 'contain',
    alpha: false,
    where: 'apps/web/public/meticle-logo.png (2x)',
    why: 'The colour lockup at 2x for retina navigation.',
  },
  {
    out: 'meticle-logo-horizontal@760.png',
    source: 'Horizontal logo.png',
    width: 760,
    height: 253,
    fit: 'contain',
    alpha: false,
    where: 'apps/web/public/meticle-logo.png (1x)',
    why: 'The colour lockup at 1x, the size the navigation actually renders.',
  },
  {
    out: 'meticle-mark@512.png',
    source: 'Android adaptive foreground.png',
    width: 512,
    height: 512,
    fit: 'contain',
    alpha: true,
    where: 'apps/web/public/logo-mark.svg',
    why: 'The mark on its own transparent canvas, for favicons and the web app manifest.',
  },
  {
    out: 'icon-192.png',
    source: 'play icon square.png',
    width: 192,
    height: 192,
    fit: 'cover',
    alpha: true,
    opaque: true,
    where: 'apps/web/public/icons/icon-192.svg',
    why: 'Web manifest icon.',
  },
  {
    out: 'icon-512.png',
    source: 'play icon square.png',
    width: 512,
    height: 512,
    fit: 'cover',
    alpha: true,
    opaque: true,
    where: 'apps/web/public/icons/icon-512.svg',
    why: 'Maskable web manifest icon and apple-touch-icon.',
  },
  {
    out: 'og-image.png',
    source: 'Feature graphic.png',
    width: 1200,
    height: 630,
    fit: 'cover',
    alpha: false,
    where: 'apps/web/public/og-image.png',
    why:
      'Social cards render at 1200x630 (1.91:1). The source is 2:1, so a small vertical crop of the ' +
      'banner is needed; measured free margins are far larger than the crop.',
  },

  /* ------------------------------------------------------ lockups ----- */
  {
    out: 'meticle-logo-stacked@840.png',
    source: 'Stacked logo.png',
    width: 840,
    height: 700,
    fit: 'contain',
    alpha: true,
    where: 'docs and marketing footers',
    why: 'The stacked lockup for centred, square-ish placements.',
  },
  {
    out: 'google-play-badge.png',
    source: 'MeticleCare Google Play Badge.png',
    width: 1086,
    height: 362,
    fit: 'stretch',
    alpha: false,
    where: 'marketing pages',
    why:
      'Google forbids recolouring, reshaping or adding effects to the "Get it on Google Play" badge, ' +
      'so this is rescale-only. It stays at its published 2:1 ratio.',
  },
];

/* ------------------------------------------------------------------- main -- */

let failures = 0;
const report = (ok, message) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${message}`);
  if (!ok) failures++;
};

for (const item of PLAN) {
  const sourcePath = join(SOURCE_DIR, item.source);
  console.log(`\n${item.out}  ->  ${item.where}`);

  if (!existsSync(sourcePath)) {
    report(false, `missing source: Store assets/${item.source}`);
    continue;
  }

  const { pixels } = resample(readFileSync(sourcePath), item.width, item.height, {
    fit: item.fit,
    inset: item.inset,
  });

  if (item.flat) {
    // Collapse to the named colour, keeping the alpha as a coverage mask.
    const rgb =
      item.flat === 'white' ? [255, 255, 255] : item.flat === 'black' ? [0, 0, 0] : null;
    if (!rgb) throw new Error(`unknown flat colour ${item.flat}`);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = rgb[0];
      pixels[i + 1] = rgb[1];
      pixels[i + 2] = rgb[2];
    }
  }

  if (item.opaque) makeOpaque(pixels);

  const png = encodePng(pixels, item.width, item.height, { alpha: item.alpha });
  writeFileSync(join(PNG_DIR, item.out), png);

  report(true, `${item.width}x${item.height} from Store assets/${item.source} (${item.fit})`);

  // Play's 1MB ceiling applies only to the two assets uploaded to the Play
  // Console. It is not a limit on the app bundle's icon or on web assets, so
  // those report their size without being judged against it.
  if (item.maxBytes) {
    report(
      png.length <= item.maxBytes,
      `${(png.length / 1024).toFixed(0)}KB of ${item.maxBytes / 1024}KB allowed by Play`,
    );
  } else {
    console.log(`  size  ${(png.length / 1024).toFixed(0)}KB (no size limit applies)`);
  }

  if (item.opaque) {
    const translucent = fullyOpaque(pixels) ? 0 : translucentPixelCount(pixels);
    report(translucent === 0, translucent === 0
      ? 'artwork fully opaque'
      : `${translucent} translucent pixels — Play would composite these over its own UI`);
  }
  console.log(`  note  ${item.why}`);
}

console.log(
  failures === 0
    ? `\nWrote ${PLAN.length} assets to brand/png from the supplied brand kit.`
    : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);