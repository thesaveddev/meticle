// Operational demo data for the existing "DreakCare Supported Living" org.
//
// The org already has locations, staff, people, shifts and care plans; what is
// missing is everything around them: leave (0 requests, 0 balances), eMAR (0),
// room checks (0), appointments (0) and tasks (0). This fills those gaps with a
// realistic slice — the same shape as seed-orbis/seed-vps, scoped to DreakCare.
//
// Run inside the production api container (DATABASE_URL is already set there),
// exactly like the seed-dreakcare workflow:
//
//   scp scripts/seed-dreakcare-data.js root@2.58.82.177:/tmp/seed-dreakcare-data.js
//   ssh root@2.58.82.177 "docker cp /tmp/seed-dreakcare-data.js meticle-api-1:/app/seed-dreakcare-data.js"
//   ssh root@2.58.82.177 'docker exec -w /app meticle-api-1 node seed-dreakcare-data.js'
//
// ## Idempotency
//
// Re-runs delete only this script's own rows first (traced by MARKER in a
// notes/description/instructions field, and by the 'MAR Chart -' title
// convention for eMAR charts, which DreakCare has no other use of). Leave
// balances use ON CONFLICT DO NOTHING. Nothing else is touched.

const { Pool } = require("pg");
const cr = require("crypto");

const MARKER = "[dreakcare-seed]";
const ORG_NAME = "DreakCare Supported Living";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const u = () => cr.randomUUID();
const dayAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
};
const dayAhead = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
};
const at = (dateStr, hour, min = 0) => {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCHours(hour, min, 0, 0);
  return d.toISOString();
};

const LEAVE_WANT = [
  { name: "Annual Leave", color: "#0F4C81", days: 28 },
  { name: "Sick Leave", color: "#DC2626", days: 10 },
  { name: "Training", color: "#16A34A", days: 5 },
];

const MEDS = [
  { name: "Paracetamol 500mg", dosage: "500 mg", unit: "mg", route: "oral", freq: "twice daily", times: ["08:00", "20:00"], prn: false },
  { name: "Atorvastatin 20mg", dosage: "20 mg", unit: "mg", route: "oral", freq: "once daily", times: ["08:00"], prn: false },
  { name: "Salbutamol inhaler 100mcg", dosage: "2 puffs", unit: "dose", route: "inhaled", freq: "as needed", times: [], prn: true, indication: "Shortness of breath or wheeze" },
];

const APPTS = ["GP Appointment", "Dentist Checkup", "Care Plan Review", "Family Visit", "Optician Appointment", "Physiotherapy"];

const TASKS = [
  { title: "Review care plans for upstairs residents", pri: "high", status: "in_progress", su: true },
  { title: "Order continence supplies", pri: "medium", status: "pending", su: false },
  { title: "Fire door checks — ground floor", pri: "high", status: "pending", su: false },
  { title: "Update MAR charts after GP round", pri: "urgent", status: "pending", su: false },
  { title: "Garden gate latch repair", pri: "low", status: "pending", su: false },
  { title: "New resident welcome pack", pri: "medium", status: "completed", su: true },
  { title: "Supervision sessions — night team", pri: "medium", status: "pending", su: false },
  { title: "Medication stock count", pri: "high", status: "completed", su: false },
];

(async () => {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");

    const org = await c.query("SELECT id FROM organizations WHERE name = $1", [ORG_NAME]);
    if (org.rows.length === 0) throw new Error(`No organisation named '${ORG_NAME}'. Nothing was written.`);
    const oid = org.rows[0].id;
    await c.query("SELECT set_config('app.current_org_id', $1, false)", [oid]);
    console.log(`Seeding ${ORG_NAME} (${oid})`);

    const staff = (await c.query(
      `SELECT sp.id AS profile_id, u.id AS user_id, sp.first_name, sp.last_name, u.role
       FROM staff_profiles sp JOIN users u ON u.id = sp.user_id
       WHERE u.organization_id = $1 ORDER BY u.email`, [oid])).rows;
    const people = (await c.query(
      `SELECT id, first_name, last_name, room_number, location_id FROM people
       WHERE organization_id = $1 ORDER BY first_name`, [oid])).rows;
    const locations = (await c.query("SELECT id, name FROM locations WHERE organization_id = $1", [oid])).rows;
    if (!staff.length || !people.length) throw new Error("Need at least one staff member and one person. Nothing was written.");
    console.log(`  staff=${staff.length} people=${people.length} locations=${locations.length}`);

    let n = 0;
    const exec = async (text, params) => { await c.query(text, params); n++; };

    // ── Leave: ensure types, balances, requests ──
    const existingTypes = (await c.query("SELECT id, name FROM leave_types WHERE organization_id = $1", [oid])).rows;
    const typeIds = {};
    for (const want of LEAVE_WANT) {
      const found = existingTypes.find((t) => t.name === want.name);
      if (found) { typeIds[want.name] = found.id; continue; }
      const id = u();
      await exec(
        `INSERT INTO leave_types (id,organization_id,name,color,days_allowed,duration_type) VALUES ($1,$2,$3,$4,$5,'days')`,
        [id, oid, want.name, want.color, want.days]);
      typeIds[want.name] = id;
    }
    for (const s of staff) {
      for (const want of LEAVE_WANT) {
        await exec(
          `INSERT INTO leave_balances (staff_id,leave_type_id,year,days_allocated,hours_allocated)
           VALUES ($1,$2,2026,$3,$4) ON CONFLICT DO NOTHING`,
          [s.profile_id, typeIds[want.name], want.days, want.days * 8]);
      }
    }
    await c.query(`DELETE FROM leave_requests WHERE notes LIKE $1`, [`%${MARKER}%`]);
    const managers = staff.filter((s) => s.role === "ORG_ADMIN" || s.role === "MANAGER");
    const reviewer = (managers[0] || staff[0]).user_id;
    const leavePlan = [
      { si: 0, type: "Annual Leave", from: -40, to: -33, status: "approved" },
      { si: 1, type: "Annual Leave", from: 12, to: 16, status: "pending" },
      { si: 2, type: "Sick Leave", from: -9, to: -7, status: "approved" },
      { si: 3, type: "Annual Leave", from: 30, to: 37, status: "pending" },
      { si: 4, type: "Training", from: 5, to: 5, status: "approved" },
      { si: 0, type: "Annual Leave", from: 60, to: 61, status: "rejected" },
    ];
    for (const [i, p] of leavePlan.entries()) {
      const s = staff[p.si % staff.length];
      const start = p.from < 0 ? dayAgo(-p.from) : dayAhead(p.from);
      const end = p.to < 0 ? dayAgo(-p.to) : dayAhead(p.to);
      const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
      await exec(
        `INSERT INTO leave_requests (id,staff_id,leave_type_id,start_date,end_date,hours_requested,duration_type,status,reason,notes,reviewed_by,reviewed_at)
         VALUES ($1,$2,$3,$4,$5,$6,'days',$7,$8,$9,$10,$11)`,
        [u(), s.profile_id, typeIds[p.type], start, end, days * 7.5, p.status,
          ["Family holiday", "Medical appointment", "Personal reasons", "Study leave"][i % 4],
          `${MARKER} demo request`,
          p.status === "pending" ? null : reviewer,
          p.status === "pending" ? null : new Date().toISOString()]);
      if (p.status === "approved") {
        await c.query(
          `UPDATE leave_balances SET days_taken = days_taken + $1, hours_taken = hours_taken + $2
           WHERE staff_id = $3 AND leave_type_id = $4 AND year = 2026`,
          [days, days * 7.5, s.profile_id, typeIds[p.type]]);
      }
    }
    console.log("  ✓ leave types, balances and requests");

    // ── eMAR: one chart per person, scheduled + PRN items, a week of doses ──
    const oldCharts = (await c.query(
      `SELECT id FROM emedication_records WHERE organization_id = $1 AND title LIKE 'MAR Chart -%'`, [oid])).rows;
    for (const r of oldCharts) {
      const items = (await c.query("SELECT id FROM emedication_items WHERE emedication_record_id = $1", [r.id])).rows;
      for (const it of items) await c.query("DELETE FROM emedication_administrations WHERE emedication_item_id = $1", [it.id]);
      await c.query("DELETE FROM emedication_items WHERE emedication_record_id = $1", [r.id]);
      await c.query("DELETE FROM emedication_records WHERE id = $1", [r.id]);
    }
    const giver = staff[0].profile_id;
    for (const [pi, p] of people.entries()) {
      const chartId = u();
      await exec(
        `INSERT INTO emedication_records (id,organization_id,person_id,title,start_date,end_date,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'active',$7)`,
        [chartId, oid, p.id, `MAR Chart - ${p.first_name} ${p.last_name}`, dayAgo(30), dayAhead(60), staff[0].user_id]);
      for (const [mi, med] of MEDS.entries()) {
        const itemId = u();
        await exec(
          `INSERT INTO emedication_items (id,emedication_record_id,name,dosage,unit,route,frequency,times,instructions,is_prn,is_active,created_by,is_controlled_drug,prescriber_name,prn_indication)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,false,'Dr Patel',$12)`,
          [itemId, chartId, med.name, med.dosage, med.unit, med.route, med.freq, JSON.stringify(med.times),
            `${MARKER} seeded chart item`, med.prn, staff[0].user_id,
            med.prn ? med.indication : null]);
        if (med.prn) continue;
        const who = staff[(pi + mi) % staff.length].profile_id;
        for (let d = -6; d <= 0; d++) {
          for (const t of med.times) {
            const [h, m] = t.split(":").map(Number);
            const sched = at(dayAgo(-d), h, m);
            const given = (pi + mi + d + h) % 11 !== 0; // occasional miss, like real life
            await exec(
              `INSERT INTO emedication_administrations (id,emedication_item_id,staff_id,scheduled_time,administered_time,status,notes)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [u(), itemId, given ? who : giver, sched,
                given ? new Date(new Date(sched).getTime() + 12 * 60000).toISOString() : null,
                given ? "given" : "missed",
                given ? "Administered as prescribed" : "Medication refused"]);
          }
        }
        for (let d = 1; d <= 2; d++) {
          for (const t of med.times) {
            const [h, m] = t.split(":").map(Number);
            await exec(
              `INSERT INTO emedication_administrations (id,emedication_item_id,staff_id,scheduled_time,status)
               VALUES ($1,$2,$3,$4,'pending')`,
              [u(), itemId, who, at(dayAhead(d), h, m)]);
          }
        }
      }
    }
    console.log("  ✓ eMAR charts, items and administrations");

    // ── Training records for the existing modules ──
    const modules = (await c.query("SELECT id, frequency_days FROM training_modules WHERE organization_id = $1", [oid])).rows;
    await c.query(`DELETE FROM training_records WHERE notes LIKE $1`, [`%${MARKER}%`]);
    for (const [si, s] of staff.entries()) {
      for (const [mi, m] of modules.entries()) {
        const variant = (si + mi) % 7;
        const status = variant === 6 ? "expired" : variant === 5 ? "incomplete" : "completed";
        await exec(
          `INSERT INTO training_records (module_id,staff_id,completed_at,expires_at,status,competency_passed,trainer_name,notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [m.id, s.profile_id,
            status === "incomplete" ? null : dayAgo(30 + ((si * 37 + mi * 53) % 300)),
            status === "incomplete" ? null : status === "expired" ? dayAgo((si + mi) % 20 + 1) : dayAhead(60 + ((si * 41 + mi * 29) % 300)),
            status, status === "completed" ? true : null,
            status === "incomplete" ? null : "External Trainer",
            `${MARKER} seeded record`]);
      }
    }
    console.log("  ✓ training records");

    // ── Room checks: each resident room, last 3 days ──
    await c.query(`DELETE FROM room_checks WHERE notes LIKE $1`, [`%${MARKER}%`]);
    for (const p of people) {
      if (!p.room_number) continue;
      for (let d = 0; d < 3; d++) {
        const checker = staff[(p.room_number.length + d) % staff.length].profile_id;
        await exec(
          `INSERT INTO room_checks (organization_id,location_id,room_number,checked_by,check_date,status,cleanliness_rating,safety_rating,notes)
           VALUES ($1,$2,$3,$4,$5,'pass',5,5,$6)`,
          [oid, p.location_id, p.room_number, checker, dayAgo(d), `${MARKER} routine check`]);
      }
    }
    console.log("  ✓ room checks");

    // ── Appointments: 5 past (completed), 5 upcoming (scheduled) ──
    await c.query(`DELETE FROM appointments WHERE notes LIKE $1`, [`%${MARKER}%`]);
    for (let i = 0; i < 10; i++) {
      const p = people[i % people.length];
      const past = i < 5;
      const day = past ? dayAgo((i + 1) * 4) : dayAhead((i - 4) * 3 + 1);
      const start = at(day, 9 + (i % 5), 30);
      const end = at(day, 10 + (i % 5), 30);
      await exec(
        `INSERT INTO appointments (organization_id,person_id,title,start_time,end_time,status,location_id,created_by,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [oid, p.id, APPTS[i % APPTS.length], start, end, past ? "completed" : "scheduled",
          p.location_id, staff[0].user_id, `${MARKER} demo appointment`]);
    }
    console.log("  ✓ appointments");

    // ── Tasks ──
    await c.query(`DELETE FROM tasks WHERE description LIKE $1`, [`%${MARKER}%`]);
    for (const [i, t] of TASKS.entries()) {
      const assignee = staff[i % staff.length].profile_id;
      const person = t.su ? people[i % people.length].id : null;
      const done = t.status === "completed";
      await exec(
        `INSERT INTO tasks (organization_id,title,description,assigned_to,person_id,priority,status,due_date,completed_at,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [oid, t.title, `${MARKER} ${t.title}`, assignee, person, t.pri, t.status,
          done ? dayAgo(2) : dayAhead(3 + i), done ? new Date().toISOString() : null, staff[0].user_id]);
    }
    console.log("  ✓ tasks");

    await c.query("COMMIT");
    console.log(`\nDone — ${n} rows written to ${ORG_NAME}.`);
  } catch (e) {
    await c.query("ROLLBACK");
    console.error("\nSeed failed, nothing was written:", e.message || e);
    process.exitCode = 1;
  } finally {
    c.release();
    await pool.end();
  }
})();
