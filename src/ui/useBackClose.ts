// The browser's Back button closes the topmost open panel or dialog first; only with
// nothing open does it leave the page (e.g. from the sheet to the character list).
import { useEffect, useRef } from 'react'

let nextId = 1
// Open overlays, oldest first; each owns one history entry pushed when it opened.
const stack: { id: number; close: () => void }[] = []
// Set while we step back ourselves (an overlay closed by its own button), so that pop isn't "Back".
let selfBack = 0
let pendingDrop: { id: number; timer: ReturnType<typeof setTimeout> } | undefined

const ownEntry = (id: number) => (window.history.state as { overlay?: number } | null)?.overlay === id

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (selfBack > 0) {
      selfBack--
      return
    }
    // Back: close every overlay whose entry is no longer the current one (normally just the top).
    while (stack.length && !ownEntry(stack[stack.length - 1].id)) stack.pop()!.close()
  })
}

/** Call in a component that is mounted while its overlay is open. */
export function useBackClose(onClose: () => void) {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    // An overlay opening right after another one closed (switching panels, or React's dev
    // double mount) takes over that entry instead of leaving a stray one in the history.
    let id: number
    if (pendingDrop && ownEntry(pendingDrop.id)) {
      clearTimeout(pendingDrop.timer)
      id = pendingDrop.id
    } else {
      id = nextId++
      // Keep the router's own state (its index) so it sees the same location on Back.
      window.history.pushState({ ...(window.history.state as object | null), overlay: id }, '')
    }
    pendingDrop = undefined
    const entry = { id, close: () => close.current() }
    stack.push(entry)
    return () => {
      const i = stack.indexOf(entry)
      if (i < 0) return // already closed by Back
      stack.splice(i, 1)
      // Closed by its own button: drop its history entry too, unless the page moved on meanwhile.
      const timer = setTimeout(() => {
        pendingDrop = undefined
        if (ownEntry(id)) {
          selfBack++
          window.history.back()
        }
      }, 400)
      pendingDrop = { id, timer }
    }
  }, [])
}

/** For overlays rendered inline: mount it while the overlay is open. */
export function BackClose({ onClose }: { onClose: () => void }) {
  useBackClose(onClose)
  return null
}
