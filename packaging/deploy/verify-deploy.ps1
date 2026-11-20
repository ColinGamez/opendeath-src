$ErrorActionPreference = 'Continue'
$base = 'C:\Users\Kylem\Documents\Qoder\2026-11-17\02a21507'
$log = "$base\analysis\verify-deploy.txt"
"verify start $(Get-Date -Format o)" | Out-File $log -Encoding utf8

# SSH must already be authenticated for root@YOUR_SERVER_IP (key or agent).
# Never store the password here; pass it through the environment if askpass is used.
$env:SSH_ASKPASS = 'C:\Users\Kylem\AppData\Local\Temp\opencode\ssh-deploy\askpass.exe'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'localhost:0'

function Log($message) { $message | Out-File $log -Append -Encoding utf8 }

$sshCmd = @'
echo ==COUNT
cat /var/www/open.death.cl/downloads.json
echo ==FILES
ls -l /var/www/open.death.cl/downloads
echo ==SUMS
sha256sum /var/www/open.death.cl/downloads/OpenDeath-Setup-1.0.0.exe /var/www/open.death.cl/downloads/OpenDeath-Portable-1.0.0.exe
echo ==CRON
cat /etc/cron.d/opendeath-downloads
echo ==COUNTER-BIN
ls -l /usr/local/bin/opendeath-downloads
echo ==COUNTER-TEST
printf 'GET /downloads/OpenDeath-Setup-1.0.0.exe 200\n' >> /var/log/nginx/opendeath-downloads.log
/usr/local/bin/opendeath-downloads
cat /var/www/open.death.cl/downloads.json
sed -i '$ d' /var/log/nginx/opendeath-downloads.log
/usr/local/bin/opendeath-downloads
cat /var/www/open.death.cl/downloads.json
echo ==LOG
cat /var/log/nginx/opendeath-downloads.log
echo ==DONE
'@
$remote = & ssh -o StrictHostKeyChecking=accept-new root@YOUR_SERVER_IP $sshCmd 2>&1 | Out-String
Log "ssh-exit=$LASTEXITCODE"
Log $remote

$checks = @(
  @{ name = 'home'; url = 'https://open.death.cl/'; code = 200 },
  @{ name = 'features'; url = 'https://open.death.cl/features.html'; code = 200 },
  @{ name = 'download'; url = 'https://open.death.cl/download.html'; code = 200 },
  @{ name = 'faq'; url = 'https://open.death.cl/faq.html'; code = 200 },
  @{ name = 'docs'; url = 'https://open.death.cl/docs.html'; code = 200 },
  @{ name = '404'; url = 'https://open.death.cl/does-not-exist'; code = 404 },
  @{ name = 'counter'; url = 'https://open.death.cl/downloads.json'; code = 200 },
  @{ name = 'sums'; url = 'https://open.death.cl/downloads/SHA256SUMS.txt'; code = 200 },
  @{ name = 'setup-head'; url = 'https://open.death.cl/downloads/OpenDeath-Setup-1.0.0.exe'; code = 200 },
  @{ name = 'portable-head'; url = 'https://open.death.cl/downloads/OpenDeath-Portable-1.0.0.exe'; code = 200 }
)
foreach ($check in $checks) {
  $code = & curl.exe -s -o NUL -w "%{http_code}" -I --max-time 30 $check.url 2>&1
  Log "http $($check.name)=$code expected=$($check.code)"
}

$pageHtml = & curl.exe -s --max-time 30 https://open.death.cl/ 2>&1 | Out-String
Log "home-has-final-cta=$($pageHtml -match 'Stop losing')"
Log "home-has-ticker=$($pageHtml -match 'ticker-track')"
Log "home-has-progress=$($pageHtml -match 'scroll-progress')"
Log "home-has-github=$($pageHtml -match 'github')"
$css = & curl.exe -s --max-time 30 https://open.death.cl/assets/site.css 2>&1 | Out-String
Log "css-has-grid=$($css -match 'grid-drift') css-has-reveal=$($css -match 'reveal-up')"
$js = & curl.exe -s --max-time 30 https://open.death.cl/assets/site.js 2>&1 | Out-String
Log "js-has-counter=$($js -match 'downloads.json') js-has-observer=$($js -match 'IntersectionObserver')"
$sumsRemote = & curl.exe -s --max-time 30 https://open.death.cl/downloads/SHA256SUMS.txt 2>&1 | Out-String
Log $sumsRemote

"verify done $(Get-Date -Format o)" | Out-File $log -Append -Encoding utf8
