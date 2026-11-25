import { createSignal, For, Show } from "solid-js"
import { Dialog, DialogBody, DialogHeader, DialogTitleGroup } from "@opencode/ui/dialog"
import { usePlatform } from "@/runtime/platform/platform"
import { useLanguage } from "@/runtime/i18n/language"
import { connectionError } from "./connection-error"
import type { RequestDiagnostic } from "./request-diagnostics"

// The help the deck never had: what is wrong right now, and what to do about it. Every command is selectable and
// copyable, because the people who hit these failures are not going to retype a warp-cli call from a screenshot.

type Fix = { title: string; body: string; command?: string }

const windows = typeof navigator === "undefined" ? true : /Windows/i.test(navigator.userAgent)

const FIXES: Fix[] = [
  {
    title: "WARP will not register",
    body: "Cloudflare limits how many new registrations one address may make. 1.0.4 does not need one to change the IP: it rotates the tunnel key instead, which Cloudflare does not rate-limit. If a registration really is missing, wait 10-30 minutes, run the command below, then click Fix connection.",
    command: "warp-cli --accept-tos registration new",
  },
  {
    title: "Cloudflare is throttling registrations",
    body: "The app pauses only new registrations for 30 minutes, not WARP itself. New IP still works because it rotates the local tunnel key (warp-cli tunnel rotate-keys). The existing registration keeps connecting. Use Proxy if you also need a different country.",
  },
  {
    title: "New IP gives the same country",
    body: "A key rotation changes the exit address, not the country Cloudflare assigns. WARP picks that from your network. Pick Proxy for a country from your own list, or wait and rotate again; Auto does this for you.",
  },
  {
    title: "WARP does not answer on 127.0.0.1:40000",
    body: "That port is WARP's local proxy, and older clients do not have one. 1.0.4 notices and uses WARP's tunnel instead, so the deck keeps working. On Linux, start the service once: sudo systemctl enable --now warp-svc.",
  },
  {
    title: "Reset limit signed me out",
    body: "Fixed in 1.0.4: the session is archived, the IP changes, and the session is restored before the app reconnects. If a rotation fails, the session is still put back. Make sure Proxy or WARP works first; Reset needs an IP to move to.",
  },
  {
    title: "Proxy keeps failing",
    body: "The free lists are often blocked by an ISP or temporarily dead. Add your own HTTP proxy list in Settings, Connection; your own proxies always win over the free ones.",
  },
  {
    title: "Nothing connects at all",
    body: "Check that Cloudflare WARP is installed and its service is running, turn off any other VPN, and make sure the system clock is correct. A wrong clock breaks WARP registration and HTTPS at the same time.",
  },
]

const chip =
  "px-3.5 py-1.5 rounded-xl text-13-regular transition-colors bg-v2-background-bg-layer-02 text-v2-text-text-base hover:bg-v2-overlay-simple-overlay-hover"
const code =
  "flex-1 min-w-0 rounded-lg bg-v2-background-bg-layer-02 px-3 py-2 font-mono text-12-regular text-v2-text-text-base overflow-x-auto whitespace-nowrap"

// Cloudflare publishes WARP for Linux through its own repositories (and the AUR). The commands are kept here so a
// Linux user can fix WARP without leaving the app, whichever family their distribution belongs to.
const LINUX_INSTALL: { label: string; command: string }[] = [
  {
    label: "Debian, Ubuntu, Mint, Pop!_OS, Kali",
    command:
      'sudo apt install -y curl gpg && curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg | sudo gpg --dearmor --yes -o /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg && echo "deb [signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ $(. /etc/os-release && echo ${UBUNTU_CODENAME:-$VERSION_CODENAME}) main" | sudo tee /etc/apt/sources.list.d/cloudflare-client.list && sudo apt update && sudo apt install -y cloudflare-warp',
  },
  {
    label: "Fedora, RHEL, Rocky, AlmaLinux, Nobara",
    command:
      "sudo sh -c 'curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg -o /etc/pki/rpm-gpg/RPM-GPG-KEY-cloudflare && printf \"[cloudflare-warp]\\nname=Cloudflare WARP\\nbaseurl=https://pkg.cloudflareclient.com/rpm\\nenabled=1\\ngpgcheck=1\\ngpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-cloudflare\\n\" > /etc/yum.repos.d/cloudflare-warp.repo' && sudo dnf install -y cloudflare-warp",
  },
  {
    label: "Arch, CachyOS, Manjaro, EndeavourOS",
    command: "yay -S cloudflare-warp-bin || paru -S cloudflare-warp-bin",
  },
]

/** The error the deck last reported, plus the fixes that actually apply to it. */
export function HelpDialog(props: { message?: string; version?: string; requests?: RequestDiagnostic[] }) {
  const infinite = usePlatform().infinite
  const language = useLanguage()
  const [mode, setMode] = createSignal("")
  const [copied, setCopied] = createSignal("")
  const [note, setNote] = createSignal("")

  void infinite?.getMode().then(setMode)

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(""), 1500)
    } catch {
      setNote("Could not reach the clipboard. Select the text and copy it by hand.")
    }
  }

  const diagnostics = () =>
    [
      `OpenDeath ${props.version ?? ""}`.trim(),
      `Platform: ${navigator.userAgent}`,
      `Mode: ${mode() || "unknown"}`,
      `Last message: ${props.message || "none"}`,
      ...(props.requests ?? []).map((request) => JSON.stringify(request)),
      `Logs: %APPDATA%\\dev.opendeath.desktop\\logs (Windows), ~/.local/share/opencode (Linux)`,
    ].join("\n")

  return (
    <Show when={infinite}>
      <Dialog size="wide">
        <DialogHeader>
          <DialogTitleGroup
            title="Help"
            description="What is failing right now, and what to do about it. Nothing here is sent anywhere."
          />
        </DialogHeader>
        <DialogBody class="min-h-0">
          <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 px-6 pb-6 pt-2">
            <div class="rounded-xl border border-v2-border-border-muted bg-v2-background-bg-layer-01 px-4 py-3">
              <div class="text-13-medium text-v2-text-text-base">Right now</div>
              <div class="mt-1 text-13-regular text-v2-text-text-muted break-words">
                Mode {mode() || "unknown"}
                {props.message ? ` · ${props.message}` : " · no error reported"}
              </div>
            </div>

            <div class="rounded-xl border border-v2-border-border-muted bg-v2-background-bg-layer-01 px-4 py-3">
              <div class="text-13-medium text-v2-text-text-base">{language.t("connection.diagnosis.title")}</div>
              <p class="mt-1 text-13-regular text-v2-text-text-muted">
                {language.t(`connection.diagnosis.${connectionError(props.message ?? "")}`)}
              </p>
            </div>

            <section class="flex flex-col gap-2">
              <h3 class="text-13-medium text-v2-text-text-base">{language.t("connection.requests.title")}</h3>
              <p class="text-13-regular text-v2-text-text-muted">{language.t("connection.requests.scope")}</p>
              <Show when={props.requests?.length} fallback={<p>{language.t("connection.requests.empty")}</p>}>
                <For each={props.requests}>
                  {(request) => (
                    <div class="rounded-xl border border-v2-border-border-muted px-4 py-3 text-13-regular break-words">
                      <div class="text-v2-text-text-base">
                        {language.t(`connection.requests.${request.status}`)} · {new Date(request.at).toLocaleString()}
                      </div>
                      <div>
                        {language.t("connection.requests.model", {
                          model: request.model ?? "?",
                          provider: request.provider ?? "?",
                        })}
                      </div>
                      <Show when={request.attempt}>
                        {(attempt) => <div>{language.t("connection.requests.attempt", { attempt: attempt() })}</div>}
                      </Show>
                      <Show when={request.retryAt}>
                        {(at) => (
                          <div>
                            {language.t("connection.requests.retryAt", { time: new Date(at()).toLocaleString() })}
                          </div>
                        )}
                      </Show>
                      <Show when={request.error}>
                        <p class="mt-2">{request.error}</p>
                        <p class="mt-1 text-v2-text-text-muted">
                          {language.t(`connection.diagnosis.${connectionError(request.error ?? "")}`)}
                        </p>
                      </Show>
                      <Show when={request.status === "failed" || request.status === "retrying"}>
                        <p>
                          {request.resetAt && Number.isFinite(request.resetAt)
                            ? language.t("connection.requests.resetAt", {
                                time: new Date(request.resetAt).toLocaleString(),
                              })
                            : language.t("connection.requests.resetUnknown")}
                        </p>
                      </Show>
                    </div>
                  )}
                </For>
              </Show>
            </section>

            <For each={FIXES}>
              {(fix) => (
                <div class="rounded-xl border border-v2-border-border-muted bg-v2-background-bg-layer-01 px-4 py-3">
                  <div class="text-13-medium text-v2-text-text-base">{fix.title}</div>
                  <p class="mt-1 text-13-regular text-v2-text-text-muted">{fix.body}</p>
                  <Show when={fix.command}>
                    {(command) => (
                      <div class="mt-2 flex items-center gap-2">
                        <code class={code}>{command()}</code>
                        <button type="button" class={chip} onClick={() => void copy(command(), fix.title)}>
                          {copied() === fix.title ? "Copied" : "Copy"}
                        </button>
                      </div>
                    )}
                  </Show>
                </div>
              )}
            </For>

            <Show when={!windows}>
              <div class="rounded-xl border border-v2-border-border-muted bg-v2-background-bg-layer-01 px-4 py-3">
                <div class="text-13-medium text-v2-text-text-base">Linux</div>
                <p class="mt-1 text-13-regular text-v2-text-text-muted">
                  WARP ships for Linux as warp-cli, and the deck drives it the same way it does on Windows. Install it
                  for your distribution, then start the service once. Without WARP, Proxy and SOCKS5 work on their own.
                </p>
                <For each={LINUX_INSTALL}>
                  {(item) => (
                    <div class="mt-2">
                      <div class="mb-1 text-12-regular text-v2-text-text-faint">{item.label}</div>
                      <div class="flex items-center gap-2">
                        <code class={code}>{item.command}</code>
                        <button type="button" class={chip} onClick={() => void copy(item.command, item.label)}>
                          {copied() === item.label ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}
                </For>
                <div class="mt-3">
                  <div class="mb-1 text-12-regular text-v2-text-text-faint">After installing (any distribution)</div>
                  <div class="flex items-center gap-2">
                    <code class={code}>
                      sudo systemctl enable --now warp-svc && warp-cli --accept-tos registration new
                    </code>
                    <button
                      type="button"
                      class={chip}
                      onClick={() =>
                        void copy(
                          "sudo systemctl enable --now warp-svc && warp-cli --accept-tos registration new",
                          "linux-service",
                        )
                      }
                    >
                      {copied() === "linux-service" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                <p class="mt-3 text-13-regular text-v2-text-text-muted">
                  One command installs OpenDeath and the terminal CLI on Linux:
                </p>
                <div class="mt-1 flex items-center gap-2">
                  <code class={code}>curl -fsSL https://open.death.cl/downloads/install.sh | sh</code>
                  <button
                    type="button"
                    class={chip}
                    onClick={() =>
                      void copy("curl -fsSL https://open.death.cl/downloads/install.sh | sh", "linux-install")
                    }
                  >
                    {copied() === "linux-install" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </Show>

            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class={chip} onClick={() => void copy(diagnostics(), "diag")}>
                {copied() === "diag" ? "Copied" : "Copy diagnostics"}
              </button>
              <span class="text-12-regular text-v2-text-text-faint">
                Version, platform, mode, last error and the log path.
              </span>
            </div>

            <Show when={note()}>
              <div class="text-13-regular text-v2-state-fg-danger">{note()}</div>
            </Show>
          </div>
        </DialogBody>
      </Dialog>
    </Show>
  )
}
