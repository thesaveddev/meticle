/**
 * Make a raw screenshot something Play will actually accept.
 *
 * ## Why this exists
 *
 * `adb exec-out screencap -p` and `xcrun simctl io screenshot` both emit a
 * 32-bit RGBA PNG. Play's published requirement for phone screenshots is
 * "JPEG or 24-bit PNG (no alpha)" — the opposite of the app icon, which must
 * *keep* its alpha channel. So an unprocessed capture is the wrong format for
 * the asset it is destined for, and the upload fails on a rule that is not
 * visible anywhere in the image itself.
 *
 * It is also unverifiable by eye. Everything below is asserted against the
 * bytes on disk, so a capture that would be rejected says so before it is
 * uploaded rather than after.
 *
 * Requirements applied, from Play's "Add preview assets" help page:
 *   - PNG or JPEG, up to 8 MB each
 *   - at least 2 screenshots per device type, at most 8
 *   - each side between 320 px and 3840 px
 *   - aspect ratio 16:9 or 9:16; Play also rejects anything beyond 2:1
 *   - 24-bit PNG, no alpha
 *
 * The PNG codec is imported from `brand/png.mjs`. That module is where the
 * colour-type-2 encoder already lives — the store icon needs exactly the same
 * "write a PNG with no alpha channel" capability — and duplicating a zlib and
 * CRC-32 implementation to avoid a cross-directory import would be worse than
 * the import.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodePng, encodePng, readPngHeader, fullyOpaque } from '../../../brand/png.mjs';

export const PLAY_LIMITS = {
  minSide: 320,
  maxSide: 3840,
  maxBytes: 8 * 1024 * 1024,
  minShots: 2,
  maxShots: 8,
  maxAspectRatio: 2,
};

/**
 * Check one screenshot and, if it carries an alpha channel, rewrite it as
 * 24-bit RGB.
 *
 * Returns the checks rather than throwing, because the host script wants to
 * report every problem across every shot in one go rather than stopping at the
 * first.
 */
export function conformScreenshot(path) {
  const buffer = readFileSync(path);
  const header = readPngHeader(buffer);
  const checks = [];

  const ratio = header.width / header.height;
  const shortSide = Math.min(header.width, header.height);
  const longSide = Math.max(header.width, header.height);

  checks.push({
    ok: shortSide >= PLAY_LIMITS.minSide,
    message: `short side ${shortSide}px (Play minimum ${PLAY_LIMITS.minSide}px)`,
  });
  checks.push({
    ok: longSide <= PLAY_LIMITS.maxSide,
    message: `long side ${longSide}px (Play maximum ${PLAY_LIMITS.maxSide}px)`,
  });
  checks.push({
    ok: ratio <= PLAY_LIMITS.maxAspectRatio && 1 / ratio <= PLAY_LIMITS.maxAspectRatio,
    message: `aspect ratio ${ratio.toFixed(2)}:1 (Play rejects beyond ${PLAY_LIMITS.maxAspectRatio}:1)`,
  });

  let finalBuffer = buffer;
  let rewrote = false;

  if (header.colourType === 6) {
    // Flatten. Screencap should be fully opaque, but this checks rather than
    // assumes — a screenshot with a genuinely translucent region would be
    // composited onto black and look subtly wrong in the listing.
    const decoded = decodePng(buffer);
    if (fullyOpaque(decoded.pixels)) {
      finalBuffer = encodePng(decoded.pixels, decoded.width, decoded.height, { alpha: false });
      rewrote = true;
      checks.push({ ok: true, message: 'had an alpha channel; rewritten as 24-bit RGB' });
    } else {
      checks.push({
        ok: false,
        message: 'has translucent pixels; cannot be flattened to 24-bit without compositing it wrongly',
      });
    }
  } else if (header.colourType === 2) {
    checks.push({ ok: true, message: 'already 24-bit RGB, no alpha' });
  } else {
    checks.push({ ok: false, message: `colour type ${header.colourType}; Play wants 24-bit RGB or JPEG` });
  }

  const bytes = rewrote ? finalBuffer.length : buffer.length;
  checks.push({
    ok: bytes <= PLAY_LIMITS.maxBytes,
    message: `${(bytes / 1024 / 1024).toFixed(2)}MB (Play maximum ${PLAY_LIMITS.maxBytes / 1024 / 1024}MB)`,
  });

  if (rewrote) writeFileSync(path, finalBuffer);

  return {
    path,
    width: header.width,
    height: header.height,
    bytes,
    rewrote,
    digest: createHash('sha256').update(finalBuffer).digest('hex'),
    ok: checks.every(c => c.ok),
    checks,
  };
}

/**
 * Check the set as a whole. Play rejects a listing with fewer than two phone
 * screenshots, which is a property of the run and not of any single file, so
 * it is checked here rather than per shot.
 *
 * Two run-level properties are checked here as well, because neither is
 * visible in a single file and both have produced a set that passed every
 * per-shot check while being unusable:
 *
 *   - **Duplicates.** Seven copies of one frame satisfy every format rule.
 *     `conformScreenshot` digests the bytes it actually wrote, so an app that
 *     never moved between shots is caught rather than reported as a success.
 *   - **Fixture misses.** The app reports which endpoints its fixtures could
 *     not answer. A miss means a panel renders empty in an image that still
 *     looks plausible, so it is a failure here and not a note in the log.
 */
export function checkScreenshotSet(results, { misses = [] } = {}) {
  const name = r => r.path.split(/[\\/]/).pop();
  const checks = [{
    ok: results.length >= PLAY_LIMITS.minShots,
    message: `${results.length} screenshot(s) captured (Play minimum ${PLAY_LIMITS.minShots}, maximum ${PLAY_LIMITS.maxShots})`,
  }];
  if (results.length > PLAY_LIMITS.maxShots) {
    checks[0].ok = false;
    checks[0].message += ' — too many';
  }
  const nonCompliant = results.filter(r => !r.ok);
  checks.push({
    ok: nonCompliant.length === 0,
    message: nonCompliant.length === 0
      ? 'every screenshot meets Play\'s format requirements'
      : `${nonCompliant.length} screenshot(s) do not: ${nonCompliant.map(name).join(', ')}`,
  });

  // Group by digest. Results without one are skipped rather than lumped
  // together: an absent digest is unknown, and treating every unknown as the
  // same file would fail a run that never called `conformScreenshot`.
  const groups = new Map();
  for (const result of results) {
    if (typeof result.digest !== 'string' || result.digest === '') continue;
    const group = groups.get(result.digest) ?? [];
    group.push(result);
    groups.set(result.digest, group);
  }
  const duplicated = [...groups.values()].filter(group => group.length > 1);
  checks.push({
    ok: duplicated.length === 0,
    message: duplicated.length === 0
      ? `all ${results.length} screenshot(s) are distinct images`
      : `${duplicated.length} group(s) of identical screenshot(s): `
        + duplicated.map(group => group.map(name).join(' = ')).join('; ')
        + '. The app did not move between these shots, so the set does not show the app.',
  });

  checks.push({
    ok: misses.length === 0,
    message: misses.length === 0
      ? 'the app answered every request the fixtures cover'
      : `${misses.length} endpoint(s) the fixtures do not answer, so a panel will be empty in the image: `
        + misses.join(', '),
  });

  return { ok: checks.every(c => c.ok), checks };
}

/** The flat list of lines for the host script to print. */
export function formatReport(perFile, set) {
  const lines = [];
  for (const result of perFile) {
    const name = result.path.split(/[\\/]/).pop();
    lines.push(`    ${result.ok ? 'ok  ' : 'FAIL'}  ${name}  ${result.width}x${result.height}, ${(result.bytes / 1024).toFixed(0)}KB`);
    for (const check of result.checks) {
      if (!check.ok) lines.push(`          ${check.message}`);
    }
  }
  for (const check of set.checks) {
    if (!check.ok) lines.push(`    FAIL  ${check.message}`);
  }
  return lines;
}