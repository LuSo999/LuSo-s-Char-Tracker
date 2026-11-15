// Global state for the rule preview: whether Ctrl/Cmd is held and what is shown.
import { create } from 'zustand'
import type { ContentIndex } from '../../content'
import type { Entity } from '../../content/schema'
import type { HelpId } from '../homebrew/help/text.en'

export type PreviewTarget = { entity: Entity; content: ContentIndex }
/** A homebrew editor help topic (what a field does, with examples from the content). */
export type HelpTarget = { help: HelpId; title: string; content?: ContentIndex }
export type AnyTarget = PreviewTarget | HelpTarget
export const isHelp = (t: AnyTarget): t is HelpTarget => 'help' in t

type PreviewState = {
  modifier: boolean
  /** Floating preview next to the mouse (desktop). */
  hover?: AnyTarget & { x: number; y: number }
  /** Full-screen preview (long press on touch devices). */
  pinned?: AnyTarget
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
