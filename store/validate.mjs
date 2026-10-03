/**
 * Validate store/listing.json before anything is sent to Play.
 *
 *   node store/validate.mjs
 *
 * Deliberately separate from the publish script and runnable with no
 * credentials: the whole value of having the listing as data is that a typo is
 * caught on a laptop, not after an edit has been committed to a live store
 * listing. Play's own limit is enforced here because Play does not validate
 * character counts the way it validates structure - it silently rejects or
 * truncates, which is worse.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LISTING_PATH = join(ROOT, 'store', 'listing.json');

/** Play's documented limits. Title 30, short description 80, full description 4000. */
export const LIMITS = {
  title: 30,
  shortDescription: 80,
  fullDescription: 4000,
};

/**
 * Play's style rules for listing copy, from the "Preview asset usage and
 * content guidelines" page. These are not length limits - they are the ones
 * that get a listing taken down or an app suspended.
 */
const PROMOTIONAL_PATTERNS = [
  { re: /\b(best|number one|#1|no\. ?1|top rated|leading|award[- ]winning)\b/i, why: 'ranking or superlative claim' },
  { re: /\b(download now|install now|get it now|buy now|subscribe now|try now|free trial)\b/i, why: 'call to action' },
  { re: /\b(cheap|cheapest|lowest price|best price|\$1|sale|discount)\b/i, why: 'pricing or promotion' },
  { re: /\b(certified|accredited|compliant with|iso ?27001|hipaa)\b/i, why: 'unsubstantiated certification claim' },
  { re: /[★☆]/u, why: 'symbol Play asks listing copy to avoid' },
];

const problems = [];
const warnings = [];

const fail = (path, message) => problems.push(`${path}: ${message}`);
const warn = (path, message) => warnings.push(`${path}: ${message}`);

export function loadListing() {
  return JSON.parse(readFileSync(LISTING_PATH, 'utf8'));
}

export function validate(listing = loadListing()) {
  problems.length = 0;
  warnings.length = 0;

  const { packageName, pushable, consoleOnly } = listing;

  if (!packageName || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName)) {
    fail('packageName', `"${packageName}" is not a valid Android package name`);
  }

  const defaultLanguage = pushable?.defaultLanguage;
  if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(defaultLanguage || '')) {
    fail('pushable.defaultLanguage', `"${defaultLanguage}" is not a BCP-47 language tag such as en-GB`);
  }

  const listings = pushable?.listings ?? {};
  const languages = Object.keys(listings);
  if (languages.length === 0) fail('pushable.listings', 'at least one language is required');
  if (defaultLanguage && !listings[defaultLanguage]) {
    fail('pushable.listings', `defaultLanguage "${defaultLanguage}" has no listing; Play would fall back to nothing`);
  }

  for (const [lang, entry] of Object.entries(listings)) {
    const at = `pushable.listings.${lang}`;

    for (const field of ['title', 'shortDescription', 'fullDescription']) {
      const value = entry?.[field];
      if (typeof value !== 'string' || value.length === 0) {
        fail(`${at}.${field}`, 'required and must be a non-empty string');
        continue;
      }
      const limit = LIMITS[field];
      if (value.length > limit) {
        fail(`${at}.${field}`, `${value.length} characters, over Play's limit of ${limit}`);
      }
      if (value !== value.trim()) {
        fail(`${at}.${field}`, 'has leading or trailing whitespace, which Play counts');
      }
      if (/\s{2,}/.test(value.replace(/\n\n/g, ''))) {
        warn(`${at}.${field}`, 'contains a run of spaces');
      }
    }

    if (entry?.title && /^\s|\s$/.test(entry.title)) {
      fail(`${at}.title`, 'leading or trailing whitespace');
    }

    for (const [field, value] of Object.entries(entry ?? {})) {
      if (typeof value !== 'string') continue;
      for (const { re, why } of PROMOTIONAL_PATTERNS) {
        if (re.test(value)) {
          fail(`${at}.${field}`, `Play restricts listing copy for ${why} (matched ${re})`);
        }
      }
      // Play rejects some characters outright in listing fields.
      // Escaped rather than written as literal control bytes: the byte range is
      // C0 minus tab/CR/LF, and a literal NUL in the source makes git treat this
      // whole file as binary, which hides the diff for a listing-validator change.
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
        fail(`${at}.${field}`, 'contains a control character');
      }
    }
  }

  // Images must exist and be the ones the brand build actually produced.
  for (const [slot, spec] of Object.entries(pushable?.images ?? {})) {
    const at = `pushable.images.${slot}`;
    if (!spec?.file) {
      fail(`${at}.file`, 'required');
      continue;
    }
    if (!existsSync(join(ROOT, spec.file))) {
      fail(`${at}.file`, `${spec.file} does not exist. Run: npm run brand:build`);
    }
    if (!spec.type) fail(`${at}.type`, 'required: the Play imageType, e.g. icon or featureGraphic');
  }

  // Data safety internal consistency. Play validates the form as a whole, so a
  // contradiction here is a rejection rather than a field-level error.
  const ds = pushable?.dataSafety;
  if (ds) {
    const at = 'pushable.dataSafety';
    const rows = ds.data ?? [];

    if (ds.collectsOrSharesUserData && rows.length === 0) {
      fail(at, 'collectsOrSharesUserData is true but no data types are declared');
    }
    if (!ds.collectsOrSharesUserData && rows.length > 0) {
      fail(at, 'declares data types but collectsOrSharesUserData is false');
    }
    if (ds.collectsOrSharesUserData && rows.length > 0 && !ds.providesDeletionRequestMechanism) {
      fail(at, 'Play requires indicating whether a deletion mechanism is provided');
    }

    const seen = new Set();
    for (const [i, row] of rows.entries()) {
      const rowAt = `${at}.data[${i}]`;
      if (!row.group || !row.type) fail(rowAt, 'group and type are required to identify the Play data type');
      const key = `${row.group}/${row.type}`;
      if (seen.has(key)) fail(rowAt, `duplicate declaration for ${key}`);
      seen.add(key);

      if (typeof row.collected !== 'boolean' || typeof row.shared !== 'boolean') {
        fail(rowAt, 'collected and shared must be explicit booleans');
      }
      if (!row.collected && !row.shared) {
        warn(rowAt, 'neither collected nor shared - Play has no category for "not handled"');
      }
      if (row.collected && (!row.collectionPurposes || row.collectionPurposes.length === 0)) {
        fail(rowAt, 'collected but no collection purpose given; Play requires at least one');
      }
      if (row.shared && (!row.sharingPurposes || row.sharingPurposes.length === 0)) {
        fail(rowAt, 'shared but no sharing purpose given; Play requires at least one');
      }
      if (row.shared && row.sharingPurposes?.includes('analytics')) {
        fail(rowAt, 'analytics as a sharing purpose would contradict docs/STORE_PRIVACY_ANSWERS.md, which states there is no analytics SDK');
      }
    }

    const shared = rows.filter((r) => r.shared);
    if (shared.length > 0) {
      warn(at, `${shared.length} data type(s) are declared shared - each needs a named third party in the form's disclosure`);
    }

    if (ds.requiresTemplate && !existsSync(join(ROOT, ds.requiresTemplate))) {
      warn(`${at}.requiresTemplate`, `${ds.requiresTemplate} is absent, so the Data safety form cannot be generated. See store/data-safety/README.md.`);
    }
  }

  // Console-only fields are surfaced rather than silently ignored.
  for (const [field, spec] of Object.entries(consoleOnly ?? {})) {
    warn(`consoleOnly.${field}`, 'cannot be set through the Play API; must be done in Play Console');
  }

  return { problems, warnings };
}

// `pathToFileURL` rather than string concatenation: on Windows
// `import.meta.url` is file:///C:/... with three slashes while `'file://' +
// argv[1]` yields two, so the naive comparison silently never matches and the
// script prints nothing and always exits 0. A validator that cannot fail is
// worse than no validator.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const listing = loadListing();
  const { problems, warnings } = validate(listing);
  console.log(`package:    ${listing.packageName}`);
  console.log(`languages:  ${Object.keys(listing.pushable.listings).join(', ')}\n`);

  for (const w of warnings) console.log(`  warn  ${w}`);
  if (warnings.length) console.log('');
  for (const p of problems) console.log(`  FAIL  ${p}`);

  if (problems.length) {
    console.log(`\n${problems.length} problem(s) must be fixed before publishing.`);
    process.exit(1);
  }
  console.log(`Listing is valid. ${warnings.length} note(s).`);
}