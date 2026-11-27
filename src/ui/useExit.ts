// Keeps an overlay mounted for a moment after it is closed, so it can animate out.
import { createContext, useContext, useEffect, useState } from 'react'
import { motionAllowed } from './fx/fx'

/** How long the exit animation runs (shorter than the entrance on purpose). */
export const EXIT_MS = 200

/**
 * `show` is the parent's "open" state. Returns `mounted` (render it) and `closing`
 * (it is on its way out: play the exit animation, ignore clicks).
 */
export function useExit(show: boolean, ms = EXIT_MS) {
  const [mounted, setMounted] = useState(show)
  if (show && !mounted) setMounted(true)
  useEffect(() => {
    if (show || !mounted) return
    const timer = window.setTimeout(() => setMounted(false), motionAllowed() ? ms : 0)
    return () => window.clearTimeout(timer)
  }, [show, mounted, ms])
  return { mounted: show || mounted, closing: !show && mounted }
}

/** Tells a panel deep inside (SidePanel, the history drawer) that it is closing. */
export const ClosingContext = createContext(false)
export const useClosing = () => useContext(ClosingContext)
