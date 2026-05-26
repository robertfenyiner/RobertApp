#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/RobertApp}"
DB_PATH="${DB_PATH:-$APP_DIR/backend/data/robertapp.db}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/robertapp}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

if [ ! -f "$DB_PATH" ]; then
  echo "ERROR: SQLite database not found at $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/robertapp-$TIMESTAMP.db"
COMPRESSED_FILE="$BACKUP_FILE.gz"

# Use SQLite's online backup API when sqlite3 is available. This is safer with WAL mode.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
else
  echo "WARN: sqlite3 command not found. Falling back to file copy." >&2
  cp "$DB_PATH" "$BACKUP_FILE"
fi

gzip -f "$BACKUP_FILE"
chmod 600 "$COMPRESSED_FILE"

# Remove old compressed backups.
find "$BACKUP_DIR" -type f -name 'robertapp-*.db.gz' -mtime +"$RETENTION_DAYS" -delete

echo "Backup created: $COMPRESSED_FILE"
