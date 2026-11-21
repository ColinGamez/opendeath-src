param(
  [string]$Version = "1.0.5",
  [string]$Setup,
  [string]$Base = "C:\Users\Kylem\Documents\Qoder\2026-11-17\02a21507",
  # Deliberate override for restoring a feed that pre-1.0.5 builds can read. Normal releases do not pass this.
  [switch]$PublishFeed
)

# OpenDeath 1.0.5 has no updater. This script exists only for the transition: the site keeps the
# existing 1.0.4 latest.yml so pre-1.0.5 builds do not see a new version, and no feed is generated for
# 1.0.5. Running this without -PublishFeed stops before it can create an automatic update path.
if (-not $PublishFeed) {
  throw "Auto-update is removed. Not generating latest.yml. Pass -PublishFeed only to repair the pre-1.0.5 feed."
}

# electron-updater's generic provider reads latest.yml from the folder it points at (https://open.death.cl/downloads/).
# It needs the installer's SHA-512 (base64, not hex), its size, and the version. No blockmap is published, so every
# update is a full download; electron-updater falls back to that on its own.

$ErrorActionPreference = "Stop"

$release = Join-Path $Base "release"
if (-not $Setup) { $Setup = Join-Path $release "OpenDeath-Setup-$Version.exe" }
if (-not (Test-Path $Setup)) { throw "missing installer: $Setup" }

$info = Get-Item $Setup
$sha512 = [System.Security.Cryptography.SHA512]::Create()
$stream = [System.IO.File]::OpenRead($Setup)
try {
  $hash = $sha512.ComputeHash($stream)
} finally {
  $stream.Dispose()
  $sha512.Dispose()
}

$b64 = [Convert]::ToBase64String($hash)
$name = "OpenDeath-Setup-$Version.exe"
$date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

$yml = @"
version: $Version
files:
  - url: $name
    sha512: $b64
    size: $($info.Length)
path: $name
sha512: $b64
releaseDate: '$date'
"@

$out = Join-Path $release "latest.yml"
# UTF-8 without BOM: the feed is YAML, and a BOM is not part of the document.
[System.IO.File]::WriteAllText($out, $yml, (New-Object System.Text.UTF8Encoding($false)))

[PSCustomObject]@{
  File    = $out
  Version = $Version
  Size    = $info.Length
  SHA512  = $b64
} | Format-List
