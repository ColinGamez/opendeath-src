$ErrorActionPreference = 'Continue'
$log = 'C:\Users\Kylem\Documents\Qoder\2026-11-17\02a21507\analysis\verify.txt'
"verify start $(Get-Date -Format o)" | Out-File $log -Encoding utf8

$env:SSH_ASKPASS = 'C:\Users\Kylem\AppData\Local\Temp\opencode\ssh-deploy\askpass.exe'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'localhost:0'

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
  'https://open.death.cl/downloads/OpenDeath-Setup-1.0.0.exe',
  'https://open.death.cl/downloads/OpenDeath-Portable-1.0.0.exe'
)
foreach ($page in $pages) {
  $code = & curl.exe -s -o NUL -I --max-time 30 -w "%{http_code}" $page 2>&1
  "$code $page" | Out-File $log -Append -Encoding utf8
}

$pageHtml = & curl.exe -s --max-time 30 https://open.death.cl/ 2>&1 | Out-String
"home-final-cta=$($pageHtml -match 'Stop losing') ticker=$($pageHtml -match 'ticker-track') progress=$($pageHtml -match 'scroll-progress') github=$($pageHtml -match 'github')" | Out-File $log -Append -Encoding utf8

$counter = & curl.exe -s --max-time 30 https://open.death.cl/downloads.json 2>&1 | Out-String
"counter=$counter" | Out-File $log -Append -Encoding utf8

$remote = @'
echo REMOTE-JSON
cat /var/www/open.death.cl/downloads.json
echo REMOTE-HASHES
sha256sum /var/www/open.death.cl/downloads/OpenDeath-Setup-1.0.0.exe /var/www/open.death.cl/downloads/OpenDeath-Portable-1.0.0.exe
echo COUNTER-TEST
printf 'GET /downloads/OpenDeath-Setup-1.0.0.exe 200\n' >> /var/log/nginx/opendeath-downloads.log
/usr/local/bin/opendeath-downloads
cat /var/www/open.death.cl/downloads.json
sed -i '$ d' /var/log/nginx/opendeath-downloads.log
/usr/local/bin/opendeath-downloads
cat /var/www/open.death.cl/downloads.json
echo CRON
cat /etc/cron.d/opendeath-downloads
echo REMOTE-DONE
'@
$remoteOut = & ssh -o StrictHostKeyChecking=accept-new root@YOUR_SERVER_IP $remote 2>&1 | Out-String
"ssh-exit=$LASTEXITCODE" | Out-File $log -Append -Encoding utf8
$remoteOut | Out-File $log -Append -Encoding utf8

"verify done $(Get-Date -Format o)" | Out-File $log -Append -Encoding utf8
