/**
 * Exercise the Data safety CSV builder against a template shaped like the one
 * Play actually exports — including the multi-line quoted label cells that a
 * naive line-splitting parser would tear apart — and prove that an unmappable
 * data type is refused rather than guessed at.
 *
 *   node store/data-safety/make-fixture.mjs
 *
 * The fixture is written to store/data-safety/template.fixture.csv so
 * `node store/publish.mjs --dry-run` has something to work with before anyone
 * has exported the real template. It is never used by `--apply`: that refuses
 * unless the real export is in place.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** One CSV record, with the multi-line label Play emits. */
const row = (question, response, requirement, labelLines) => {
  const label = labelLines.join('\n');
  const fields = [question, response, '', requirement];
  const escaped = fields.map((f) => (/[",\n]/.test(f) ? `"${f.replace(/"/g, '""')}"` : f));
  return `${escaped.join(',')},"${label.replace(/"/g, '""')}"`;
};

const DATA_TYPES = [
  ['PSL_DATA_TYPES_LOCATION', 'PSL_PRECISE_LOCATION', ['Location', 'Precise location']],
  ['PSL_DATA_TYPES_LOCATION', 'PSL_APPROX_LOCATION', ['Location', 'Approximate location']],
  ['PSL_DATA_TYPES_PERSONAL', 'PSL_NAME', ['Personal info', 'Name']],
  ['PSL_DATA_TYPES_PERSONAL', 'PSL_EMAIL_ADDRESS', ['Personal info', 'Email address']],
  ['PSL_DATA_TYPES_PERSONAL', 'PSL_USER_IDS', ['Personal info', 'User IDs']],
  ['PSL_DATA_TYPES_PERSONAL', 'PSL_ADDRESS', ['Personal info', 'Address']],
  ['PSL_DATA_TYPES_PERSONAL', 'PSL_PHONE_NUMBER', ['Personal info', 'Phone number']],
  ['PSL_DATA_TYPES_PERSONAL', 'PSL_OTHER_INFO', ['Personal info', 'Other info']],
  ['PSL_DATA_TYPES_FINANCIAL', 'PSL_OTHER_FINANCIAL_INFO', ['Financial info', 'Other financial info']],
  ['PSL_DATA_TYPES_HEALTH_AND_FITNESS', 'PSL_HEALTH_INFO', ['Health and fitness', 'Health info']],
  ['PSL_DATA_TYPES_MESSAGES', 'PSL_OTHER_IN_APP_MESSAGES', ['Messages', 'Other in-app messages']],
  ['PSL_DATA_TYPES_PHOTOS_AND_VIDEOS', 'PSL_PHOTOS', ['Photos and videos', 'Photos']],
  ['PSL_DATA_TYPES_APP_ACTIVITY', 'PSL_OTHER_USER_GENERATED_CONTENT', ['App activity', 'Other user-generated content']],
  ['PSL_DATA_TYPES_APP_ACTIVITY', 'PSL_APP_INTERACTIONS', ['App activity', 'App interactions']],
  ['PSL_DATA_TYPES_DEVICE_IDS', 'PSL_DEVICE_OR_OTHER_IDS', ['Device or other IDs', 'Device or other IDs']],
];

const records = [
  'Question ID (machine readable),Response (machine readable),Response value,Answer requirement,Human-friendly question label',
  row('DATA_SAFETY_COLLECTS_OR_SHARES_USER_DATA', 'COLLECTS_OR_SHARES_USER_DATA', 'SINGLE_CHOICE', [
    'Data collection and security',
    'Does your app collect or share any of the required user data types?',
    'Yes',
  ]),
  row('DATA_SAFETY_ENCRYPTED_IN_TRANSIT', 'ENCRYPTED_IN_TRANSIT', 'REQUIRED', [
    'Data collection and security',
    'Is all of the user data collected by your app encrypted in transit?',
  ]),
  row('DATA_SAFETY_DELETION_REQUEST_MECHANISM', 'DELETION_REQUEST_MECHANISM', 'REQUIRED', [
    'Data collection and security',
    'Do you provide a way for users to request that their data is deleted?',
  ]),
];

for (const [question, response, labelLines] of DATA_TYPES) {
  records.push(row(question, response, 'MULTIPLE_CHOICE', [...labelLines, '...']));
}

const csv = records.join('\n') + '\n';
const out = join(HERE, 'template.fixture.csv');
mkdirSync(HERE, { recursive: true });
writeFileSync(out, csv, 'utf8');
console.log(`wrote ${out} (${records.length} records, multi-line labels included)`);