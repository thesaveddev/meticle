// Syncs the users of "DreakCare Supported Living" to the MeticleCare mailbox
// roster. Run it any time the roster changes: it is idempotent and preserves
// each account's existing password hash, so nobody's password changes.
//
// Roster (realistic care-org role mix):
//   demo@           ORG_ADMIN           full access (as requested)
//   security@       COMPLIANCE_OFFICER  safety/compliance
//   hello@          CARE_WORKER         front-line
//   support@        CARE_WORKER         front-line
//   opeyemi@        MANAGER             founder's account (moved from DreakCare)
//   billing@        MANAGER
//   business@       MANAGER
//   enterprise@     MANAGER
//   notifications@  MANAGER
//
// opeyemi@meticlecare.com is globally unique and used to be the DreakCare
// manager login. It moves here; the DreakCare account is renamed to
// opeyemi+dreak@meticlecare.com (same inbox, unchanged password hash). The
// account that takes over the opeyemi@ address inherits the OLD opeyemi@
// password hash, so any existing login or smoke test for that address keeps
// working unchanged.
//
// Accounts are re-used in place (renamed), so staff profiles, rota
// assignments, notes and chat history all survive. Surplus accounts are
// removed after their assignments/notes are reassigned to a surviving carer.
//
// Run inside the API container (needs pg): node users.js
// Or locally: DATABASE_URL=postgres://... node scripts/update-sl-users.js

const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ORG = "DreakCare Supported Living";
const OPEYEMI = "opeyemi@meticlecare.com";
const OPEYEMI_DREAK = "opeyemi+dreak@meticlecare.com";

const TARGETS = [
  { e: "demo@meticlecare.com", r: "ORG_ADMIN" },
  { e: "security@meticlecare.com", r: "COMPLIANCE_OFFICER" },
  { e: "hello@meticlecare.com", r: "CARE_WORKER" },
  { e: "support@meticlecare.com", r: "CARE_WORKER" },
  { e: OPEYEMI, r: "MANAGER" },
  { e: "billing@meticlecare.com", r: "MANAGER" },
  { e: "business@meticlecare.com", r: "MANAGER" },
  { e: "enterprise@meticlecare.com", r: "MANAGER" },
  { e: "notifications@meticlecare.com", r: "MANAGER" },
];

(async () => {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");

    const orgRes = await c.query("SELECT id FROM organizations WHERE name=$1", [ORG]);
    if (orgRes.rows.length === 0) {
      console.error(ORG + " not found - run the seed first (scripts/seed-supported-living.js)");
      process.exit(1);
    }
    const oid = orgRes.rows[0].id;
    await c.query("SELECT set_config('app.current_org_id', $1, false)", [oid]);

    // 1. Free the opeyemi@ address: if it belongs to another org (DreakCare),
    //    rename that account to the +dreak alias and keep its password hash to
    //    hand to whichever account takes over the address here.
    let opeyemiHash = null;
    const oe = await c.query(
      "SELECT id, organization_id, password_hash FROM users WHERE LOWER(TRIM(email))=$1",
      [OPEYEMI]
    );
    if (oe.rows.length > 0) {
      const row = oe.rows[0];
      if (String(row.organization_id) === String(oid)) {
        console.log(OPEYEMI + " already in " + ORG);
      } else {
        opeyemiHash = row.password_hash;
        await c.query("UPDATE users SET email=$1 WHERE id=$2", [OPEYEMI_DREAK, row.id]);
        console.log("Moved " + OPEYEMI + " here; DreakCare manager renamed to " + OPEYEMI_DREAK);
      }
    }

    // 2. Current org users.
    const cur = await c.query(
      "SELECT u.id, u.email, u.role, sp.id AS staff_id FROM users u LEFT JOIN staff_profiles sp ON sp.user_id=u.id WHERE u.organization_id=$1 ORDER BY u.created_at",
      [oid]
    );
    const byEmail = new Map(cur.rows.map((r) => [String(r.email).toLowerCase(), r]));
    const spare = cur.rows.filter((r) => !TARGETS.some((t) => t.e === String(r.email).toLowerCase()));

    // 3. Map every target onto an account: an exact match is kept, otherwise a
    //    spare account is renamed in place (preferring the same role so staff
    //    history stays coherent).
    const survivors = [];
    for (const t of TARGETS) {
      const existing = byEmail.get(t.e);
      if (existing) {
        if (existing.role !== t.r) {
          await c.query("UPDATE users SET role=$1 WHERE id=$2", [t.r, existing.id]);
          console.log(t.e + ": role -> " + t.r);
        }
        survivors.push(existing);
        continue;
      }

      // Skip targets already used by some other org (global email uniqueness).
      const taken = await c.query("SELECT organization_id FROM users WHERE LOWER(TRIM(email))=$1", [t.e]);
      if (taken.rows.length > 0) {
        console.log("SKIPPED " + t.e + " - already used by another organisation");
        continue;
      }

      let pick = -1;
      if (t.e === OPEYEMI && opeyemiHash) pick = 0; // any spare will carry the hash
      else pick = spare.findIndex((s) => s.role === t.r);
      if (pick < 0) pick = 0;
      if (spare.length === 0) {
        console.log("SKIPPED " + t.e + " - no account available to reuse");
        continue;
      }
      const [acct] = spare.splice(pick, 1);
      const params = [t.e, t.r, acct.id];
      let sql = "UPDATE users SET email=$1, role=$2";
      if (t.e === OPEYEMI && opeyemiHash) {
        sql += ", password_hash=$4";
        params.push(opeyemiHash);
      }
      sql += " WHERE id=$3";
      await c.query(sql, params);
      console.log(acct.email + " -> " + t.e + " (" + t.r + ")");
      survivors.push({ ...acct, email: t.e, role: t.r });
    }

    // 4. Remove surplus accounts, but keep their work: reassign rota
    //    assignments, daily notes and chat messages to a surviving carer first.
    if (spare.length > 0) {
      const keep = survivors.find((s) => s.staff_id) || survivors[0];
      for (const s of spare) {
        if (s.staff_id && keep && keep.staff_id && s.staff_id !== keep.staff_id) {
          await c.query("UPDATE shift_assignments SET staff_id=$1 WHERE staff_id=$2", [keep.staff_id, s.staff_id]);
        }
        if (keep) {
          await c.query("UPDATE daily_notes SET author_id=$1 WHERE author_id=$2", [keep.id, s.id]);
          await c.query("UPDATE chat_messages SET sender_id=$1 WHERE sender_id=$2", [keep.id, s.id]);
        }
        await c.query("DELETE FROM users WHERE id=$1", [s.id]);
        console.log("Removed surplus account " + s.email + " (work reassigned)");
      }
    }

    await c.query("COMMIT");

    const final = await c.query(
      "SELECT email, role FROM users WHERE organization_id=$1 ORDER BY role, email",
      [oid]
    );
    console.log("\n=== DONE - " + ORG + " users ===");
    for (const r of final.rows) console.log("  " + r.email + " -> " + r.role);
    console.log("\nPasswords are unchanged for every account (Password123$ for all seeded accounts).");
  } catch (e) {
    try { await c.query("ROLLBACK"); } catch (_e) {}
    console.error("Update failed:", e.message || e);
    process.exit(1);
  } finally {
    c.release();
    await pool.end();
  }
})()
  .then(() => process.exit(0))
  .catch((e) => { console.error("Unhandled:", e.message || e); process.exit(1); });
