import { query } from '../../shared/database';

/**
 * The read-only tools Mica's question-answering loop may call.
 *
 * This is the "Mica can access anything in MeticleCare" surface, and it is
 * deliberately constrained twice:
 *
 *   1. Read-only. Every executor is a SELECT. Write actions (care notes, tasks)
 *      stay on the explicit Mica action gateway where drafts are reviewed
 *      before persistence — a voice question must never be a write path.
 *
 *   2. Org-scoped and small. Every query is bounded by the caller's
 *      organisation and LIMITed, so a tool result is a summary a staff member
 *      could have looked up themselves, not a bulk record export.
 *
 * Tool results are pseudonymised before they reach the model (the caller holds
 * the reverse map), so real names never cross the LLM boundary; they are only
 * restored into the client-facing answer afterwards.
 */

export interface MicaTool {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments, handed to the model verbatim. */
  parameters: Record<string, unknown>;
  /** Executes the tool. Throws on failure — the loop reports it as a tool error. */
  execute: (orgId: string, args: Record<string, unknown>) => Promise<unknown[]>;
}

/**
 * Resolve a tool's date argument, defaulting to "today".
 *
 * "Today" must be the *database session's* day, not JavaScript's. Every tool
 * query filters with `start_time::date = $2::date`, and a bare `::date` cast
 * resolves in the session TimeZone. Computing the default from
 * `toISOString()` slices the day in UTC instead, so around local midnight
 * (00:00–01:00 in BST, 23:00–00:00 in winter) the fallback names the previous
 * day while the `::date` casts name today — shifts, appointments and doses
 * seeded for today vanish from every "today" answer, which is exactly how a
 * real user asking Mica at 00:30 would see an empty rota. Asking the database
 * (the same ALS-bound session the tool SQL then runs on) keeps the fallback
 * and the casts in agreement at every hour of every day.
 */
export const cleanDate = async (value: unknown): Promise<string> => {
  const s = typeof value === 'string' ? value.trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const result = await query('SELECT CURRENT_DATE::text AS day');
  return result.rows[0].day;
};

const cleanName = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

/** Resolve a person by spoken name within the org. Returns at most 5 candidates. */
async function findPeople(orgId: string, name: string): Promise<Array<Record<string, unknown>>> {
  const parts = name.split(' ').filter(Boolean);
  const result = await query(
    `
    SELECT id, first_name || ' ' || last_name AS person_name, room_number, status
    FROM people
    WHERE organization_id = $1
      AND (first_name || ' ' || last_name) ILIKE $2
      AND ($3::text IS NULL OR first_name ILIKE $3)
    ORDER BY status = 'active' DESC, last_name, first_name
    LIMIT 5
  `,
    [orgId, `%${name}%`, parts[0] || null],
  );
  return result.rows;
}

export const MICA_TOOLS: MicaTool[] = [
  {
    name: 'get_staff_on_shift',
    description:
      'Lists staff assigned to shifts on a date (default today), with shift type, location and times. Use for "who is on shift today".',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Optional YYYY-MM-DD, defaults to today' },
      },
    },
    async execute(orgId, args) {
      const date = await cleanDate(args.date);
      const result = await query(
        `
        SELECT sp.first_name || ' ' || sp.last_name AS staff_name,
               s.shift_type, l.name AS location_name,
               s.start_time, s.end_time, sa.status AS assignment_status
        FROM shifts s
        JOIN locations l ON s.location_id = l.id
        JOIN shift_assignments sa ON sa.shift_id = s.id AND sa.status IN ('assigned', 'accepted')
        JOIN staff_profiles sp ON sp.id = sa.staff_id
        JOIN users u ON u.id = sp.user_id
        WHERE l.organization_id = $1
          AND s.status NOT IN ('cancelled')
          AND s.start_time::date = $2::date
        ORDER BY s.start_time, sp.last_name
        LIMIT 40
      `,
        [orgId, date],
      );
      return result.rows;
    },
  },
  {
    name: 'who_supports_person',
    description:
      'Finds the staff supporting one service user on a date (default today) across rota shifts and domiciliary visits. Use for "who is supporting Grace Roberts today".',
    parameters: {
      type: 'object',
      properties: {
        person_name: { type: 'string', description: 'The service user\'s name, e.g. "Grace Roberts"' },
        date: { type: 'string', description: 'Optional YYYY-MM-DD, defaults to today' },
      },
    },
    async execute(orgId, args) {
      const name = cleanName(args.person_name);
      if (!name) throw new Error('person_name is required');
      const date = await cleanDate(args.date);
      const matches = await findPeople(orgId, name);
      if (matches.length === 0) return [{ result: `No service user matching "${name}" found.` }];
      const ids = matches.map((m) => String(m.id));
      const shifts = await query(
        `
        SELECT DISTINCT 'rota' AS source,
               pe.first_name || ' ' || pe.last_name AS person_name,
               sp.first_name || ' ' || sp.last_name AS staff_name,
               s.shift_type, s.start_time, s.end_time,
               l.name AS location_name
        FROM shifts s
        JOIN locations l ON s.location_id = l.id
        JOIN shift_assignments sa ON sa.shift_id = s.id AND sa.status IN ('assigned', 'accepted')
        JOIN staff_profiles sp ON sp.id = sa.staff_id
        JOIN people pe ON pe.id = s.person_id
        WHERE pe.organization_id = $1 AND s.person_id = ANY($2::uuid[])
          AND s.status NOT IN ('cancelled')
          AND s.start_time::date = $3::date
        ORDER BY s.start_time
        LIMIT 20
      `,
        [orgId, ids, date],
      );
      const visits = await query(
        `
        SELECT DISTINCT 'visit' AS source,
               pe.first_name || ' ' || pe.last_name AS person_name,
               sp.first_name || ' ' || sp.last_name AS staff_name,
               hv.visit_type, hv.label, hv.scheduled_start, hv.scheduled_end, hv.status
        FROM homecare_visits hv
        JOIN people pe ON pe.id = hv.person_id
        LEFT JOIN staff_profiles sp ON sp.id = hv.assigned_staff_id
        WHERE pe.organization_id = $1 AND hv.person_id = ANY($2::uuid[])
          AND hv.scheduled_start::date = $3::date
          AND hv.status != 'cancelled'
        ORDER BY hv.scheduled_start
        LIMIT 20
      `,
        [orgId, ids, date],
      );
      return [...shifts.rows, ...visits.rows];
    },
  },
  {
    name: 'get_appointments',
    description:
      'Lists appointments on a date (default today), optionally for one service user. Use for "give me the appointments of today".',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Optional YYYY-MM-DD, defaults to today' },
        person_name: { type: 'string', description: 'Optional service-user name to filter by' },
      },
    },
    async execute(orgId, args) {
      const date = await cleanDate(args.date);
      const name = cleanName(args.person_name);
      let personIds: string[] | null = null;
      if (name) {
        const matches = await findPeople(orgId, name);
        if (matches.length === 0) return [{ result: `No service user matching "${name}" found.` }];
        personIds = matches.map((m) => String(m.id));
      }
      const result = await query(
        `
        SELECT a.title, a.start_time, a.end_time, a.status,
               pe.first_name || ' ' || pe.last_name AS person_name,
               pe.room_number,
               sp.first_name || ' ' || sp.last_name AS staff_name,
               l.name AS location_name
        FROM appointments a
        LEFT JOIN people pe ON pe.id = a.person_id
        LEFT JOIN staff_profiles sp ON sp.id = a.staff_id
        LEFT JOIN locations l ON l.id = a.location_id
        WHERE a.organization_id = $1
          AND a.start_time::date = $2::date
          AND ($3::uuid[] IS NULL OR a.person_id = ANY($3::uuid[]))
        ORDER BY a.start_time
        LIMIT 30
      `,
        [orgId, date, personIds],
      );
      return result.rows;
    },
  },
  {
    name: 'get_person_overview',
    description:
      'One service user\'s snapshot: status, room, support level, and next scheduled event. Use for "tell me about Grace Roberts".',
    parameters: {
      type: 'object',
      properties: {
        person_name: { type: 'string', description: 'The service user\'s name' },
      },
    },
    async execute(orgId, args) {
      const name = cleanName(args.person_name);
      if (!name) throw new Error('person_name is required');
      const matches = await findPeople(orgId, name);
      if (matches.length === 0) return [{ result: `No service user matching "${name}" found.` }];
      const result = await query(
        `
        SELECT pe.first_name || ' ' || pe.last_name AS person_name, pe.room_number, pe.status,
               pe.support_level, pe.flags,
               (SELECT COUNT(*)::int FROM care_plans cp WHERE cp.person_id = pe.id AND cp.status = 'active') AS active_care_plans,
               (SELECT COUNT(*)::int FROM risk_assessments ra WHERE ra.person_id = pe.id AND ra.risk_level IN ('high','critical')) AS open_risks,
               (SELECT a.title FROM appointments a WHERE a.person_id = pe.id AND a.start_time >= NOW() AND a.status = 'scheduled' ORDER BY a.start_time LIMIT 1) AS next_appointment,
               (SELECT COUNT(*)::int FROM homecare_visits hv WHERE hv.person_id = pe.id AND hv.scheduled_start::date = CURRENT_DATE) AS visits_today
        FROM people pe WHERE pe.id = ANY($2::uuid[])
        LIMIT 5
      `,
        [orgId, matches.map((m) => m.id)],
      );
      return result.rows;
    },
  },
  {
    name: 'get_incidents',
    description:
      'Summarises incidents in a recent window: count by severity and the latest titles. Use for "any incidents today".',
    parameters: {
      type: 'object',
      properties: {
        days_back: { type: 'number', description: 'Optional window in days, default 1 (today)' },
      },
    },
    async execute(orgId, args) {
      const daysBack = Math.min(Math.max(Number(args.days_back) || 1, 1), 30);
      const result = await query(
        `
        SELECT ic.title, ic.severity, ic.status, ic.incident_date,
               pe.first_name || ' ' || pe.last_name AS person_name
        FROM incidents ic
        LEFT JOIN people pe ON pe.id = ic.person_id
        WHERE ic.organization_id = $1
          AND ic.created_at >= CURRENT_DATE - ($2::int - 1)
        ORDER BY ic.created_at DESC
        LIMIT 20
      `,
        [orgId, daysBack],
      );
      const summary = await query(
        `
        SELECT COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical,
               COUNT(*) FILTER (WHERE severity = 'high')::int AS high,
               COUNT(*) FILTER (WHERE severity = 'medium')::int AS medium,
               COUNT(*) FILTER (WHERE severity = 'low')::int AS low
        FROM incidents WHERE organization_id = $1 AND created_at >= CURRENT_DATE - ($2::int - 1)
      `,
        [orgId, daysBack],
      );
      return [...summary.rows, ...result.rows];
    },
  },
  {
    name: 'get_staff_on_leave',
    description:
      'Lists staff on approved leave today (default) or on a date. Use for "who is on leave".',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Optional YYYY-MM-DD, defaults to today' },
      },
    },
    async execute(orgId, args) {
      const date = await cleanDate(args.date);
      const result = await query(
        `
        SELECT sp.first_name || ' ' || sp.last_name AS staff_name,
               lr.start_date, lr.end_date, lr.duration_type, lt.name AS leave_type
        FROM leave_requests lr
        JOIN staff_profiles sp ON sp.id = lr.staff_id
        JOIN users u ON u.id = sp.user_id
        LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE u.organization_id = $1
          AND lr.status = 'approved'
          AND lr.start_date <= $2::date AND lr.end_date >= $2::date
        ORDER BY sp.last_name
        LIMIT 30
      `,
        [orgId, date],
      );
      return result.rows;
    },
  },
  {
    name: 'get_rota_overview',
    description:
      'Coverage snapshot for a date: open vs filled shifts by location, plus how many staff are working. Use for "how is the rota looking today".',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Optional YYYY-MM-DD, defaults to today' },
      },
    },
    async execute(orgId, args) {
      const date = await cleanDate(args.date);
      const result = await query(
        `
        SELECT l.name AS location_name,
               COUNT(*)::int AS total_shifts,
               COUNT(*) FILTER (WHERE s.status = 'open')::int AS open_shifts,
               COUNT(*) FILTER (WHERE s.status IN ('filled','completed'))::int AS filled_shifts,
               COUNT(*) FILTER (WHERE s.shift_type = 'wake_night')::int AS night_shifts
        FROM shifts s
        JOIN locations l ON s.location_id = l.id
        WHERE l.organization_id = $1
          AND s.start_time::date = $2::date
          AND s.status NOT IN ('cancelled')
        GROUP BY l.name ORDER BY l.name
      `,
        [orgId, date],
      );
      return result.rows;
    },
  },
  {
    name: 'get_medication_round',
    description:
      'Medication round status for a date (default today): doses given, missed/pending/overdue counts, overdue doses and low/out-of-stock medication. Each low stock line includes days_until_empty estimated from the last 28 days of given doses (null if no recent usage), incoming_quantity and next_delivery_date for future-dated deliveries not yet received, days_until_expiry (null if undated), and expired_first (true if stock expires before projected run-out). For reorder urgency, use consistent bands: already out or run-out within 3 days = urgent, arrange delivery today; 4–7 days = arrange delivery this week; over 7 days = lower urgency, plan normal replenishment. If a future delivery is already booked, factor its quantity and date into advice and do not recommend a duplicate order unless it arrives too late or is insufficient. If expired_first is true, warn that the expiring stock may not last until replacement; if expiry is sooner than run-out, replacement stock is still needed. Be explicit when usage or expiry is unknown; never invent an estimate. Use for "how is the medication round looking", "any meds overdue", "any medicines running low", "how long will the Risperidone last", "is anything ordered/on its way", or "how urgent is this reorder".',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Optional YYYY-MM-DD, defaults to today' },
        person_name: { type: 'string', description: 'Optional service-user name to filter by' },
      },
    },
    async execute(orgId, args) {
      const date = await cleanDate(args.date);
      const name = cleanName(args.person_name);
      let personIds: string[] | null = null;
      if (name) {
        const matches = await findPeople(orgId, name);
        if (matches.length === 0) return [{ result: `No service user matching "${name}" found.` }];
        personIds = matches.map((m) => String(m.id));
      }
      const summary = await query(
        `
        SELECT COUNT(*)::int AS total_scheduled,
               COUNT(*) FILTER (WHERE a.status = 'given')::int AS given,
               COUNT(*) FILTER (WHERE a.status = 'pending' AND a.scheduled_time < NOW() - interval '30 minutes')::int AS overdue,
               COUNT(*) FILTER (WHERE a.status = 'pending' AND a.scheduled_time >= NOW() - interval '30 minutes')::int AS still_due,
               COUNT(*) FILTER (WHERE a.status NOT IN ('given','pending'))::int AS not_given_other
        FROM emedication_administrations a
        JOIN emedication_items mi ON mi.id = a.emedication_item_id
        JOIN emedication_records r ON r.id = mi.emedication_record_id
        WHERE r.organization_id = $1
          AND r.status = 'active'
          AND mi.is_active = TRUE
          AND a.scheduled_time::date = $2::date
          AND ($3::uuid[] IS NULL OR r.person_id = ANY($3::uuid[]))
      `,
        [orgId, date, personIds],
      );
      const detail = await query(
        `
        SELECT pe.first_name || ' ' || pe.last_name AS person_name,
               mi.name AS medication, mi.dosage, mi.unit,
               a.scheduled_time, a.status,
               sp.first_name || ' ' || sp.last_name AS staff_name
        FROM emedication_administrations a
        JOIN emedication_items mi ON mi.id = a.emedication_item_id
        JOIN emedication_records r ON r.id = mi.emedication_record_id
        JOIN people pe ON pe.id = r.person_id
        LEFT JOIN staff_profiles sp ON sp.id = a.staff_id
        WHERE r.organization_id = $1
          AND r.status = 'active'
          AND mi.is_active = TRUE
          AND a.scheduled_time::date = $2::date
          AND ($3::uuid[] IS NULL OR r.person_id = ANY($3::uuid[]))
          AND a.status = 'pending'
          AND a.scheduled_time < NOW() - interval '30 minutes'
        ORDER BY a.scheduled_time
        LIMIT 15
      `,
        [orgId, date, personIds],
      );
      // Stock warnings: active stock lines whose remaining quantity has fallen
      // to the item's own reorder level, plus explicit zero/out-of-stock rows.
      // Same person scoping as the round itself, so Mica only flags stock for
      // the people the question is about (or all of the org when unfiltered).
      //
      // days_until_empty: extrapolated run-out estimate from *recent actual
      // consumption* — the last 28 days of given administrations for that
      // same medication+dosage in this org. A flat reorder-level flag says
      // "order soon"; the estimate says how urgent it is, which is what a
      // manager actually needs at 8am. No recent administration (new item,
      // seasonal PRN) leaves it null rather than inventing a number, and the
      // tool description tells the model to say so. PRN usage can inflate the
      // rate — accepted, erring towards ordering earlier is the safe side.
      //
      // incoming_quantity: deliveries already received against this line and
      // not yet counted into the stock quantity. The stock row is updated when
      // the delivery is received, so anything with a future delivery_date is
      // still "in the pipeline" — a line can be below reorder level yet safe
      // because 200 tablets land tomorrow. Without this the model would tell a
      // manager to order stock that is already in the building, and the reorder
      // sweep would nag about a problem that is already solved. Matching is by
      // org + person + medication/dosage key (the same key the usage CTE uses)
      // because delivery items are free-text; stock_id is populated only when
      // the UI could resolve the line, and the text match is the reliable join.
      //
      // days_until_expiry / expired_first: stock expiry is a safety warning,
      // not an ordering one — medicine that expires before the projected run-out
      // date (or that is already expired) is unusable stock, so expired_first
      // is true when the earliest expiring batch on this line passes before the
      // last day the extrapolated quantity covers. Null usage (no run-out date
      // to compare against) leaves expired_first null — "expiring soon" is
      // still reported, the run-out comparison just cannot be made honestly.
      const stockLow = await query(
        `
        WITH usage AS (
          SELECT r.organization_id,
                 LOWER(TRIM(mi.name)) AS med_key,
                 LOWER(TRIM(COALESCE(mi.dosage, ''))) AS dosage_key,
                 COUNT(a.id)::int AS given_28d,
                 -- Round the rate to 4dp: 1/28 as a full double is a 17-digit
                 -- decimal the LLM does not need, and the PII redactor's
                 -- phone-number pattern would eat the long digit run.
                 -- Days-until-empty below still divides at full precision.
                 ROUND((COUNT(a.id)::float8 / 28.0)::numeric, 4)::float8 AS daily_usage
          FROM emedication_administrations a
          JOIN emedication_items mi ON mi.id = a.emedication_item_id
          JOIN emedication_records r ON r.id = mi.emedication_record_id
          WHERE r.organization_id = $1
            AND a.status = 'given'
            AND COALESCE(a.administered_time, a.scheduled_time) >= NOW() - interval '28 days'
            AND ($2::uuid[] IS NULL OR r.person_id = ANY($2::uuid[]))
          GROUP BY 1, 2, 3
        ),
        incoming AS (
          SELECT d.organization_id, d.person_id,
                 LOWER(TRIM(di.medication_name)) AS med_key,
                 LOWER(TRIM(COALESCE(di.dosage, ''))) AS dosage_key,
                 SUM(di.quantity)::float8 AS incoming_quantity,
                 MIN(d.delivery_date)::text AS next_delivery_date
          FROM emedication_delivery_items di
          JOIN emedication_deliveries d ON d.id = di.delivery_id
          WHERE d.organization_id = $1
            AND d.delivery_date > CURRENT_DATE
            AND ($2::uuid[] IS NULL OR d.person_id = ANY($2::uuid[]))
          GROUP BY 1, 2, 3, 4
        )
        SELECT es.medication_name, es.dosage, es.unit,
               es.quantity, es.quantity_unit, es.reorder_level,
               (es.quantity <= 0) AS out_of_stock,
               pe.first_name || ' ' || pe.last_name AS person_name,
               COALESCE(u.given_28d, 0) AS given_28d,
               u.daily_usage,
               CASE WHEN u.daily_usage > 0
                    THEN ROUND((es.quantity / u.daily_usage)::numeric, 1)::float8
                    ELSE NULL END AS days_until_empty,
               COALESCE(inc.incoming_quantity, 0) AS incoming_quantity,
               inc.next_delivery_date,
               -- Null expiry_date on the stock line means the batch was never
               -- dated — say so rather than implying "never expires".
               CASE WHEN es.expiry_date IS NULL THEN NULL
                    ELSE (es.expiry_date - CURRENT_DATE) END AS days_until_expiry,
               CASE WHEN u.daily_usage > 0
                         AND es.expiry_date IS NOT NULL
                    THEN (es.expiry_date < CURRENT_DATE + CEIL(es.quantity / u.daily_usage)::int)
                    ELSE NULL END AS expired_first
        FROM emedication_stock es
        LEFT JOIN people pe ON pe.id = es.person_id
        LEFT JOIN usage u
          ON u.organization_id = es.organization_id
         AND u.med_key = LOWER(TRIM(es.medication_name))
         AND u.dosage_key = LOWER(TRIM(COALESCE(es.dosage, '')))
        LEFT JOIN incoming inc
          ON inc.organization_id = es.organization_id
         AND inc.person_id IS NOT DISTINCT FROM es.person_id
         AND inc.med_key = LOWER(TRIM(es.medication_name))
         AND inc.dosage_key = LOWER(TRIM(COALESCE(es.dosage, '')))
        WHERE es.organization_id = $1
          AND es.status = 'active'
          AND es.quantity <= COALESCE(es.reorder_level, 10)
          AND ($2::uuid[] IS NULL OR es.person_id = ANY($2::uuid[]))
        ORDER BY es.quantity ASC, es.medication_name
        LIMIT 10
      `,
        [orgId, personIds],
      );
      return [...summary.rows, ...detail.rows, ...stockLow.rows];
    },
  },
  {
    name: 'get_training_expiring',
    description:
      'Lists completed staff training that expires within a window (default 30 days), with module, staff and expiry date. Use for "whose training is expiring".',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Optional window in days, default 30' },
        staff_name: { type: 'string', description: 'Optional staff name to filter by' },
      },
    },
    async execute(orgId, args) {
      const days = Math.min(Math.max(Number(args.days) || 30, 1), 365);
      const name = cleanName(args.staff_name);
      let staffIds: string[] | null = null;
      if (name) {
        const parts = name.split(' ').filter(Boolean);
        const staff = await query(
          `
          SELECT sp.id FROM staff_profiles sp
          JOIN users u ON u.id = sp.user_id
          WHERE u.organization_id = $1
            AND (sp.first_name || ' ' || sp.last_name) ILIKE $2
            AND ($3::text IS NULL OR sp.first_name ILIKE $3)
          LIMIT 5
        `,
          [orgId, `%${name}%`, parts[0] || null],
        );
        if (staff.rows.length === 0) return [{ result: `No staff matching "${name}" found.` }];
        staffIds = staff.rows.map((r) => String(r.id));
      }
      const result = await query(
        `
        SELECT sp.first_name || ' ' || sp.last_name AS staff_name,
               tm.name AS module,
               tr.completed_at, tr.expires_at
        FROM training_records tr
        JOIN training_modules tm ON tm.id = tr.module_id
        JOIN staff_profiles sp ON sp.id = tr.staff_id
        JOIN users u ON u.id = sp.user_id
        WHERE u.organization_id = $1
          AND tr.status = 'completed'
          AND tr.expires_at IS NOT NULL
          AND tr.expires_at <= CURRENT_DATE + $2::integer
          AND ($3::uuid[] IS NULL OR tr.staff_id = ANY($3::uuid[]))
        ORDER BY tr.expires_at, sp.last_name
        LIMIT 30
      `,
        [orgId, days, staffIds],
      );
      return result.rows;
    },
  },
  {
    name: 'get_leave_balance',
    description:
      'A staff member\'s leave balances by type: allocated, taken and remaining days/hours for this year. Use for "how much leave does Jane have left".',
    parameters: {
      type: 'object',
      properties: {
        staff_name: { type: 'string', description: 'The staff member\'s name, e.g. "Jane Doyle"' },
        year: { type: 'number', description: 'Optional calendar year, defaults to the current year' },
      },
    },
    async execute(orgId, args) {
      const name = cleanName(args.staff_name);
      if (!name) throw new Error('staff_name is required');
      const year = Number(args.year) || new Date().getFullYear();
      const parts = name.split(' ').filter(Boolean);
      const staff = await query(
        `
        SELECT sp.id, sp.first_name || ' ' || sp.last_name AS staff_name
        FROM staff_profiles sp
        JOIN users u ON u.id = sp.user_id
        WHERE u.organization_id = $1
          AND (sp.first_name || ' ' || sp.last_name) ILIKE $2
          AND ($3::text IS NULL OR sp.first_name ILIKE $3)
        ORDER BY u.status = 'active' DESC, sp.last_name
        LIMIT 5
      `,
        [orgId, `%${name}%`, parts[0] || null],
      );
      if (staff.rows.length === 0) return [{ result: `No staff matching "${name}" found.` }];
      const result = await query(
        `
        SELECT sp.first_name || ' ' || sp.last_name AS staff_name,
               lt.name AS leave_type, lt.duration_type,
               GREATEST(lb.days_allocated, lt.days_allowed) AS days_allocated,
               lb.days_taken,
               (GREATEST(lb.days_allocated, lt.days_allowed) - lb.days_taken) AS days_remaining,
               GREATEST(lb.hours_allocated, lt.hours_allowed) AS hours_allocated,
               lb.hours_taken,
               (GREATEST(lb.hours_allocated, lt.hours_allowed) - lb.hours_taken) AS hours_remaining,
               lb.year
        FROM leave_balances lb
        JOIN leave_types lt ON lt.id = lb.leave_type_id
        JOIN staff_profiles sp ON sp.id = lb.staff_id
        WHERE sp.id = ANY($2::uuid[])
          AND lt.organization_id = $1
          AND lb.year = $3::int
        ORDER BY sp.last_name, lt.name
      `,
        [orgId, staff.rows.map((r) => String(r.id)), year],
      );
      return result.rows;
    },
  },
  {
    name: 'resolve_person',
    description:
      'Searches service users by name and returns matching candidates with room and status. Use when you need to identify which person a question is about.',
    parameters: {
      type: 'object',
      properties: {
        person_name: { type: 'string', description: 'All or part of the service user\'s name' },
      },
    },
    async execute(orgId, args) {
      const name = cleanName(args.person_name);
      if (!name) throw new Error('person_name is required');
      return findPeople(orgId, name);
    },
  },
];

export function findMicaTool(name: string): MicaTool | undefined {
  return MICA_TOOLS.find((t) => t.name === name);
}
