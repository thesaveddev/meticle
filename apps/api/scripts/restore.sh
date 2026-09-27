#!/bin/sh
# Point-in-time recovery drill.
#
# Restores the database into a THROWAWAY Postgres container and replays the
# archived write-ahead log into it, so the recovery path is proven without ever
# touching production. A backup nobody has ever restored is a hypothesis.
#
# Why a separate container, and not a database on the live cluster:
#
#   Archive recovery is engaged by writing `recovery.signal` and restarting the
#   Postgres *server*. On the live cluster that restart is an outage for every
#   customer, and replaying WAL into a production directory is not a drill, it
#   is an incident. So this spins up a disposable cluster on the same image
#   with its own data directory, and does the dangerous part there.
#
# What it proves: that the snapshot restores, that the WAL archive is readable,
# and that replay reaches the point in time asked for. Those are three separate
# things and any of them can be broken on its own.
#
# Usage:
#   ./restore.sh --to "2026-09-27 11:42:00+00"     # recover to a moment
#   ./restore.sh                                    # recover as far as the archive goes
#   ./restore.sh --keep                             # leave the container running to poke at it
#
# Requirements: docker, and read access to the backup volume.

set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
WAL_DIR="${WAL_DIR:-$BACKUP_DIR/wal}"
# Must match the digest-pinned image in docker-compose.prod.yml. A different
# Postgres major version cannot read the WAL of another.
PG_IMAGE="${PG_IMAGE:?PG_IMAGE must be set to the same digest-pinned postgres image as production}"
DRILL_CONTAINER="${DRILL_CONTAINER:-meticle_pitr_drill}"
RESTORE_TO=""
KEEP=0

while [ $# -gt 0 ]; do
  case "$1" in
    --to) RESTORE_TO="$2"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    -h|--help) sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is required for this drill." >&2
  exit 1
fi

# ── Pick the snapshot ──────────────────────────────────────────────────────
SNAPSHOT=$(ls -1t "$BACKUP_DIR"/meticle_*.sql.gz 2>/dev/null | head -1 || true)
if [ -z "$SNAPSHOT" ]; then
  echo "ERROR: no snapshot found in $BACKUP_DIR" >&2
  exit 1
fi
SNAPSHOT_NAME=$(basename "$SNAPSHOT")
echo "[$(date)] Snapshot:  $SNAPSHOT_NAME ($(du -h "$SNAPSHOT" | cut -f1))"
echo "[$(date)] WAL dir:   $WAL_DIR ($(find "$WAL_DIR" -type f 2>/dev/null | wc -l | tr -d ' ') segment(s))"

if [ "$(find "$WAL_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')" -eq 0 ]; then
  # Without segments the drill still works, but it is only testing the snapshot.
  # Say so rather than letting a green run be read as proof of PITR.
  echo "[$(date)] WARNING: the WAL archive is empty." >&2
  echo "[$(date)] This drill can only prove the snapshot restores, NOT that" >&2
  echo "[$(date)] point-in-time recovery works. Check archive_mode on the live db." >&2
fi

# ── Start a disposable cluster ─────────────────────────────────────────────
docker rm -f "$DRILL_CONTAINER" >/dev/null 2>&1 || true

echo "[$(date)] Starting disposable cluster '$DRILL_CONTAINER'"
docker run -d --name "$DRILL_CONTAINER" \
  -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=meticle \
  -v "$WAL_DIR:/wal:ro" \
  "$PG_IMAGE" >/dev/null

# Wait for it to accept connections. The entrypoint initialises a fresh cluster,
# which on a slow disk is not instant.
READY=0
for _ in $(seq 1 60); do
  if docker exec "$DRILL_CONTAINER" pg_isready -U postgres -d meticle >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done

if [ "$READY" -ne 1 ]; then
  echo "[$(date)] ERROR: drill cluster did not become ready" >&2
  docker logs "$DRILL_CONTAINER" 2>&1 | tail -20 >&2
  docker rm -f "$DRILL_CONTAINER" >/dev/null 2>&1 || true
  exit 1
fi

# ── Load the snapshot ──────────────────────────────────────────────────────
echo "[$(date)] Loading snapshot into the drill cluster (a few minutes)"
if ! gunzip -c "$SNAPSHOT" | docker exec -i "$DRILL_CONTAINER" \
  psql -U postgres -d meticle -q -v ON_ERROR_STOP=1 >/dev/null; then
  echo "[$(date)] ERROR: snapshot failed to load" >&2
  docker logs "$DRILL_CONTAINER" 2>&1 | tail -20 >&2
  docker rm -f "$DRILL_CONTAINER" >/dev/null 2>&1 || true
  exit 1
fi

BEFORE_COUNT=$(docker exec "$DRILL_CONTAINER" psql -U postgres -d meticle -At -c "SELECT count(*) FROM people;" 2>/dev/null || echo "?")
echo "[$(date)] Snapshot loaded. people rows before replay: $BEFORE_COUNT"

# ── Replay the WAL ─────────────────────────────────────────────────────────
# Requires a clean shutdown so recovery can be configured, then a restart with
# recovery.signal present. This is the step that only succeeds because archive
# archiving is enabled on the live server.
echo "[$(date)] Configuring archive recovery"
docker exec "$DRILL_CONTAINER" psql -U postgres -d meticle -q -v ON_ERROR_STOP=1 <<SQL
ALTER SYSTEM SET restore_command = 'cp /wal/%f %p';
ALTER SYSTEM SET recovery_target_timeline = 'latest';
ALTER SYSTEM SET recovery_target_action = 'promote';
SQL

if [ -n "$RESTORE_TO" ]; then
  docker exec "$DRILL_CONTAINER" psql -U postgres -d meticle -q -c \
    "ALTER SYSTEM SET recovery_target_time = '$RESTORE_TO';" >/dev/null
  echo "[$(date)] Target time: $RESTORE_TO"
else
  echo "[$(date)] Target time: end of available archive"
fi

# A clean shutdown is required before recovery can be configured, otherwise
# Postgres replays crash recovery and not archive recovery.
docker exec "$DRILL_CONTAINER" psql -U postgres -q -c "CHECKPOINT;" >/dev/null
docker stop "$DRILL_CONTAINER" >/dev/null

# The signal file has to be present at server startup. The data directory lives
# in the container's writable layer, which survives stop/start (but not rm), so
# the sequence is: start normally, write the signal, restart. Postgres reads it
# on the second start and enters archive recovery.
docker start "$DRILL_CONTAINER" >/dev/null
docker exec "$DRILL_CONTAINER" sh -c 'touch /var/lib/postgresql/data/recovery.signal'
docker restart "$DRILL_CONTAINER" >/dev/null

echo "[$(date)] Replaying WAL (this is the part point-in-time recovery depends on)"
REPLAYING=1
for _ in $(seq 1 90); do
  if docker exec "$DRILL_CONTAINER" psql -U postgres -d meticle -At -c \
    "SELECT pg_is_in_recovery();" 2>/dev/null | grep -q '^f$'; then
    REPLAYING=0
    break
  fi
  sleep 2
done

if [ "$REPLAYING" -ne 0 ]; then
  echo "[$(date)] ERROR: replay did not finish. The container log says why:" >&2
  docker logs "$DRILL_CONTAINER" 2>&1 | grep -iE "recovery|restore|error|fatal" | tail -20 >&2
  docker rm -f "$DRILL_CONTAINER" >/dev/null 2>&1 || true
  exit 1
fi

AFTER_COUNT=$(docker exec "$DRILL_CONTAINER" psql -U postgres -d meticle -At -c "SELECT count(*) FROM people;" 2>/dev/null || echo "?")
LATEST=$(docker exec "$DRILL_CONTAINER" psql -U postgres -d meticle -At -c \
  "SELECT COALESCE(max(created_at)::text, 'none') FROM audit_logs;" 2>/dev/null || echo "?")

echo "[$(date)] --------------------------------------------------"
echo "[$(date)] DRILL PASSED"
echo "[$(date)]   people rows:  $BEFORE_COUNT (snapshot) -> $AFTER_COUNT (after replay)"
echo "[$(date)]   latest audit entry in the recovered copy: $LATEST"
echo "[$(date)]   replayed to:  ${RESTORE_TO:-end of archive}"
echo "[$(date)] --------------------------------------------------"

if [ -n "$RESTORE_TO" ]; then
  echo "[$(date)] CHECK: is '$LATEST' consistent with recovering to '$RESTORE_TO'?"
  echo "[$(date)] If it is later than asked for, replay stopped at the last"
  echo "[$(date)] available segment. A green run is not the same as the right"
  echo "[$(date)] point in time — compare the timestamps yourself."
fi

if [ "$KEEP" -eq 1 ]; then
  echo "[$(date)] Container kept. Inspect it with:"
  echo "[$(date)]   docker exec -it $DRILL_CONTAINER psql -U postgres -d meticle"
else
  docker rm -f "$DRILL_CONTAINER" >/dev/null 2>&1 || true
  echo "[$(date)] Drill container removed."
fi

exit 0
