import { createSignal } from "solid-js"
import { api } from "../api"

// The renderer draws the caption buttons, so it owns their state: the middle button is a "restore"
// glyph while the window is maximized and a "maximize" glyph otherwise. Main reports every change,
// including a double click on the drag strip, which never reaches the button itself.
const [windowMaximized, setWindowMaximized] = createSignal(false)

api.onWindowMaximizedChanged(setWindowMaximized)

void api.getWindowMaximized().then(setWindowMaximized, () => setWindowMaximized(false))

export { windowMaximized }
