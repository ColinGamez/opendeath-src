# Deploy open.death.cl

Target: `YOUR_SERVER_IP` (Ubuntu, OpenSSH 9.6). DNS for `open.death.cl` already points there.

The site is static. Release files are served from `/downloads/`, and the download counter is a small nginx-log cron job, so nothing depends on GitHub.

## 1. Files to upload

From this project:

- `website/` â†’ `/var/www/open.death.cl/`
- `release/OpenDeath-Setup-1.0.2.exe` â†’ `/var/www/open.death.cl/downloads/`
- `release/OpenDeath-Portable-1.0.2.exe` â†’ `/var/www/open.death.cl/downloads/`
- `release/SHA256SUMS.txt` â†’ `/var/www/open.death.cl/downloads/`
- `deploy/nginx.conf` â†’ `/etc/nginx/sites-available/open.death.cl`
- `deploy/update-downloads.sh` â†’ `/usr/local/bin/opendeath-downloads`

## 2. First-time server setup

Run as root (or with sudo):

```bash
apt update
apt install -y nginx certbot python3-certbot-nginx rsync

mkdir -p /var/www/open.death.cl/downloads
mkdir -p /var/log/nginx

# Site files
rsync -avz --delete --exclude downloads/ \
  ./website/ root@YOUR_SERVER_IP:/var/www/open.death.cl/

# Release files
rsync -avz ./release/OpenDeath-Setup-1.0.2.exe \
  ./release/OpenDeath-Portable-1.0.2.exe \
  ./release/SHA256SUMS.txt \
  root@YOUR_SERVER_IP:/var/www/open.death.cl/downloads/

# Counter script
scp ./deploy/update-downloads.sh root@YOUR_SERVER_IP:/usr/local/bin/opendeath-downloads
ssh root@YOUR_SERVER_IP 'chmod 755 /usr/local/bin/opendeath-downloads'
```

## 3. Nginx

```bash
scp ./deploy/nginx.conf root@YOUR_SERVER_IP:/etc/nginx/sites-available/open.death.cl
ssh root@YOUR_SERVER_IP '
  ln -sf /etc/nginx/sites-available/open.death.cl /etc/nginx/sites-enabled/open.death.cl
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
'
```

If the TLS certificate does not exist yet, nginx will refuse to start. Issue it first:

```bash
ssh root@YOUR_SERVER_IP 'certbot --nginx -d open.death.cl --non-interactive --agree-tos -m support@open.death.cl --redirect'
```

Certbot writes the certificate paths already referenced by `nginx.conf`. After it finishes:

```bash
ssh root@YOUR_SERVER_IP 'nginx -t && systemctl reload nginx'
```

## 4. Download counter

The counter starts at 59 and adds every full `200` response for a release file:

```bash
ssh root@YOUR_SERVER_IP '
  mkdir -p /var/www/open.death.cl
  printf "%s\n" "{\"downloads\":59,\"updated\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
    > /var/www/open.death.cl/downloads.json
  chmod 644 /var/www/open.death.cl/downloads.json

  /usr/local/bin/opendeath-downloads

  cat > /etc/cron.d/opendeath-downloads <<"CRON"
* * * * * root /usr/local/bin/opendeath-downloads >/dev/null 2>&1
CRON
  chmod 644 /etc/cron.d/opendeath-downloads
'
```

Do not rotate `/var/log/nginx/opendeath-downloads.log` without keeping the old lines; the counter reads that file. At one log line per download it stays small for a long time.

## 5. Verify

```bash
curl -I https://open.death.cl/
curl -s https://open.death.cl/downloads.json
curl -I https://open.death.cl/downloads/OpenDeath-Setup-1.0.2.exe
curl -s https://open.death.cl/downloads/SHA256SUMS.txt
```

Expected:

- `/` returns `200` and the page loads.
- `/downloads.json` returns JSON with `"downloads": 59` (or higher after downloads).
- The setup URL returns `200` with `content-type: application/octet-stream`.
- `SHA256SUMS.txt` matches the uploaded binaries.

Then download the setup once and confirm the counter increments within a minute:

```bash
curl -L -o /tmp/OpenDeath-Setup.exe https://open.death.cl/downloads/OpenDeath-Setup-1.0.2.exe
sleep 65
curl -s https://open.death.cl/downloads.json
```

## 6. Re-deploying the site

```bash
rsync -avz --delete --exclude downloads/ ./website/ root@YOUR_SERVER_IP:/var/www/open.death.cl/
ssh root@YOUR_SERVER_IP 'chown -R www-data:www-data /var/www/open.death.cl && nginx -t && systemctl reload nginx'
```

Do not use `--delete` on the `downloads/` directory; the release binaries and counter live there.

When you change `site.css` or `site.js`, bump the `?v=` query on every page (currently
`?v=3`). `/assets/` is cached for seven days, so the version is what makes existing visitors
pick up the new styles instead of the previous cached copy.

## 7. Rollback

Keep the previous `downloads.json` and site files. To roll back:

```bash
ssh root@YOUR_SERVER_IP '
  mv /var/www/open.death.cl /var/www/open.death.cl.bad-$(date +%Y%m%d)
  cp -a /var/www/open.death.cl.bak-20261118 /var/www/open.death.cl
  nginx -t && systemctl reload nginx
'
```

## Notes

- The server accepts `publickey,password` on port 22. No key or password is stored in this project. Rotate the deployment password and use your own SSH credentials.
- Ports 80 and 443 are open and serving; the live site answers over HTTPS with a Let's Encrypt certificate valid to 2027-02-16. If it stops loading, check `systemctl status nginx`, `ufw status`, and the provider firewall.
- `open.death.cl` resolves to `YOUR_SERVER_IP`; `death.cl` itself points elsewhere (registrar parking). Only the `open` subdomain is configured here.

## 8. Deployment record (2026-11-18)

The final site and releases were deployed at 21:38â€“21:39 (UTC+8):

- Previous site archived on the server as `/var/www/open.death.cl.bak-20261118`.
- `/var/www/open.death.cl` is owned by `www-data`, directories `755`, files `644`.
- Remote SHA-256 values match `release/SHA256SUMS.txt`:
  - setup `0CF998D9F14209E32DC2B57348588E1DA0A0B6A12C4E75B737C452E607E87193`
  - portable `D6047F9A0D5016999D9CB2CE03CDB4F2AB44AC28CDBE22A39D0ADB2BEC0EF4DD`
- `/usr/local/bin/opendeath-downloads` and `/etc/cron.d/opendeath-downloads` are installed; the
  cron file contains exactly `* * * * * root /usr/local/bin/opendeath-downloads >/dev/null 2>&1`.
- The pre-launch download log was set aside and a fresh log started, so `downloads.json` begins
  at `59`. A synthetic counted request verified `59 â†’ 60`, then the line was removed and the
  count returned to `59`.
- Public checks: all pages, assets, `downloads.json`, `SHA256SUMS.txt`, and both `.exe` URLs
  return `200` over HTTPS.

## 9. Deployment record (2026-11-19, 1.0.1)

Version 1.0.1 adds the **Jailbreak** button to the top deck. It sends the bundled OPEN.DEATH
guide as one prompt into the active chat.

- Pages updated from `1.0.0` to `1.0.1`; no `1.0.0` references remain.
- Uploaded with `deploy/deploy.py` (SFTP), site files excluding `downloads/` and the live
  `downloads.json` counter.
- New binaries on the server:
  - `OpenDeath-Setup-1.0.2.exe` â€” 231,919,411 bytes,
    SHA-256 `CA19E2799B5103911DDE08B174654558E0C2EB3A22F48AB5106A3EA6ED91ABD0`
  - `OpenDeath-Portable-1.0.2.exe` â€” 228,818,428 bytes,
    SHA-256 `715EE653D796A85708BBB796583D69136C24E7A4B320985EF407FC53C9B93038`
- Remote `sha256sum` matches `release/SHA256SUMS.txt`.
- The 1.0.0 binaries remain in `/downloads/` but the site links only to 1.0.1.
- `nginx -t` passed and nginx was reloaded; `/`, both `.exe` URLs, `SHA256SUMS.txt`, and
  `downloads.json` all verified `200` over HTTPS.

## 10. Deployment record (2026-11-19, 1.0.2)

Version 1.0.2 replaces the **Jailbreak** button with an **Auto-rotate-style checkbox**. While
ticked, every prompt goes through a hidden `od` agent whose system prompt is the OPEN.DEATH
house guide, so the guide is never admitted as a chat message and a new chat works on its first
prompt without a "hi" first.

- The desktop main process writes `~/.config/opencode/agent/od.md` at every launch (only when
  the content changed). The bundled CLI watches its config, so the agent appears without a
  restart; the app forces the agent to `od` in the composer while the checkbox is on.
- New binaries:
  - `OpenDeath-Setup-1.0.2.exe` â€” 231,954,463 bytes,
    SHA-256 `B9FDAA9177EEEB5796ECA595E87DA9300D83EDD4D3C4FB00C05D91D7C07A7452`
  - `OpenDeath-Portable-1.0.2.exe` â€” 228,814,087 bytes,
    SHA-256 `6D43857D514AC6BF7EEA3A9B5F95C911E257D58D8F668B8B4F275EEF65B8743A`
- Prior 1.0.0 and 1.0.1 binaries stay in `/downloads/`; the site links only to 1.0.2.
- Remote `sha256sum` matches `release/SHA256SUMS.txt`; nginx reloaded and `/`, both new `.exe`
  URLs, `SHA256SUMS.txt`, and `downloads.json` all verified `200` over HTTPS.

## 11. Deployment record (2026-11-20, 1.0.3)

Version 1.0.3 is the personalisation release.

- Every theme is listed by colour name instead of product name (`oc-2` â†’ **Peach**,
  `catppuccin-frappe` â†’ **Cornflower**, `pastel-lavender` â†’ **Lavender**, `amoled` â†’
  **Violet Black**). Theme IDs are unchanged, so a saved theme survives the rename.
- Window controls are drawn in the renderer; `titleBarOverlay` is gone, so the top strip is the
  same surface as the title bar. New RPCs: `WindowMinimize`, `WindowToggleMaximize`,
  `WindowClose`, `WindowGetMaximized`, plus `WindowMaximizedChanged`.
- The network deck is a slot registry: drag to move, arrows to nudge, eye to hide, reset to
  restore. The layout persists in one store with a merge rule (new slots append, removed slots
  drop, corrupt data resets). A `New IP` slot rotates on demand.
- The status band was rebuilt as mark, version, health dot, route, IP, auto-rotate toggle, HUD
  entry point. Settings tabs are Connection, Personalization, HUD, Advanced.
- Personalization adds accent colour (8 presets + picker), corner roundness 0â€“200%, deck
  density, and a status-band toggle.
- Auto-rotate and egress fixes: `rotate("NONE")` fails honestly instead of reporting success,
  `rotateOnly()`/`hunt()` escalate NONE â†’ WARP â†’ PROXY, and a manual rotate bypasses the `auto`
  checkbox gate. Auto mode ladders WARP â†’ free proxy â†’ NONE.
- New binaries, built with `installer/opendeath.nsi` (solid LZMA, 64 MB dictionary, per-user
  install) and `electron-builder --win portable`:
  - `OpenDeath-Setup-1.0.3.exe` â€” 231,907,309 bytes,
    SHA-256 `6CE59EE81C85DBDDF8E7EE3460E16ABB6671DF41DDBBE08CA638ED17A1E51A3F`
  - `OpenDeath-Portable-1.0.3.exe` â€” 228,822,913 bytes,
    SHA-256 `7A8610687198CD7998627D9510C685ED734CD894B67348783C12845F97BDBD19`
- Pages updated from `1.0.2` to `1.0.3` with `deploy/stage-release.ps1`, which also derives the
  byte counts and MB labels from the artifacts. `docs.html` gains a HUD section, `index.html`
  gains three feature cards (Move the deck, Make it yours, Chrome that gets out of the way), and
  `faq.html` gains the theme-rename and deck-rearrange answers.
- `deploy/deploy.py` now takes `OPEND_VERSION` (default `1.0.3`) instead of hardcoded filenames.
- Prior binaries stay in `/downloads/`; the site links only to 1.0.3.
- Remote `sha256sum` matches `release/SHA256SUMS.txt` for both files. `nginx -t` passed and
  nginx reloaded. Public checks: `/`, `features.html`, `download.html`, `faq.html`, `docs.html`
  and `404.html` all return `200` with `1.0.3` and no `1.0.2` string; both new `.exe` URLs return
  `200` with `content-type: application/octet-stream` and the exact byte counts above;
  `downloads.json` kept counting (77 at deploy time) and was not overwritten.

### Build note

The setup wizard is built by `installer/opendeath.nsi` with `makensis` (solid LZMA, 64 MB
dictionary), not by electron-builder's `nsis` target. `bun run pack` leaves the app at
`C:\od\app\dist\desktop\app`, which is the `APP_SRC` the script now points at; `makensis` writes
straight into `release/OpenDeath-Setup-${VERSION}.exe`. Packaging the same payload through
electron-builder's NSIS produced a 256 MB installer instead of 232 MB because of its compressor
settings, so keep using the script.




## 12. Clean URLs and cache policy (2026-11-20)

The site now serves extensionless addresses.

- `deploy/clean-urls.ps1` rewrites every internal link, canonical, `og:url`, sitemap entry and
  robots entry from `page.html` to `page`; the home link becomes `/`.
- nginx redirects the old addresses with 301, keyed on `$request_uri` so the internal
  `/` â†’ `/index.html` rewrite is not bounced back to `/`:
  - `/index.html` â†’ `/`
  - `/page.html` â†’ `/page` (query string preserved: `/faq?x=1` stays `/faq?x=1`)
- `/404` answers with the error page and a real `404` status; the file stays `404.html` on disk
  and `location = /404.html { internal; }` keeps it unaddressable directly.
- HTML is served with `Cache-Control: no-cache`, so a browser revalidates instead of showing a
  heuristically cached copy. `add_header` does not inherit once a level defines its own, so the
  five security headers are repeated inside `location /`.
- Verified live: `/`, `/features`, `/download`, `/docs`, `/faq` return `200`; each `*.html`
  address returns `301` to its clean form; `/404` returns `404` with the page body; zero
  `.html` hrefs remain in any served page.
- A config swap is done with a backup and a guard: copy the new file in, `nginx -t`, reload on
  success, restore the `.bak-<stamp>` and reload on failure. Backups from this session:
  `/root/open.death.cl.bak-20261120114941` and `-20261120115019`.

## 13. 1.0.3 rebuilt: auto-update, WARP default, WARP required (2026-11-20)

The version stays 1.0.3. Nothing in the field self-updates yet, so there is no older number to beat;
the next release is the one existing installs will see.

- Auto-update was not wired at all before this build: `packages/gui-plugins/src/main.ts` never
  listed the updater in its builtins. It is registered now
  (`updater: { ...updater, mainEntry: () => import("./updater/main") }`).
- `electron-builder.config.ts` publishes a generic feed at `https://open.death.cl/downloads/`;
  `script/pack.ts` writes `resources/app-update.yml` from that config. The machine checks at launch
  and every ten minutes and downloads a newer release by itself. A 30-second poll only surfaces the
  restart prompt once the download has landed; "Later" ends the prompt for the session. The menu
  item "Check for updates" still runs a check on demand.
- `deploy/make-latest-yml.ps1` writes `release/latest.yml` (version, installer URL, base64
  SHA-512, size, release date) and `deploy.py` uploads it beside the binaries. No blockmap is
  published, so every update is a full download; electron-updater falls back to that on its own.
- Portable builds do not self-update. The updater is disabled when `PORTABLE_EXECUTABLE_DIR` is
  set, because a portable run extracts to a temp folder that is deleted on exit; its update path is
  the site.
- WARP is the default route. `infinite.json` defaults to `WARP` for a missing file and for an
  unreadable one; the deck shows the WARP chip first without Advanced mode.
- WARP is required. The installer's prerequisite page checks it first, offers "Install WARP now"
  (winget, official package), retries once on Next, and refuses to continue without it. The WARP
  section is read-only and sits before the shortcuts. A from-scratch "Fix connection" stops when
  WARP is missing instead of quietly choosing Tor. Manual mode selection still works.
- WARP connect was rewritten. `warp-cli` can exit 0 while printing "Registration missing" or
  "Unable to connect", so the output decides, not the exit code. A missing registration is
  recreated with back-off (about 90 s); the client is disconnected before `mode proxy`, the port is
  set, then connect, and the proxy is polled for up to 25 s across two cycles. On failure the
  client is returned to tunnel mode instead of being left disconnected.
- The action lock has ceilings now: set mode 180 s, auto-rotate 240 s, reset 240 s, restore 90 s,
  and the background service stop/start is bounded. A stuck child process can no longer keep
  "Another action is still running" for the rest of the session. A manual mode change cancels a
  running hunt at its next attempt and waits up to 12 s for the lock.
- Auto-update needed three fixes beyond registering the plugin, all found by reading the built
  installer against electron-updater 6.8.9:
  - `quitAndInstall()` defaults to `isSilent = false`, so the update ran the wizard at restart.
    It is now `quitAndInstall(true, true)` — silent, and `--force-run` is passed.
  - The updater called the downloaded installer with `--stage`, which only electron-builder's own
    NSIS understands. The house installer ignored the flag and opened its UI during the download.
    That pre-restart unpack was removed; the installer runs once, at the restart.
  - A silent install never shows the finish page, so nothing launched the app afterwards. The
    installer now relaunches when it is running from `$LOCALAPPDATA\@opencodedesktop-updater\pending`
    (electron-updater's cache), and only then.
  - A silent update also skipped the WARP winget install; an update must not start an installer in
    the background. The RO section still reports the missing client, and the app's own gate handles
    it on the next Fix connection.
- A failed mode switch saves `NONE` and restarts the service on it, so the service is never left
  pointed at a dead proxy port (that was the ECONNRESET banner). The deck re-reads the saved mode
  after a failed switch instead of keeping the old highlight.
- Site copy now describes WARP as required and the default, updates as automatic on the installed
  build, and adds an FAQ entry for `CF_REGISTRATION_MISSING` with the one-line recovery command.
- `/downloads/` is served with `expires 1y`, which is right for versioned `.exe` names but wrong for
  `latest.yml`: a cached feed pins installed builds to the release they first saw. Both
  `latest.yml` and `SHA256SUMS.txt` now have their own `expires -1` + `Cache-Control: no-store`
  locations. The rule is in `deploy/nginx.conf` and applied with the same backup / `nginx -t` /
  reload guard (`deploy/apply-nginx.py`, backup `/root/open.death.cl.bak-20261120161446`).

Verified live after the swap (2026-11-20 17:30 UTC):

- `/`, `/features`, `/download`, `/docs`, `/faq` return `200`; `/404` returns `404`.
- `latest.yml` serves with `Cache-Control: no-store`, version `1.0.3`, size `231918655`, and
  SHA-512 `5NdPIYQRfboO6kLegtKv8d/82CJwRpZJWyzz2zCYGzC2/+rpcclGd0r/AuHLyLz4Mg8Boc/55tz/CxwyrixTMg==`.
- `SHA256SUMS.txt` matches the local file; remote `sha256sum` of both binaries matches it:
  setup `42853DFF…`, portable `6BA01EB5…`.
- `Content-Length` is exactly `231918655` for the setup and `228863401` for the portable.
- Pages carry the new copy: WARP as default and required, automatic updates on installed builds,
  the `Device not authenticated` FAQ entry with the registration command.


## 14. Tor removed (2026-11-20)

Tor is gone from the product, the installer and the site. WARP is the only required route.

- Mode union and MODES drop TOR; LABELS, the bar, the doctor order, the status band,
  the IPC schema, the tests and the settings hints follow. The SOCKS5 CONNECT bridge stays
  (it serves the user's own SOCKS servers) and is now named as such, not as Tor plumbing.
- The esources/tor extra resource is removed from electron-builder.config.ts, so the
  packaged app has no esources/tor (verified on dist\desktop\app).
- Hunt lock fixes: hunting/huntCancelled/stopped() live once at module top, cancelHunt()
  is exported there, waitProxy and ensureRegistration abort when stopped, connect()
  reports "auto-rotate stopped" instead of a generic failure, registration back-off is
  [0,2,4,6,8,10]s, and a /registration/i failure ends the hunt immediately instead of
  spending two attempts. esetFlow and estoreFlow cancel a running hunt.
- Smaller binaries, since the Tor Expert Bundle is no longer inside:
  - OpenDeath-Setup-1.0.3.exe - 218,924,833 bytes, SHA-256 B5109B99F6766C5F51C19576A0E0BB0E5BE9DB8EB736A7A9E88171522B083A8B
  - OpenDeath-Portable-1.0.3.exe - 216,518,523 bytes, SHA-256 1ECF05F9AAE8AAE41FB219D4FC073B6C59769EBCF9F79C23F717024D5A18CBBF
- latest.yml: size 218924833, SHA-512 910zuNurkQQAcgEDlHTzp9MkWsv8F9+rICEsZyAkrTweGWoCEsJNgXdyh77V8mNKBbtWit9HrlWNzA5WFxEH2Q==.
- Site copy: index/features/docs/download/faq/404 say eight routes, WARP required, no Tor;
  aq.html keeps one entry answering "does OpenDeath use Tor" with no.
- Verified live: pages 200 (/404 = 404), Content-Length exact for both binaries,
  remote sha256sum matches SHA256SUMS.txt, latest.yml and SHA256SUMS.txt serve
  Cache-Control: no-store.

Note: the version stays 1.0.3, so an installed 1.0.3 will not pull this build through the
updater (same version is a no-op). Fresh downloads and 1.0.2-and-below installs get it.
## 14. 1.0.5: terminal deck controls, manual updates only (2026-11-21)

- The desktop now exposes the network deck to the terminal on a loopback-only control port
  (infinite-control.json in the app's user-data folder, 0600, bearer token, Origin rejected).
  Every request runs the same guarded flow as the window: status, check, fix, reset, rotate, route.
- New opendeath commands: status [--check] [--json], ix, eset, otate, and
  oute [WARP|PROXY|SOCKS|ROUTE64|MULLVAD|WINDSCRIBE|NONE]. They refuse with a clear message when
  the desktop is not running; the deck lives in the app process.
- The TUI gets the same actions as slash commands: /deck (aliases /net, /network), /fix
  (/fix-connection), /reset (/reset-limit), /rotate, and /route [mode].
- Product branding in the terminal is OpenDeath everywhere it is the product: the CLI root name and
  description, the TUI wordmark (open muted, death full strength), splash/epilogue, crash screen,
  update dialogs, terminal title, and docs link. Provider names such as OpenCode Go and OpenCode Zen
  are left unchanged because they name a service, not this app.
- Automatic updates are removed. The updater plugin is no longer registered in the desktop, the TUI
  no longer receives an update source or runs a background check, and the CLI no longer checks every
  ten minutes. Nothing contacts an update feed on its own: a new build is a manual download, and a
  reinstall keeps settings and chats.
- The packaging no longer carries a feed either: `publish` is gone from `electron-builder.config.ts`,
  `pack.ts` no longer writes `resources/app-update.yml`, and the prod payload was verified without
  that file. No 1.0.5 `latest.yml` is published; the site keeps the existing 1.0.4 feed only so
  pre-1.0.5 builds do not see a new version.
- The Windows setup refuses silent installs: `/S` restores the wizard, shows a refusal, and aborts.
  The `.onInstSuccess` auto-launch is gone, so setup never starts OpenDeath by itself. The WARP
  prerequisite install is unchanged: setup still installs WARP first when it is missing.
- Windows and Linux ship from the same source: AppImage, deb and rpm for Linux plus the Linux CLI
  tarball and install.sh; the AppImage is what the AUR package installs. The Linux desktop already
  carries the deck (WARP through warp-cli, SOCKS, proxy lists, Route64, Mullvad, Windscribe).
