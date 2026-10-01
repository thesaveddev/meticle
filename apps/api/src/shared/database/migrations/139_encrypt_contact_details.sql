-- 139: widen the third-party contact columns so they can hold a ciphertext.
--
-- Same reasoning as 137 and 138. `family_contacts.email` is VARCHAR(255) and the
-- phone columns are VARCHAR(50); both are narrower than the ~66 characters an
-- empty value costs once it is written as a 32-char hex IV, a colon, a 32-char hex
-- GCM tag and the hex payload. A truncated GCM ciphertext does not fail at write
-- time — it fails at decryption time, as an authentication error that reads like
-- a bug somewhere else entirely.
--
-- Nothing here encrypts anything. Rows written before this migration keep their
-- plaintext values, and `decryptField` returns a value that is not in ciphertext
-- form unchanged, so the repositories can be deployed before
-- `npm run backfill:pii-encryption` runs. That script is driven by the registry
-- in `apps/api/src/shared/utils/encrypted-columns.ts`, so it picks these columns
-- up without a second list to keep in step.

ALTER TABLE family_contacts ALTER COLUMN phone TYPE TEXT;
ALTER TABLE family_contacts ALTER COLUMN email TYPE TEXT;
ALTER TABLE emergency_contacts ALTER COLUMN phone TYPE TEXT;