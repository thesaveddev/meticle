#!/bin/sh
# Automated PostgreSQL backup script
# Runs pg_dump and retains backups for 30 days

set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-meticle}"
DB_USER="${DB_USER:-meticle}"
DB_PASSWORD="${DB_PASSWORD:-}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

if [ -z "$DB_PASSWORD" ]; then
  echo "[$(date)] ERROR: DB_PASSWORD is not configured" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
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

# Remove backups older than retention period
find "$BACKUP_DIR" -name "meticle_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

echo "[$(date)] Cleanup complete. Retaining backups from last $RETENTION_DAYS days."
