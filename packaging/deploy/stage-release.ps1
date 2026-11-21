param(
  [Parameter(Mandatory = $true)][string]$Setup,
  [Parameter(Mandatory = $true)][string]$Portable,
  [string]$Version = "1.0.5",
  [string]$Previous = "1.0.4",
  [string]$Base = "C:\Users\Kylem\Documents\Qoder\2026-11-17\02a21507"
)

$ErrorActionPreference = "Stop"

$release = Join-Path $Base "release"
$site = Join-Path $Base "website"
$utf8 = New-Object System.Text.UTF8Encoding($false)

# ---- release artifacts ----
New-Item -ItemType Directory -Force -Path $release | Out-Null

$setupName = "OpenDeath-Setup-$Version.exe"
$portableName = "OpenDeath-Portable-$Version.exe"

if ((Resolve-Path $Setup).Path -ne (Join-Path $release $setupName)) {
  Copy-Item $Setup (Join-Path $release $setupName) -Force
}
if ((Resolve-Path $Portable).Path -ne (Join-Path $release $portableName)) {
  Copy-Item $Portable (Join-Path $release $portableName) -Force
}

# Linux files are built in GitHub Actions; stage the one file this machine owns.
$installScript = Join-Path $Base "packaging\linux\install.sh"
if (Test-Path $installScript) { Copy-Item $installScript (Join-Path $release "install.sh") -Force }

$setupInfo = Get-Item (Join-Path $release $setupName)
$portableInfo = Get-Item (Join-Path $release $portableName)
$setupHash = (Get-FileHash $setupInfo.FullName -Algorithm SHA256).Hash
$portableHash = (Get-FileHash $portableInfo.FullName -Algorithm SHA256).Hash

$sums = "$setupHash  $setupName`r`n$portableHash  $portableName`r`n"
[System.IO.File]::WriteAllText((Join-Path $release "SHA256SUMS.txt"), $sums, $utf8)

# Linux files arrive from the GitHub Actions run. When they have been copied into release/, refresh their sums too.
$linuxFiles = @(
  (Join-Path $release "OpenDeath-$Version-x86_64.AppImage"),
  (Join-Path $release "OpenDeath-$Version-amd64.deb"),
  (Join-Path $release "OpenDeath-$Version-x86_64.rpm"),
  (Join-Path $release "opendeath-cli-$Version-linux-x64.tar.gz"),
  (Join-Path $release "install.sh")
) | Where-Object { Test-Path $_ }
if ($linuxFiles.Count -gt 0) {
  $linuxSums = ($linuxFiles | ForEach-Object {
    "$((Get-FileHash $_ -Algorithm SHA256).Hash.ToLower())  $(Split-Path $_ -Leaf)"
  }) -join "`n"
  [System.IO.File]::WriteAllText((Join-Path $release "SHA256SUMS-linux.txt"), $linuxSums + "`n", $utf8)
}

# ---- numbers for the pages ----
function Mb([long]$bytes) { [string][Math]::Round($bytes / 1e6, 0) }
$setupMb = Mb $setupInfo.Length
$portableMb = Mb $portableInfo.Length
$setupBytes = $setupInfo.Length.ToString("N0", [System.Globalization.CultureInfo]::InvariantCulture)
$portableBytes = $portableInfo.Length.ToString("N0", [System.Globalization.CultureInfo]::InvariantCulture)

# ---- pages ----
$pages = Get-ChildItem $site -Filter "*.html" -File
foreach ($page in $pages) {
  $text = [System.IO.File]::ReadAllText($page.FullName)
  $text = $text.TrimStart([char]0xFEFF)
  $before = $text

  $text = $text.Replace($Previous, $Version)

  # Sizes move with the binaries; only touch the values that describe the setup and portable.
  $text = [regex]::Replace($text, "(Download setup\s*[\u00B7\u2014\u2013-]\s*)\d+ MB", "`${1}$setupMb MB")
  $text = [regex]::Replace($text, "(Portable\s*[\u00B7\u2014\u2013-]\s*)\d+ MB", "`${1}$portableMb MB")
  $text = [regex]::Replace(
    $text,
    "(<span>OpenDeath-Setup-$([regex]::Escape($Version))\.exe</span>\s*<span>)\d+ MB(</span>)",
    "`${1}$setupMb MB`${2}"
  )
  $text = [regex]::Replace(
    $text,
    "(<span>OpenDeath-Portable-$([regex]::Escape($Version))\.exe</span>\s*<span>)\d+ MB(</span>)",
    "`${1}$portableMb MB`${2}"
  )
  $text = $text.Replace("231,954,463 bytes", "$setupBytes bytes")
  $text = $text.Replace("228,814,087 bytes", "$portableBytes bytes")
  $text = $text.Replace("231,919,411 bytes", "$setupBytes bytes")
  $text = $text.Replace("228,818,428 bytes", "$portableBytes bytes")
  $text = $text.Replace("231,907,309 bytes", "$setupBytes bytes")
  $text = $text.Replace("228,822,913 bytes", "$portableBytes bytes")
  $text = $text.Replace("219,012,517 bytes", "$setupBytes bytes")
  $text = $text.Replace("216,529,842 bytes", "$portableBytes bytes")

  # Linux rows follow the artifacts once they are copied into release/.
  foreach ($name in @(
    "OpenDeath-$Version-x86_64.AppImage",
    "OpenDeath-$Version-amd64.deb",
    "OpenDeath-$Version-x86_64.rpm",
    "opendeath-cli-$Version-linux-x64.tar.gz"
  )) {
    $file = Join-Path $release $name
    if (-not (Test-Path $file)) { continue }
    $bytes = (Get-Item $file).Length.ToString("N0", [System.Globalization.CultureInfo]::InvariantCulture)
    $text = [regex]::Replace(
      $text,
      "(<b>$([regex]::Escape($name))</b></td><td>)[\d,]+ bytes",
      "`${1}$bytes bytes"
    )
  }

  if ($text -ne $before) {
    [System.IO.File]::WriteAllText($page.FullName, $text, $utf8)
    "updated $($page.Name)"
  }
}

# ---- report ----
$left = (Select-String -Path (Join-Path $site "*.html") -Pattern $Previous -SimpleMatch -ErrorAction SilentlyContinue | Measure-Object).Count

[PSCustomObject]@{
  Version    = $Version
  Setup      = $setupName
  SetupBytes = $setupBytes
  SetupMB    = $setupMb
  SetupSHA   = $setupHash
  Portable   = $portableName
  PortBytes  = $portableBytes
  PortMB     = $portableMb
  PortSHA    = $portableHash
  OldRefs    = $left
} | Format-List
