import { encryptField, decryptField } from './encryption';

/**
 * Which columns are stored encrypted, and on which table.
 *
 * This is the single place the answer lives. It exists because the list was
 * being carried implicitly: `people.nhs_number` had its own `decryptNhsNumber`
 * helper in one repository, the reporting query had its own inline decrypt, and
 * the third copy of the knowledge was a paragraph in a privacy policy. Three
 * places to update, and the gap between them is exactly where a column gets
 * silently left in plaintext while a document claims it is not.
 *
 * **Adding a column here does nothing on its own.** It must also be encrypted
 * on the write path that populates it, decrypted on every read path that returns
 * it, and widened by a migration if the column is too narrow to hold a
 * ciphertext. `encryptedColumns.sentinel.test.ts` asserts each of those, because
 * the failure mode for this list is a column that looks covered and is not.
 *
 * ## Why these columns
 *
 * The test is the policy's own wording: dates of birth, addresses and telephone
 * numbers, on a person's record and on a staff member's own profile, plus the
 * NHS number. All are identifiers that follow someone around and none is used
 * in a query predicate, so nothing needs to match on them.
 *
 * ## Why these columns are *not* on the list
 *
 * - `locations.address` — the address of a care site, not of a person, and
 *   `scripts/geocode-backfill.ts` filters on it.
 * - `users.email` — the login identifier. Encrypting it would break every
 *   authentication lookup in the product.
 * - `emergency_contacts.phone` — a third party's number, not the subject's.
 *   It is reachable only through `staff_id → staff_profiles → users`, and the
 *   same concept exists in a second table (`staff_emergency_contacts`, migration
 *   094), so encrypting one without the other would half-fix it. Still
 *   plaintext, and tracked as an open item on T0-15 rather than quietly omitted.
 * - Every `DATE` column other than the two dates of birth. Visit dates, incident
 *   dates and review dates are operational records, they are frequently filtered
 *   on, and encrypting them would break the reporting ranges.
 */
export const ENCRYPTED_COLUMNS: Record<string, readonly string[]> = {
  people: [
    'nhs_number',
    'date_of_birth',
    'gp_phone',
    'gp_address',
    'pharmacy_phone',
    'pharmacy_address',
    'social_worker_phone',
  ],
  staff_profiles: ['birth_date', 'phone', 'address', 'city', 'postal_code'],
};

export function encryptedColumns(table: string): readonly string[] {
  return ENCRYPTED_COLUMNS[table] ?? [];
}

/** A row as it comes back from `pg`, before any decryption. */
type RawRow = Record<string, any>;

function decryptColumnsFor(
  table: string,
  row: RawRow | null | undefined,
  orgId: string | null | undefined,
): RawRow | null | undefined {
  if (!row) return row;
  const columns = encryptedColumns(table);
  // Resolved once per row rather than per column: the key derivation is an HKDF
  // and the columns are decrypted together or not at all.
  const out: RawRow = { ...row };
  for (const column of columns) {
    if (out[column] == null) continue;
    out[column] = decryptField(out[column], orgId as string);
  }
  return out;
}

export interface OrgScopedRow extends RawRow {
  organization_id?: string | null;
}

/** Decrypts a row that carries its own `organization_id`. */
export function decryptRow<T extends OrgScopedRow>(table: string, row: T): T {
  return decryptColumnsFor(table, row, row?.organization_id) as T;
}

/** Decrypts many rows that each carry their own `organization_id`. */
export function decryptRows<T extends OrgScopedRow>(table: string, rows: T[]): T[] {
  return (rows ?? []).map(row => decryptRow(table, row));
}

/**
 * Decrypts rows from a table whose organisation is supplied separately.
 *
 * `staff_profiles` has no `organization_id` of its own — the organisation is
 * reached through `user_id → users.organization_id`, which is also how its
 * row-level security policy is written. So the caller either already knows the
 * organisation (a request scoped to one) or has to resolve it.
 */
export function decryptRowsForOrg<T extends RawRow>(table: string, rows: T[], orgId: string): T[] {
  return (rows ?? []).map(row => decryptColumnsFor(table, row, orgId) as T);
}

/** Decrypts a single row from a table whose organisation is supplied separately. */
export function decryptRowForOrg<T extends RawRow>(table: string, row: T | null | undefined, orgId: string): T | null | undefined {
  return decryptColumnsFor(table, row, orgId) as T | null | undefined;
}

/**
 * Encrypts the registered columns present in an update payload.
 *
 * Takes and returns a copy, so a caller's object is never mutated — the update
 * loop in `people.repository` reuses its `data` for the `id` and `orgId`
 * parameters afterwards.
 */
export function encryptUpdate(
  table: string,
  values: Record<string, unknown>,
  orgId: string,
): Record<string, unknown> {
  const columns = encryptedColumns(table);
  if (columns.length === 0) return values;
  const out: Record<string, unknown> = { ...values };
  for (const column of columns) {
    if (out[column] == null) continue;
    // An update that re-sends a value read back from the database would
    // otherwise encrypt ciphertext; `decryptRow` runs on every read path, so
    // this is the normal case and not an edge case.
    if (typeof out[column] === 'string') {
      out[column] = encryptField(out[column], orgId);
    }
  }
  return out;
}

/** Resolves the organisation for a staff profile row, which does not carry one. */
export async function orgIdForStaffProfile(staffIdOrUserId: string): Promise<string | null> {
  const { query } = await import('../database');
  const result = await query(
    `SELECT u.organization_id
       FROM users u
       JOIN staff_profiles sp ON sp.user_id = u.id
      WHERE sp.id = $1 OR sp.user_id = $1
      LIMIT 1`,
    [staffIdOrUserId],
  );
  return result.rows[0]?.organization_id ?? null;
}