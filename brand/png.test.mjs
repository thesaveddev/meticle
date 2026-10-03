/**
 * Round-trip tests for the PNG encoder.
 *
 * The encoder writes colour type 2 or 6 and picks a scanline filter per row.
 * Both are easy to get subtly wrong — a mis-indexed predictor or an aliased
 * previous-row buffer produces a file that still decodes, just to the wrong
 * pixels. These tests encode, decode with the same module, and compare bytes,
 * which is the only assertion that catches that.
 *
 * Run: node --test brand/png.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodePng, decodePng, readPngHeader, fullyOpaque } from './png.mjs';

/** Deterministic pseudo-random RGBA, so a failure is reproducible. */
function makePixels(width, height, seed = 1) {
  const px = Buffer.alloc(width * height * 4);
  let s = seed;
  for (let i = 0; i < px.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    px[i] = (s >> 16) & 0xff;
  }
  return px;
}

/** A smooth gradient, which is what the brand artwork actually is. */
function makeGradient(width, height) {
  const px = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      px[i] = Math.round((x / width) * 255);
      px[i + 1] = Math.round((y / height) * 255);
      px[i + 2] = Math.round(((x + y) / (width + height)) * 255);
      px[i + 3] = 255;
    }
  }
  return px;
}

test('32-bit round-trips exactly', () => {
  const width = 61, height = 37;
  const original = makePixels(width, height);
  const decoded = decodePng(encodePng(original, width, height, { alpha: true }));

  assert.equal(decoded.colourType, 6);
  assert.equal(decoded.channels, 4);
  assert.equal(decoded.width, width);
  assert.equal(decoded.height, height);
  assert.deepEqual(decoded.pixels, original);
});

test('24-bit round-trips the RGB channels and drops alpha', () => {
  const width = 61, height = 37;
  const original = makePixels(width, height);
  const decoded = decodePng(encodePng(original, width, height, { alpha: false }));

  assert.equal(decoded.colourType, 2);
  assert.equal(decoded.channels, 3);
  for (let i = 0; i < width * height; i++) {
    assert.equal(decoded.pixels[i * 3], original[i * 4]);
    assert.equal(decoded.pixels[i * 3 + 1], original[i * 4 + 1]);
    assert.equal(decoded.pixels[i * 3 + 2], original[i * 4 + 2]);
  }
});

test('a gradient survives every scanline exactly', () => {
  // Multi-row images exercise the Up and Paeth predictors, which depend on the
  // previous row. An aliased previous-row buffer corrupts every row but the
  // first, so this is the test that would catch that bug.
  const width = 128, height = 96;
  const original = makeGradient(width, height);
  const decoded = decodePng(encodePng(original, width, height, { alpha: true }));
  assert.deepEqual(decoded.pixels, original);
});

test('a single-row image round-trips (no previous row to filter against)', () => {
  const width = 40, height = 1;
  const original = makeGradient(width, height);
  const decoded = decodePng(encodePng(original, width, height, { alpha: true }));
  assert.deepEqual(decoded.pixels, original);
});

test('a single-column image round-trips (no left neighbour)', () => {
  const width = 1, height = 40;
  const original = makeGradient(width, height);
  const decoded = decodePng(encodePng(original, width, height, { alpha: true }));
  assert.deepEqual(decoded.pixels, original);
});

test('filtering shrinks a gradient rather than inflating it', () => {
  // Guards the reason adaptive filtering exists. Storing every row literally is
  // the baseline; without filtering this file is several times larger.
  const width = 512, height = 512;
  const pixels = makeGradient(width, height);

  const filtered = encodePng(pixels, width, height, { alpha: true });

  const unfiltered = encodePng(pixels, width, height, { alpha: true, noFilter: true });
  assert.ok(
    filtered.length < unfiltered.length,
    `filtered ${filtered.length}B should be smaller than unfiltered ${unfiltered.length}B`,
  );
});

test('the header reports the size and colour type actually written', () => {
  const png = encodePng(makePixels(20, 10), 20, 10, { alpha: false });
  const header = readPngHeader(png);
  assert.deepEqual(header, {
    width: 20,
    height: 10,
    bitDepth: 8,
    colourType: 2,
    interlaced: false,
  });
});

test('fullyOpaque detects the distinction Play cares about', () => {
  const px = Buffer.alloc(4 * 4 * 4, 255);
  assert.equal(fullyOpaque(px), true);

  px[3] = 252; // the off-by-three the supplied Play icon actually had
  assert.equal(fullyOpaque(px), false);
});

test('a wrong-sized input is rejected rather than silently truncated', () => {
  assert.throws(
    () => encodePng(Buffer.alloc(10), 4, 4, { alpha: true }),
    /expected 64 bytes of RGBA for 4x4, got 10/,
  );
});