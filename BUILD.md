# Building OpenDeath

Windows 10/11 x64. [Bun](https://bun.sh) 1.4.4 (see `packageManager` in `package.json`), Node 22+,
Git, and NSIS 3.x for the setup wizard.

## 1. Dependencies

```powershell
bun install
```

## 2. The engine

The desktop app bundles its own CLI. Build it from this tree so the app and the engine agree:

```powershell
cd packages\cli
bun run build --single --baseline
```

## 3. Desktop app

```powershell
cd ..\desktop
$env:OPENCODE_CHANNEL = "prod"
bun run build
bun run pack
```

`bun run pack` clears `dist\desktop` and leaves the unpacked app at `C:\od\app\dist\desktop\app`.
That directory is what the installer and the portable build consume.

## 4. Portable executable

```powershell
cd C:\od\app\packages\desktop
bunx electron-builder --win --x64 --publish never --config electron-builder.config.ts `
  --prepackaged C:\od\app\dist\desktop\app `
  '-c.win.target=portable' '-c.artifactName=opendeath-portable-${os}-${arch}.${ext}'
```

Output: `dist\opendeath-portable-win-x64.exe`.

## 5. Setup wizard

```powershell
makensis C:\od\app\packaging\installer\opendeath.nsi
```

`packaging\installer\opendeath.nsi` reads its payload from `APP_SRC` and writes
`release\OpenDeath-Setup-<version>.exe`. It uses solid LZMA with a 64 MB dictionary and installs
per user, without administrator rights.

Do not build the setup with electron-builder's `nsis` target: its compressor settings produce a
noticeably larger installer from the same payload.

## 6. Checks

```powershell
bunx tsc -b packages\desktop --force
bunx tsc -p packages\app --noEmit
bunx tsc -p packages\gui-plugins --noEmit

cd packages\desktop; bun test src\main\infinite
cd ..\app;            bun test src\shell\infinite-doctor.test.ts
cd ..\gui-plugins;    bun test src\updater
```

Tests run from `packages\*`, never from the repository root (the root `test` script exists to say
exactly that).

## Notes

- WARP mode needs [Cloudflare WARP](https://one.one.one.one) installed and its service running.
  Proxy, SOCKS5 and None need nothing else.
- The app is unsigned in this tree. A signed release needs your own certificate; `signtool.exe`
  is picked up by electron-builder when `CSC_LINK` and `CSC_KEY_PASSWORD` are set.
- Auto-update reads `latest.yml` from the generic provider in `app-update.yml`. A build with the
  same version as the feed will not update itself; bump the version to roll one out.
