/**
 * Generate the Google Play Data safety CSV from store/listing.json.
 *
 * ## Why a template is required
 *
 * `applications.dataSafety` does not accept JSON. It takes the contents of the
 * CSV you would export from Play Console, in a format documented only by
 * example: a `Question ID` column, a `Response` column, TRUE/FALSE in
 * `Response value`, an `Answer requirement`, and a human-readable label.
 *
 * Those identifiers are long, opaque and only two of them appear in Google's
 * documentation (`PSL_DATA_TYPES_LOCATION`/`PSL_APPROX_LOCATION` and
 * `PSL_DATA_TYPES_PERSONAL`/`PSL_NAME`). Writing the other thirty-odd from
 * memory would produce a file Play rejects as malformed, and a rejection here
 * is silent in the worst way - the form simply does not update.
 *
 * So the identifiers come from a template Play itself exports
 * (App content > Data safety > Start > Export to CSV). This script fills in the
 * response values. If it cannot confidently map a declared data type onto the
 * template, it refuses to produce a CSV rather than guessing.
 *
 * Rows are matched on the human-readable label column, not on the identifiers,
 * because the labels are the one part of the format that is documented as
 * stable and readable.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Parse a whole CSV document into records.
 *
 * Not a line splitter, and that distinction is load-bearing: in Play's export
 * the human-readable label cell is a *quoted, multi-line* value -
 * `"Personal info\nName"` - and every row carries the category, the question
 * and its choices on separate lines inside one cell. Splitting on newlines
 * would tear each record into fragments and silently pair the wrong label with
 * the wrong question, producing a CSV that uploads cleanly and declares the
 * wrong things.
 */
export function parseCsv(text) {
  const records = [];
  let field = '';
  let record = [];
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch; // newlines inside quotes are ordinary characters
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\r') {
      // ignore
    } else if (ch === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records.filter((r) => r.some((c) => c.trim().length > 0));
}

/** Quote a field if it needs it, and strip characters CSV cannot carry cleanly. */
function csvField(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** "Personal info - name" -> "personal info name" */
const normalise = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Split a declared label into the two parts Play's label column carries, which
 * are the category and then the data type: "Personal info - name" becomes
 * ["personal info", "name"].
 */
function labelParts(label) {
  const [category, ...rest] = String(label).split(/\s+-\s+/);
  return [normalise(category), normalise(rest.join(' '))];
}

/**
 * Our labels carry a parenthetical qualifier, because the declaration needs to
 * say *what* a broad Play data type actually is here: "Personal info - other
 * info (date of birth)" is Play's "Other info". These map the normalised type
 * portion back to Play's own data-type name.
 *
 * Keys and values are both in normalised form (lowercase, spaces only). An
 * earlier version keyed some entries on "category + type" while looking them
 * up on type alone, so half the table silently never matched.
 */
const ALIASES = {
  'other info date of birth': 'other info',
  'other financial info payroll mileage': 'other financial info',
  'other user generated content care notes': 'other user generated content',
  'app interactions audit log': 'app interactions',
  'push token': 'device or other ids',
};

const TRUE = 'TRUE';

/**
 * Build the filled CSV.
 *
 * Returns `{ csv, unmatched, summary }`. `unmatched` is non-empty when a
 * declared data type could not be found in the template, which is the signal
 * that the template is stale or the label has drifted.
 */
export function buildDataSafetyCsv(templateText, dataSafety) {
  const records = parseCsv(templateText);
  if (records.length < 2) {
    throw new Error('Template CSV has no rows. Export it from Play Console: App content > Data safety > Start > Export to CSV.');
  }

  const header = records[0].map((h) => normalise(h));
  const col = (name) => header.indexOf(normalise(name));
  const iQuestion = col('question id machine readable');
  const iResponse = col('response machine readable');
  const iValue = col('response value');
  const iLabel = col('human friendly question label');

  if (iQuestion === -1 || iValue === -1) {
    throw new Error(
      `Template CSV is missing required columns. Found: ${header.join(' | ')}. ` +
        'Expected "Question ID (machine readable)" and "Response value".',
    );
  }

  const body = records.slice(1);

  // Index the template's top-level data-type rows by normalised label. Each
  // record's label is a multi-line cell; the category is its first line and the
  // data type name the last, e.g. "Location\nPrecise location".
  const dataTypeRows = new Map();
  body.forEach((cells, index) => {
    const question = cells[iQuestion] ?? '';
    if (!question.startsWith('PSL_DATA_TYPES_')) return;
    const labelLines = (iLabel === -1 ? '' : cells[iLabel] ?? '')
      .split('\n')
      .map(normalise)
      .filter(Boolean);
    if (labelLines.length === 0) return;
    const type = labelLines[labelLines.length - 1];
    dataTypeRows.set(`${labelLines[0]}|${type}`, { index, question, response: cells[iResponse] ?? '' });
  });

  const unmatched = [];
  const setValue = new Map(); // bodyIndex -> 'TRUE'

  for (const entry of dataSafety.data ?? []) {
    const [category, type] = labelParts(entry.label);
    // The alias *values* are written in readable form ("other user-generated
    // content") while the lookup keys are normalised ("other user generated
    // content"). Comparing the two directly silently fails to match, so the
    // mapped value is normalised too.
    const canonicalType = normalise(ALIASES[type] ?? type);

    const row =
      dataTypeRows.get(`${category}|${canonicalType}`) ??
      dataTypeRows.get(`${category}|${type}`) ??
      // Fall back to the type alone when our category wording differs from
      // Play's ("App info and performance" vs "App activity").
      [...dataTypeRows.entries()].find(([k]) => k.endsWith(`|${canonicalType}`))?.[1];

    if (!row) {
      unmatched.push({ label: entry.label, wanted: `${category}|${canonicalType}` });
      continue;
    }
    if (entry.collected || entry.shared) setValue.set(row.index, TRUE);
  }

  if (unmatched.length > 0) {
    return { csv: null, unmatched, summary: null };
  }

  // Top-level answers, which occupy their own records in the export.
  const flag = (pattern) => {
    const re = new RegExp(pattern, 'i');
    for (const [index, cells] of body.entries()) {
      const question = cells[iQuestion] ?? '';
      const label = normalise(iLabel === -1 ? '' : cells[iLabel] ?? '');
      if (re.test(question) || re.test(label)) {
        setValue.set(index, TRUE);
        return true;
      }
    }
    return false;
  };

  const found = {
    collectsOrSharesUserData: flag('COLLECTS_OR_SHARES|collect or share'),
    encryptedInTransit: flag('ENCRYPTED_IN_TRANSIT|encrypted in transit'),
    deletionRequestMechanism: flag('DELETION_REQUEST|deletion request'),
  };

  const rebuilt = [records[0]];
  body.forEach((cells, index) => {
    const copy = [...cells];
    if (setValue.has(index)) copy[iValue] = setValue.get(index);
    rebuilt.push(copy.map(csvField).join(','));
  });

  return {
    csv: rebuilt.join('\n') + '\n',
    unmatched: [],
    summary: {
      rowsAnswered: setValue.size,
      dataTypes: (dataSafety.data ?? []).length,
      shared: (dataSafety.data ?? []).filter((d) => d.shared).length,
      found,
    },
  };
}

/** Load the template, build the CSV, and refuse rather than guess. */
export function generate({ templatePath, outputPath, dataSafety }) {
  if (!existsSync(templatePath)) {
    throw new Error(
      `Data safety template not found at ${templatePath}.\n` +
        'Export it from Play Console: App content > Data safety > Start > Export to CSV, and save it there.\n' +
        'See store/data-safety/README.md for why the question identifiers are not hardcoded here.',
    );
  }

  const { csv, unmatched, summary } = buildDataSafetyCsv(readFileSync(templatePath, 'utf8'), dataSafety);

  if (!csv) {
    const lines = unmatched.map((u) => `  - ${u.label}  (looked for "${u.wanted}")`).join('\n');
    throw new Error(
      `Could not map ${unmatched.length} declared data type(s) onto the template:\n${lines}\n\n` +
        'Refusing to guess at Play\'s question identifiers. Re-export the template, or fix the labels in store/listing.json.',
    );
  }

  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, csv, 'utf8');
  }
  return { csv, summary };
}