"""Swap the nginx site config with a backup and a guard.

copies the live file to /root/open.death.cl.bak-<stamp>, uploads deploy/nginx.conf,
runs `nginx -t`, reloads on success and restores the backup on failure.

    $env:OPEND_SSH_PASSWORD=...; py -3 deploy/apply-nginx.py
"""

import os
import posixpath
import time

import paramiko

HOST = "YOUR_SERVER_IP"
USER = "root"
PASSWORD = os.environ["OPEND_SSH_PASSWORD"]
LOCAL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nginx.conf")
REMOTE = "/etc/nginx/sites-available/open.death.cl"
STAMP = time.strftime("%Y%m%d%H%M%S")
BACKUP = f"/root/open.death.cl.bak-{STAMP}"


def run(client, command, timeout=120):
    _, out, err = client.exec_command(command, timeout=timeout)
    code = out.channel.recv_exit_status()
    return code, out.read().decode(errors="replace"), err.read().decode(errors="replace")


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    code, out, err = run(client, f"cp -a {REMOTE} {BACKUP} && sha256sum {BACKUP}")
    if code != 0:
        raise SystemExit(f"backup failed: {err}")
    print(f"backup {BACKUP}: {out.strip()}")

    sftp = client.open_sftp()
    sftp.put(LOCAL, f"{posixpath.dirname(REMOTE)}/.open.death.cl.new")
    sftp.close()
    print("uploaded new config")

    code, out, err = run(client, f"mv {posixpath.dirname(REMOTE)}/.open.death.cl.new {REMOTE}")
    if code != 0:
        raise SystemExit(f"install failed: {err}")

    code, out, err = run(client, "nginx -t 2>&1")
    print(out.strip() or err.strip())
    if code != 0:
        run(client, f"cp -a {BACKUP} {REMOTE} && nginx -t && systemctl reload nginx")
        raise SystemExit("nginx -t rejected the new config; previous file restored")

    code, out, err = run(client, "systemctl reload nginx && echo reloaded")
    if code != 0:
        raise SystemExit(f"reload failed: {err}")
    print(out.strip())

    code, out, _ = run(client, f"grep -n 'latest.yml' {REMOTE} | head -3")
    print(out.strip())
    client.close()


if __name__ == "__main__":
    main()
