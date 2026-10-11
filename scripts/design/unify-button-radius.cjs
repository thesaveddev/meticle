/**
 * One-off codemod: unify product button radius.
 *
 * Product pages (apps/web/src, excluding pages/marketing and marketing
 * components) sprinkle `borderRadius: N | 'Npx'` inside the `sx` prop of MUI
 * <Button> elements. The theme (`createMeticleTheme`) already sets
 * `MuiButton.root.borderRadius: 10` (+ sizeSmall 9), so every stray value —
 * `2` (24px), `1.5` (18px), `3` (36px) — fights the rest of the product and
 * is exactly the "some buttons rounded, some rectangular" inconsistency.
 *
 * What this does NOT touch:
 *  - pages/marketing/** and components/marketing/** (separate visual system)
 *  - non-Button elements (Paper, Box, Alert, TextField…) that legitimately
 *    use their own radii
 *  - borderRadius values that are not scalars (theme refs etc. are kept)
 *
 * Usage:  node scripts/design/unify-button-radius.cjs [--write]
 * Without --write it prints a per-file summary only.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..', 'apps', 'web', 'src');
const SKIP_DIRS = new Set(['marketing']);
const WRITE = process.argv.includes('--write');

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(p);
    } else if (/\.(tsx|ts)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      files.push(p);
    }
  }
})(root);

/**
 * Find `sx={` ... `}` spans that belong to a <Button ...> opening tag.
 * We work on raw text with a tiny balanced-brace scanner; the codebase is
 * consistently formatted (Prettier), so text spans are reliable here.
 */
let totalEdits = 0;
const editedFiles = [];
const out = [];

for (const file of files) {
  const rel = path.relative(root, file);
  if (/pages[\\/]marketing[\\/]|components[\\/]marketing[\\/]/.test(rel)) continue;
  let src = fs.readFileSync(file, 'utf8');
  let edits = 0;

  // Locate opening tags: '<Button' up to the matching '>'. Then inside that
  // tag find `sx={` … matching `}` and, within the sx object, a direct
  // (or nested in the object literal, one level) `borderRadius: <scalar>`.
  const tagRe = /<Button\b/g;
  let m;
  let transformed = src;
  const spans = [];
  while ((m = tagRe.exec(transformed))) {
    const tagStart = m.index;
    // Find the end of the opening tag: first '>' that is not inside braces/strings/JSX comment.
    let i = tagStart, depth = 0, end = -1;
    while (i < transformed.length) {
      const ch = transformed[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) { end = i; break; }
      i++;
    }
    if (end < 0) break;
    const tag = transformed.slice(tagStart, end + 1);
    // Only component="button"/"a" or plain MUI Buttons — all inherit theme.
    const sxMatch = /\bsx=\{/g;
    let sm;
    while ((sm = sxMatch.exec(tag))) {
      const objStart = sm.index + sm[0].length; // position right after 'sx={'
      let d = 1, j = objStart;
      while (j < tag.length && d > 0) {
        const c = tag[j];
        if (c === '{') d++;
        else if (c === '}') d--;
        j++;
      }
      if (d !== 0) continue;
      const objEnd = j - 1; // index of closing '}'
      const obj = tag.slice(objStart, objEnd);
      // Remove only scalar borderRadius entries:  borderRadius: 2, | '24px', etc.
      const cleaned = obj.replace(
        /(\n?[ \t]*)borderRadius:\s*(?:\d+|[\d.]+)(?:px)?\s*,?(\n[ \t]*)?/g,
        (full, pre, post) => {
          // preserve a comma if one followed, to avoid gluing tokens
          if (full.includes(',')) return '';
          return '';
        },
      );
      if (cleaned !== obj) {
        spans.push({ start: tagStart + objStart, end: tagStart + objEnd, old: obj, neu: cleaned });
        edits++;
      }
      break; // one sx per tag is all we care about
    }
  }


  if (edits > 0) {
    // Apply spans back-to-front so earlier offsets stay valid.
    spans.sort((a, b) => b.start - a.start);
    for (const s of spans) transformed = transformed.slice(0, s.start) + s.neu + transformed.slice(s.end);
    if (WRITE) fs.writeFileSync(file, transformed, 'utf8');
    editedFiles.push({ rel, edits });
    totalEdits += edits;
  }
  void transformed;
  void src;
  void out;
}

console.log(`${WRITE ? 'WRITE' : 'DRY '} ${totalEdits} radius overrides across ${editedFiles.length} files`);
for (const f of editedFiles) console.log(`  ${f.rel} (${f.edits})`);
