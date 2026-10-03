/**
 * Prepares the Google Play review account: a reviewer login, invented service
 * users, and a day's visits in three states so the reviewer can inspect a useful
 * manager view.
 *
 * ## Why the credential comes from the environment
 *
 * `PLAY_REVIEWER_PASSWORD` is required and has no default. A password written
 * into this file would be in the repository and in every clone and in history
 * forever, and the whole point of a dedicated reviewer account is that it is
 * throwaway — which is exactly the property you do not want to lose track of.
 * The seed is run once by a human who supplies the value; the value is never
 * committed.
 *
 *   PLAY_REVIEWER_EMAIL=... PLAY_REVIEWER_PASSWORD=... \
 *     npm run seed:play-reviewer --workspace apps/api
 *
 * ## Everything here is invented
 *
 * The people, notes, contact details and NHS numbers are synthetic. The NHS
 * numbers use a 900-series prefix that is not issued; phone numbers use Ofcom's
 * reserved 01632 960 range; emails use the reserved example.invalid domain.
 * Nothing in this file is copied from a real record.
 *
 * ## Idempotent
 *
 * Re-running reuses the existing rows rather than duplicating them, and the
 * visits are re-anchored to today each time. A reviewer account that goes stale
 * — no visits today, so an empty Today screen — is the failure mode this avoids.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { migrateQuery, closeDatabasePools } from '../shared/database';
import { hashPassword } from '../modules/auth/password.util';
import logger from '../shared/utils/logger';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const ORG_NAME = process.env.PLAY_REVIEWER_ORG_NAME || 'Clean Care Ltd';
const EMAIL = process.env.PLAY_REVIEWER_EMAIL;
const PASSWORD = process.env.PLAY_REVIEWER_PASSWORD;

/**
 * How long the subscription gate is lifted for this organisation, in days.
 *
 * This is the whole safety mechanism, so it is deliberately not configurable.
 * Making it configurable would mean a typo or a copy-pasted `9999` silently
 * turned a time-boxed review grant into a permanent one for a real tenant, and
 * the only record of that would be this file having been edited. A constant
 * means the longest possible grant is a property of the code rather than of
 * whatever was in the environment.
 *
 * Play review typically completes in a few days. 30 is generous without being
 * open-ended; past that the grant has to be re-armed on purpose by re-running
 * this script, which is the intended behaviour.
 */
const REVIEW_ACCESS_DAYS = 30;

/** The reason stored with the grant, so the row explains itself. */
const REVIEW_ACCESS_REASON = 'Google Play reviewer access';

function requireCredentials(): { email: string; password: string } {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      'PLAY_REVIEWER_EMAIL and PLAY_REVIEWER_PASSWORD must both be set. They are deliberately not ' +
        'defaulted in this file so the reviewer credential never enters the repository.',
    );
  }
  return { email: EMAIL.toLowerCase(), password: PASSWORD };
}

/** Invented service users; NHS numbers are drawn from the unissued 900-series. */
const SERVICE_USERS = [
  { first: 'Eileen', last: 'Fairweather', dob: '1934-02-11', room: '12', nhs: '900 000 0001', gp: 'Dr Amara Osei', allergies: 'Penicillin', diet: 'Soft food, low salt' },
  { first: 'Ronald', last: 'Ashby', dob: '1929-07-30', room: '14', nhs: '900 000 0002', gp: 'Dr Amara Osei', allergies: 'None known', diet: 'Normal' },
  { first: 'Marguerite', last: 'Delacroix', dob: '1941-11-04', room: '07', nhs: '900 000 0003', gp: 'Dr Ravi Menon', allergies: 'Latex, Shellfish', diet: 'Diabetic' },
  { first: 'Desmond', last: 'Okonkwo', dob: '1938-05-19', room: '03', nhs: '900 000 0004', gp: 'Dr Ravi Menon', allergies: 'None known', diet: 'Normal' },
  { first: 'Yolanda', last: 'Briggs', dob: '1946-09-23', room: '21', nhs: '900 000 0005', gp: 'Dr Amara Osei', allergies: 'Aspirin', diet: 'Vegetarian' },
  { first: 'Hector', last: 'Lindqvist', dob: '1931-01-08', room: '18', nhs: '900 000 0006', gp: 'Dr Ravi Menon', allergies: 'None known', diet: 'Puréeed after 2020' },
];

async function upsertOrganization(): Promise<string> {
  // Ignore capitalization differences in the existing organisation name. Do
  // not create a near-duplicate or silently switch an existing tenant's model.
  const existing = await migrateQuery(
    `SELECT id, primary_service_type FROM organizations WHERE lower(name) = lower($1)`,
    [ORG_NAME],
  );
  if (existing.rows.length > 1) {
    throw new Error(`More than one organisation matches "${ORG_NAME}"; refusing to guess.`);
  }
  if (existing.rows.length === 1) {
    if (existing.rows[0].primary_service_type !== 'domiciliary') {
      throw new Error(`Organisation "${ORG_NAME}" must be configured as domiciliary before homecare reviewer visits can be seeded; no organisation settings were changed.`);
    }
    return existing.rows[0].id;
  }
  const created = await migrateQuery(
    `INSERT INTO organizations (name, status, plan, subscription_status, onboarding_completed, onboarding_step,
                               primary_service_type, service_types)
     VALUES ($1, 'active', 'professional', 'active', TRUE, 100, 'domiciliary', ARRAY['domiciliary']::TEXT[])
     RETURNING id`,
    [ORG_NAME],
  );
  logger.info(`Domiciliary organisation "${ORG_NAME}" created.`);
  return created.rows[0].id;
}

async function upsertReviewer(orgId: string, email: string, password: string): Promise<{ userId: string; staffId: string; role: string }> {
  const hash = await hashPassword(password);
  const existing = await migrateQuery(
    'SELECT id, organization_id, role, mfa_enabled FROM users WHERE lower(email) = lower($1)',
    [email],
  );
  if (existing.rows.length > 1) throw new Error(`More than one user matches ${email}; refusing to guess.`);

  let userId: string;
  let role: string;
  if (existing.rows.length === 1) {
    const user = existing.rows[0];
    if (user.organization_id !== orgId) {
      throw new Error(`Reviewer email ${email} belongs to a different organisation; refusing to move or take over the account.`);
    }
    if (!['MANAGER', 'ORG_ADMIN'].includes(user.role)) {
      throw new Error(`Reviewer email ${email} has role ${user.role}; refusing to change the existing role.`);
    }
    if (user.mfa_enabled) {
      throw new Error(`Reviewer email ${email} has MFA enabled; a second-factor method must be arranged before review access can be provisioned.`);
    }
    userId = user.id;
    role = user.role;
    // Preserve the existing role and tenant. Reset only the supplied review
    // credential and login flags so the account can be used without a reset flow.
    await migrateQuery(
      `UPDATE users SET password_hash = $1, status = 'active',
              email_verified = TRUE, force_password_reset = FALSE
       WHERE id = $2 AND organization_id = $3`,
      [hash, userId, orgId],
    );
    logger.info(`Existing reviewer user updated; role ${role} preserved.`);
  } else {
    const created = await migrateQuery(
      `INSERT INTO users (email, password_hash, role, organization_id, status, email_verified, force_password_reset)
       VALUES ($1, $2, 'MANAGER', $3, 'active', TRUE, FALSE) RETURNING id`,
      [email, hash, orgId],
    );
    userId = created.rows[0].id;
    role = 'MANAGER';
    logger.info(`Reviewer user ${email} created.`);
  }

  const profile = await migrateQuery('SELECT id FROM staff_profiles WHERE user_id = $1', [userId]);
  if (profile.rows.length > 1) throw new Error(`Reviewer ${email} has multiple staff profiles; refusing to guess.`);
  let staffId: string;
  if (profile.rows.length > 0) {
    staffId = profile.rows[0].id;
  } else {
    const made = await migrateQuery(
      `INSERT INTO staff_profiles (user_id, first_name, last_name, employment_status, location_id, employment_type)
       VALUES ($1, 'Review', 'Account', 'active', NULL, 'full_time') RETURNING id`,
      [userId],
    );
    staffId = made.rows[0].id;
  }
  return { userId, staffId, role };
}

async function upsertLocation(orgId: string): Promise<string> {
  const name = 'Play reviewer sample — Meadowview House';
  const existing = await migrateQuery(
    'SELECT id FROM locations WHERE organization_id = $1 AND name = $2 LIMIT 1',
    [orgId, name],
  );
  if (existing.rows.length > 0) return existing.rows[0].id;
  const created = await migrateQuery(
    'INSERT INTO locations (organization_id, name, address) VALUES ($1, $2, $3) RETURNING id',
    [orgId, name, '1 Example Lane, Brighton BN1 1AA'],
  );
  return created.rows[0].id;
}

/** `nhs_number` is encrypted, so it goes through the same helper as production. */
async function upsertServiceUsers(orgId: string, locationId: string): Promise<Array<{ id: string; first: string; room: string }>> {
  const { encryptUpdate } = await import('../shared/utils/encrypted-columns');
  const { decryptField } = await import('../shared/utils/encryption');
  const out: Array<{ id: string; first: string; room: string }> = [];

  for (const person of SERVICE_USERS) {
    const existing = await migrateQuery(
      'SELECT id, nhs_number FROM people WHERE organization_id = $1 AND first_name = $2 AND last_name = $3',
      [orgId, person.first, person.last],
    );
    if (existing.rows.length > 1) {
      throw new Error(`More than one client matches synthetic reviewer name ${person.first} ${person.last}; refusing to guess.`);
    }
    let id: string;
    if (existing.rows.length > 0) {
      const storedNhs = existing.rows[0].nhs_number == null
        ? null
        : decryptField(existing.rows[0].nhs_number, orgId);
      if (storedNhs !== person.nhs) {
        throw new Error(`Client name ${person.first} ${person.last} already exists but is not this seed's synthetic record; refusing to modify it.`);
      }
      id = existing.rows[0].id;
      await migrateQuery('UPDATE people SET location_id = $1 WHERE id = $2 AND organization_id = $3', [locationId, id, orgId]);
    } else {
      const encrypted = encryptUpdate(
        'people',
        {
          date_of_birth: person.dob,
          nhs_number: person.nhs,
          gp_phone: '01632 960101',
          gp_address: 'Harbour Surgery, 2 Example Road, Brighton',
          pharmacy_phone: '01632 960102',
          pharmacy_address: 'Example Pharmacy, 3 Example Road, Brighton',
          social_worker_phone: '01632 960103',
        },
        orgId,
      );
      const created = await migrateQuery(
        `INSERT INTO people (organization_id, first_name, last_name, date_of_birth, nhs_number, room_number,
                             status, gp_name, gp_phone, gp_address, allergies, dietary_requirements,
                             support_level, location_id, gender)
         VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10,$11,'medium',$12,$13) RETURNING id`,
        [
          orgId, person.first, person.last, encrypted.date_of_birth, encrypted.nhs_number, person.room,
          person.gp, encrypted.gp_phone, encrypted.gp_address,
          JSON.stringify(person.allergies === 'None known' ? [] : [person.allergies]),
          person.diet, locationId, person.first === 'Marguerite' ? 'female' : 'male',
        ],
      );
      id = created.rows[0].id;
    }

    const contactName = `${person.first} next of kin`;
    const contactExists = await migrateQuery(
      'SELECT id, phone, email FROM family_contacts WHERE person_id = $1 AND name = $2',
      [id, contactName],
    );
    if (contactExists.rows.length > 1) {
      throw new Error(`Multiple synthetic next-of-kin records found for ${person.first}; refusing to guess.`);
    }
    const contactValues = { phone: '01632 960199', email: `${person.first.toLowerCase()}.family@example.invalid` };
    if (contactExists.rows.length === 0) {
      const encryptedContact = encryptUpdate('family_contacts', contactValues, orgId);
      await migrateQuery(
        `INSERT INTO family_contacts (person_id, name, relationship, phone, email, is_emergency_contact)
         VALUES ($1, $2, $3, $4, $5, TRUE)`,
        [id, contactName, 'Daughter', encryptedContact.phone, encryptedContact.email],
      );
    } else {
      const contact = contactExists.rows[0];
      const phone = contact.phone == null ? null : decryptField(contact.phone, orgId);
      const email = contact.email == null ? null : decryptField(contact.email, orgId);
      if (phone !== contactValues.phone || email !== contactValues.email) {
        const encryptedContact = encryptUpdate('family_contacts', contactValues, orgId);
        await migrateQuery(
          'UPDATE family_contacts SET phone = $1, email = $2 WHERE id = $3 AND person_id = $4',
          [encryptedContact.phone, encryptedContact.email, contact.id, id],
        );
      }
    }
    out.push({ id, first: person.first, room: person.room });
  }
  return out;
}

/**
 * One visit finished, one checked in, one still to come — all today.
 *
 * The three states matter: a reviewer opening the app at an arbitrary hour sees
 * "past / under way / next" the same way regardless of when they look. A single
 * scheduled visit would render as overdue by lunchtime and as not-yet-started at
 * eight in the morning.
 */
async function upsertTodaysVisits(
  orgId: string,
  userId: string,
  staffId: string,
  people: Array<{ id: string; first: string; room: string }>,
): Promise<void> {
  const packages = new Map<string, string>();
  for (const person of people) {
    const found = await migrateQuery(
      `SELECT id FROM homecare_packages
        WHERE organization_id = $1 AND person_id = $2 AND name = $3 LIMIT 1`,
      [orgId, person.id, `Reviewer sample — Personal care — ${person.first}`],
    );
    if (found.rows.length > 0) {
      packages.set(person.id, found.rows[0].id);
      continue;
    }
    const made = await migrateQuery(
      `INSERT INTO homecare_packages (organization_id, person_id, name, funding_type, start_date, weekly_hours, hourly_rate_pence)
       VALUES ($1, $2, $3, 'private', CURRENT_DATE, 14, 2850) RETURNING id`,
      [orgId, person.id, `Reviewer sample — Personal care — ${person.first}`],
    );
    packages.set(person.id, made.rows[0].id);
  }

  // Use the database's calendar day/time zone for timestamps, then clamp the
  // anchor so no visit rolls into yesterday or tomorrow near midnight.
  const clock = await migrateQuery(
    `SELECT CURRENT_DATE::text AS local_day,
            current_setting('TIMEZONE') AS timezone,
            EXTRACT(HOUR FROM LOCALTIME)::int AS hour,
            EXTRACT(MINUTE FROM LOCALTIME)::int AS minute`,
  );
  const localDay = clock.rows[0].local_day as string;
  if (clock.rows[0].timezone !== 'Europe/London') {
    throw new Error(`Reviewer schedule requires the production timezone Europe/London; database uses ${clock.rows[0].timezone}. Refusing to create incorrectly dated visits.`);
  }
  const currentMinute = Number(clock.rows[0].hour) * 60 + Number(clock.rows[0].minute);
  const anchorMinute = Math.min(Math.max(Math.floor(currentMinute / 30) * 30, 180), 1200);
  const at = (offsetMinutes: number) => {
    const minuteOfDay = anchorMinute + offsetMinutes;
    const hour = Math.floor(minuteOfDay / 60).toString().padStart(2, '0');
    const minute = (minuteOfDay % 60).toString().padStart(2, '0');
    return `${localDay} ${hour}:${minute}:00`;
  };
  const anchorLabel = `${Math.floor(anchorMinute / 60).toString().padStart(2, '0')}:${(anchorMinute % 60).toString().padStart(2, '0')}`;

  const visits = [
    { person: people[0], start: at(-150), end: at(-90), status: 'completed', label: 'Reviewer sample — Morning call and personal care' },
    { person: people[1], start: at(-30), end: at(30), status: 'checked_in', label: 'Reviewer sample — Medication support and companionship' },
    { person: people[2], start: at(60), end: at(120), status: 'scheduled', label: 'Reviewer sample — Personal care and meal preparation' },
    { person: people[3], start: at(180), end: at(210), status: 'scheduled', label: 'Reviewer sample — Evening call and light domestic support' },
  ];

  // Remove only this seed's clearly marked rows. Never delete same-day visits
  // belonging to the existing organisation or other staff.
  await migrateQuery(
    `DELETE FROM homecare_visits
      WHERE organization_id = $1 AND assigned_staff_id = $2 AND created_by = $3
        AND label IN (
          'Reviewer sample — Morning call and personal care',
          'Reviewer sample — Medication support and companionship',
          'Reviewer sample — Personal care and meal preparation',
          'Reviewer sample — Evening call and light domestic support'
        )`,
    [orgId, staffId, userId],
  );

  for (const visit of visits) {
    const personId = visit.person.id;
    const packageId = packages.get(personId)!;
    const checkIn = visit.status === 'checked_in' || visit.status === 'completed'
      ? at(visit.status === 'completed' ? -145 : -25)
      : null;
    const checkOut = visit.status === 'completed' ? at(-95) : null;

    await migrateQuery(
      `INSERT INTO homecare_visits (organization_id, package_id, person_id, assigned_staff_id, visit_type, label,
                                     scheduled_start, scheduled_end, status, check_in_at, check_out_at,
                                     actual_travel_minutes, actual_mileage_miles, mileage_status, visit_notes, created_by)
       VALUES ($1,$2,$3,$4,'personal_care',$5,$6,$7,$8,$9,$10,$11,3.4,'submitted',$12,$13)`,
      [
        orgId, packageId, personId, staffId, visit.label,
        visit.start, visit.end, visit.status, checkIn, checkOut,
        visit.status === 'completed' ? 12 : null,
        visit.status === 'completed' ? 'Completed without incident. Settled and comfortable.' : null,
        userId,
      ],
    );
  }
  logger.info(`Four visits seeded for today (${anchorLabel} database-local anchor): one completed, one checked in, two scheduled.`);

  // A synthetic care note on the completed visit, idempotently refreshed only
  // when the exact marker identifies a note created by this seed.
  const first = people[0].id;
  const note = await migrateQuery(
    `SELECT id FROM daily_notes
      WHERE person_id = $1 AND note_date = CURRENT_DATE AND category = 'Personal care'
        AND content = 'Reviewer sample: Settled well overnight. Breakfast eaten in full with assistance. Skin intact; no concerns to report.' LIMIT 1`,
    [first],
  );
  const noteValues = [
    userId,
    'Reviewer sample: Settled well overnight. Breakfast eaten in full with assistance. Skin intact; no concerns to report.',
  ];
  if (note.rows.length > 0) {
    await migrateQuery(
      `UPDATE daily_notes SET author_id = $1, shift = 'day', content = $2,
                              support_level = 'good', generated_by_ai = FALSE
        WHERE id = $3`,
      [...noteValues, note.rows[0].id],
    );
  } else {
    await migrateQuery(
      `INSERT INTO daily_notes (person_id, author_id, note_date, shift, category, content, support_level, generated_by_ai)
       VALUES ($1, $2, CURRENT_DATE, 'day', 'Personal care', $3, 'good', FALSE)`,
      [first, ...noteValues],
    );
  }
}

/**
 * Lift the subscription gate for the reviewer organisation until a fixed date.
 *
 * This writes exactly one column pair on one organisation, chosen by the same
 * name lookup the rest of this script uses. It does not touch
 * `subscription_status`, `trial_ends_at` or `current_period_end`, so the
 * organisation's real billing state is preserved and Stripe sync has nothing to
 * disagree with.
 *
 * Re-running this top the window back up, which is what makes the reviewer
 * account renewable without anyone remembering to revoke it.
 */
async function grantTimeBoxedReviewAccess(orgId: string): Promise<string> {
  // Compute the expiry here rather than in SQL so the exact instant written is
  // the one that gets logged below, rather than a value the database resolves
  // in its own timezone.
  const expiresAt = new Date(Date.now() + REVIEW_ACCESS_DAYS * 24 * 60 * 60 * 1000);
  await migrateQuery(
    `UPDATE organizations
        SET review_access_expires_at = $1,
            review_access_reason = $2
      WHERE id = $3`,
    [expiresAt.toISOString(), REVIEW_ACCESS_REASON, orgId],
  );
  return expiresAt.toISOString();
}

async function main(): Promise<void> {
  const { email, password } = requireCredentials();

  // A valid key and the schema-widening migrations are prerequisites for any
  // writes to registered encrypted columns.
  const { assertFieldEncryptionConfigured } = await import('../shared/utils/encryption');
  assertFieldEncryptionConfigured();
  const applied = await migrateQuery(
    `SELECT COUNT(*)::int AS count FROM _migrations
      WHERE name IN ('137_encrypt_people_nhs_number','138_encrypt_person_and_staff_pii','139_encrypt_contact_details')`,
  );
  if (applied.rows[0]?.count !== 3) {
    throw new Error('PII schema migrations 137–139 must be applied before seeding encrypted reviewer data.');
  }

  const orgId = await upsertOrganization();
  const { staffId, userId, role } = await upsertReviewer(orgId, email, password);
  const locationId = await upsertLocation(orgId);
  const people = await upsertServiceUsers(orgId, locationId);
  await upsertTodaysVisits(orgId, userId, staffId, people);
  const reviewAccessUntil = await grantTimeBoxedReviewAccess(orgId);

  logger.info('');
  logger.info('Play review account ready:');
  logger.info(`  organisation : ${ORG_NAME}`);
  logger.info(`  email        : ${email}`);
  logger.info(`  role         : ${role}${role === 'ORG_ADMIN' ? ' (existing role preserved)' : ''}`);
  logger.info('  password     : (the value of PLAY_REVIEWER_PASSWORD, not printed here)');
  logger.info(`  service users: ${people.map(p => `${p.first} (room ${p.room})`).join(', ')}`);
  logger.info("  visits today : 1 completed, 1 checked in, 2 scheduled");
  logger.info(`  access until : ${reviewAccessUntil} (${REVIEW_ACCESS_DAYS} days; gate re-arms on re-run)`);
  logger.info('');
  logger.info('The billing gate is lifted for this organisation only, and only until the date above.');
  logger.info('No other organisation is affected, and no subscription state was changed.');
  logger.info('These are synthetic records; contact details use reserved fictional ranges.');
}

main()
  .catch(err => {
    logger.error(`Reviewer seed failed: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => closeDatabasePools());