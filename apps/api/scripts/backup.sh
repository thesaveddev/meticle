#!/bin/sh
# Automated PostgreSQL backup script
# Runs pg_dump and retains backups for 30 days

set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-meticle}"
DB_USER="${DB_USER:-meticle}"
DB_PASSWORD="${DB_PASSWORD}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

export PGPASSWORD="$DB_PASSWORD"

DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="$BACKUP_DIR/meticle_$DATE.sql.gz"

echo "[$(date)] Starting backup: $FILENAME"

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --clean --if-exists --no-owner --no-privileges \
  | gzip > "$FILENAME"

echo "[$(date)] Backup complete: $(du -h "$FILENAME" | cut -f1)"

# Remove backups older than retention period
find "$BACKUP_DIR" -name "meticle_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Cleanup complete. Retaining backups from last $RETENTION_DAYS days."
