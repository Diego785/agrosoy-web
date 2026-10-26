#!/bin/sh
# Daily database backup for one environment. Run from cron in the environment's folder:
#   15 3 * * * cd /srv/agrosoy/production && ./backup.sh >> backups/backup.log 2>&1
# Keeps 30 days locally and, when RCLONE_REMOTE is set (e.g. "offsite:agrosoy"), copies each
# dump off the server, as the proposal requires.
set -eu

KEEP_DAYS=30
mkdir -p backups
file="backups/agrosoy-$(date +%Y-%m-%d).dump"

docker compose exec -T db pg_dump -U agrosoy --format=custom agrosoy > "$file"
echo "$(date -Iseconds) wrote $file ($(du -h "$file" | cut -f1))"

find backups -name 'agrosoy-*.dump' -mtime +"$KEEP_DAYS" -delete

if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$file" "$RCLONE_REMOTE/$(basename "$PWD")/"
  rclone delete --min-age "${KEEP_DAYS}d" "$RCLONE_REMOTE/$(basename "$PWD")/"
  echo "$(date -Iseconds) copied off the server to $RCLONE_REMOTE"
fi
