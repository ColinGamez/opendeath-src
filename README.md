<p align="center">
  <img src="packaging/website/assets/skull.png" alt="OpenDeath" width="96" />
</p>

<h1 align="center">OpenDeath</h1>

<p align="center">
  A Windows and Linux desktop AI workspace with a network deck.<br />
  WARP-first routing, automatic rotation, limit recovery, relaunch resume.
</p>

<p align="center">
  <a href="https://open.death.cl">open.death.cl</a> ·
  <b>1.0.5</b> ·
  MIT
</p>

---

## What it is

OpenDeath is a standalone desktop application for Windows and Linux, built on the
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
session on the new exit, even when the rotation fails. Waiting chats are written to disk, so a
relaunch resumes them and sends `continue` once a new route is ready. **Help** shows the last error
with the fixes and copyable commands for it. The doctor tries what actually works on this machine
instead of asking questions.

**The deck in the terminal.** The bundled `opendeath` CLI reaches the running desktop over a
loopback-only control port and uses the same guarded flows as the window: `opendeath status`,
`fix`, `reset`, `rotate`, and `route [mode]`. The TUI has the same actions as `/deck`, `/fix`,
`/reset`, `/rotate`, and `/route`. `--json` is available on every deck command for scripts.

WARP rotation uses `warp-cli tunnel rotate-keys`: a new local key makes Cloudflare hand out a new
exit without a new registration, so the "does not accept new ones for now" rate limit no longer
stops **New IP**. A redial is next, and a registration only once per ten minutes when both fail.

**Tor is not part of this product.** It was removed in 1.0.3 at every layer: no bundled binary,
no route, no code path. The routes above are the whole deck.

## Install

Download from [open.death.cl](https://open.death.cl/download):

Windows:

- `OpenDeath-Setup-1.0.5.exe` - guided per-user install, shortcuts, uninstaller, optional `opendeath` CLI
- `OpenDeath-Portable-1.0.5.exe` - single file, runs from any folder

Linux, one command (AppImage, deb or rpm chosen from `/etc/os-release`, plus the CLI):

```sh
curl -fsSL https://open.death.cl/downloads/install.sh | sh
```

Add `--warp` to install Cloudflare WARP in the same run. Debian, Ubuntu, Mint, Pop!_OS, Kali,
Fedora, RHEL, Rocky, AlmaLinux, Nobara, Arch, CachyOS, Manjaro, EndeavourOS, Garuda and openSUSE
are detected; anything else gets the AppImage. Arch users can also install `opendeath-bin` from
the AUR (`packaging/linux/PKGBUILD`).

Windows 10 or 11, 64-bit, or a modern 64-bit Linux distribution. No administrator account is
needed on Windows. Cloudflare WARP is the one required dependency; on Linux the installer can add
it, and the app detects an existing `warp-cli`. WireGuard, Mullvad and Windscribe are optional,
only for the route you actually use.

OpenDeath does not update itself. There is no launch check, background download, update feed, or
restart prompt: a new build is a manual download from the site, installed over the current one.
The Windows setup is interactive and refuses silent `/S` installs, so OpenDeath is only installed
by a person running the wizard. Settings and chats stay in the profile. Linux packages are built by
`.github/workflows/linux.yml` and attached to the release.

## Build from source

Requires [Bun](https://bun.sh) 1.4.4 and Node 22+, on Windows x64 for the NSIS build. The Linux packages are built on Ubuntu by `.github/workflows/linux.yml`, because electron-builder needs rpm and fpm there.

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
packages\desktop\      Electron shell: main process, preload, renderer, network deck
packages\app\          The workspace UI (Solid): sessions, deck, doctor, settings
packages\gui-plugins\  GUI plugin host and built-in plugins
packages\core\         Engine, providers, tools
packaging\installer\   NSIS setup script
packaging\linux\       Linux installer, AUR PKGBUILD
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
