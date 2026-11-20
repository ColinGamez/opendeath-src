param(
  [Parameter(Mandatory = $true)][string]$Setup,
  [Parameter(Mandatory = $true)][string]$Portable,
  [string]$Version = "1.0.3",
  [string]$Previous = "1.0.2",
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

Copy-Item $Setup (Join-Path $release $setupName) -Force -ErrorAction SilentlyContinue
Copy-Item $Portable (Join-Path $release $portableName) -Force -ErrorAction SilentlyContinue

$setupInfo = Get-Item (Join-Path $release $setupName)
$portableInfo = Get-Item (Join-Path $release $portableName)
$setupHash = (Get-FileHash $setupInfo.FullName -Algorithm SHA256).Hash
$portableHash = (Get-FileHash $portableInfo.FullName -Algorithm SHA256).Hash

$sums = "$setupHash  $setupName`r`n$portableHash  $portableName`r`n"
[System.IO.File]::WriteAllText((Join-Path $release "SHA256SUMS.txt"), $sums, $utf8)

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
  $dash = [string][char]0x2014
  $text = $text.Replace("Download setup $dash 232 MB", "Download setup $dash $setupMb MB")
  $text = $text.Replace("Portable $dash 229 MB", "Portable $dash $portableMb MB")
  $text = $text.Replace("<strong>232 MB</strong> setup", "<strong>$setupMb MB</strong> setup")
  $text = $text.Replace(">232 MB<", ">$setupMb MB<")
  $text = $text.Replace(">229 MB<", ">$portableMb MB<")
  $text = $text.Replace("231,954,463 bytes", "$setupBytes bytes")
  $text = $text.Replace("228,814,087 bytes", "$portableBytes bytes")
  $text = $text.Replace("231,919,411 bytes", "$setupBytes bytes")
  $text = $text.Replace("228,818,428 bytes", "$portableBytes bytes")
  $text = $text.Replace("231,907,309 bytes", "$setupBytes bytes")
  $text = $text.Replace("228,822,913 bytes", "$portableBytes bytes")

  # The byte row follows the artifacts, whatever the previous number was.
  $text = [regex]::Replace(
    $text,
    "(<b>OpenDeath-Setup-$([regex]::Escape($Version))\.exe</b></td><td>)[\d,]+ bytes",
    "`${1}$setupBytes bytes"
  )
  $text = [regex]::Replace(
    $text,
    "(<b>OpenDeath-Portable-$([regex]::Escape($Version))\.exe</b></td><td>)[\d,]+ bytes",
    "`${1}$portableBytes bytes"
  )

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
