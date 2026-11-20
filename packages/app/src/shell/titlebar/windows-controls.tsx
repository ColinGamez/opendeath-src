import { Show } from "solid-js"
import { usePlatform } from "@/runtime/platform/platform"

// opendeath: the window draws its own caption buttons.
//
// The native `titleBarOverlay` cannot be made see-through on Windows: the OS paints the caption
// area itself, so even `#00000000` lands as a solid strip beside a transparent titlebar. Removing
// the overlay and drawing the three buttons here means the whole top row is one surface — the
// titlebar's own — and the strip can be transparent, tinted, or covered by a background picture.

const BUTTON =
  "relative grid h-full w-[46px] shrink-0 place-items-center [app-region:no-drag] text-v2-icon-icon-muted transition-colors duration-100"

// Windows 11 draws 10px glyphs with a 1px stroke; these paths are the same shapes, so they render
// identically on Windows 10, where the Fluent icon font is not installed.
function MinimizeGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0 5.5h10" stroke="currentColor" stroke-width="1" fill="none" />
    </svg>
  )
}

function MaximizeGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" stroke-width="1" fill="none" />
    </svg>
  )
}

function RestoreGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect x="0.5" y="2.5" width="7" height="7" stroke="currentColor" stroke-width="1" fill="none" />
      <path d="M2.5 2.5v-2h7v7h-2" stroke="currentColor" stroke-width="1" fill="none" />
    </svg>
  )
}

function CloseGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" stroke-width="1" fill="none" />
    </svg>
  )
}

/** The three caption buttons, pinned to the physical right of the titlebar on Windows desktop. */
export function WindowsCaptionButtons() {
  const platform = usePlatform()
  const visible = () => platform.platform === "desktop" && platform.os === "windows"
  const maximized = () => platform.windowMaximized?.() === true

  return (
    <Show when={visible()}>
      <div
        data-slot="windows-caption-buttons"
        class="absolute inset-y-0 end-0 flex items-stretch [app-region:no-drag]"
        // The strip is part of the titlebar, so it must not intercept the drag region around it.
        aria-label="Window controls"
      >
        <button
          type="button"
          class={`${BUTTON} hover:bg-v2-overlay-simple-overlay-hover`}
          aria-label="Minimize"
          title="Minimize"
          onClick={() => platform.minimizeWindow?.()}
        >
          <MinimizeGlyph />
        </button>
        <button
          type="button"
          class={`${BUTTON} hover:bg-v2-overlay-simple-overlay-hover`}
          aria-label={maximized() ? "Restore" : "Maximize"}
          title={maximized() ? "Restore" : "Maximize"}
          onClick={() => void platform.toggleMaximizeWindow?.()}
        >
          {maximized() ? <RestoreGlyph /> : <MaximizeGlyph />}
        </button>
        <button
          type="button"
          class={`${BUTTON} hover:bg-[#c42b1c] hover:text-white`}
          aria-label="Close"
          title="Close"
          onClick={() => platform.closeWindow?.()}
        >
          <CloseGlyph />
        </button>
      </div>
    </Show>
  )
}
