# Notice

OpenDeath is a fork of **opencode** (https://github.com/sst/opencode), distributed under the MIT
License. The upstream copyright notice is preserved verbatim in [LICENSE](LICENSE):

```
Copyright (c) 2025 opencode
```

OpenDeath is not affiliated with, endorsed by, or supported by the opencode project or its
maintainers. Bug reports go here, not upstream.

## What this fork changes

Added:

- **The network deck** — routes for WARP, HTTP proxy lists, SOCKS5 (through a local CONNECT
  bridge), route64 WireGuard, Mullvad, Windscribe and direct, with Auto ordering.
- **IP rotation** — WARP proxy-mode control through `warp-cli`, free-proxy list verification,
  burned-IP memory, and hunt-through-probe sessions so a chat only meets an exit that answers.
- **Reset limit** — archives `auth.json`, renews the exit, restores the session and continues.
- **Relaunch resume** — pending chats persisted to disk and resumed after a restart.
- **The connection doctor** — tries the routes that actually work on the machine, WARP first.
- **Desktop shell work** — status band, HUD editor with drag-and-drop layout, settings tabs,
  themes and accents.
- **The Windows release pipeline** — NSIS setup script, portable build, generic auto-update feed.

Removed:

- **Tor.** There is no bundled Tor binary, no Tor route and no Tor code path in 1.0.3 or later.
  The SOCKS5 bridge remains, but it serves the user's own SOCKS servers.

Changed:

- **Auto-update** uses a generic provider at `https://open.death.cl/downloads/`, checks at launch
  and every ten minutes, downloads in the background, and asks once before restarting.
- **WARP is required** and is installed by the setup wizard before the app starts.

## Third-party components

The packaged application bundles the opencode engine and its dependencies; their licences ship
with them. Cloudflare WARP, WireGuard, Mullvad and Windscribe are separate products with their
own terms, installed only when the user chooses a route that needs them.
