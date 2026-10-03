/**
 * Tests for the Play screenshot conformance rules.
 *
 *   node apps/mobile/scripts/play-screenshot-spec.test.mjs
 *
 * Synthetic PNGs rather than real captures, so the rules can be checked against
 * images that deliberately violate them — a real capture only ever produces
 * one shape and would pass every test while the checker was wrong.
 */
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodePng, decodePng, readPngHeader } from '../../../brand/png.mjs';
import { conformScreenshot, checkScreenshotSet, PLAY_LIMITS } from './play-screenshot-spec.mjs';

const dir = mkdtempSync(join(tmpdir(), 'play-shots-'));

/** A solid RGBA image. `alphaByte` sets every pixel's alpha. */
function makePng(width, height, { alpha = true, alphaByte = 255, shade = 60 } = {}) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = shade;
    pixels[i * 4 + 1] = shade + 20;
    pixels[i * 4 + 2] = shade + 40;
    pixels[i * 4 + 3] = alphaByte;
  }
  return encodePng(pixels, width, height, { alpha });
}

function write(name, buffer) {
  const path = join(dir, name);
  writeFileSync(path, buffer);
  return path;
}

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok    ${name}`);
    passed++;
  } catch (error) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message}`);
    process.exitCode = 1;
  }
}

console.log('\nPlay screenshot conformance\n');

test('flattens a 32-bit RGBA capture to 24-bit RGB', () => {
  const path = write('rgba.png', makePng(1080, 1920, { alpha: true }));
  const result = conformScreenshot(path);
  assert.equal(readPngHeader(readFileSync(path)).colourType, 2, 'file on disk should be colour type 2');
  assert.equal(result.rewrote, true);
  assert.equal(result.ok, true);
});

test('the flattened image keeps its pixels', () => {
  const original = decodePng(makePng(64, 64, { alpha: true }));
  const path = write('pixels.png', makePng(64, 64, { alpha: true }));
  conformScreenshot(path);
  const after = decodePng(readFileSync(path));
  assert.equal(after.width, 64);
  assert.equal(after.height, 64);
  // `after` is 24-bit, so its stride is 3 bytes per pixel; `original` is the
  // 32-bit source at 4. Comparing them on the same index would read a green
  // channel out of one and a red channel out of the other and report a
  // corruption that is not there.
  assert.equal(after.channels, 3);
  for (let i = 0; i < 64 * 64; i++) {
    for (let channel = 0; channel < 3; channel++) {
      assert.equal(
        after.pixels[i * 3 + channel],
        original.pixels[i * 4 + channel],
        `channel ${channel} at pixel ${i}`,
      );
    }
  }
});

test('leaves an already-24-bit capture alone', () => {
  const path = write('rgb.png', makePng(1080, 1920, { alpha: false }));
  const result = conformScreenshot(path);
  assert.equal(result.rewrote, false);
  assert.equal(readPngHeader(readFileSync(path)).colourType, 2);
  assert.equal(result.ok, true);
});

test('rejects a capture with translucent pixels rather than compositing it black', () => {
  // Screencap should never do this. If it does, flattening would invent a
  // black background, so the checker has to refuse instead.
  const path = write('translucent.png', makePng(1080, 1920, { alpha: true, alphaByte: 128 }));
  const result = conformScreenshot(path);
  assert.equal(result.ok, false);
  assert.equal(readPngHeader(readFileSync(path)).colourType, 6, 'the file must be left untouched');
});

test('rejects an image below the 320px minimum', () => {
  const path = write('small.png', makePng(200, 400, { alpha: true }));
  const result = conformScreenshot(path);
  assert.equal(result.ok, false);
  assert.ok(result.checks.some(c => !c.ok && /minimum 320px/.test(c.message)));
});

test('rejects an aspect ratio beyond 2:1', () => {
  const path = write('wide.png', makePng(1000, 200, { alpha: true }));
  const result = conformScreenshot(path);
  assert.equal(result.ok, false);
  assert.ok(result.checks.some(c => !c.ok && /aspect ratio/.test(c.message)));
});

test('accepts a normal 1080x1920 phone capture', () => {
  const path = write('phone.png', makePng(1080, 1920, { alpha: true }));
  const result = conformScreenshot(path);
  assert.equal(result.ok, true);
  assert.equal(result.width, 1080);
  assert.equal(result.height, 1920);
});

test('set check rejects fewer than two screenshots', () => {
  const one = conformScreenshot(write('set1.png', makePng(1080, 1920, { alpha: true })));
  const check = checkScreenshotSet([one]);
  assert.equal(check.ok, false);
  assert.ok(check.checks.some(c => !c.ok && /minimum 2/.test(c.message)));
});

test('set check rejects more than eight screenshots', () => {
  const many = Array.from({ length: 9 }, (_, i) =>
    conformScreenshot(write(`set${i}.png`, makePng(1080, 1920, { alpha: true }))));
  assert.equal(checkScreenshotSet(many).ok, false);
});

test('set check passes for a compliant run', () => {
  const good = Array.from({ length: 6 }, (_, i) =>
    conformScreenshot(write(`good${i}.png`, makePng(1080, 1920, { alpha: true }))));
  assert.equal(checkScreenshotSet(good).ok, true);
});

test('the documented limits are Play\'s, not guesses', () => {
  assert.equal(PLAY_LIMITS.minSide, 320);
  assert.equal(PLAY_LIMITS.maxSide, 3840);
  assert.equal(PLAY_LIMITS.maxShots, 8);
  assert.equal(PLAY_LIMITS.minShots, 2);
});

console.log(`\n${passed} passed\n`);