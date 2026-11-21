/* OpenDeath site — live download counter, then presentation.
   The count comes from /downloads.json, which the server updates from the
   download access log. It starts at 312 and survives redeploys and log rotation. */

const COUNTER_URL = "/downloads.json"
const BASELINE = 312
const CACHE_KEY = "opendeath.downloads.v4"

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
  // The highest number this browser has seen is the floor. An unreachable counter, a rotated log or a bad payload
  // must never make the public number go backwards to the baseline.
  const floor = Math.max(readCache() ?? 0, BASELINE)
  try {
    const response = await fetch(`${COUNTER_URL}?t=${Date.now()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (!response.ok) throw new Error(`Counter returned ${response.status}`)
    const payload = await response.json()
    const reported = Number(payload.downloads)
    if (!Number.isFinite(reported)) throw new Error("Unexpected counter payload")
    const value = Math.max(reported, floor)
    render(value)
    writeCache(value)
  } catch {
    /* Keep the highest cached value or the baseline. The page never blocks on the counter and never regresses. */
    render(floor)
    writeCache(floor)
  }
}

render(Math.max(readCache() ?? 0, BASELINE))
void refresh()

let lastCheck = Date.now()
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return
  if (Date.now() - lastCheck < 60_000) return
  lastCheck = Date.now()
  void refresh()
})

/* Presentation: sticky header, scroll meter, mobile nav, card spotlight,
   copy buttons, active docs section, and reveal-on-entry. */

const header = document.querySelector(".site-header")
const meter = document.querySelector(".scroll-progress")
const nav = document.querySelector(".nav")
const navToggle = document.querySelector(".nav-toggle")
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
const nativeScrollTimeline =
  typeof CSS !== "undefined" && CSS.supports && CSS.supports("animation-timeline: scroll()")

let scrollQueued = false

const tocLinks = new Map()
const tocHeadings = []
if (document.querySelector(".docs-nav")) {
  document.querySelectorAll(".docs-nav a[href^='#']").forEach((link) => {
    tocLinks.set(link.hash.slice(1), link)
  })
  document.querySelectorAll(".docs-body h2[id]").forEach((heading) => {
    if (tocLinks.has(heading.id)) tocHeadings.push(heading)
  })
}

function paintToc() {
  if (!tocHeadings.length) return
  const line = window.scrollY + 150
  let current = tocHeadings[0]
  for (const heading of tocHeadings) {
    if (heading.getBoundingClientRect().top + window.scrollY <= line) current = heading
  }
  tocLinks.forEach((link, id) => {
    link.classList.toggle("is-active", id === current.id)
  })
}

function paintScroll() {
  scrollQueued = false
  const top = window.scrollY || document.documentElement.scrollTop || 0
  if (header) header.classList.toggle("is-scrolled", top > 8)
  if (meter && !nativeScrollTimeline) {
    const max = document.documentElement.scrollHeight - window.innerHeight
    const ratio = max > 0 ? Math.min(1, Math.max(0, top / max)) : 0
    meter.style.transform = `scaleX(${ratio})`
  }
  paintToc()
}

function queueScroll() {
  if (scrollQueued) return
  scrollQueued = true
  requestAnimationFrame(paintScroll)
}

window.addEventListener("scroll", queueScroll, { passive: true })
window.addEventListener("resize", queueScroll)
paintScroll()

function closeNav() {
  if (!nav || !navToggle) return
  nav.classList.remove("is-open")
  navToggle.setAttribute("aria-expanded", "false")
  navToggle.setAttribute("aria-label", "Open navigation")
}

if (nav && navToggle) {
  navToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open")
    navToggle.setAttribute("aria-expanded", String(open))
    navToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation")
  })
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav))
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNav()
  })
  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target) && !navToggle.contains(event.target)) closeNav()
  })
}

if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
  document.querySelectorAll(".feature, .mode, .download-card").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect()
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`)
      card.style.setProperty("--my", `${event.clientY - rect.top}px`)
    })
  })

  const stage = document.querySelector(".hero-stage")
  if (stage) {
    stage.addEventListener("pointermove", (event) => {
      const rect = stage.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width - 0.5
      const y = (event.clientY - rect.top) / rect.height - 0.5
      stage.style.setProperty("--tilt-x", `${y * -2.4}deg`)
      stage.style.setProperty("--tilt-y", `${x * 3.2}deg`)
    })
    stage.addEventListener("pointerleave", () => {
      stage.style.setProperty("--tilt-x", "0deg")
      stage.style.setProperty("--tilt-y", "0deg")
    })
  }
}

document.querySelectorAll("pre").forEach((pre) => {
  if (!pre.querySelector("code") || pre.querySelector(".copy-btn")) return
  const button = document.createElement("button")
  button.type = "button"
  button.className = "copy-btn"
  button.textContent = "Copy"
  button.addEventListener("click", async () => {
    const text = pre.querySelector("code").innerText
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const field = document.createElement("textarea")
      field.value = text
      field.style.position = "fixed"
      field.style.opacity = "0"
      document.body.appendChild(field)
      field.select()
      document.execCommand("copy")
      field.remove()
    }
    button.textContent = "Copied"
    button.classList.add("is-copied")
    window.setTimeout(() => {
      button.textContent = "Copy"
      button.classList.remove("is-copied")
    }, 1800)
  })
  pre.appendChild(button)
})

if (!reduceMotion && "IntersectionObserver" in window) {
  const revealSelector = [
    ".section-head",
    ".feature",
    ".mode",
    ".download-card",
    ".step",
    ".table-wrap",
    ".faq details",
    ".prose > h2",
    ".prose > h3",
    ".stats",
    ".manifesto blockquote",
    ".final-cta h2",
    ".final-cta .lede",
    ".final-cta .btn-row",
    ".docs-nav",
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
