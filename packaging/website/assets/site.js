/* OpenDeath site — live download counter, then presentation.
   The count comes from /downloads.json, which the server updates from the
   download access log. It starts at 59 and survives redeploys. */

const COUNTER_URL = "/downloads.json"
const BASELINE = 59
const CACHE_KEY = "opendeath.downloads.v2"

function format(value) {
  return new Intl.NumberFormat("en-US").format(value)
}

function render(value) {
  document.querySelectorAll("[data-download-count]").forEach((element) => {
    element.textContent = format(value)
  })
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    if (typeof parsed.value !== "number" || typeof parsed.at !== "number") return undefined
    return parsed.value
  } catch {
    return undefined
  }
}

function writeCache(value) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ value, at: Date.now() }))
  } catch {
    /* storage can be disabled; the number still renders */
  }
}

async function refresh() {
  try {
    const response = await fetch(`${COUNTER_URL}?t=${Date.now()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (!response.ok) throw new Error(`Counter returned ${response.status}`)
    const payload = await response.json()
    const value = Number(payload.downloads)
    if (!Number.isFinite(value) || value < BASELINE) throw new Error("Unexpected counter payload")
    render(value)
    writeCache(value)
  } catch {
    /* Keep the cached value or the baseline. The page never blocks on the counter. */
    render(readCache() ?? BASELINE)
  }
}

render(readCache() ?? BASELINE)
void refresh()

let lastCheck = Date.now()
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return
  if (Date.now() - lastCheck < 60_000) return
  lastCheck = Date.now()
  void refresh()
})

/* Presentation: sticky header state, scroll meter fallback, card spotlight,
   and reveal-on-entry for people who accept motion. */

const header = document.querySelector(".site-header")
const meter = document.querySelector(".scroll-progress")
const nativeScrollTimeline =
  typeof CSS !== "undefined" && CSS.supports && CSS.supports("animation-timeline: scroll()")
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

let scrollQueued = false

function paintScroll() {
  scrollQueued = false
  const top = window.scrollY || document.documentElement.scrollTop || 0
  if (header) header.classList.toggle("is-scrolled", top > 8)
  if (meter && !nativeScrollTimeline) {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const ratio = max > 0 ? Math.min(1, Math.max(0, top / max)) : 0
    meter.style.transform = `scaleX(${ratio})`
  }
}

function queueScroll() {
  if (scrollQueued) return
  scrollQueued = true
  requestAnimationFrame(paintScroll)
}

window.addEventListener("scroll", queueScroll, { passive: true })
window.addEventListener("resize", queueScroll)
paintScroll()

if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
  document.querySelectorAll(".feature").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect()
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`)
      card.style.setProperty("--my", `${event.clientY - rect.top}px`)
    })
  })
}

if (!reduceMotion && "IntersectionObserver" in window) {
  const revealSelector = [
    ".section-head",
    ".feature",
    ".mode",
    ".download-card",
    ".step",
    ".table-wrap",
    ".panel",
    ".faq details",
    ".prose > h2",
    ".prose > h3",
    ".stats",
    ".manifesto blockquote",
    ".final-cta h2",
    ".final-cta .lede",
    ".final-cta .btn-row",
  ].join(",")

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add("is-visible")
        observer.unobserve(entry.target)
      }
    },
    { threshold: 0.06, rootMargin: "0px 0px -6% 0px" },
  )

  document.querySelectorAll(revealSelector).forEach((element) => {
    if (element.getBoundingClientRect().top < window.innerHeight * 0.92) return
    element.classList.add("reveal")
    observer.observe(element)
  })
}
