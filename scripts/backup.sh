#!/bin/sh
# Daily backup: database dump plus uploaded files. Run from the project folder, for example from cron.
# Needs pg_dump and DATABASE_URL in the environment (export it or source .env first).
set -e
STAMP=$(date +%Y-%m-%d)
DEST="${BACKUP_DIR:-./backups}"
mkdir -p "$DEST"
pg_dump "$DATABASE_URL" > "$DEST/db-$STAMP.sql"
tar -czf "$DEST/uploads-$STAMP.tar.gz" "${UPLOAD_DIR:-uploads}"
# keep the last 30 days
find "$DEST" -type f -mtime +30 -delete
echo "Backup written to $DEST"
