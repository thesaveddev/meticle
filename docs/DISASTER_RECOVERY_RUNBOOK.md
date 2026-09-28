# Disaster recovery runbook

**Owner:** Opeyemi (execution) · **Accountability:** Adetoye (decision to declare)
**Created:** 28 September 2026 · **Review:** after every drill (T0-2), or after any real invocation
**Tracker:** T2-6 in `GO_LIVE_READINESS.md`; depends on the restore procedure in T0-2

## What this runbook covers

Recovery of the production MeticleCare stack after: database loss or corruption,
a failed deploy leaving no healthy release, host-level failure of the VPS, and
suspected compromise requiring a clean rebuild. It does not cover application-level
data mistakes a *customer* makes inside the product — that is support, not DR.

**The one command to remember, and the one to run first in any scenario:**

```sh
PG_IMAGE=<digest-pinned postgres image> ./apps/api/scripts/restore.sh
```

It restores the latest snapshot plus archived WAL into a **disposable** container
and never touches the live database. Almost every scenario below begins with
running it, because the first thing a recovery needs is a readable copy of the
data at the best available point in time.

## Targets and reality

| Target | Value | Basis |
|---|---|---|
| RPO — max data loss | ~5 minutes | `archive_timeout` forces a WAL segment switch every 5 min (T0-3a); nightly `pg_dump` at 02:00 is the floor |
| RTO — max time to service restored | 4 hours | Restore drill (once run) + stack redeploy; untested until T0-2 passes |
| Point-in-time granularity | any second since archiving began | WAL replay via `restore.sh --to "timestamp"` |

These targets are claims, and two of them rest on the T0-2 drill having been
**run**. Until it has, treat RTO as unmeasured and say so to anyone who asks.
After every drill, update this table with measured numbers instead of targets.

## Scenario 1 — database corruption or bad migration

*Symptoms: queries failing on specific tables, data that should not exist, an
application error that survives a restart.*

1. **Stop writes.** `docker compose -f docker-compose.prod.yml stop api` — the
   API is the only writer; stopping it freezes the damage. Do not stop `db`.
2. **Snapshot the evidence before touching anything.**
   `docker exec meticle-db-1 pg_dump -U meticle -d meticle > /backups/pre_recovery_$(date +%s).sql`
   The broken state is needed for the incident record and, occasionally, for
   retrieving rows that were fine.
3. **Pick the recovery point.** The last moment the data was known good. When in
   doubt, choose the moment *just before* the corruption appeared — the script
   accepts `--to "2026-09-28 14:30:00+00"`.
4. **Restore to a throwaway container and verify it there:**
   ```sh
   PG_IMAGE=<image> ./apps/api/scripts/restore.sh --to "..." --keep
   ```
   Then inspect the drill container directly: row counts on `people`,
   `daily_notes`, `medication` tables against known-good markers.
5. **Promote the verified copy.** Stop `db`, swap the data directory (or `pg_dump`
   out of the drill container and restore in), start `db`, then `api`.
6. **Record**: recovery point chosen, why, time from stop to service. Update the
   RTO/RPO table with the real number.

## Scenario 2 — bad deploy, no healthy release

*Symptoms: crash loop after a deploy, 500s on every route, but the database is
fine.*

1. The previous image is digest-pinned in the deploy log. Redeploy it:
   `API_IMAGE=<previous digest> docker compose -f docker-compose.prod.yml up -d api`
2. Do **not** roll back a migration by hand. Migrations run forward-only; if the
   previous image cannot run against the newer schema, the fix is a *forward*
   migration that restores compatibility, written after the rollback stops the
   bleeding.
3. If the failure involved the web build, the same logic applies with
   `WEB_IMAGE=<previous digest>`.
4. Record: image rolled from/to, and whether the schema had to be reconciled.

## Scenario 3 — host failure (VPS dead or unbootable)

*Symptoms: no SSH, provider reports the node failed, console unreachable.*

1. Provision a replacement host. The whole stack is reproducible from the repo:
   `docker-compose.prod.yml` plus the `.env` from the password manager (not from
   the dead host).
2. Point the domain at the new host (TTL matters here — keep it at 300 s, and
   this is why).
3. Restore data on the new host with `restore.sh`, then promote as in Scenario 1
   step 5. The backup volume must be mounted from wherever backups actually
   live (`/backups`); if backups lived only on the dead host, stop and escalate
   to Adetoye before promising anyone anything, because the recovery may now be
   "replay what the off-host copy allows", which may be nothing.
4. **Off-host backups are the assumption this whole scenario rests on.** If the
   backup volume is local-only, fixing that is a pre-condition for declaring any
   RPO at all.

## Scenario 4 — suspected compromise

*Symptoms: unknown processes, unfamiliar keys in `authorized_keys`, unexpected
DB roles, vendor alerts about keys we did not rotate.*

1. **Declare first, investigate second.** Adetoye decides; the timer for the
   ICO's 72-hour breach clock starts at awareness, and investigating quietly
   first is how organisations lose most of it.
2. Preserve evidence before cleaning: copy logs (now size-capped per T0-13, so
   also export them off-host), `docker commit` suspicious containers, save the
   running config.
3. Rotate **every** credential per `API_KEY_ROTATION_POLICY.md`, starting with
   Postgres and the vendor keys. This is the "immediately" trigger in that
   policy, not the calendar one.
4. Rebuild the host from images; do not clean in place.
5. Restore data from a pre-compromise point in time, chosen with the incident
   timeline in hand.
6. ICO assessment with timestamps, per `SECURITY_POLICY.md`.

## Who does what

| Phase | Opeyemi | Adetoye |
|---|---|---|
| Detect | Confirm and scope the failure | — |
| Declare | Recommend a recovery point | **Decision**: declare, choose recovery point, approve customer comms |
| Recover | Execute this runbook | Available for vendor/console actions |
| Verify | Data checks in the drill container | Sign-off that service is genuinely restored |
| Review | Technical timeline within 48 h | ICO/customer notifications, register update |

## Running the drill (T0-2) — the exact procedure

Run it **on the VPS**, not a laptop: it needs Docker and read access to the
`backup_data` volume. This machine (the dev laptop) has neither, so the drill
is a VPS session, run by Opeyemi or by Adetoye with Opeyemi on screen share.
Two gotchas that are not obvious from the script alone:

1. **Get the image from the running stack, not from memory.**
   `docker inspect meticle-db-1 --format '{{.Config.Image}}'`
   gives the exact digest-pinned reference. A different Postgres major version
   cannot read the archived WAL. Copy-paste that value into `PG_IMAGE` — the
   script refuses to run with it unset for exactly this reason.
2. **Run it on the host, not inside the backup container.** The obvious
   place — `docker exec meticle-backup-1 sh /usr/local/bin/restore.sh` — does
   not work: the script calls the Docker CLI to spawn the drill container, and
   the backup container has no Docker socket and no CLI. Running it on the
   host against the volume's real mountpoint is the supported path (Option A
   below). Mounting the Docker socket into a container is a root-equivalent
   privilege grant and should not be left in place just to make a drill
   convenient (Option B, only if ever needed):

   ```sh
   # Option A (simplest): run on the host, not in a container.
   ssh <vps>
   docker volume ls   # the volume is <project>_backup_data — note the exact name
   VOL=$(docker volume ls --format '{{.Name}}' | grep backup_data)
   BACKUP_DIR=$(docker volume inspect "$VOL" --format '{{.Mountpoint}}')   # usually /var/lib/docker/volumes/<name>/_data
   cd "$DEPLOY_DIR"   # the repo checkout the deploy workflow uses
   PG_IMAGE=$(docker inspect meticle-db-1 --format '{{.Config.Image}}') \
     BACKUP_DIR="$BACKUP_DIR" \
     sh apps/api/scripts/restore.sh

   # Option B (no host docker perms for a script): temporarily add the socket
   # and the Docker CLI to the backup container via a one-off compose override,
   # run, then remove it. Docker-in-Docker-by-mount is a privilege grant — do
   # not leave the override in place.
   ```

   Option A is the one to use. The script only needs: `docker` on the host,
   read access to the volume's files, and `gunzip` (present on any standard
   VPS distro). Its container name default `meticle_pitr_drill` does not
   collide with anything in the compose file.

**Pass criteria, not just exit code 0.** The script prints `people rows:
X (snapshot) -> Y (after replay)`. Y must be **greater than** X, because the
WAL replayed since the 02:00 dump contains real new writes — if Y == X, either
the archive is empty (the script warns) or replay silently did nothing. Then
run it a second time with `--to "$(date -u -d '-1 hour' +'%Y-%m-%d %H:%M:%S')"`
and confirm the printed `latest audit entry` is **older than one hour ago**:
that is the step that proves *point-in-time*, not just replay-to-end. Record
both runs' output in the tracker; the RTO/RPO table in this document gets its
first real numbers from them.

## Standing pre-conditions (each is a tracker item)

- **T0-2**: the drill has actually been run. Until then this runbook is theory.
- **T0-2a**: a named person rehearses this. A runbook nobody has walked through
  under pressure is a document, not a capability.
- **T0-3a / backup cadence**: archiving confirmed moving segments.
- **Off-host backup copy**: assumed above; verify it exists before trusting
  Scenario 3.

After every invocation — drill or real — update the RTO/RPO table and file the
timeline in the incident record. A runbook that is never revised from contact
with reality degrades into marketing.
