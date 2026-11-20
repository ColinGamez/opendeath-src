$ErrorActionPreference = 'Continue'
$base = 'C:\Users\Kylem\Documents\Qoder\2026-11-17\02a21507'
$stage = 'C:\Users\Kylem\AppData\Local\Temp\opencode\deploy'
$log = "$base\analysis\deploy.txt"
"start $(Get-Date -Format o)" | Out-File $log -Encoding utf8

# SSH must already be authenticated for root@YOUR_SERVER_IP (key or agent).
# Never store the password here; pass it through the environment if askpass is used.
$env:SSH_ASKPASS = 'C:\Users\Kylem\AppData\Local\Temp\opencode\ssh-deploy\askpass.exe'
$env:SSH_ASKPASS_REQUIRE = 'force'
$env:DISPLAY = 'localhost:0'

function Step([string]$name, [scriptblock]$body) {
  "== $name $(Get-Date -Format HH:mm:ss)" | Out-File $log -Append -Encoding utf8
  $output = & $body 2>&1 | Out-String
  "exit=$LASTEXITCODE" | Out-File $log -Append -Encoding utf8
  $output | Out-File $log -Append -Encoding utf8
}

# Local artifacts and hashes.
$setup = "$base\release\OpenDeath-Setup-1.0.0.exe"
$portable = "$base\release\OpenDeath-Portable-1.0.0.exe"
$sums = "$base\release\SHA256SUMS.txt"
"setup=$((Get-Item $setup).Length) $((Get-FileHash $setup -Algorithm SHA256).Hash)" | Out-File $log -Append -Encoding utf8
"portable=$((Get-Item $portable).Length) $((Get-FileHash $portable -Algorithm SHA256).Hash)" | Out-File $log -Append -Encoding utf8

# Build a site archive with the current pages and assets, excluding downloads.
$siteTar = "$stage\site.tar.gz"
Remove-Item $siteTar -ErrorAction SilentlyContinue
Step 'tar' {
  & tar -czf $siteTar -C "$base\website" index.html 404.html docs.html download.html faq.html features.html robots.txt sitemap.xml favicon.ico assets
}
Step 'tar-list' { & tar -tzf $siteTar }
"site-tar=$((Get-Item $siteTar).Length)" | Out-File $log -Append -Encoding utf8

Step 'scp-site' {
  & scp -o StrictHostKeyChecking=accept-new $siteTar root@YOUR_SERVER_IP:/root/site.tar.gz
}
Step 'scp-setup' {
  & scp -o StrictHostKeyChecking=accept-new $setup root@YOUR_SERVER_IP:/root/OpenDeath-Setup-1.0.0.exe
}
Step 'scp-sums' {
  & scp -o StrictHostKeyChecking=accept-new $sums root@YOUR_SERVER_IP:/root/SHA256SUMS.txt
}
Step 'scp-counter' {
  & scp -o StrictHostKeyChecking=accept-new "$base\deploy\update-downloads.sh" root@YOUR_SERVER_IP:/root/opendeath-downloads
}
Step 'scp-cron' {
  & scp -o StrictHostKeyChecking=accept-new "$base\deploy\opendeath-downloads.cron" root@YOUR_SERVER_IP:/root/opendeath-downloads.cron
}
Step 'scp-deploy' {
  & scp -o StrictHostKeyChecking=accept-new "$base\deploy\remote-deploy.sh" root@YOUR_SERVER_IP:/root/remote-deploy.sh
}

Step 'remote-deploy' {
  & ssh -o StrictHostKeyChecking=accept-new root@YOUR_SERVER_IP "bash /root/remote-deploy.sh"
}

"done $(Get-Date -Format o)" | Out-File $log -Append -Encoding utf8
