-- 138: widen the remaining PII columns so they can hold a ciphertext.
--
-- Migration 137 did this for `people.nhs_number` and the reasoning is identical
-- here. `encryptField` writes a 32-char hex IV, a colon, a 32-char hex GCM tag,
-- a colon, then the hex payload, so an empty-ish source value still costs ~66
-- characters before any of the plaintext is counted. A `DATE` cannot hold that at
-- all, and `VARCHAR(20)` / `VARCHAR(50)` truncate — and a truncated GCM
-- ciphertext does not fail loudly, it fails at decryption time, as an
-- authentication error that looks like a bug somewhere else entirely.
--
-- TEXT rather than a wider VARCHAR, deliberately. A fixed width would make a
-- long value a silent truncation again; TEXT makes PostgreSQL reject it.
--
-- What is widened, and the full list of encrypted columns, is declared in
-- `apps/api/src/shared/utils/encrypted-columns.ts`. This file only makes room.
-- Nothing here encrypts anything: a row keeps whatever it has until the backfill
-- runs, and `decryptField` returns a legacy plaintext value unchanged, so the
-- repositories can be deployed before the backfill without a flag day.
--
-- Dates of birth are `DATE` columns becoming `TEXT`, which is the one real
-- behavioural change in this migration. Both are read straight through to a
-- formatted string and neither is used in a query predicate — verified, because
-- a date range or an `ORDER BY birth_date` would break the moment the column
-- stopped being a date. Every *other* date column stays `DATE`, because visits,
-- incidents and reviews genuinely are filtered on.

ALTER TABLE people ALTER COLUMN date_of_birth TYPE TEXT;
ALTER TABLE people ALTER COLUMN gp_phone TYPE TEXT;
ALTER TABLE people ALTER COLUMN gp_address TYPE TEXT;
ALTER TABLE people ALTER COLUMN pharmacy_phone TYPE TEXT;
ALTER TABLE people ALTER COLUMN pharmacy_address TYPE TEXT;
ALTER TABLE people ALTER COLUMN social_worker_phone TYPE TEXT;

ALTER TABLE staff_profiles ALTER COLUMN birth_date TYPE TEXT;
ALTER TABLE staff_profiles ALTER COLUMN phone TYPE TEXT;
ALTER TABLE staff_profiles ALTER COLUMN address TYPE TEXT;
ALTER TABLE staff_profiles ALTER COLUMN city TYPE TEXT;
ALTER TABLE staff_profiles ALTER COLUMN postal_code TYPE TEXT;