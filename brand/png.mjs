/**
 * A minimal PNG encoder.
 *
 * ## Why this exists
 *
 * `@resvg/resvg-js` can only write 32-bit RGBA PNGs, and Google Play's
 * requirements are not uniform across assets:
 *
 *   * App icon       — "32-bit PNG (with alpha)"
 *   * Feature graphic — "JPEG or 24-bit PNG (no alpha)"
 *
 * A single RGBA encoder cannot satisfy both, and handing Play a 32-bit feature
 * graphic is a rejection. This writes colour type 6 (RGBA) or colour type 2
 * (RGB) from the same raw pixel buffer.
 *
 * It encodes rather than decodes-and-re-encodes: resvg hands back a raw RGBA
 * buffer via `renderedImage.pixels`, so there is no PNG decoding, filter
 * reversal or re-compression step to get wrong.
 *
 * Scanlines are filtered adaptively. Storing every row literally (filter 0)
 * costs about six times the file size on smooth gradients such as this brand's
 * ground, because a gradient's neighbours differ by one or two units per
 * channel — differences the Up and Paeth filters cancel almost entirely. Each
 * row picks whichever of the five filters has the smallest sum of absolute
 * differences, which is the heuristic the PNG specification recommends.
 */
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** CRC-32 as specified by PNG (IEEE 802.3 polynomial, reflected). */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/**
 * The PNG Paeth predictor, per the specification.
 *
 * Picks whichever of left, above and upper-left a decoder is most likely to
 * predict, which is what makes it the best of the five on this brand's smooth
 * gradients and curved shapes.
 */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Filter one scanline with all five candidates and keep the smallest.
 *
 * "Smallest" is measured as the sum of absolute signed deviations, which is the
 * heuristic libpng uses: it tracks how well the values will compress without
 * needing an absolute value, which deflate would turn back into literals.
 *
 * @returns {{filter: number, data: Buffer}}
 */
function filterRow(line, prior, stride, channels) {
  let best = null;

  for (let filter = 0; filter < 5; filter++) {
    const data = Buffer.alloc(stride);
    let score = 0;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prior ? prior[i] : 0;
      const c = prior && i >= channels ? prior[i - channels] : 0;
      let v;
      switch (filter) {
        case 0: v = line[i]; break;
        case 1: v = line[i] - a; break;
        case 2: v = line[i] - b; break;
        case 3: v = line[i] - ((a + b) >> 1); break;
        default: v = line[i] - paeth(a, b, c); break;
      }
      v &= 0xff;
      data[i] = v;
      score += v < 128 ? v : 256 - v;
    }
    if (!best || score < best.score) best = { filter, data, score };
  }

  return best;
}

/** Store a scanline literally, as the `noFilter` baseline. */
function unfilteredRow(line, stride) {
  const data = Buffer.alloc(stride);
  line.copy(data, 0, 0, stride);
  return { filter: 0, data };
}

/**
 * Encode raw pixels to a PNG buffer.
 *
 * @param {Buffer|Uint8Array} pixels  RGBA bytes, `width * height * 4` long.
 * @param {number} width
 * @param {number} height
 * @param {{ alpha?: boolean, noFilter?: boolean }} [options]  `alpha: false`
 *   writes a 24-bit RGB PNG with no alpha channel at all; `alpha: true` (the
 *   default) writes 32-bit RGBA. Any alpha value in the source is discarded in
 *   the 24-bit case, so only pass fully opaque pixels when flattening.
 *   `noFilter: true` stores every scanline literally, which is a larger but
 *   still correct file — it exists as the baseline the compression test
 *   measures against.
 */
export function encodePng(pixels, width, height, { alpha = true, noFilter = false } = {}) {
  const expected = width * height * 4;
  if (pixels.length !== expected) {
    throw new Error(`expected ${expected} bytes of RGBA for ${width}x${height}, got ${pixels.length}`);
  }

  const channels = alpha ? 4 : 3;
  const colourType = alpha ? 6 : 2;
  const stride = width * channels;

  // Pack the RGBA source down to the output channel count once, then filter
  // row by row. The previous row is kept because Up and Paeth need it, so two
  // buffers are swapped each pass — aliasing a single one would corrupt every
  // row after the first.
  let row = Buffer.alloc(stride);
  let prior = null;
  const raw = Buffer.alloc(height * (stride + 1));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      const d = x * channels;
      row[d] = pixels[s];
      row[d + 1] = pixels[s + 1];
      row[d + 2] = pixels[s + 2];
      if (alpha) row[d + 3] = pixels[s + 3];
    }

    const { filter, data } = noFilter
      ? unfilteredRow(row, stride)
      : filterRow(row, prior, stride, channels);
    const rowStart = y * (stride + 1);
    raw[rowStart] = filter;
    data.copy(raw, rowStart + 1);

    // `row` becomes the next iteration's `prior`, and a fresh buffer is needed.
    const next = prior && prior.length === stride ? prior : Buffer.alloc(stride);
    if (prior) row.copy(prior);
    prior = row;
    row = next;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = colourType;
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter method: adaptive
  ihdr[12] = 0; // interlace: none

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Every pixel fully opaque?
 *
 * Play's wording — "32-bit PNG (with alpha)" for the icon but "doesn't include
 * any transparency" for the background — is not a contradiction. The container
 * carries an alpha channel; the artwork inside it must be opaque. If any pixel
 * were translucent, Play would composite it over its own UI background and the
 * icon would render differently on every surface.
 */
export function fullyOpaque(pixels) {
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] !== 255) return false;
  }
  return true;
}

/** Count of non-opaque pixels, for a useful error message. */
export function translucentPixelCount(pixels) {
  let n = 0;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] !== 255) n++;
  }
  return n;
}

/* ----------------------------------------------------------------- decode -- */

/**
 * Read a PNG back into raw pixels, so a checker can assert properties of the
 * file that actually exists on disk rather than of the pixels that were meant
 * to go into it.
 *
 * Handles colour types 2 (RGB) and 6 (RGBA) at bit depth 8, with all five
 * scanline filters. That is everything this project produces; anything else
 * throws rather than guessing.
 */
export function decodePng(buffer) {
  const signature = buffer.subarray(0, 8);
  if (!signature.equals(SIGNATURE)) throw new Error('not a PNG');

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colourType = 0;
  const idat = [];

  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colourType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNGs are not supported');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`);
  if (colourType !== 2 && colourType !== 6) throw new Error(`unsupported colour type ${colourType}`);

  const channels = colourType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const row = y * stride;
    const prior = row - stride;

    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[row + i - channels] : 0; // left
      const b = y > 0 ? out[prior + i] : 0; // up
      const c = y > 0 && i >= channels ? out[prior + i - channels] : 0; // up-left
      let value = line[i];
      switch (filter) {
        case 0: break;
        case 1: value += a; break;
        case 2: value += b; break;
        case 3: value += (a + b) >> 1; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          break;
        }
        default: throw new Error(`unknown filter ${filter} on row ${y}`);
      }
      out[row + i] = value & 0xff;
    }
  }

  return { width, height, colourType, channels, pixels: out };
}

/**
 * Header facts readable without decompressing the image data — cheap enough to
 * run over every asset, and enough to check the format-level requirements.
 */
export function readPngHeader(buffer) {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colourType: buffer[25],
    interlaced: buffer[28] !== 0,
  };
}