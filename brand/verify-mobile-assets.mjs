/**
 * Render the generated app assets the way Android actually displays them.
 *
 * None of these can be judged by looking at the PNG alone. An adaptive icon is
 * a background colour plus a foreground layer, then masked; a notification icon
 * is tinted by the system; a splash is centred on a flat background. Rendering
 * each one that way is the only check that catches a mark drifting out of the
 * safe zone or turning invisible on the wrong background.
 *
 * Run: node brand/verify-mobile-assets.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { encodePng } from './png.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, '..', 'apps', 'mobile', 'assets');
const OUT = join(HERE, '..', 'tmp', 'brand-preview');

/** Matches the `backgroundColor` and dark splash now set in app.json. */
const ADAPTIVE_BG = '#1CAAF2';
const DARK_SPLASH_BG = '#0045E2';

mkdirSync(OUT, { recursive: true });

const uri = (name) => `data:image/png;base64,${readFileSync(join(ASSETS, name)).toString('base64')}`;

/**
 * Draw an adaptive icon the way the launcher does: background colour, then the
 * foreground layer scaled to the full 108dp canvas, then the mask applied.
 */
function adaptive(maskShape, size = 300) {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` width="${size}" height="${size}" viewBox="0 0 108 108">`,
    `<defs><clipPath id="m">${maskShape(108)}</clipPath></defs>`,
    `<g clip-path="url(#m)">`,
    `<rect width="108" height="108" fill="${ADAPTIVE_BG}"/>`,
    `<image x="0" y="0" width="108" height="108" preserveAspectRatio="none"`,
    ` href="${uri('adaptive-icon-foreground.png')}"/>`,
    `</g>`,
    `</svg>`,
  ].join('');
  return render(svg, size);
}

/** The 66dp guaranteed-visible circle, drawn over the icon for inspection. */
function withSafeCircle(png, size) {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` width="${size}" height="${size}">`,
    `<image x="0" y="0" width="${size}" height="${size}" href="data:image/png;base64,${png}"/>`,
    `<circle cx="${size / 2}" cy="${size / 2}" r="${(size * 66) / 108 / 2}" fill="none"`,
    ` stroke="#ff2d55" stroke-width="2" stroke-dasharray="5 4"/>`,
    `</svg>`,
  ].join('');
  return render(svg, size);
}

/** Composite an image over a flat colour, which is how a splash is displayed. */
function onBackground(name, bg, size = 300) {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` width="${size}" height="${size}" viewBox="0 0 100 100">`,
    `<rect width="100" height="100" fill="${bg}"/>`,
    // 180px wide on a splash, per imageWidth in app.json, centred.
    `<image x="0" y="30" width="100" height="40" preserveAspectRatio="xMidYMid meet"`,
    ` href="${uri(name)}"/>`,
    `</svg>`,
  ].join('');
  return render(svg, size);
}

function render(svg, size) {
  const px = Buffer.from(new Resvg(svg, { fitTo: { mode: 'original' } }).render().pixels);
  return encodePng(px, size, size, { alpha: false }).toString('base64');
}

const panels = [
  {
    title: 'Adaptive icon — circle mask',
    note: 'Pixel Launcher default. Red dashed = the 66dp guaranteed-visible circle.',
    img: withSafeCircle(adaptive((s) => `<circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/>`), 300),
  },
  {
    title: 'Adaptive icon — squircle mask',
    note: 'Most OEM launchers, and the themed-icon shape on Android 13+.',
    img: withSafeCircle(
      adaptive((s) => `<rect x="0" y="0" width="${s}" height="${s}" rx="${s * 0.22}" ry="${s * 0.22}"/>`),
      300,
    ),
  },
  {
    title: 'Adaptive icon — square mask',
    note: 'The most aggressive common mask; nothing may rely on the corners.',
    img: withSafeCircle(adaptive(() => `<rect x="0" y="0" width="108" height="108"/>`), 300),
  },
  {
    title: 'Themed icon (monochrome)',
    note: 'Android tints this silhouette; here it is shown as the system renders it.',
    img: render(
      [
        `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">`,
        `<rect width="300" height="300" fill="#1a1a2e"/>`,
        `<image x="0" y="0" width="300" height="300" href="data:image/png;base64,${readFileSync(join(ASSETS, 'monochrome-icon.png')).toString('base64')}"/>`,
        `</svg>`,
      ].join(''),
      300,
    ),
  },
  {
    title: 'Splash — light',
    note: 'White background, as app.json configures it.',
    img: onBackground('splash-icon.png', '#FFFFFF'),
  },
  {
    title: 'Splash — dark',
    note: `Dark background #${DARK_SPLASH_BG.slice(1)}, as app.json configures it.`,
    img: onBackground('splash-icon-dark.png', DARK_SPLASH_BG),
  },
];

const html = `<!doctype html><meta charset="utf-8">
<body style="background:#111;color:#eee;font:13px/1.5 ui-sans-serif,system-ui;margin:0;padding:24px">
<h2 style="margin:0 0 4px;font-size:16px">App assets, as Android will draw them</h2>
<p style="margin:0 0 24px;color:#93a1b1">Generated from <code>Store assets/</code> by <code>brand/build-from-supplied.mjs</code>.</p>
<div style="display:flex;flex-wrap:wrap;gap:26px">
${panels
  .map(
    (p) => `<figure style="margin:0;width:300px">
  <img src="data:image/png;base64,${p.img}" width="300" style="display:block;border-radius:8px">
  <figcaption style="margin-top:8px"><b style="color:#6ee7b7">${p.title}</b><br><span style="color:#93a1b1">${p.note}</span></figcaption>
</figure>`,
  )
  .join('')}
</div>
</body>`;

writeFileSync(join(OUT, 'mobile-assets.html'), html);
console.log('wrote tmp/brand-preview/mobile-assets.html');