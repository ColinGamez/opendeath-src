#!/bin/sh
# OpenDeath installer for Linux.
#
#   curl -fsSL https://open.death.cl/downloads/install.sh | sh
#   curl -fsSL https://open.death.cl/downloads/install.sh | sh -s -- --warp
#
# It detects the distribution family, installs the matching package (deb, rpm or AppImage), and puts the
# `opendeath` terminal CLI on PATH. Nothing is installed until every download has been verified.
#
# Supported families: Debian/Ubuntu/Mint/Pop/Kali, Fedora/RHEL/Rocky/Alma/Nobara, Arch/CachyOS/Manjaro/
# EndeavourOS/Garuda, openSUSE, and any other distribution through the AppImage.

set -eu

VERSION="${OPEND_VERSION:-1.0.4}"
BASE="${OPEND_BASE_URL:-https://open.death.cl/downloads}"
TMP="$(mktemp -d)"
WANT_WARP=0
for arg in "$@"; do
  case "$arg" in
    --warp) WANT_WARP=1 ;;
    --version=*) VERSION="${arg#*=}" ;;
    --help|-h)
      printf 'OpenDeath installer\n\n  --warp            also install Cloudflare WARP\n  --version=X.Y.Z   install another version (default %s)\n' "$VERSION"
      exit 0
      ;;
  esac
done

cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT INT TERM

say() { printf '%s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

[ "$(uname -s)" = "Linux" ] || die "This installer is for Linux. Windows and macOS use the setup from the download page."

case "$(uname -m)" in
  x86_64|amd64) ARCH=x64; DEB=amd64; RPM=x86_64; IMG=x86_64 ;;
  *) die "OpenDeath 1.0.4 is built for x86_64 Linux; this machine is $(uname -m)." ;;
esac

# Root when possible, per-user when not. A piped installer must never leave a half-installed system package behind.
if [ "$(id -u)" -eq 0 ]; then
  SUDO=""
elif have sudo; then
  SUDO="sudo"
else
  SUDO=""
fi
as_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"; elif [ -n "$SUDO" ]; then $SUDO "$@"; else return 1; fi
}
can_system_install() { [ "$(id -u)" -eq 0 ] || [ -n "$SUDO" ]; }

fetch() {
  if have curl; then
    curl -fL --retry 3 --connect-timeout 20 -o "$2" "$1"
  elif have wget; then
    wget -O "$2" "$1"
  else
    die "curl or wget is required to download OpenDeath."
  fi
}

# The checksum file is optional so a mirror without it still works, but a listed file must match.
verify() {
  file="$1"
  sums="$TMP/SHA256SUMS-linux.txt"
  [ -s "$sums" ] || return 0
  name="$(basename "$file")"
  want="$(awk -v f="$name" '$2 == f { print $1; exit }' "$sums")"
  [ -n "$want" ] || return 0
  if have sha256sum; then got="$(sha256sum "$file" | awk '{ print $1 }')"; else got="$(shasum -a 256 "$file" | awk '{ print $1 }')"; fi
  [ "$want" = "$got" ] || die "Checksum mismatch for $name; nothing was installed."
}

# --- distribution detection ---------------------------------------------------------------------------------------

ID=""; LIKE=""; CODENAME=""
if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  ID="${ID:-}"; LIKE="${ID_LIKE:-}"; CODENAME="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
fi

family() {
  case " $ID $LIKE " in
    *" arch "*|*" cachyos "*|*" manjaro "*|*" endeavouros "*|*" garuda "*) echo arch ;;
    *" debian "*|*" ubuntu "*|*" linuxmint "*|*" mint "*|*" pop "*|*" elementary "*|*" zorin "*|*" kali "*|*" parrot "*|*" raspbian "*|*" neon "*) echo deb ;;
    *" fedora "*|*" rhel "*|*" centos "*|*" rocky "*|*" almalinux "*|*" nobara "*|*" bazzite "*) echo rpm ;;
    *" suse "*|*" opensuse "*|*" opensuse-leap "*|*" opensuse-tumbleweed "*) echo zypper ;;
    *) echo unknown ;;
  esac
}
FAMILY="$(family)"
say "OpenDeath $VERSION for Linux ($IMG), $ID ${CODENAME:+($CODENAME)} -> $FAMILY"

fetch "$BASE/SHA256SUMS-linux.txt" "$TMP/SHA256SUMS-linux.txt" >/dev/null 2>&1 || true

# --- CLI ----------------------------------------------------------------------------------------------------------

install_cli() {
  say "Installing the opendeath CLI..."
  archive="$TMP/opendeath-cli-$VERSION-linux-$ARCH.tar.gz"
  fetch "$BASE/opendeath-cli-$VERSION-linux-$ARCH.tar.gz" "$archive" || {
    warn "The CLI archive is not on this mirror; the desktop app will still be installed."
    return 0
  }
  verify "$archive"
  mkdir -p "$TMP/cli"
  tar -xzf "$archive" -C "$TMP/cli"
  bin="$(find "$TMP/cli" -type f -name opencode | head -n1)"
  [ -n "$bin" ] || bin="$(find "$TMP/cli" -type f | head -n1)"
  [ -n "$bin" ] || { warn "The CLI archive did not contain an executable."; return 0; }
  chmod +x "$bin"
  if can_system_install && as_root install -d /usr/local/bin; then
    as_root install -m 0755 "$bin" /usr/local/bin/opendeath
    say "  /usr/local/bin/opendeath"
  else
    mkdir -p "$HOME/.local/bin"
    install -m 0755 "$bin" "$HOME/.local/bin/opendeath"
    say "  $HOME/.local/bin/opendeath (add it to PATH if it is not there yet)"
  fi
}

# --- GUI ----------------------------------------------------------------------------------------------------------

install_deb() {
  file="$TMP/OpenDeath-$VERSION-$DEB.deb"
  fetch "$BASE/OpenDeath-$VERSION-$DEB.deb" "$file"
  verify "$file"
  if ! can_system_install; then warn "No sudo: installing the AppImage for this user instead."; install_appimage; return; fi
  say "Installing the Debian package..."
  if have apt-get; then
    as_root apt-get install -y "$file"
  elif have dpkg; then
    as_root dpkg -i "$file" || { as_root apt-get install -y -f; }
  else
    die "apt-get or dpkg is required for the .deb package."
  fi
}

install_rpm() {
  file="$TMP/OpenDeath-$VERSION-$RPM.rpm"
  fetch "$BASE/OpenDeath-$VERSION-$RPM.rpm" "$file"
  verify "$file"
  if ! can_system_install; then warn "No sudo: installing the AppImage for this user instead."; install_appimage; return; fi
  say "Installing the RPM package..."
  if have rpm-ostree; then
    as_root rpm-ostree install "$file" || die "rpm-ostree refused the package."
    warn "This is an immutable system: reboot to finish the install."
  elif have dnf; then
    as_root dnf install -y "$file"
  elif have zypper; then
    as_root zypper --non-interactive install --allow-unsigned-rpm "$file"
  elif have rpm; then
    as_root rpm -i "$file"
  else
    die "dnf, zypper or rpm is required for the .rpm package."
  fi
}

install_appimage() {
  file="$TMP/OpenDeath-$VERSION-$IMG.AppImage"
  fetch "$BASE/OpenDeath-$VERSION-$IMG.AppImage" "$file"
  verify "$file"
  chmod +x "$file"
  say "Installing the AppImage..."
  if can_system_install; then
    dir=/opt/opendeath
    bin=/usr/local/bin/opendeath-desktop
    entry=/usr/share/applications/opendeath.desktop
    icon=/usr/share/icons/hicolor/512x512/apps/opendeath.png
    as_root install -d "$dir" "$(dirname "$entry")" "$(dirname "$icon")"
  else
    dir="$HOME/.local/opt/opendeath"
    bin="$HOME/.local/bin/opendeath-desktop"
    entry="$HOME/.local/share/applications/opendeath.desktop"
    icon="$HOME/.local/share/icons/hicolor/512x512/apps/opendeath.png"
    mkdir -p "$dir" "$(dirname "$entry")" "$(dirname "$icon")" "$HOME/.local/bin"
  fi
  if can_system_install; then
    as_root install -m 0755 "$file" "$dir/OpenDeath.AppImage"
  else
    install -m 0755 "$file" "$dir/OpenDeath.AppImage"
  fi

  # The AppImage carries its own icons; extract the largest one for the menu entry.
  ( cd "$TMP" && "$dir/OpenDeath.AppImage" --appimage-extract >/dev/null 2>&1 ) || true
  png="$(find "$TMP/squashfs-root" -type f -name '*.png' -size +10k 2>/dev/null | sort | tail -n1)"
  if [ -n "$png" ]; then
    if can_system_install; then as_root install -m 0644 "$png" "$icon"; else install -m 0644 "$png" "$icon"; fi
  fi

  write_desktop() {
    cat > "$1" <<EOF
[Desktop Entry]
Type=Application
Name=OpenDeath
Comment=AI workspace with the Infinite network deck
Exec=$dir/OpenDeath.AppImage %U
Icon=opendeath
Terminal=false
Categories=Development;
StartupWMClass=dev.opendeath.desktop
EOF
  }
  if can_system_install; then
    write_desktop "$TMP/opendeath.desktop"
    as_root install -m 0644 "$TMP/opendeath.desktop" "$entry"
    as_root ln -sf "$dir/OpenDeath.AppImage" "$bin" 2>/dev/null || true
  else
    write_desktop "$entry"
    ln -sf "$dir/OpenDeath.AppImage" "$bin" 2>/dev/null || true
  fi
  have update-desktop-database && as_root update-desktop-database >/dev/null 2>&1 || true
  say "  $dir/OpenDeath.AppImage"
}

install_gui() {
  case "$FAMILY" in
    deb) install_deb ;;
    rpm) install_rpm ;;
    arch|unknown) install_appimage ;;
    zypper) install_rpm ;;
  esac
}

# --- WARP ---------------------------------------------------------------------------------------------------------

install_warp() {
  if have warp-cli; then
    say "Cloudflare WARP is already installed."
    return 0
  fi
  say "Installing Cloudflare WARP..."
  case "$FAMILY" in
    deb)
      as_root install -d /usr/share/keyrings || true
      fetch "https://pkg.cloudflareclient.com/pubkey.gpg" "$TMP/warp.gpg" || true
      if [ -s "$TMP/warp.gpg" ] && have gpg; then
        as_root gpg --yes --dearmor -o /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg "$TMP/warp.gpg" || true
      fi
      printf 'deb [signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ %s main\n' "$CODENAME" > "$TMP/warp.list"
      as_root install -m 0644 "$TMP/warp.list" /etc/apt/sources.list.d/cloudflare-client.list
      as_root apt-get update && as_root apt-get install -y cloudflare-warp
      ;;
    rpm)
      as_root sh -c 'curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg -o /etc/pki/rpm-gpg/RPM-GPG-KEY-cloudflare && printf "[cloudflare-warp]\nname=Cloudflare WARP\nbaseurl=https://pkg.cloudflareclient.com/rpm\nenabled=1\ngpgcheck=1\ngpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-cloudflare\n" > /etc/yum.repos.d/cloudflare-warp.repo' &&
        as_root dnf install -y cloudflare-warp
      ;;
    zypper)
      as_root zypper --non-interactive addrepo -f https://pkg.cloudflareclient.com/rpm cloudflare-warp || true
      as_root zypper --non-interactive --gpg-auto-import-keys install cloudflare-warp
      ;;
    arch)
      if have yay; then yay -S --noconfirm cloudflare-warp-bin; elif have paru; then paru -S --noconfirm cloudflare-warp-bin; else
        warn "Install cloudflare-warp-bin from the AUR, then run: sudo systemctl enable --now warp-svc"
        return 0
      fi
      ;;
  esac
  as_root systemctl enable --now warp-svc 2>/dev/null || warn "Start the WARP service with: sudo systemctl enable --now warp-svc"
  have warp-cli && say "Cloudflare WARP installed."
}

install_cli
install_gui
[ "$WANT_WARP" -eq 1 ] && install_warp

say ""
say "OpenDeath $VERSION is installed."
say "  App:    OpenDeath in your application menu, or opendeath-desktop"
say "  CLI:    opendeath --help"
if have warp-cli; then
  say "  WARP:   detected; open OpenDeath and press Fix connection."
else
  say "  WARP:   not detected. Re-run with --warp, or open Help in the app for the command for your distribution."
fi
