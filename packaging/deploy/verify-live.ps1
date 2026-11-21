$ErrorActionPreference = 'Continue'
$log = 'C:\Users\Kylem\Documents\Qoder\2026-11-17\02a21507\analysis\verify-live.txt'
"live verify start $(Get-Date -Format o)" | Out-File $log -Encoding utf8

$pages = @(
  'https://open.death.cl/',
  'https://open.death.cl/features.html',
  'https://open.death.cl/download.html',
  'https://open.death.cl/faq.html',
  'https://open.death.cl/docs.html',
  'https://open.death.cl/downloads.json',
  'https://open.death.cl/downloads/SHA256SUMS.txt',
  'https://open.death.cl/assets/site.css',
  'https://open.death.cl/assets/site.js',
  'https://open.death.cl/downloads/OpenDeath-Setup-1.0.5.exe',
  'https://open.death.cl/downloads/OpenDeath-Portable-1.0.5.exe',
  'https://open.death.cl/downloads/install.sh',
  'https://open.death.cl/downloads/SHA256SUMS-linux.txt',
  'https://open.death.cl/downloads/OpenDeath-1.0.5-x86_64.AppImage',
  'https://open.death.cl/downloads/OpenDeath-1.0.5-amd64.deb',
  'https://open.death.cl/downloads/OpenDeath-1.0.5-x86_64.rpm',
  'https://open.death.cl/downloads/opendeath-cli-1.0.5-linux-x64.tar.gz'
)
foreach ($page in $pages) {
  $code = & curl.exe -s -o NUL -I --max-time 30 -w "%{http_code}" $page 2>&1
  "$code $page" | Out-File $log -Append -Encoding utf8
}

$pageHtml = & curl.exe -s --max-time 30 https://open.death.cl/ 2>&1 | Out-String
"home-final-cta=$($pageHtml -match 'Stop losing') ticker=$($pageHtml -match 'ticker-track') progress=$($pageHtml -match 'scroll-progress') github=$($pageHtml -match 'github')" | Out-File $log -Append -Encoding utf8

$counter = & curl.exe -s --max-time 30 https://open.death.cl/downloads.json 2>&1 | Out-String
"counter=$counter" | Out-File $log -Append -Encoding utf8
try {
  $counterJson = $counter | ConvertFrom-Json
  "counter-value=$($counterJson.downloads) counter-ok=$([int]$counterJson.downloads -ge 312)" | Out-File $log -Append -Encoding utf8
} catch {
  "counter-parse-failed" | Out-File $log -Append -Encoding utf8
}

$sums = & curl.exe -s --max-time 30 https://open.death.cl/downloads/SHA256SUMS.txt 2>&1 | Out-String
$sums | Out-File $log -Append -Encoding utf8

"live verify done $(Get-Date -Format o)" | Out-File $log -Append -Encoding utf8
