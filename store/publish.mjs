/**
 * Push store/listing.json to Google Play.
 *
 *   node store/publish.mjs                    # dry run: diff against live, change nothing
 *   node store/publish.mjs --apply            # write the listing and images
 *   node store/publish.mjs --apply --data-safety   # also submit the Data safety form
 *
 * Dry run is the default, and that is not a convenience. `edits.commit` is
 * immediate and outward-facing: it changes a live store listing. The diff is
 * printed before anything is sent, so the first run against a real app is a
 * read.
 *
 * Credentials come from `GOOGLE_PLAY_SERVICE_ACCOUNT` (a path to the key JSON)
 * or `--key`. The key is never committed - see the gitignore rules for
 * `meticlecare-*.json` and `*service*account*.json`.
 */
import { readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadListing, validate } from './validate.mjs';
import { getAccessToken, PlayApi } from './play-api.mjs';
import { generate } from './data-safety.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const valueOf = (flag) => {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : undefined;
};

const APPLY = has('--apply');
const WITH_DATA_SAFETY = has('--data-safety');
const KEY = valueOf('--key') || process.env.GOOGLE_PLAY_SERVICE_ACCOUNT;

const listing = loadListing();
const { problems, warnings } = validate(listing);

console.log(`Meticle Care — Play listing ${APPLY ? 'PUBLISH' : 'dry run'}`);
console.log(`package: ${listing.packageName}`);
console.log();

for (const w of warnings) console.log(`  note  ${w}`);
if (warnings.length) console.log();

if (problems.length) {
  console.log('Refusing to run: the listing does not validate.');
  for (const p of problems) console.log(`  FAIL  ${p}`);
  console.log('\nRun `npm run store:validate` for the readable version.');
  process.exit(1);
}

if (!KEY) {
  console.error(
    'No service account key.\n' +
      '  Set GOOGLE_PLAY_SERVICE_ACCOUNT to the path of the key JSON, or pass --key <path>.\n' +
      '  The key is deliberately not in this repository; it is gitignored if you drop one in the root.',
  );
  process.exit(1);
}
if (!readFileSync(KEY, 'utf8')) process.exit(1); // fail early on an unreadable path

const { token, account } = await getAccessToken(KEY);
const api = new PlayApi(token);
console.log(`authenticated as ${account}\n`);

const pkg = listing.packageName;
let edit;
let changed = 0;

try {
  edit = await api.insertEdit(pkg);
  const editId = edit.id;

  // ---------------------------------------------------------- listing text
  const desired = listing.pushable.listings[listing.pushable.defaultLanguage];
  let current = {};
  try {
    current = (await api.getListing(pkg, editId, listing.pushable.defaultLanguage)) ?? {};
  } catch {
    /* no listing yet; everything is an addition */
  }

  for (const field of ['title', 'shortDescription', 'fullDescription']) {
    const from = current[field] ?? '(unset)';
    const to = desired[field];
    const same = current[field] === to;
    console.log(`${same ? '  same ' : '  CHANGE'} ${field}`);
    if (!same) {
      changed++;
      console.log(`    live : ${truncate(from)}`);
      console.log(`    ours : ${truncate(to)}`);
    }
  }
  console.log();

  // -------------------------------------------------------------- images
  for (const [slot, spec] of Object.entries(listing.pushable.images)) {
    const bytes = readFileSync(join(ROOT, spec.file));
    console.log(`  upload ${slot.padEnd(15)} ${spec.file} (${(bytes.length / 1024).toFixed(0)}KB)`);
    changed++;
  }
  console.log();

  if (!APPLY) {
    console.log(`Dry run: ${changed} change(s) would be made. Re-run with --apply.`);
    console.log('\nNot pushable through the API, set these in Play Console:');
    for (const [field, spec] of Object.entries(listing.consoleOnly)) {
      const value = spec.value ? ` (currently ${spec.value})` : '';
      console.log(`  - ${field}${value}`);
    }
  } else {
    // ------------------------------------------------------- write the edit
    await api.updateListing(pkg, editId, {
      language: listing.pushable.defaultLanguage,
      title: desired.title,
      shortDescription: desired.shortDescription,
      fullDescription: desired.fullDescription,
    });
    console.log('  listing written');

    for (const [slot, spec] of Object.entries(listing.pushable.images)) {
      const bytes = readFileSync(join(ROOT, spec.file));
      await api.uploadImage(pkg, editId, listing.pushable.defaultLanguage, spec.type, bytes);
      console.log(`  ${slot} uploaded`);
    }

    await api.commitEdit(pkg, editId);
    console.log('\nEdit committed. The listing is live.');
    edit = null;
  }

  // --------------------------------------------------------- data safety
  if (WITH_DATA_SAFETY) {
    const ds = listing.pushable.dataSafety;
    const templatePath = join(ROOT, ds.requiresTemplate);

    if (ds.requiresTemplate.includes('fixture')) {
      console.error(
        'Refusing to submit Data safety from the fixture template.\n' +
          '  Export the real CSV from Play Console and save it to ' + ds.requiresTemplate + '.',
      );
      process.exitCode = 1;
    } else {
      const { csv, summary } = generate({ templatePath, outputPath: null, dataSafety: ds });
      console.log(`\nData safety: ${summary.rowsAnswered} response(s) across ${summary.dataTypes} data type(s).`);
      if (!APPLY) {
        console.log(`  generated ${(csv.length / 1024).toFixed(1)}KB of CSV — would be submitted with --apply`);
      } else {
        // Not part of an edit: this applies the moment it is accepted, and it
        // overwrites answers already entered in the form.
        await api.setDataSafety(pkg, csv);
        console.log('  Data safety declaration submitted.');
      }
    }
  }
} catch (error) {
  console.error(`\nFailed: ${error.message}`);
  if (edit) {
    await api.deleteEdit(pkg, edit.id);
    console.error('The edit was discarded; nothing was committed.');
  }
  process.exitCode = 1;
}

function truncate(s, n = 70) {
  const one = String(s).replace(/\n/g, ' ');
  return one.length > n ? `${one.slice(0, n)}…` : one;
}