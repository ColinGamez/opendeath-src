#!/usr/bin/env bash
# Deploy the OpenDeath site and counter to /var/www/open.death.cl.
# Run on the server as root: bash /root/remote-deploy.sh
set -euo pipefail

SITE=/var/www/open.death.cl
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
LOG=/var/log/nginx/opendeath-downloads.log

echo "== deploy $STAMP"
mkdir -p "$SITE/downloads"

# Keep one copy of the previous site pages and assets (not the binaries).
tar -czf "/root/opendeath-site-backup-$STAMP.tar.gz" \
  -C "$SITE" --exclude=downloads --exclude=downloads.json . || true

# New site files.
tar -xzf /root/site.tar.gz -C "$SITE"

# Staged release files.
for f in OpenDeath-Setup-1.0.2.exe OpenDeath-Portable-1.0.2.exe SHA256SUMS.txt; do
  if [ -f "/root/$f" ]; then
    install -m 644 -o www-data -g www-data "/root/$f" "$SITE/downloads/$f"
    echo "installed $f"
  fi
done

# Ownership and permissions: pages readable, no group/world write.
chown -R www-data:www-data "$SITE"
find "$SITE" -path "$SITE/downloads" -prune -o -type d -exec chmod 755 {} +
find "$SITE" -path "$SITE/downloads" -prune -o -type f -exec chmod 644 {} +
chmod 755 "$SITE/downloads"
find "$SITE/downloads" -type f -exec chmod 644 {} +

# Counter script and schedule. Replace the previously corrupted cron file.
install -m 755 /root/opendeath-downloads /usr/local/bin/opendeath-downloads
install -m 644 /root/opendeath-downloads.cron /etc/cron.d/opendeath-downloads

# Start the public count at 312 plus this log: archive the old test log, then recount. The state file keeps the
# published number monotonic, so rotating or truncating this log can never make it go backwards.
if [ -s "$LOG" ]; then
  mv "$LOG" "$LOG.pre-launch-$STAMP"
  echo "archived previous download log"
fi
: > "$LOG"
chown www-data:www-data "$LOG"
chmod 644 "$LOG"

/usr/local/bin/opendeath-downloads

echo "== downloads.json"
cat "$SITE/downloads.json"
echo
echo "== release files"
ls -l "$SITE/downloads"
echo "== hashes"
sha256sum "$SITE/downloads/"*.exe
echo "== nginx test"
nginx -t
systemctl reload nginx
echo "== deployed"
