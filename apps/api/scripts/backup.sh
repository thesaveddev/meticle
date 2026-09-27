#!/bin/sh
# Automated PostgreSQL backup and point-in-time recovery support.
#
# Two jobs, and they are not the same thing:
#
#   1. A nightly full snapshot. This is the base a restore starts from, and it
#      has existed since the beginning.
#   2. Continuous write-ahead log archiving, run by Postgres itself rather than
#      by this script. This is what makes point-in-time recovery possible: with
#      it, the database can be rewound to any moment after the last snapshot.
#      Without it, "restore" means "go back to 2am and lose the day".
#
# The trap in (2) is that it fails *silently*. If the archive destination is not
# writable, or the volume is full, Postgres logs a warning and carries on
# writing WAL that is never copied anywhere. Nothing crashes, no backup job
# fails, and the day it matters there is no recovery point. So this script
# actively checks that archiving is keeping up and exits non-zero when it is
# not — a loud failure on a schedule beats a quiet one on the worst day.

set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
WAL_DIR="${WAL_DIR:-$BACKUP_DIR/wal}"
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-meticle}"
DB_USER="${DB_USER:-meticle}"
DB_PASSWORD="${DB_PASSWORD:-}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
# A segment should appear in the archive within this long of being written.
# archive_timeout is 300s, so anything past ~20 minutes means archiving has
# stopped, not that it is merely slow.
ARCHIVE_STALE_SECONDS="${ARCHIVE_STALE_SECONDS:-1200}"

if [ -z "$DB_PASSWORD" ]; then
  echo "[$(date)] ERROR: DB_PASSWORD is not configured" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR" "$WAL_DIR"
export PGPASSWORD="$DB_PASSWORD"

DATE=$(date +%Y%m%d_%H%M%S)
SQL_TMP="$BACKUP_DIR/.meticle_$DATE.sql.tmp"
GZIP_TMP="$BACKUP_DIR/.meticle_$DATE.sql.gz.tmp"
FILENAME="$BACKUP_DIR/meticle_$DATE.sql.gz"
trap 'rm -f "$SQL_TMP" "$GZIP_TMP"' EXIT

echo "[$(date)] Starting backup: $FILENAME"

# Keep pg_dump and compression as separate steps. This works under Alpine's
# /bin/sh and ensures a failed pg_dump cannot be hidden by a successful gzip.
if ! pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --clean --if-exists --no-owner --no-privileges > "$SQL_TMP"; then
  echo "[$(date)] ERROR: pg_dump failed; incomplete backup removed" >&2
  exit 1
fi

if ! gzip < "$SQL_TMP" > "$GZIP_TMP"; then
  echo "[$(date)] ERROR: gzip failed; incomplete backup removed" >&2
  exit 1
fi

mv "$GZIP_TMP" "$FILENAME"
rm -f "$SQL_TMP"

echo "[$(date)] Backup complete: $(du -h "$FILENAME" | cut -f1)"

# Remove snapshots older than retention period.
find "$BACKUP_DIR" -maxdepth 1 -name "meticle_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

# ---------------------------------------------------------------------------
# Point-in-time recovery check
# ---------------------------------------------------------------------------
# Read the archiver's own counters rather than counting files in $WAL_DIR. File
# counts can look healthy while archiving is actually wedged, whereas
# pg_stat_archiver reports the last time a segment was successfully archived
# and how many attempts have failed.
ARCHIVER=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -At -F '|' -c \
  "SELECT COALESCE(EXTRACT(EPOCH FROM (NOW() - last_archived_time))::int, -1),
          archived_count,
          failed_count,
          (SELECT setting FROM pg_settings WHERE name = 'archive_mode')
   FROM pg_stat_archiver;" 2>/dev/null || echo "|-1|-|-")

STALE=$(echo "$ARCHIVER" | cut -d'|' -f1)
ARCHIVED=$(echo "$ARCHIVER" | cut -d'|' -f2)
FAILED=$(echo "$ARCHIVER" | cut -d'|' -f3)
ARCHIVE_MODE=$(echo "$ARCHIVER" | cut -d'|' -f4)

if [ "$ARCHIVE_MODE" != "on" ]; then
  echo "[$(date)] ERROR: archive_mode is '${ARCHIVE_MODE:-unknown}', not 'on'." >&2
  echo "[$(date)] Point-in-time recovery is NOT working. Snapshots continue, but" >&2
  echo "[$(date)] a restore can only go back to the last nightly snapshot." >&2
  exit 1
fi

if [ "$STALE" = "-1" ]; then
  echo "[$(date)] ERROR: could not read pg_stat_archiver; cannot confirm PITR is working." >&2
  exit 1
fi

if [ "$STALE" -gt "$ARCHIVE_STALE_SECONDS" ]; then
  echo "[$(date)] ERROR: no WAL segment archived for ${STALE}s (limit ${ARCHIVE_STALE_SECONDS}s)." >&2
  echo "[$(date)] Point-in-time recovery is NOT keeping up. Check the archive" >&2
  echo "[$(date)] destination is writable by the postgres user and has space." >&2
  exit 1
fi

if [ "${FAILED:-0}" -gt 0 ]; then
  # A failure count that never resets is worth knowing about even when the
  # current state is healthy, so warn but do not fail the run.
  echo "[$(date)] WARNING: ${FAILED} WAL archive attempt(s) have failed since startup." >&2
  echo "[$(date)] Archiving is currently keeping up (last segment ${STALE}s ago)." >&2
fi

echo "[$(date)] PITR check OK: ${ARCHIVED} segment(s) archived, last ${STALE}s ago."

# Prune archived segments on the same schedule as snapshots. Both are written
# to the same volume, so a full disk takes out the snapshots and the recovery
# points together; this is the other half of not filling the disk.
find "$WAL_DIR" -type f -mtime +"$RETENTION_DAYS" -delete
WAL_COUNT=$(find "$WAL_DIR" -type f | wc -l | tr -d ' ')
echo "[$(date)] Cleanup complete. ${WAL_COUNT} WAL segment(s) retained, last ${RETENTION_DAYS} days."

df -h "$BACKUP_DIR" | tail -1 | sed "s/^/[$(date)] Backup volume: /"

exit 0
