"""Deploy open.death.cl over SSH/SFTP with password auth.

Usage:
  py deploy/deploy.py check
  py deploy/deploy.py deploy
"""

import os
import sys
import stat
import posixpath

import paramiko

HOST = os.environ.get("OPEND_SSH_HOST", "172.255.210.162")
USER = os.environ.get("OPEND_SSH_USER", "root")
PASSWORD = os.environ.get("OPEND_SSH_PASSWORD", "")
VERSION = os.environ.get("OPEND_VERSION", "1.0.4")

LOCAL_SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "website"))
LOCAL_RELEASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "release"))
REMOTE_SITE = "/var/www/open.death.cl"

# Live counter written by the nginx-log cron job. Never overwrite it from the local copy.
SKIP_NAMES = {"downloads.json"}
SKIP_DIRS = {"downloads"}


def connect():
    if not PASSWORD:
        raise SystemExit("set OPEND_SSH_PASSWORD before running this script")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30, banner_timeout=30, auth_timeout=30)
    return client


def run(client, command):
    stdin, stdout, stderr = client.exec_command(command, timeout=120)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err


def check(client):
    for cmd in [
        "hostname",
        "nginx -v",
        "ls -la /var/www/open.death.cl | head -40",
        "ls -la /var/www/open.death.cl/downloads | head -40",
        "cat /var/www/open.death.cl/downloads/SHA256SUMS.txt 2>/dev/null",
        "cat /var/www/open.death.cl/downloads.json 2>/dev/null",
    ]:
        code, out, err = run(client, cmd)
        print(f"$ {cmd}\n{out}{err}(exit {code})\n")


def ensure_remote_dir(sftp, path):
    parts = path.strip("/").split("/")
    cur = ""
    for part in parts:
        cur += "/" + part
        try:
            sftp.stat(cur)
        except IOError:
            sftp.mkdir(cur)


def upload_site(sftp):
    count = 0
    for root, dirs, files in os.walk(LOCAL_SITE):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel = os.path.relpath(root, LOCAL_SITE)
        remote_dir = REMOTE_SITE if rel == "." else posixpath.join(REMOTE_SITE, rel.replace(os.sep, "/"))
        ensure_remote_dir(sftp, remote_dir)
        for name in files:
            if name in SKIP_NAMES:
                continue
            local = os.path.join(root, name)
            remote = posixpath.join(remote_dir, name)
            sftp.put(local, remote)
            count += 1
    return count


def upload_downloads(sftp):
    remote_dir = posixpath.join(REMOTE_SITE, "downloads")
    ensure_remote_dir(sftp, remote_dir)
    names = [
        f"OpenDeath-Setup-{VERSION}.exe",
        f"OpenDeath-Portable-{VERSION}.exe",
        "SHA256SUMS.txt",
        # electron-updater reads its feed from here, so it ships with the binaries.
        "latest.yml",
    ]
    for name in names:
        local = os.path.join(LOCAL_RELEASE, name)
        if not os.path.exists(local):
            raise SystemExit(f"missing local file: {local}")
        size = os.path.getsize(local)
        print(f"uploading {name} ({size:,} bytes) ...", flush=True)
        sftp.put(local, posixpath.join(remote_dir, name), callback=lambda done, total: None)
        print(f"  done {name}", flush=True)
    # Linux files are built in GitHub Actions and may not be in this folder yet; send them when they are.
    optional = [
        f"OpenDeath-{VERSION}-x86_64.AppImage",
        f"OpenDeath-{VERSION}-amd64.deb",
        f"OpenDeath-{VERSION}-x86_64.rpm",
        f"opendeath-cli-{VERSION}-linux-x64.tar.gz",
        "SHA256SUMS-linux.txt",
        "install.sh",
    ]
    for name in optional:
        local = os.path.join(LOCAL_RELEASE, name)
        if not os.path.exists(local):
            print(f"skip {name} (not built here)", flush=True)
            continue
        print(f"uploading {name} ({os.path.getsize(local):,} bytes) ...", flush=True)
        sftp.put(local, posixpath.join(remote_dir, name), callback=lambda done, total: None)
        names.append(name)
        print(f"  done {name}", flush=True)
    return names


def fix_permissions(client):
    commands = [
        "chown -R www-data:www-data /var/www/open.death.cl",
        "find /var/www/open.death.cl -type d -exec chmod 755 {} +",
        "find /var/www/open.death.cl -type f -exec chmod 644 {} +",
    ]
    for cmd in commands:
        code, out, err = run(client, cmd)
        if code != 0:
            print(f"warn: {cmd}: {err}")
    code, out, err = run(client, "nginx -t && systemctl reload nginx && echo RELOADED")
    print(out, err)
    if code != 0:
        raise SystemExit("nginx reload failed")


def install_download_counter(client):
    """Replace the server-side counter and run it once, so the site never waits a cron cycle for the new number."""
    local = os.path.abspath(os.path.join(os.path.dirname(__file__), "update-downloads.sh"))
    sftp = client.open_sftp()
    try:
        sftp.put(local, "/usr/local/bin/opendeath-downloads")
    finally:
        sftp.close()
    code, out, err = run(
        client,
        "chmod 755 /usr/local/bin/opendeath-downloads && "
        "/usr/local/bin/opendeath-downloads && cat /var/www/open.death.cl/downloads.json",
    )
    print(f"counter: {out.strip()} {err.strip()} (exit {code})")
    if code != 0:
        raise SystemExit("counter install failed")


def pause_counter_cron(client):
    """Keep the old counter from writing 59 while the new baseline is being deployed."""
    run(
        client,
        "if [ -f /etc/cron.d/opendeath-downloads ]; then "
        "mv -f /etc/cron.d/opendeath-downloads /root/opendeath-downloads.cron.off; fi",
    )


def resume_counter_cron(client):
    run(
        client,
        "if [ -f /root/opendeath-downloads.cron.off ]; then "
        "mv -f /root/opendeath-downloads.cron.off /etc/cron.d/opendeath-downloads; fi",
    )


def reset_counter(client):
    """Archive the current access log and drop the monotonic state, so the 612 baseline is the starting number."""
    code, out, err = run(
        client,
        "set -e; "
        "LOG=/var/log/nginx/opendeath-downloads.log; "
        "STAMP=$(date -u +%Y%m%dT%H%M%SZ); "
        'if [ -s "$LOG" ]; then mv "$LOG" "$LOG.pre-1.0.4-$STAMP"; fi; '
        ': > "$LOG"; '
        'chown www-data:www-data "$LOG" 2>/dev/null || true; '
        'chmod 644 "$LOG"; '
        "rm -f /var/lib/opendeath/downloads.last; "
        "echo COUNTER RESET",
    )
    print(f"counter reset: {out.strip()} {err.strip()} (exit {code})")
    if code != 0:
        raise SystemExit("counter reset failed")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"
    reset = os.environ.get("OPEND_RESET_COUNTER") == "1"
    client = connect()
    try:
        if mode == "check":
            check(client)
            return
        if reset:
            pause_counter_cron(client)
            reset_counter(client)
        try:
            sftp = client.open_sftp()
            try:
                print("uploading site files ...", flush=True)
                n = upload_site(sftp)
                print(f"site files uploaded: {n}", flush=True)
                if mode != "site":
                    print("uploading release files ...", flush=True)
                    upload_downloads(sftp)
            finally:
                sftp.close()
            fix_permissions(client)
            install_download_counter(client)
            code, out, err = run(client, "ls -la /var/www/open.death.cl/downloads; echo ---; date -u")
            print(out, err)
            print("DEPLOY OK")
        finally:
            if reset:
                resume_counter_cron(client)
    finally:
        client.close()


if __name__ == "__main__":
    main()
