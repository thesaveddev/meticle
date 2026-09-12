const { Pool } = require("pg");
const cr = require("crypto");
const bc = require("bcryptjs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const u = () => cr.randomUUID();
const df = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

(async () => {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");

    // Set RLS org context for all subsequent inserts
    const RLS_SET = `SELECT set_config('app.current_org_id', $1, false)`;
    // Check if already exists (by name since slug column doesn't exist)
    const check = await c.query("SELECT id FROM organizations WHERE name='DreakCare'");
    if (check.rows.length > 0) {
      console.log("DreakCare already exists - skipping");
      await c.query("ROLLBACK");
      return;
    }

    const oid = u();
    const hp = await bc.hash("Password123$", 12);

    // Organisation (no slug, no billing_settings columns)
    await c.query(
      `INSERT INTO organizations(id,name,subscription_status,service_types,onboarding_completed)
       VALUES($1,$2,$3,$4,$5)`,
      [oid, "DreakCare", "active", ["domiciliary"], true]
    );
    console.log("Created DreakCare org");
    // Set RLS context for this org so all subsequent inserts pass tenant isolation
    await c.query(RLS_SET, [oid]);

    // Locations (no status column)
    const l1 = u(), l2 = u();
    await c.query(
      `INSERT INTO locations(id,organization_id,name,address) VALUES($1,$2,$3,$4)`,
      [l1, oid, "DreakCare Office", "100 Corporation Street, Birmingham B4 6AY"]
    );
    await c.query(
      `INSERT INTO locations(id,organization_id,name,address) VALUES($1,$2,$3,$4)`,
      [l2, oid, "South Birmingham Hub", "25 Bristol Road, Birmingham B5 7AA"]
    );
    console.log("Created 2 locations");

    // Staff (staff_profiles: no organization_id, no status)
    const S = [
      { e: "opeyemiolorunfemy@gmail.com", f: "Opeyemi", l: "Olorunfemi", r: "ORG_ADMIN" },
      { e: "opeyemi@meticlecare.com", f: "Opeyemi", l: "Admin", r: "MANAGER" },
      { e: "linkhopey@gmail.com", f: "Hope", l: "Link", r: "MANAGER" },
      { e: "sarah.johnson@dreakcare.co.uk", f: "Sarah", l: "Johnson", r: "CARE_WORKER" },
      { e: "james.williams@dreakcare.co.uk", f: "James", l: "Williams", r: "CARE_WORKER" },
      { e: "emma.brown@dreakcare.co.uk", f: "Emma", l: "Brown", r: "CARE_WORKER" },
      { e: "david.smith@dreakcare.co.uk", f: "David", l: "Smith", r: "CARE_WORKER" },
      { e: "lisa.taylor@dreakcare.co.uk", f: "Lisa", l: "Taylor", r: "CARE_WORKER" },
      { e: "michael.davis@dreakcare.co.uk", f: "Michael", l: "Davis", r: "CARE_WORKER" },
      { e: "rachel.wilson@dreakcare.co.uk", f: "Rachel", l: "Wilson", r: "COMPLIANCE_OFFICER" },
    ];
    const sids = [];
    const uids = [];
    for (const s of S) {
      const uid = u(), sid = u();
      sids.push(sid);
      uids.push(uid);
      await c.query(
        `INSERT INTO users(id,organization_id,email,password_hash,role,email_verified)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [uid, oid, s.e, hp, s.r, true]
      );
      // staff_profiles: id, user_id, first_name, last_name (no org_id, no status)
      await c.query(
        `INSERT INTO staff_profiles(id,user_id,first_name,last_name)
         VALUES($1,$2,$3,$4)`,
        [sid, uid, s.f, s.l]
      );
    }
    console.log(`Created ${S.length} staff members`);

    // Clients (people: use room_number, not address; address doesn't exist)
    const P = [
      { f: "Margaret", l: "Thompson", d: "1942-03-15", room: "12 Oak Lane", al: ["Penicillin", "Latex"], s: "minimal" },
      { f: "Arthur", l: "Bennett", d: "1938-11-22", room: "45 Maple Road", al: ["Shellfish"], s: "one_to_one" },
      { f: "Dorothy", l: "Hughes", d: "1945-07-08", room: "78 Elm Street", al: [], s: "minimal" },
      { f: "Walter", l: "Green", d: "1940-01-30", room: "23 Cedar Avenue", al: ["Aspirin", "Codeine"], s: "one_to_one" },
      { f: "Betty", l: "Adams", d: "1943-09-12", room: "56 Birch Close", al: [], s: "minimal" },
      { f: "George", l: "Clark", d: "1936-05-19", room: "91 Pine Drive", al: ["Peanuts"], s: "two_to_one" },
      { f: "Edna", l: "Robinson", d: "1944-12-03", room: "14 Willow Way", al: [], s: "minimal" },
      { f: "Frank", l: "Hall", d: "1939-08-25", room: "67 Ash Grove", al: ["Ibuprofen"], s: "one_to_one" },
    ];
    const pids = [];
    for (const p of P) {
      const pid = u();
      pids.push(pid);
      // people: id, org_id, first_name, last_name, date_of_birth, room_number, allergies, support_level, status, location_id
      // Note: no 'address' column
      await c.query(
        `INSERT INTO people(id,organization_id,first_name,last_name,date_of_birth,room_number,allergies,support_level,status,location_id)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [pid, oid, p.f, p.l, p.d, p.room, JSON.stringify(p.al), p.s, "active", l1]
      );
    }
    console.log(`Created ${P.length} clients`);

    // Mileage policies
    const MF = [
      { t: "2024/25", v: "car", f: "petrol", r: 45 },
      { t: "2024/25", v: "car", f: "diesel", r: 45 },
      { t: "2024/25", v: "car", f: "hybrid", r: 45 },
      { t: "2024/25", v: "car", f: "electric", r: 9 },
      { t: "2024/25", v: "motorcycle", f: "petrol", r: 24 },
      { t: "2024/25", v: "bicycle", f: "not_applicable", r: 20 },
    ];
    for (const m of MF) {
      await c.query(
        `INSERT INTO homecare_mileage_policies(id,organization_id,tax_year,vehicle_type,fuel_category,rate_pence,is_active,created_by)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [u(), oid, m.t, m.v, m.f, m.r, true, uids[0]]
      );
    }
    console.log(`Created ${MF.length} mileage policies`);

    // Care packages
    const FN = ["private", "local_authority", "nhs"];
    const pkgs = [];
    for (let i = 0; i < pids.length; i++) {
      const pk = u();
      pkgs.push(pk);
      await c.query(
        `INSERT INTO homecare_packages(id,organization_id,person_id,name,status,funding_type,hourly_rate_pence,travel_time_paid,mileage_rate_pence,start_date)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [pk, oid, pids[i], P[i].f + " care package", "active", FN[i % 3], 1800 + i * 100, true, 45, new Date().toISOString().split("T")[0]]
      );
    }
    console.log(`Created ${pkgs.length} care packages`);

    // Care plans
    const CT = ["medication", "nutrition", "mobility", "personal_care", "social"];
    for (let i = 0; i < pids.length; i++) {
      for (let j = 0; j < 2; j++) {
        await c.query(
          `INSERT INTO care_plans(id,person_id,title,category,description,status,review_date)
           VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [u(), pids[i], CT[(i + j) % 5] + " for " + P[i].f, CT[(i + j) % 5], "Plan for " + P[i].f, "active", df(30 + j * 30).toISOString().split("T")[0]]
        );
      }
    }
    console.log("Created 16 care plans");

    // Scheduled visits (next 7 days)
    const cw = sids.slice(3); // care workers only
    let visitCount = 0;
    for (let d = 0; d < 7; d++) {
      const dt = df(d);
      for (let i = 0; i < pids.length; i++) {
        const n = i % 3 === 0 ? 3 : 2;
        const T = [
          { h: 8, m: 0, dur: 30, t: "morning" },
          { h: 12, m: 30, dur: 45, t: "lunch" },
          { h: 17, m: 0, dur: 30, t: "evening" },
        ].slice(0, n);
        for (const v of T) {
          const s = new Date(dt);
          s.setHours(v.h, v.m, 0, 0);
          const e = new Date(s.getTime() + v.dur * 60000);
          await c.query(
            `INSERT INTO homecare_visits(id,organization_id,package_id,person_id,assigned_staff_id,visit_type,label,scheduled_start,scheduled_end,status)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [u(), oid, pkgs[i], pids[i], d === 6 && i > 4 ? null : cw[(i + d) % cw.length], v.t, v.t + " call", s.toISOString(), e.toISOString(), "scheduled"]
          );
          visitCount++;
        }
      }
    }
    console.log(`Created ${visitCount} scheduled visits`);

    // Completed visits (past 3 days) with GPS
    let completedCount = 0;
    for (let d = -3; d < 0; d++) {
      const dt = df(d);
      for (let i = 0; i < Math.min(pids.length, 5); i++) {
        const s = new Date(dt);
        s.setHours(9 + i, 0, 0, 0);
        const e = new Date(s.getTime() + 30 * 60000);
        await c.query(
          `INSERT INTO homecare_visits(id,organization_id,package_id,person_id,assigned_staff_id,visit_type,label,scheduled_start,scheduled_end,status,check_in_at,check_out_at,check_in_latitude,check_in_longitude,actual_travel_minutes,actual_mileage_miles,mileage_status,visit_notes)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
          [
            u(), oid, pkgs[i], pids[i], cw[i % cw.length], "routine", "Call",
            s.toISOString(), e.toISOString(), "completed",
            new Date(s.getTime() + 300000).toISOString(),
            new Date(e.getTime() - 120000).toISOString(),
            52.48 + Math.random() * 0.02,
            -1.89 + Math.random() * 0.02,
            10 + ~~(Math.random() * 20),
            (2 + Math.random() * 8).toFixed(2),
            "submitted",
            "Done"
          ]
        );
        completedCount++;
      }
    }
    console.log(`Created ${completedCount} completed visits`);

    // Timesheets (staff_id, not carer_id)
    const cv = await c.query(
      "SELECT id,assigned_staff_id FROM homecare_visits WHERE organization_id=$1 AND status=$2 AND actual_mileage_miles IS NOT NULL",
      [oid, "completed"]
    );
    for (const v of cv.rows) {
      const w = 25 + ~~(Math.random() * 10);
      const t = 10 + ~~(Math.random() * 20);
      const p = Math.min(t, 15);
      const m = (2 + Math.random() * 8).toFixed(2);
      const g = Math.round((w + p) * 20);
      await c.query(
        `INSERT INTO homecare_timesheets(id,organization_id,visit_id,staff_id,work_minutes,travel_minutes,paid_travel_minutes,mileage_miles,mileage_rate_pence,gross_pay_pence,status)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [u(), oid, v.id, v.assigned_staff_id, w, t, p, m, 45, g, "submitted"]
      );
    }
    console.log(`Created ${cv.rows.length} timesheets`);

    // Family contacts
    for (let i = 0; i < 4; i++) {
      await c.query(
        `INSERT INTO family_contacts(id,person_id,name,relationship,phone,email,is_emergency_contact)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [u(), pids[i], P[i].f + " family", i % 2 ? "Son" : "Daughter", "07" + ~~(1e8 + Math.random() * 9e8), P[i].l.toLowerCase() + "family@email.com", i < 2]
      );
    }
    console.log("Created 4 family contacts");

    await c.query("COMMIT");
    console.log("\n=== DONE - DreakCare seeded successfully ===");
    console.log("Login credentials (all Password123$):");
    for (const s of S) console.log(`  ${s.e} -> ${s.r}`);
  } catch (e) {
    try { await c.query("ROLLBACK"); } catch (_e) {}
    console.error("Seed failed:", e.message || e);
    process.exit(1);
  } finally {
    c.release();
    await pool.end();
  }
})()
  .then(() => process.exit(0))
  .catch((e) => { console.error("Unhandled:", e.message || e); process.exit(1); });
