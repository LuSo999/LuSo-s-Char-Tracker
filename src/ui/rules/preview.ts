// Global state for the rule preview: whether Ctrl/Cmd is held and what is shown.
import { create } from 'zustand'
import type { ContentIndex } from '../../content'
import type { Entity } from '../../content/schema'

export type PreviewTarget = { entity: Entity; content: ContentIndex }

type PreviewState = {
  modifier: boolean
  /** Floating preview next to the mouse (desktop). */
  hover?: PreviewTarget & { x: number; y: number }
  /** Full-screen preview (long press on touch devices). */
  pinned?: PreviewTarget
}

export const usePreview = create<PreviewState>(() => ({ modifier: false }))

const isModifier = (e: KeyboardEvent | MouseEvent) => e.ctrlKey || e.metaKey

if (typeof window !== 'undefined') {
  const update = (e: KeyboardEvent) => {
    const modifier = isModifier(e)
    if (modifier !== usePreview.getState().modifier) usePreview.setState({ modifier, ...(modifier ? {} : { hover: undefined }) })
  }
  window.addEventListener('keydown', update)
  window.addEventListener('keyup', update)
  // Releasing Ctrl outside the window (e.g. after Ctrl+click opened a tab) would leave it "held".
  window.addEventListener('blur', () => usePreview.setState({ modifier: false, hover: undefined }))
  window.addEventListener('mousemove', (e) => {
    const modifier = isModifier(e)
    if (modifier !== usePreview.getState().modifier) usePreview.setState({ modifier, ...(modifier ? {} : { hover: undefined }) })
  })
}
