#!/usr/bin/env bash
# Keep /var/www/open.death.cl/downloads.json in sync with real downloads.
# Install at /usr/local/bin/opendeath-downloads and run from cron every minute:
#   * * * * * root /usr/local/bin/opendeath-downloads >/dev/null 2>&1
#
# The count is monotonic: a rotated access log must not make the public number go backwards. The baseline is the
# count that predates this counter, so the first run publishes 612 plus whatever the current log holds.
set -euo pipefail

LOG="/var/log/nginx/opendeath-downloads.log"
OUT="/var/www/open.death.cl/downloads.json"
STATE="/var/lib/opendeath/downloads.last"
BASELINE=612

count=0
if [[ -f "$LOG" ]]; then
  count=$(awk '$1 == "GET" && $2 ~ /^\/downloads\/(OpenDeath-[A-Za-z0-9._-]+\.(exe|AppImage|deb|rpm)|opendeath-cli-[0-9.]+-linux-[a-z0-9]+\.tar\.gz)$/ && $3 == "200" { n++ } END { print n + 0 }' "$LOG")
fi

total=$((BASELINE + count))
mkdir -p "$(dirname "$STATE")"
if [[ -f "$STATE" ]]; then
  last=$(cat "$STATE" 2>/dev/null || echo 0)
  if [[ "$last" =~ ^[0-9]+$ ]] && (( total < last )); then
    total=$last
  fi
fi
printf '%d\n' "$total" > "$STATE"

tmp="${OUT}.tmp"
printf '{"downloads":%d,"updated":"%s"}\n' "$total" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$tmp"
mv "$tmp" "$OUT"
chmod 644 "$OUT"
