# EU-region deployment

A design note, not an implementation. Written 30 September 2026 as part of the
Ireland scoping spike. Nothing in this document is deployed.

## Why this came up in an Ireland spike rather than an infrastructure one

Two of them, and only one of them is obvious.

The obvious one: an Irish provider is in the EU, and a UK-only product asks them
to send care records outside the EU and the Economic Area. Under GDPR Chapter V
that is a restricted transfer, and it needs a lawful mechanism and, where the
destination is not covered by an adequacy decision, safeguards. For an Irish
controller that is a question their DPO will ask before they sign.

The less obvious one, and the reason this note exists: **HIQA told us this
matters to the regulator, not just to the DPO.** HIQA's announcement of its
standards review, 18 August 2026, names the **EU Artificial Intelligence (AI)
Act 2024** as one of the changes the sector has to absorb. So for an Irish
provider, where the AI runs and how it is governed is a regulatory question in
its own right, not only a privacy one. That single sentence from a primary
source is the reason the region decision is a scoping item at all rather than
infrastructure folklore.

## What "region" would mean here, and what it does not today

There is no region concept anywhere in this repository. Not in the API, not in
the web app, not in the deployment.

- Production is a **single-host Docker Compose** deployment (`docker-compose.prod.yml`):
  `web`, `api`, `db`, `redis`, all on one host, ports published to `127.0.0.1`
  and presumably fronted by a reverse proxy.
- `DATABASE_URL` points at `db:5432` — a service name on the same Compose
  network. **The application cannot be pointed at a database on another host
  without a change**, let alone another continent.
- There is no managed database, no read replica, no cross-region anything, and no
  `REGION` variable.

So "add an EU region" today means choosing between two quite different shapes,
and the choice should be made before any code is written.

## The trade-off nobody should skip: this is not purely additive

This is the part that argues against the obvious plan.

A UK-only deployment in a UK region and a **second** EU deployment in an EU
region is the intuitive design: existing customers are unaffected, Irish
customers get EU hosting. It also means the UK deployment still sends Irish
data to the UK, so the Irish provider still needs a transfer mechanism — and we
would have built the thing that was supposed to remove that problem.

Putting **everything** in the EU removes the Ireland problem outright and
introduces one for the UK instead. UK customer data would leave the UK, and the
security page currently says records are stored in the United Kingdom. That is
not a technical problem; it is a claim we would have to withdraw or qualify, and
the same page already has three rows where we had to admit we could not evidence
the answer (see `docs/CLAIM_REGISTER.md` F10 and the SecurityPage status table).

There is no version of this that avoids a residency conversation. The only
question is which one, and with whom.

## Options

### Option A — Single EU region for everything

- One deployment, one region, no routing, no data partitioning, one backup story.
- Ireland gets what it needs with no transfer mechanism at all.
- The UK loses UK residency and the security page has to change.
- Simplest thing to build and to operate. Genuinely tempting.

### Option B — UK region plus an EU region, per-customer tenancy

- The shape people reach for first.
- Costs: two deployments, two migration paths, two backup and restore paths, two
  incident responses, and a tenant-to-region routing decision that the
  application does not currently have any concept of.
- **Does not solve the Irish problem by itself** — see the paragraph above.
- Becomes the right answer only if the tenancy is genuinely region-bound, i.e.
  an Irish customer's data never enters the UK deployment.

### Option C — Keep one region, be honest about transfers

- No new infrastructure. Document the transfer, get the Art 28 / IDTA position
  settled, update the security page accurately.
- **This is what T0-17b already says we owe every customer**, and it is not
  Ireland-specific. Doing it honestly for Ireland and dishonestly for the UK
  would not survive a DPO's attention.

## What is actually blocking

None of this can be decided before these four are answered, and none of them are
engineering questions:

1. **Is an Irish regulator, a commissioner or a customer's own DPO going to
   require EU residency?** A home in a different member state can require it
   contractually regardless of the law. We do not know, and we should not assume
   a sale is blocked by something nobody has actually raised.
2. **What is the Art 28 / international transfer position?** T0-17b is open for
   the UK and an EU region does not close it — OpenAI and Anthropic are US
   companies, so clinical text leaves the EU as well as the UK. **An EU region
   fixes the storage leg of the problem and leaves the AI leg untouched**, which
   is worth being blunt about before anyone treats EU hosting as the answer to
   the AI transfer question.
3. **Who operates it?** This is a Docker Compose deployment with no managed
   database. "Two regions" is an operational commitment, not a config flag, and
   the DR runbook is a document rather than a tested capability.
4. **Does the EU AI Act apply to us, to the provider, or to both?** HIQA raised
   it. We use AI features that generate care-record narratives. Nobody here has
   assessed our role, and that assessment is a prerequisite to selling to
   Ireland, not a follow-up.

## Recommendation

**Do not build a region yet. Answer the four questions first.**

The reason is that the honest reading of the evidence so far says the region is
not the binding constraint. An EU region does not fix the AI transfer, does not
fix Art 28, and — under Option B — does not even fix Ireland's own position. It
is the most expensive of the three options and it addresses one leg of a
three-leg problem.

The cheapest next step is not infrastructure. It is the four answers, and then a
decision recorded with the reasoning. If it turns out EU residency is genuinely
required, Option A is where I would start, because it is the only one of the
three that actually solves the problem it is meant to solve, and because its
cost — withdrawing a residency claim we cannot currently evidence anyway — is
smaller than it looks.

## Related

- `docs/CLAIM_REGISTER.md` — F10 (encryption at rest, unevidenced), F11b
  (backups), and the Art 28 gap that made the security page's UK-residency row
  unclaimable.
- `docs/GO_LIVE_READINESS.md` — T0-17b (transfers), T2-26 (backups),
  T2-30 (HIQA themes, the other Ireland blocker).
- `apps/web/src/pages/marketing/SecurityPage.tsx` — the page that would have to
  change under Option A. Its status table already marks rows it cannot evidence.
