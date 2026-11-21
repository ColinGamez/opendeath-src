#!/usr/bin/env bash
# Keep /var/www/open.death.cl/downloads.json in sync with real downloads.
# Install at /usr/local/bin/opendeath-downloads and run from cron every minute:
#   * * * * * root /usr/local/bin/opendeath-downloads >/dev/null 2>&1
#
# The count is monotonic and survives log rotation. The state file stores the last published total and the
# last access-log count. New entries are added as a delta, so truncating or rotating the log can never make the
# public number go backwards. The baseline is the count that predates this counter.
set -euo pipefail

LOG="${OPEND_DOWNLOAD_LOG:-/var/log/nginx/opendeath-downloads.log}"
OUT="${OPEND_DOWNLOAD_JSON:-/var/www/open.death.cl/downloads.json}"
STATE="${OPEND_DOWNLOAD_STATE:-/var/lib/opendeath/downloads.last}"
BASELINE=312

count=0
if [[ -f "$LOG" ]]; then
  count=$(awk '$1 == "GET" && $2 ~ /^\/downloads\/(OpenDeath-[A-Za-z0-9._-]+\.(exe|AppImage|deb|rpm)|opendeath-cli-[0-9.]+-linux-[a-z0-9]+\.tar\.gz)$/ && $3 == "200" { n++ } END { print n + 0 }' "$LOG")
fi

# The live file is a second floor. If the state file is lost, a new visitor must still not see the count go back.
published=0
if [[ -f "$OUT" ]]; then
  published=$(sed -n 's/.*"downloads":\([0-9][0-9]*\).*/\1/p' "$OUT" | head -n1)
fi
case "$published" in ''|*[!0-9]*) published=0 ;; esac

last_total=0
last_count=0
mkdir -p "$(dirname "$STATE")"
if [[ -f "$STATE" ]]; then
  read -r last_total last_count < "$STATE" || true
fi
case "$last_total" in ''|*[!0-9]*) last_total=0 ;; esac
case "$last_count" in ''|*[!0-9]*) last_count=0 ;; esac

if [[ "${OPEND_COUNTER_RESET:-0}" == "1" ]]; then
  # A deliberate reset publishes the baseline exactly once. Any entry already in the log is folded
  # into last_count below, so the next cron run only adds downloads that happen after the reset.
  total=$BASELINE
elif (( last_total == 0 )); then
  # First run after a fresh install.
  total=$((BASELINE + count))
else
  if (( count >= last_count )); then
    total=$((last_total + count - last_count))
  else
    # The log was rotated or truncated; every current entry is new.
    total=$((last_total + count))
  fi
fi

# Hard floors: the baseline and whatever number is already public. Neither can ever be crossed downwards.
# OPEND_COUNTER_FORCE_LOWER=1 is only for a deliberate, one-time correction of the published number.
if (( total < BASELINE )); then total=$BASELINE; fi
if [[ "${OPEND_COUNTER_FORCE_LOWER:-0}" != "1" ]] && (( total < published )); then total=$published; fi

printf '%d %d\n' "$total" "$count" > "$STATE"

tmp="${OUT}.tmp"
printf '{"downloads":%d,"updated":"%s"}\n' "$total" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$tmp"
mv "$tmp" "$OUT"
chmod 644 "$OUT"
