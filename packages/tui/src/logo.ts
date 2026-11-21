// The terminal wordmark. "open" stays muted, "death" is drawn at full strength, so the splash reads as one mark.
export const logo = {
  left: [
    "                   ",
    "█▀▀█ █▀▀█ █▀▀█ █▀▀▄",
    "█__█ █__█ █^^^ █__█",
    "▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀~~▀",
  ],
  right: [
    "                        ",
    "█▀▀▄ █▀▀█ █▀▀█ ▀█▀▀ █__█",
    "█__█ █^^^ █▀▀█ _█__ █▀▀█",
    "▀▀▀▀ ▀▀▀▀ ▀▀▀▀ _▀▀▀ ▀__▀",
  ],
}

// Narrow terminals get a two-letter mark instead of a wrapped wordmark.
export const od = {
  left: ["    ", "█▀▀█", "█__█", "▀▀▀▀"],
  right: ["    ", "█▀▀▄", "█__█", "▀▀▀▀"],
}

// OpenCode Go keeps its own mark; it is a provider, not the product.
export const go = {
  left: ["    ", "█▀▀▀", "█_^█", "▀▀▀▀"],
  right: ["    ", "█▀▀█", "█__█", "▀▀▀▀"],
}
