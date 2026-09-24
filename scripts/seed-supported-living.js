// Seeds "DreakCare Supported Living" — the supported-living sister org of the
// DreakCare domiciliary demo org — with the SAME staff and passwords.
//
// Logins cannot share an address (auth resolves a login to one account by
// email), so each account is a plus-tag alias of the original that lands in
// the same inbox: sarah.johnson@dreakcare.co.uk -> sarah.johnson+sl@dreakcare.co.uk
//
// Passwords are CLONED from the DreakCare accounts at run time, so each login
// keeps the exact password its DreakCare counterpart has today (all
// Password123$ unless someone changed one since seeding). If DreakCare is not
// present in the database, the script falls back to hashing Password123$.
//
// Run inside the API container (needs pg + bcryptjs): node seed.js
// Or locally: DATABASE_URL=postgres://... node scripts/seed-supported-living.js

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
const ds = (n) => df(n).toISOString().split("T")[0];
const ORG = "DreakCare Supported Living";

// Plus-tag an email while keeping the same inbox: a+b@x -> a+sl@x.
const alias = (e) => {
  const at = e.lastIndexOf("@");
  return e.slice(0, at).split("+")[0] + "+sl" + e.slice(at);
};
const base = (e) => {
  const at = e.lastIndexOf("@");
  return (e.slice(0, at).split("+")[0] + e.slice(at)).toLowerCase();
};

(async () => {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");

    const check = await c.query("SELECT id FROM organizations WHERE name=$1", [ORG]);
    if (check.rows.length > 0) {
      console.log(ORG + " already exists - skipping");
      await c.query("ROLLBACK");
      return;
    }

    const oid = u();

    // Passwords: clone DreakCare's hashes so every login keeps the same
    // password as its domiciliary counterpart.
    const hashes = new Map();
    try {
      const src = await c.query(
        "SELECT u.email, u.password_hash FROM users u JOIN organizations o ON o.id=u.organization_id WHERE o.name='DreakCare'"
      );
      for (const r of src.rows) hashes.set(base(r.email), r.password_hash);
    } catch (_e) {}
    const fallbackHash = hashes.size === 0 ? await bc.hash("Password123$", 12) : null;
    const hashFor = (email) => hashes.get(base(email)) || fallbackHash;

    // Organisation (supported living, medication + nutrition capable)
    await c.query(
      `INSERT INTO organizations(id,name,status,plan,subscription_status,primary_service_type,service_types,care_capabilities,onboarding_completed)
       VALUES($1,$2,'active','professional','active','supported_living',$3,$4,true)`,
      [oid, ORG, ["supported_living"], { medication_support: true, nutrition_support: true }]
    );
    console.log("Created " + ORG);
    await c.query("SELECT set_config('app.current_org_id', $1, false)", [oid]);

    // Homes (locations)
    const H = [
      { n: "Selly Oak House", a: "50 Bristol Road, Selly Oak, Birmingham B29 6AG", cap: 8, cqc: "good", lat: "52.4800", lon: "-1.8900" },
      { n: "Edgbaston View", a: "120 Hagley Road, Edgbaston, Birmingham B16 8PE", cap: 6, cqc: "good", lat: "52.4700", lon: "-1.9200" },
      { n: "Handsworth Lodge", a: "45 Grove Lane, Handsworth, Birmingham B20 3HJ", cap: 10, cqc: "requires_improvement", lat: "52.5100", lon: "-1.9300" },
    ];
    const lids = [];
    for (const h of H) {
      const lid = u();
      lids.push(lid);
      await c.query(
        `INSERT INTO locations(id,organization_id,name,address,service_type,service_capacity,cqc_rating,last_cqc_inspection,minimum_staff_per_day,min_day_staff,min_night_staff,latitude,longitude)
         VALUES($1,$2,$3,$4,'supported_living',$5,$6,$7,4,2,1,$8,$9)`,
        [lid, oid, h.n, h.a, h.cap, h.cqc, ds(-90 - H.indexOf(h) * 30), h.lat, h.lon]
      );
    }
    console.log("Created " + H.length + " supported-living homes");

    // Staff — the same people as DreakCare, same roles, same passwords
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
         VALUES($1,$2,$3,$4,$5,true)`,
        [uid, oid, alias(s.e), hashFor(s.e), s.r]
      );
      await c.query(
        `INSERT INTO staff_profiles(id,user_id,first_name,last_name)
         VALUES($1,$2,$3,$4)`,
        [sid, uid, s.f, s.l]
      );
    }
    console.log("Created " + S.length + " staff members (same people and passwords as DreakCare)");

    // Residents (people living in the homes)
    const P = [
      { f: "Owen", l: "Davies", d: "1988-04-12", room: "Room 1", home: 0, al: [], s: "one_to_one", diet: "Regular", flags: ["autism"] },
      { f: "Chloe", l: "Morgan", d: "1992-09-30", room: "Room 2", home: 0, al: ["Penicillin"], s: "minimal", diet: "Gluten free", flags: [] },
      { f: "Ryan", l: "Evans", d: "1985-01-22", room: "Room 3", home: 0, al: [], s: "two_to_one", diet: "Regular", flags: ["behaviour"] },
      { f: "Sian", l: "Thomas", d: "1990-06-18", room: "Room 4", home: 1, al: ["Latex"], s: "one_to_one", diet: "Soft diet", flags: ["epilepsy"] },
      { f: "Callum", l: "Jones", d: "1994-11-02", room: "Room 5", home: 1, al: [], s: "independent", diet: "Regular", flags: [] },
      { f: "Megan", l: "Lewis", d: "1987-03-08", room: "Room 6", home: 1, al: ["Aspirin"], s: "minimal", diet: "Diabetic", flags: ["diabetic"] },
      { f: "Aled", l: "Hughes", d: "1991-07-25", room: "Room 7", home: 2, al: [], s: "one_to_one", diet: "Modified texture", flags: ["autism"] },
      { f: "Ffion", l: "Beynon", d: "1989-12-14", room: "Room 8", home: 2, al: [], s: "minimal", diet: "Regular", flags: [] },
      { f: "Ieuan", l: "Griffiths", d: "1993-02-27", room: "Room 9", home: 2, al: ["Ibuprofen"], s: "complex", diet: "Fortified", flags: ["behaviour", "epilepsy"] },
      { f: "Nia", l: "Powell", d: "1996-08-05", room: "Room 10", home: 2, al: [], s: "independent", diet: "Vegetarian", flags: [] },
    ];
    const pids = [];
    for (const p of P) {
      const pid = u();
      pids.push(pid);
      await c.query(
        `INSERT INTO people(id,organization_id,first_name,last_name,date_of_birth,gender,status,location_id,room_number,gp_name,gp_surgery,gp_phone,dietary_requirements,allergies,support_level,flags,tags,communication_method,funding_type,funding_details,dnacpr_status,admission_date,min_staff_required)
         VALUES($1,$2,$3,$4,$5,$6,'active',$7,$8,'Dr Patel','Selly Oak Health Centre','0121 496 0101',$9,$10,$11,$12,'[]'::jsonb,'verbal','local_authority','LA funded','no_dnacpr',$13,$14)`,
        [pid, oid, p.f, p.l, p.d, ["Male", "Female"][pids.length % 2], lids[p.home], p.room, p.diet, JSON.stringify(p.al), p.s, JSON.stringify(p.flags), ds(-200 + pids.length * 12), p.s === "two_to_one" || p.s === "complex" ? 2 : 1]
      );
    }
    console.log("Created " + P.length + " residents");

    // Rota shifts + assignments (day and wake-night, two weeks back, two forward)
    const cw = sids.slice(3, 9); // the six care workers
    let shiftCount = 0, assignCount = 0, openCount = 0;
    for (let d = -14; d <= 13; d++) {
      for (let h = 0; h < lids.length; h++) {
        for (const shape of [{ t: "day", h0: 7, hrs: 8 }, { t: "wake_night", h0: 22, hrs: 8 }]) {
          const s = df(d);
          s.setHours(shape.h0, 0, 0, 0);
          const e = new Date(s.getTime() + shape.hrs * 3600000);
          const isPast = e.getTime() < Date.now();
          const isOpen = !isPast && d > 2 && (d + h) % 6 === 0;
          const sid = u();
          await c.query(
            `INSERT INTO shifts(id,location_id,start_time,end_time,status,published_at,shift_type)
             VALUES($1,$2,$3,$4,$5,$6,$7)`,
            [sid, lids[h], s.toISOString(), e.toISOString(), isPast ? "completed" : isOpen ? "open" : "filled", df(-7).toISOString(), shape.t]
          );
          shiftCount++;
          if (isOpen) { openCount++; continue; }
          await c.query(
            `INSERT INTO shift_assignments(id,shift_id,staff_id,status,is_overtime)
             VALUES($1,$2,$3,$4,false)`,
            [u(), sid, cw[(shiftCount + h) % cw.length], isPast ? "accepted" : "assigned"]
          );
          assignCount++;
        }
      }
    }
    console.log("Created " + shiftCount + " rota shifts (" + openCount + " open), " + assignCount + " assignments");

    // Care plans
    for (const p of P) {
      for (const cat of ["personal_care", "independent_living"]) {
        await c.query(
          `INSERT INTO care_plans(id,person_id,title,category,description,status,review_date)
           VALUES($1,$2,$3,$4,$5,'active',$6)`,
          [u(), pids[P.indexOf(p)], cat.replace(/_/g, " ") + " plan", cat, "Individualised support plan for " + p.f + ".", ds(90)]
        );
      }
    }
    console.log("Created " + P.length * 2 + " care plans");

    // Daily notes
    const notes = ["Good day. Engaged with activities.", "Attended college placement.", "Required prompting with personal care.", "Cooked a meal with support.", "Family visit. Mood good.", "Low mood, responded well to reassurance.", "Medication administered as prescribed.", "Slept well. No incidents.", "Swimming session enjoyed.", "Keywork session completed."];
    for (let i = 0; i < 40; i++) {
      await c.query(
        `INSERT INTO daily_notes(id,person_id,author_id,note_date,shift,category,content,support_level)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [u(), pids[i % pids.length], uids[3 + (i % 6)], ds(-(i % 30)), i % 3 === 0 ? "night" : "day", ["wellbeing", "activities", "mood"][i % 3], notes[i % notes.length], ["independent", "minimal", "one_to_one"][i % 3]]
      );
    }
    console.log("Created 40 daily notes");

    // Risk assessments + family contacts
    for (const p of P) {
      await c.query(
        `INSERT INTO risk_assessments(id,person_id,type,risk_level,details,mitigation_actions,review_date)
         VALUES($1,$2,'behaviour',$3,$4,$5,$6)`,
        [u(), pids[P.indexOf(p)], ["low", "medium", "high"][P.indexOf(p) % 3], "Positive behaviour support review for " + p.f + ".", "Staff follow the PBS plan.", ds(60)]
      );
    }
    for (let i = 0; i < 4; i++) {
      await c.query(
        `INSERT INTO family_contacts(id,person_id,name,relationship,phone,email,is_emergency_contact)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [u(), pids[i], P[i].f + " family", i % 2 ? "Son" : "Daughter", "07" + ~~(1e8 + Math.random() * 9e8), P[i].l.toLowerCase() + "family@email.com", i < 2]
      );
    }
    console.log("Created 10 risk assessments, 4 family contacts");

    // Incidents
    const cats = [];
    for (const cat of [["Injury", "medium", false], ["Medication", "high", true]]) {
      const cid = u();
      cats.push(cid);
      await c.query(
        `INSERT INTO incident_categories(id,organization_id,name,severity,is_cqc_reportable,is_active)
         VALUES($1,$2,$3,$4,$5,true)`,
        [cid, oid, cat[0], cat[1], cat[2]]
      );
    }
    for (let i = 0; i < 4; i++) {
      await c.query(
        `INSERT INTO incidents(id,organization_id,category_id,title,description,incident_date,severity,status,is_cqc_reportable)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [u(), oid, cats[i % 2], "Incident " + (i + 1), "Reported incident #" + (i + 1) + ".", ds(-(25 + i * 12)), ["low", "medium", "high"][i % 3], i < 2 ? "resolved" : "reported", false]
      );
    }
    console.log("Created 2 incident categories + 4 incidents");

    // Policies, training, leave types, chat, compliance
    for (const t of ["Safeguarding", "Positive Behaviour Support", "GDPR", "Fire Safety", "Medication", "Infection Control", "Health & Safety", "Missing Person"]) {
      await c.query(
        `INSERT INTO policies(id,organization_id,title,category,content,version,status)
         VALUES($1,$2,$3,'General',$4,'1.0','active')`,
        [u(), oid, t, "# " + t + "\n" + ORG + " policy on " + t.toLowerCase() + "."]
      );
    }
    for (const t of ["Safeguarding Level 2", "Autism Awareness", "Epilepsy & Buccal Midazolam", "Positive Behaviour Support", "Fire Safety", "GDPR"]) {
      await c.query(
        `INSERT INTO training_modules(id,organization_id,name,category,frequency_days,is_mandatory)
         VALUES($1,$2,$3,'Mandatory',365,true)`,
        [u(), oid, t]
      );
    }
    for (const lt of [["Annual Leave", "#0F4C81", 28], ["Sick Leave", "#DC2626", 6], ["Training", "#16A34A", 3]]) {
      await c.query(
        `INSERT INTO leave_types(id,organization_id,name,color,days_allowed,duration_type)
         VALUES($1,$2,$3,$4,$5,'days')`,
        [u(), oid, lt[0], lt[1], lt[2]]
      );
    }
    const ch = u();
    await c.query(
      `INSERT INTO chat_channels(id,organization_id,name,type,created_by)
       VALUES($1,$2,'General','general',$3)`,
      [ch, oid, uids[0]]
    );
    for (const uid of uids) await c.query(`INSERT INTO chat_members(id,channel_id,user_id) VALUES($1,$2,$3)`, [u(), ch, uid]);
    const msgs = ["Welcome to " + ORG + "!", "Good morning team!", "Rota for next week is published.", "Any updates on support plans?", "Training refresher on Thursday."];
    for (let i = 0; i < msgs.length; i++) await c.query(`INSERT INTO chat_messages(id,channel_id,sender_id,content) VALUES($1,$2,$3,$4)`, [u(), ch, uids[i % uids.length], msgs[i]]);
    for (const cr2 of ["DBS Check", "Safeguarding Training", "Autism Awareness", "Epilepsy & Buccal Midazolam", "Positive Behaviour Support", "Fire Safety"]) {
      await c.query(
        `INSERT INTO compliance_config(id,organization_id,name,description,days_warning,days_overdue,is_mandatory)
         VALUES($1,$2,$3,$4,30,0,true)`,
        [u(), oid, cr2, cr2 + " requirement"]
      );
    }
    console.log("Created 8 policies, 6 training modules, 3 leave types, chat, 6 compliance requirements");

    await c.query("COMMIT");
    console.log("\n=== DONE - " + ORG + " seeded successfully ===");
    console.log("Login credentials (same password as each DreakCare account, all Password123$ unless changed since):");
    for (const s of S) console.log("  " + alias(s.e) + " -> " + s.r);
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
