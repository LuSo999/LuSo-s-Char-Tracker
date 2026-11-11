import { useRef } from 'react'
import type { ContentIndex } from '../../content'
import { ruleLink } from '../../content/links'
import type { Entity } from '../../content/schema'
import { useSettings } from '../../state/settings'
import { usePreview } from './preview'

const LONG_PRESS_MS = 500

/**
 * Wraps anything that comes from the rules. Holding Ctrl (Cmd on Mac)
 * highlights it and shows a preview next to the mouse; Ctrl+click opens the
 * rules page. On touch devices a long press opens the preview.
 */
export function RuleRef({
  entity,
  content,
  children,
  className = '',
}: {
  entity: Entity | undefined
  content: ContentIndex
  children: React.ReactNode
  className?: string
}) {
  const modifier = usePreview((s) => s.modifier)
  const site = useSettings((s) => s.linkSite)
  const pressTimer = useRef<number | undefined>(undefined)
  const longPressed = useRef(false)

  if (!entity) return <span className={className}>{children}</span>

  const show = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) usePreview.setState({ hover: { entity, content, x: e.clientX, y: e.clientY } })
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
        window.open(ruleLink(entity, content, site[entity.edition]), '_blank', 'noopener')
      }}
      onTouchStart={() => {
        longPressed.current = false
        pressTimer.current = window.setTimeout(() => {
          longPressed.current = true
          usePreview.setState({ pinned: { entity, content } })
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
