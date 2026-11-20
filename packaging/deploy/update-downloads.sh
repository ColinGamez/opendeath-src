#!/usr/bin/env bash
# Keep /var/www/open.death.cl/downloads.json in sync with real downloads.
# Install at /usr/local/bin/opendeath-downloads and run from cron every minute:
#   * * * * * root /usr/local/bin/opendeath-downloads >/dev/null 2>&1
set -euo pipefail

LOG="/var/log/nginx/opendeath-downloads.log"
OUT="/var/www/open.death.cl/downloads.json"
BASELINE=59

count=0
if [[ -f "$LOG" ]]; then
  count=$(awk '$1 == "GET" && $2 ~ /^\/downloads\/OpenDeath-(Setup|Portable)-[0-9]+\.[0-9]+\.[0-9]+\.exe$/ && $3 == "200" { n++ } END { print n + 0 }' "$LOG")
fi

total=$((BASELINE + count))
tmp="${OUT}.tmp"
printf '{"downloads":%d,"updated":"%s"}\n' "$total" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$tmp"
mv "$tmp" "$OUT"
chmod 644 "$OUT"
