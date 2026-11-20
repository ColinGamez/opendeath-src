param(
  [string]$Site = "C:\Users\Kylem\Documents\Qoder\2026-11-17\02a21507\website"
)

$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding($false)

# Pages keep their .html filenames on disk. Links, canonicals and the address bar do not.
$pages = @("features", "download", "docs", "faq")

$files = Get-ChildItem $Site -Filter "*.html" -File
foreach ($file in $files) {
  $text = [System.IO.File]::ReadAllText($file.FullName)
  $text = $text.TrimStart([char]0xFEFF)
  $before = $text

  # Site-absolute links first, so the relative pass cannot double-handle them.
  $text = $text.Replace("https://open.death.cl/index.html", "https://open.death.cl/")
  foreach ($page in $pages) {
    $text = $text.Replace("https://open.death.cl/$page.html", "https://open.death.cl/$page")
    $text = $text.Replace("href=`"$page.html", "href=`"$page")
  }

  # Home points at the root, not /index.
  $text = $text.Replace('href="index.html"', 'href="/"')
  $text = $text.Replace('href="./index.html"', 'href="/"')

  # 404 keeps a stable path without the extension.
  $text = $text.Replace("https://open.death.cl/404.html", "https://open.death.cl/404")
  $text = $text.Replace('href="404.html"', 'href="/404"')

  if ($text -ne $before) {
    [System.IO.File]::WriteAllText($file.FullName, $text, $utf8)
    "updated $($file.Name)"
  }
}

# sitemap and robots
$sitemap = Join-Path $Site "sitemap.xml"
$text = [System.IO.File]::ReadAllText($sitemap).TrimStart([char]0xFEFF)
foreach ($page in $pages) { $text = $text.Replace("https://open.death.cl/$page.html", "https://open.death.cl/$page") }
[System.IO.File]::WriteAllText($sitemap, $text, $utf8)

$robots = Join-Path $Site "robots.txt"
$text = [System.IO.File]::ReadAllText($robots).TrimStart([char]0xFEFF)
$text = $text.Replace("Disallow: /404.html", "Disallow: /404")
[System.IO.File]::WriteAllText($robots, $text, $utf8)

# report
$left = Select-String -Path (Join-Path $Site "*.html"), $sitemap -Pattern 'href="[^"]*\.html' -ErrorAction SilentlyContinue
if ($left) { "leftover .html hrefs:"; $left | ForEach-Object { "  $($_.Filename):$($_.LineNumber): $($_.Line.Trim())" } }
else { "no .html hrefs left" }
