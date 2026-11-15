import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { usePreview } from '../../rules/preview'
import { useHelpContent } from './context'
import type { HelpId } from './text.en'

const LONG_PRESS_MS = 500

/**
 * Wraps a label or option of the homebrew editor. Holding Ctrl (Cmd on Mac) highlights it and
 * shows what it does with examples from the rules; Ctrl+click (or a long press) pins the help,
 * where the examples can be opened and copied.
 */
export function Help({ id, title, children, className = '' }: { id: HelpId; title: string; children: React.ReactNode; className?: string }) {
  const modifier = usePreview((s) => s.modifier)
  const content = useHelpContent()
  const pressTimer = useRef<number | undefined>(undefined)
  const longPressed = useRef(false)
  const show = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) usePreview.setState({ hover: { help: id, title, content, x: e.clientX, y: e.clientY } })
  }
  return (
    <span
      className={`${className} ${modifier ? 'cursor-help rounded underline decoration-accent decoration-2 underline-offset-2' : ''}`}
      onMouseEnter={show}
      onMouseMove={show}
      onMouseLeave={() => usePreview.setState({ hover: undefined })}
      onClickCapture={(e) => {
        if (longPressed.current) {
          longPressed.current = false
          e.preventDefault()
          e.stopPropagation()
          return
        }
        if (!(e.ctrlKey || e.metaKey)) return
        e.preventDefault()
        e.stopPropagation()
        usePreview.setState({ pinned: { help: id, title, content }, hover: undefined })
      }}
      onTouchStart={() => {
        longPressed.current = false
        pressTimer.current = window.setTimeout(() => {
          longPressed.current = true
          usePreview.setState({ pinned: { help: id, title, content } })
        }, LONG_PRESS_MS)
      }}
      onTouchEnd={() => window.clearTimeout(pressTimer.current)}
      onTouchMove={() => window.clearTimeout(pressTimer.current)}
      onContextMenu={(e) => longPressed.current && e.preventDefault()}
    >
      {children}
    </span>
  )
}

/** A small ⓘ that opens the same help without Ctrl (touch, and for those who don't know the trick). */
export function HelpButton({ id, title }: { id: HelpId; title: string }) {
  const { t } = useTranslation()
  const content = useHelpContent()
  return (
    <button
      type="button"
      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-border align-middle text-[10px] leading-none text-muted hover:border-accent hover:text-accent"
      aria-label={t('homebrew.help.open', { what: title })}
      title={t('homebrew.help.open', { what: title })}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        usePreview.setState({ pinned: { help: id, title, content }, hover: undefined })
      }}
    >
      i
    </button>
  )
}
