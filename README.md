<p align="center">
  <img src="packaging/website/assets/skull.png" alt="OpenDeath" width="96" />
</p>

<h1 align="center">OpenDeath</h1>

<p align="center">
  A Windows desktop AI workspace with a network deck.<br />
  WARP-first routing, automatic rotation, limit recovery, relaunch resume.
</p>

<p align="center">
  <a href="https://open.death.cl">open.death.cl</a> ·
  <b>1.0.3</b> ·
  MIT
</p>

---

## What it is

OpenDeath is a standalone Windows desktop application built on the
[opencode](https://github.com/sst/opencode) engine. It keeps its own executable, its own data
folder and its own settings. Two layers:

**The workspace.** Sessions and tabs, streaming tool output, file diffs, a terminal, a built-in
browser, voice dictation, themes and accent colours, and a HUD you can rearrange by dragging.

**The network deck.** A row of routes, one click each, sitting under the session bar:

| Route | What it does |
|---|---|
| **Auto** | Picks a healthy route in order and reports which one it used |
| **WARP** | Cloudflare WARP in proxy mode. Required; the installer puts it in place first |
| **Proxy** | Your HTTP proxy list, or the free public list when yours is empty |
| **SOCKS5** | Your own SOCKS5 servers, served to the engine through a local HTTP bridge |
| **Route64** | A route64 WireGuard tunnel from your `.conf` |
| **Mullvad** | Switches server through the Mullvad app |
| **Windscribe** | Switches location through the Windscribe app |
| **None** | Direct. Honest about it: no IP is claimed to have changed |

When a session hits a limit, **Reset limit** archives the session, renews the IP and restores the
session on the new exit. Waiting chats are written to disk, so a relaunch resumes them and sends
`continue` once a new route is ready. The doctor tries what actually works on this machine
instead of asking questions.

**Tor is not part of this product.** It was removed in 1.0.3 at every layer: no bundled binary,
no route, no code path. The routes above are the whole deck.

## Install

Download from [open.death.cl](https://open.death.cl/download):

- `OpenDeath-Setup-1.0.3.exe` — guided per-user install, shortcuts, uninstaller
- `OpenDeath-Portable-1.0.3.exe` — single file, runs from any folder

Windows 10 or 11, 64-bit. No administrator account is needed. Cloudflare WARP is the one
required dependency and the wizard installs it before the app. WireGuard, Mullvad and
Windscribe are optional, only for the route you actually use.

Installed builds check for updates at launch and every ten minutes after that, download in the
background, and ask once to restart. Portable builds do not self-update — replace the file.

## Build from source

Requires [Bun](https://bun.sh) 1.4.4 and Node 22+, on Windows x64.

```powershell
bun install

# desktop app
cd packages\desktop
$env:OPENCODE_CHANNEL = "prod"
bun run build
bun run pack          # leaves the app at dist\desktop\app

# portable executable
bunx electron-builder --win --x64 --publish never --config electron-builder.config.ts `
  --prepackaged C:\od\app\dist\desktop\app `
  '-c.win.target=portable' '-c.artifactName=opendeath-portable-${os}-${arch}.${ext}'

# setup wizard (NSIS 3.x)
makensis packaging\installer\opendeath.nsi
```

`packaging\` holds the release side of the project: the NSIS installer script, the marketing
site, and the deploy tooling for a static nginx host. The deploy scripts read the host and
password from the environment — `OPEND_SSH_HOST`, `OPEND_SSH_USER`, `OPEND_SSH_PASSWORD` — and
nothing is stored in the tree.

## Layout

```
packages\desktop\      Electron shell: main process, preload, renderer, updater
packages\app\          The workspace UI (Solid): sessions, deck, doctor, settings
packages\gui-plugins\  GUI plugin host, including the auto-updater
packages\core\         Engine, providers, tools
packaging\installer\   NSIS setup script
packaging\website\     Static site served at open.death.cl
packaging\deploy\      Release and deploy tooling
```

The network deck lives in `packages\desktop\src\main\infinite\infinite.ts` (routing, rotation,
WARP control, bridges) and `packages\app\src\shell\infinite-*.ts(x)` (deck, doctor, status band,
persisted layout).

## License

MIT. OpenDeath is a fork of [opencode](https://github.com/sst/opencode), also MIT; the original
copyright notice is kept in [LICENSE](LICENSE) and the changes are described in
[NOTICE.md](NOTICE.md).
