# Encryption at rest — what is covered, what cannot be, and what is left

A column-by-column survey of personal and sensitive data held by the API, and why
each one is in one of three states. The point is that the set is written down, so
"what is not encrypted" is a question with an answer rather than an absence of one.

The enforced list is `ENCRYPTED_COLUMNS` in
`apps/api/src/shared/utils/encrypted-columns.ts`, and
`encrypted-columns.sentinel.test.ts` checks every entry against the stored bytes.
This document covers what is *not* in that list, which nothing enforces.

Cipher: AES-256-GCM under an HKDF-SHA256 key derived per organisation from
`FIELD_ENCRYPTION_KEY`. The key is mandatory — the API exits at boot without a
well-formed one. Rotating it is a dual-key migration, not a restart.

## Encrypted today

| Table | Columns | Key context |
| --- | --- | --- |
| `people` | `nhs_number`, `date_of_birth`, `gp_phone`, `gp_address`, `pharmacy_phone`, `pharmacy_address`, `social_worker_phone` | row's `organization_id` |
| `staff_profiles` | `birth_date`, `phone`, `address`, `city`, `postal_code` | `user_id → users.organization_id` |
| `family_contacts` | `phone`, `email` | `person_id → people.organization_id` |
| `emergency_contacts` | `phone` | `staff_id → staff_profiles → users` |

All are widened to TEXT by migrations 137–139. A ciphertext is ~66 characters before
any plaintext, so `VARCHAR(20)` and `DATE` could not hold one.

`family_contacts` is also decrypted inside the `json_agg` that
`PersonRepository.findById` returns it in — see `NESTED_JSON_TABLES`. Decrypting
only the top-level columns would leave a family's numbers as ciphertext in the middle
of a care record, which reads as corruption rather than as a decision.

## Cannot be encrypted without breaking a feature

These are the ones worth arguing about, because "encrypt it" is not available.

| Column | Why not |
| --- | --- |
| `chat_messages.content` | Full-text searched. `chat.repository.ts:185` runs `cm.content ILIKE '%' || $3 || '%'`, and `chat.controller.ts:799` runs `m.message ILIKE $2`. Ciphertext has no substrings to match, so search would silently return nothing. |
| medication `notes` | `medicationRules.ts:654` filters on `x.notes LIKE '%Revoked%'`. Encrypting it makes that predicate silently false — revoked stock would stop being detected rather than erroring. |
| `users.email` | The login identifier. Encrypting it breaks every authentication lookup in the product. |

The two search cases are the dangerous shape: a predicate on ciphertext does not
fail, it returns nothing. Any future work in this area has to keep that in mind.

**The honest alternative for these** is a blind index — a keyed HMAC of a normalised
value, stored alongside, so equality and prefix search still work while the
plaintext does not sit in the column. That is real work and is not built.

## Accepted as plaintext, with a reason

Recorded so the decision is not re-litigated every audit.

| Data | Decision |
| --- | --- |
| Names (`people`, `staff_profiles`, `family_contacts`, `emergency_contacts`) | Plaintext. Displayed, sorted and searched throughout the product. Putting them behind per-organisation encryption without saying so would be a claim nobody made. |
| `locations.address` | A care site, not a person. Also filtered on by `scripts/geocode-backfill.ts`. |
| All dates other than the two dates of birth | Visit, incident, review and assessment dates are operational records and are frequently filtered on and ranged. Encrypting them breaks reporting. |
| Clinical free text | See below — the largest remaining gap. |
| Financial records (`invoices`, `payment_methods`, `person_expenses`, `petty_cash_*`) | Plaintext. RLS-scoped per organisation, and not identifiers. Revisit if a PCI scope question ever arises. |
| `password_history`, `verification_tokens`, `compliance_portal_tokens` | Already secrets in the cryptographic sense — hashed or random. Encrypting a hash adds nothing. |
| `documents` file contents | Files live on disk or object storage, not in the database. The `file_url` column is a path. |

## The largest remaining gap: clinical free text

**`daily_notes.content` and the incident/risk/care-plan narrative columns are the most
sensitive data in the product and are not encrypted.** A care worker's free-text
notes about a named individual, and the `investigation_notes` on a safeguarding
incident, are more revealing than a date of birth.

It is not encrypted because of the read surface, not the write surface. Writing is
one or two places per table. Reading is roughly fifteen, and one of them —
`people.repository.ts:181` — embeds notes inside a `json_agg` alongside a joined
author name, so the decryption would have to walk parsed JSON rather than a flat row.

Getting that wrong produces AES blobs inside care records, which is worse than
plaintext: a worker cannot read the note, and it looks like corruption rather than a
decision. That is a real risk, not a theoretical one, and it is why this was not
done in the same pass as the column work.

**The shape of the work**, when it is picked up:

1. Add the columns to `ENCRYPTED_COLUMNS` and widen them in a migration.
2. Introduce a decrypt step that walks nested JSON, not just rows — `NESTED_JSON_TABLES`
   is the seam, and it currently handles one table.
3. Route the AI paths first. `ai.controller.ts` sends note and incident text to a
   third-party model provider; those reads are already `decryptField` call sites from
   the date-of-birth work, so they are the least surprising to change.
4. Add sentinel cases per table, matching the existing raw-column pattern.

Until then, the privacy policy names this honestly rather than implying the record is
protected as a whole.

## Surfaces this survey does not cover

- **Backups.** A dump contains every column in whatever state it is. Host-level disk
  encryption is the infrastructure provider's claim, not one this codebase makes.
- **Application logs.** Nothing writes note or contact content to a log, and
  `ai.redaction.ts` pseudonymises before anything leaves for a model provider — but
  this was checked by reading, not by a guard.
- **`apps/marketing/data/marketing.db`.** A SQLite file of leads and named contacts,
  unencrypted by the application, never committed (T0-17, `repo-hygiene.test.ts`).
  It is a separate product and a separate exposure.
- **Uploads and exports.** PDFs from `compliance.pdf.ts` and exports from
  `reporting.repository.ts` contain decrypted data by design — that is the point of
  them. Where they are written and how long they live is not covered here.

## Why this exists

Because `encryption.ts` sat in the repository for about a year, correctly
implemented, unit-tested, imported by nothing — while three documents described
column-level encryption as working. The tables above are written down so that the
next audit starts from a list rather than from an assumption, and so that anything
left unencrypted is a decision somebody made on purpose.