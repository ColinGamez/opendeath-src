import { Effect } from "effect"
import { InfiniteRpcs } from "../../shared/ipc-rpc/infinite"
import {
  applyMode,
  archiveAuth,
  cancelHunt,
  checkIp,
  clearBurned,
  fetchList,
  getMode,
  getOptions,
  autoStatus,
  huntIp,
  leaveMode,
  lock,
  restoreSession,
  pending,
  clearWaiting,
  waitForIp,
  promptSession,
  resumeSession,
  rotateOnly,
  setMode,
  warpUsesTunnel,
  setOptions,
  startWatch,
  type Result,
} from "../infinite/infinite"
import { voiceTyping } from "../infinite/dictate"
import { install, plan } from "../infinite/install"
import { bringUpRoute64, importRoute64, removeRoute64, route64Status } from "../infinite/route64"
import { BackgroundService, customChannelFile, registrationFile } from "../service/background-service"
import { DesktopCli } from "../service/desktop-cli"

export const infiniteHandlers = InfiniteRpcs.toLayer(
  Effect.gen(function* () {
    const background = yield* BackgroundService.Service
    const desktopCli = yield* DesktopCli.Service
    const runFork = Effect.runForkWith(yield* Effect.context())

    // This CLI registers under its own channel name, so stopping must look in that file, not the default one.
    const stopService = Effect.gen(function* () {
      const cli = yield* desktopCli.resolve
      yield* Effect.tryPromise(async () => {
        const client = await import("@opencode/client/service")
        await client.Service.stop({ file: registrationFile() ?? customChannelFile(cli.version) })
      })
    }).pipe(
      // A service that will not stop must not hold the action lock for the rest of the session.
      Effect.timeoutOrElse({ duration: 15_000, orElse: () => Effect.void }),
      Effect.catch(() => Effect.void),
    )
    const startService = Effect.asVoid(background.reconnect).pipe(
      Effect.timeoutOrElse({ duration: 30_000, orElse: () => Effect.void }),
      Effect.catch(() => Effect.void),
    )

    // The service reads its proxy environment only when it starts. Where the proxy URL is already known (WARP,
    // None) it starts while the network work runs, instead of after it.
    const withService = (network: () => Promise<Result>) =>
      Effect.gen(function* () {
        // The service only ever sees a local address (the door or a bridge), so it starts while the network work runs.
        const [result] = yield* Effect.all([Effect.tryPromise(network), startService], { concurrency: 2 })
        return result
      })

    // One action at a time: the lock is taken before anything is stopped. Every action also has a ceiling, so a
    // child process or a service that will not answer can never keep the lock for the rest of the session.
    let running: string | undefined
    const guarded = (name: string, budget: number, body: Effect.Effect<Result, unknown>): Effect.Effect<Result> =>
      Effect.gen(function* () {
        // A hunt asks for its stop before a manual action arrives, so the wait here is short: four seconds covers a
        // rotation that is already mid-flight without leaving the click spinning.
        let release: (() => void) | undefined
        for (let i = 0; i < 16; i++) {
          release = lock()
          if (release) break
          yield* Effect.sleep("250 millis")
        }
        if (!release) return { ok: false, message: `Busy: ${running ?? "an IP check"} is still running.` }
        running = name
        return yield* body.pipe(
          Effect.timeoutOrElse({
            duration: budget,
            orElse: () => Effect.succeed<Result>({ ok: false, message: `${name} took too long and was stopped.` }),
          }),
          Effect.catch((error) =>
            Effect.succeed<Result>({ ok: false, message: error instanceof Error ? error.message : String(error) }),
          ),
          Effect.ensuring(
            Effect.sync(() => {
              running = undefined
              release?.()
            }),
          ),
        )
      })

    const setModeFlow = (mode: Parameters<typeof applyMode>[0]) => {
      // A manual mode change wins over a running auto-rotate.
      cancelHunt()
      return guarded(
        `Switching to ${mode}`,
        180_000,
        Effect.gen(function* () {
          const previous = getMode()
          yield* stopService
          yield* Effect.tryPromise(() => setMode(mode))
          // Leaving Route64 takes its tunnel down; leaving Mullvad or Windscribe disconnects that client.
          yield* Effect.tryPromise(() => leaveMode(previous, mode))
          const result = yield* withService(() => applyMode(mode))
          // A client without proxy mode carries the traffic in its tunnel; the service has to restart direct behind it,
          // because it read the proxy environment before that was known.
          if (result.ok && mode === "WARP" && warpUsesTunnel()) {
            yield* stopService
            yield* startService
          }
          if (result.ok) return result
          // A mode whose proxy never came up must not stay saved: the service would talk to a dead port and every
          // request would fail with ECONNRESET. Put the saved mode back to direct and restart the service on it.
          yield* Effect.tryPromise(() => setMode("NONE"))
          yield* stopService
          yield* startService
          return result
        }),
      )
    }

    // "Reset limit": archive the session, renew the IP, put the session back. A failed rotation must never leave the
    // user signed out, which is what made this button feel broken: the archive happened, the restore never did.
    const resetFlow = () => {
      // A click wins over a running hunt, exactly like a mode change.
      cancelHunt()
      return guarded(
        "Resetting the session",
        300_000,
        Effect.gen(function* () {
          yield* stopService
          const archived = yield* Effect.tryPromise(archiveAuth)
          const net = yield* Effect.tryPromise(rotateOnly)
          // Put the session back either way, before the service starts again, so the app is never left signed out.
          const back = archived ? yield* Effect.tryPromise(restoreSession) : { ok: false, message: "No session found." }
          yield* startService
          const kept = archived ? (back.ok ? "Signed in again." : back.message) : "No session was archived."
          return {
            ...net,
            message: net.ok
              ? `Session reset on ${net.ip ?? "a new IP"}. ${kept}`
              : `No new IP: ${net.message}. ${kept} Try Proxy, or open Help.`,
          }
        }),
      )
    }

    const restoreFlow = () => {
      cancelHunt()
      return guarded(
        "Restoring the session",
        90_000,
        Effect.gen(function* () {
          yield* stopService
          const result = yield* Effect.tryPromise(restoreSession)
          yield* startService
          return result
        }),
      )
    }

    // Auto-rotate keeps the session. WARP keeps the same local proxy, so it rotates without a restart.
    // The IPs are tried on throwaway probe sessions; the chat is only touched once one works.
    const autoRotate = (sessionID: string) =>
      guarded(
        "Auto-rotate",
        240_000,
        Effect.gen(function* () {
          const started = Date.now()
          const cli = yield* desktopCli.resolve
          const net = yield* Effect.tryPromise(() => huntIp(cli.command))
          if (!net.ok) return net
          // Same as a manual switch: a tunnel-mode WARP leaves the service direct, and it has to be restarted to see it.
          if (getMode() === "WARP" && warpUsesTunnel()) {
            yield* stopService
            yield* startService
          }
          // Every chat that is waiting gets "continue" on this one new IP, in parallel.
          if (sessionID) waitForIp(sessionID)
          const chats = [...pending]
          clearWaiting()
          const seconds = ((Date.now() - started) / 1000).toFixed(1)
          if (!chats.length) {
            autoStatus(`new IP ${net.ip ?? ""} works in ${seconds}s, no chat to continue`, true)
            return net
          }
          autoStatus(`new IP ${net.ip ?? ""} works, sending "continue" to ${chats.length} chat(s)…`)
          const results = yield* Effect.promise(() =>
            Promise.all(chats.map((id) => resumeSession(id).catch(() => false))),
          )
          const sent = results.filter(Boolean).length
          // Timing of the whole rotation, for checking the 3-5 s target in logs.
          console.info(`[auto-rotate] ${chats.length} chat(s) continued in ${seconds}s (${sent} sent)`)
          autoStatus(
            sent === chats.length
              ? `new IP ${net.ip ?? ""} in ${seconds}s, "continue" sent to ${sent} chat(s)`
              : `new IP ${net.ip ?? ""} in ${seconds}s, "continue" sent to ${sent} of ${chats.length} chat(s): send the rest yourself`,
            true,
          )
          return net
        }),
      )

    // Failed hunts in a row. The chats stay waiting and are retried a little later, then reported for the user.
    let failedHunts = 0
    const trigger = startWatch((sessionID) =>
      void runFork(
        autoRotate(sessionID).pipe(
          Effect.tap((net) =>
            Effect.sync(() => {
              if (net.ok) {
                failedHunts = 0
                // A chat that reached the limit while this rotation was resuming the others starts its own rotation.
                if (pending.size) trigger("chats waiting")
                return
              }
              if (!pending.size) return
              if (failedHunts < 3) {
                failedHunts++
                autoStatus(`no working IP (${net.message}), retrying in 60 s (${failedHunts}/3)`)
                setTimeout(() => trigger("retry after a failed IP"), 60_000)
                return
              }
              failedHunts = 0
              autoStatus(`no working IP after 3 tries: send "continue" yourself in ${pending.size} chat(s)`, true)
              clearWaiting()
            }),
          ),
        ),
      ),
      // The chat is retrying the free limit itself: only the IP changes (the old one is remembered as used), no probe.
      () =>
        void runFork(
          guarded(
            "Changing the IP",
            120_000,
            Effect.gen(function* () {
              const started = Date.now()
              const net = yield* Effect.tryPromise(rotateOnly)
              const seconds = ((Date.now() - started) / 1000).toFixed(1)
              autoStatus(
                net.ok ? `new IP ${net.ip ?? ""} in ${seconds}s, the chat resends on it` : `IP change failed: ${net.message}`,
                true,
              )
              return net
            }),
          ),
        ),
    )

    return InfiniteRpcs.of({
      InfiniteGetMode: () => Effect.sync(getMode),
      InfiniteSetMode: ({ mode }) => setModeFlow(mode),
      InfiniteResetLimit: resetFlow,
      InfiniteRestoreSession: restoreFlow,
      // A manual click: runs even when the Auto-rotate checkbox is off, because the click itself is the intent.
      // The button sends no session id; the renderer always sends one. Only the button outranks a running hunt,
      // otherwise a limit event echoed by the renderer would cancel the rotation it just asked for.
      InfiniteAutoRotate: ({ sessionID }) =>
        Effect.sync(() => {
          if (!sessionID) cancelHunt()
          trigger("limit reached", sessionID, false, true)
        }),
      InfiniteSendPrompt: ({ sessionID, text }) =>
        Effect.promise(() =>
          promptSession(sessionID, text).then((ok) => ({
            ok,
            message: ok ? "Jailbreak sent." : "The chat did not take the prompt. Open a chat and try again.",
          })),
        ),
      InfiniteFetchList: ({ url }) => Effect.promise(() => fetchList(url)),
      InfiniteDictate: () => Effect.promise(voiceTyping),
      InfiniteClearBurned: () => Effect.promise(clearBurned),
      InfiniteCheckIp: () => Effect.promise(checkIp),
      InfiniteGetOptions: () => Effect.sync(getOptions),
      InfiniteSetOptions: (options) => Effect.promise(() => setOptions(options).then(getOptions)),
      InfiniteToolPlan: ({ tool }) => Effect.promise(() => plan(tool)),
      InfiniteToolInstall: ({ tool, confirmed }) => Effect.promise(() => install(tool, confirmed)),
      InfiniteRoute64Import: ({ text }) => Effect.promise(() => importRoute64(text)),
      InfiniteRoute64Status: () => Effect.promise(route64Status),
      InfiniteRoute64Up: () => Effect.promise(bringUpRoute64),
      InfiniteRoute64Remove: () => Effect.promise(removeRoute64),
    })
  }),
)
