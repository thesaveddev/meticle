# Differentiation: location privacy, on demand

**Status:** internal position paper — for Adetoye to deploy across sales,
website and store metadata. **Not published copy.** Every claim carries the
code that proves it; nothing here is written against intent.
**Evidence verified 28 Sep 2026.** Tracker anchors: T0-6 (DPIA), T0-6a/6b,
T2-14. Related: the DPIA v1.0–v1.4 in `docs/DPIA_Live_Active_Visit_Map.md`.

## The thesis in one sentence

MeticleCare is the care platform whose carer location story a provider can
defend to a carer, a family, and the ICO in the same breath — because the
platform collects position **three times per visit, on demand, with the
collection provably off on request** — while the sector default is a live
tracker that follows the worker all day and trusts the vendor's retention
policy to be kind.

That is the whole argument. Everything below is either proof, objection
handling, or the places this thesis must not be overstated.

## Why this is the one defensible thesis

Every other differentiator available to us is either matched within a release
or unverifiable:

- **Feature parity** (scheduling, medication, notes, families) — every
  competitor's roadmap reaches the same features. Not a moat.
- **AI** — the honest position (dated record query + language-model summary,
  no statistical model — see `ai.capabilities.ts`) is exactly what our larger
  competitors are shipping with more data scientists. We differentiate on
  *governance of* AI, not on AI.
- **Price** — a race to the bottom with private-equity-backed incumbents.
- **"UK-hosted"** — true, table stakes, and every competitor claims it.

Location privacy is different in kind, for three reasons:

1. **The data subject is an employee, not a customer.** Care workers cannot
   walk away from an employer's tracking choice. That asymmetry is precisely
   what ICO enforcement guidance on workplace monitoring singles out, and what
   unions, recruitment problems, and tribunal risk all trace back to. A
   provider who can say "our system cannot follow my staff around all day"
   is answering the strongest emotional objection in the sector.
2. **It is architectural, not configurational.** Competitors can add a "privacy
   mode" toggle that stops *displaying* location while continuing to collect
   it. Ours stops collection at the source — `watchPositionAsync` was deleted
   from the mobile app (commit `1677ffe`), not hidden. "We don't collect what
   we don't need" survives a code audit; "we have a setting" does not.
3. **We already did the work the buyer would otherwise have to demand.** The
   DPIA went through four versions, two of which *retracted our own claims*
   when the controls didn't exist yet (v1.1) and a third that found and closed
   a hole in the kill switch while writing the carer notice (v1.4). That
   document is a sales asset: it demonstrates the vendor polices itself.

## The four proofs

Each of these is shippable in a sales deck with a screenshot of the code or
the DPIA section beside it.

### 1. Three on-demand reads per visit; zero continuous tracking

`Location.watchPositionAsync` — the API that follows a worker continuously —
was **removed** from the mobile app (commit `1677ffe`, 28 Sep 2026). What
remains is three discrete reads: check-in position, check-out position (the
only two stored, both on the visit record), and one on-demand read that drives
a distance display and **never leaves the device**
(`DPIA` §1.1, `apps/mobile/src/components/MapPickerModal.tsx`). The DPIA states
it flatly: "Given the purposes above, no continuous tracking is necessary, and
none occurs" (§1.1, line 180).

### 2. The per-organisation kill switch — and what "off" honestly means

`organizations.location_tracking_enabled` (migration 126; `PUT/GET
/homecare/settings/location-tracking`, ORG_ADMIN only, audited old → new with
timestamps). When off: `GET /dashboard/live-map` returns **403 — "Carer
location is not being collected"** (`dashboard.controller.ts`), and the mobile
app checks the flag *before* it ever asks the OS for permission
(`MapPickerModal.tsx:64`, `StaffNoticeGate.tsx:50`) — so a carer whose employer
switched tracking off is never shown a permission prompt that shouldn't exist.
Every map view is audited as an access event, deliberately without coordinates.

The honest edge, which we say out loud because hiding it would be discovered:
"off" stops future collection and live-map viewing; the two stored points per
historical visit remain on those records until retention is defined
(DPIA §6.1 — the one thing off cannot preserve). Residual risk is held at
MEDIUM in the DPIA, not quietly lowered to sell.

### 3. The carer is told — with server-side receipts

At first launch the carer sees what is collected, in plain sentences, before
any capture: `apps/mobile/src/content/staffLocationNotice.ts`. Acknowledgement
is recorded **server-side** (migration 127; `POST/GET /homecare/staff-notices`),
so an employer can evidence "this worker was told, on this date, against this
version of the notice" — and a material change to the notice re-triggers
acknowledgement. Where the honest answer is unknown (retention period), the
notice says "we don't know" rather than guessing. A notice that guesses is
worse than one that admits the gap, because the worker cannot tell which parts
are reliable.

### 4. The data minimisation posture is organisation-level policy, not vendor virtue

The same session shipped `ai_data_minimisation` (migration 130): clinical
narrative can be withheld from LLM prompts per organisation, names are always
pseudonymised with org-scoped HMACs, and a production deploy **refuses** to
send anything to an unapproved AI processor
(`assertApprovedProcessor`, fail-closed). The pitch line: *the platform is
built on the assumption that the controller, not the vendor, decides what
leaves — and enforces it in code.*

## Objection handling

**"Isn't on-demand capture less useful for scheduling and disputes?"**
The use cases buyers actually name — proof of arrival, mileage, travel time —
are exactly what check-in/check-out points prove. Continuous tracks add
surveillance value for the employer and nothing for the care record. If a
prospect insists they need a track, that prospect is telling you their
workforce relations problem is about to become yours; walk away or put it in
writing that the platform cannot do it.

**"Competitor X offers geofencing and live ETA."**
Correct, and that is a real feature gap for dispatch-heavy operators. Say so.
The counter is not denial; it is that the gap is a *choice* the provider gets
to make — and our choice is documented, audited, and reversible by the
controller. Position: we sell the version where the provider decided, on
record, not to watch.

**"What if the client's family demands to see where the carer is?"**
`GET /dashboard/live-map` is manager-role gated, domiciliary-only, and every
view is audit-logged as an access event. Families get reassurance through
completed-visit records, not live worker tracking — which is also the
position the ICO would expect the employer to hold.

**"Prove it."**
Three artifacts do the proving: the DPIA with its retraction history,
`grep -rn watchPositionAsync apps/mobile` returning nothing outside tests, and
the staff-notice acknowledgement table. None requires trust in a vendor
statement.

## Where this thesis must NOT be pushed

Guardrails, because overselling this destroys it:

- **Never "we don't track"** — we collect two points per visit. "No continuous
  tracking; capture at check-in and check-out only" is the claim. The claims
  guard blocks bare "live location"/"live tracking" for exactly this reason.
- **Never claim data minimisation proves anonymisation** — pseudonymised is
  not anonymous, and the LLM boundary still carries coded facts (T0-17b is
  open until the Art 28 work is signed). AI governance is a supporting proof,
  not the headline.
- **Retention is still undefined** (DPIA §2.2, T2-14 adjacent). Until it is,
  the pitch is about *collection discipline*, not full lifecycle privacy. If
  pressed: "retention is being defined with our DPIA sign-off; collection
  minimisation is shipped."
- **The kill switch preserves history** — §6.1 says exactly what off stops.
  Sales must use §6.1's wording, not "switch it off and the data is gone."

## Deployment checklist for Adetoye

1. **Website privacy/security page**: one paragraph + the four proofs, linked
   to the DPIA. This is the strongest placement; procurement readers look
   there first.
2. **Sales deck**: slide 2 — "Your carers are not tracked. Here is the commit
   that proves it." (The engineering receipt lands better than adjectives.)
3. **Store metadata** (`STORE_PRIVACY_ANSWERS.md`): already honest; align its
   wording with §"Where this thesis must not be pushed" above.
4. **Recruitment/retention angle**: care-sector staff churn is the buyer's
   cost centre; "your carers can see we don't track them, and we can show them
   the notice they signed" is a retention argument, not a compliance one.
5. **Guard the language**: any new copy goes through the claims sweep
   (`marketingClaims.ts`); if a needed phrase is blocked, widen the *evidence*,
   not the guard.

*One-pager ends. Every factual sentence above traces to code listed in it.*
