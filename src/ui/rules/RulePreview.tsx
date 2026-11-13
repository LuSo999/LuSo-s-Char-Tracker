import { useTranslation } from 'react-i18next'
import { linkSiteLabels, ruleLink } from '../../content/links'
import type { Entity } from '../../content/schema'
import { useSettings } from '../../state/settings'
import { usePreview, type PreviewTarget } from './preview'
import { BackClose } from '../useBackClose'
import { viewCreature } from '../../engine/creatures'
import { StatBlock } from '../creatures/StatBlock'

const WIDTH = 420
const MAX_HEIGHT = 420

/** Renders SRD text: paragraphs, **bold** and simple markdown tables. */
export function RuleText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}|\n(?=\*\*)|\n(?=\|)/)
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((b, i) =>
        b.trim().startsWith('|') ? (
          <pre key={i} className="overflow-x-auto text-xs">
            {b.trim()}
          </pre>
        ) : (
          <p key={i}>
            {b.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
              part.startsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : <span key={j}>{part}</span>,
            )}
          </p>
        ),
      )}
    </div>
  )
}

function typeLabel(e: Entity) {
  if (e.type === 'item') return e.magic ? `magic ${e.kind}` : e.kind
  if (e.type === 'feat' && e.category) return `${e.category} feat`
  return e.type
}

function PreviewBody({ target }: { target: PreviewTarget }) {
  const { t } = useTranslation()
  const site = useSettings((s) => s.linkSite)
  const { entity, content } = target
  const pack = content.pack(entity.id)
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="font-heading text-lg font-semibold">{entity.name}</h3>
        <span className="text-xs text-muted">{typeLabel(entity)}</span>
        {entity.isNew && <span className="rounded bg-accent px-1.5 text-[10px] font-semibold uppercase text-accent-text">new</span>}
        {!entity.verified && <span className="rounded border border-danger px-1.5 text-[10px] text-danger">{t('rules.unverified')}</span>}
        {content.isCustomized(entity.id) && <span className="rounded border border-accent px-1.5 text-[10px] text-accent">✎ {t('rules.customized')}</span>}
      </div>
      <div className="mt-2">
        {/* Stat blocks preview as stat blocks (scaled spirits keep their summary: their numbers need a slot level). */}
        {entity.type === 'creature' && !entity.tags.includes('summon') && !entity.tags.includes('companion') ? (
          <StatBlock view={viewCreature(entity, {})} />
        ) : (
          <RuleText text={entity.text ?? entity.description} />
        )}
      </div>
      {/search[:?/]/.test(ruleLink(entity, content, site[entity.edition])) && <p className="mt-2 text-xs text-muted">🔎 {t('rules.noDirectLink')}</p>}
      <p className="mt-3 border-t border-border pt-2 text-xs text-muted">
        {pack?.name ?? entity.source.book} · {t('rules.openHint', { site: entity.source.url ? new URL(entity.source.url).host : linkSiteLabels[site[entity.edition]][entity.edition] })}
      </p>
      <a className="sr-only" href={ruleLink(entity, content, site[entity.edition])} target="_blank" rel="noopener">
        {t('rules.open')}
      </a>
    </>
  )
}

/** Floating preview near the mouse while Ctrl is held. */
export function RulePreview() {
  const hover = usePreview((s) => s.hover)
  const modifier = usePreview((s) => s.modifier)
  if (!hover || !modifier) return null
  const left = Math.max(8, Math.min(hover.x + 16, window.innerWidth - WIDTH - 8))
  const below = hover.y + 16 + MAX_HEIGHT < window.innerHeight
  const top = below ? hover.y + 16 : Math.max(8, hover.y - 16 - MAX_HEIGHT)
  return (
    <div
      className="pointer-events-none fixed z-50 overflow-hidden rounded-card border border-border bg-card p-4 shadow-xl"
      style={{ left, top, width: WIDTH, maxHeight: MAX_HEIGHT }}
      role="tooltip"
    >
      <PreviewBody target={hover} />
    </div>
  )
}

/** Full-screen preview opened by a long press on touch devices. */
export function PinnedPreview() {
  const { t } = useTranslation()
  const pinned = usePreview((s) => s.pinned)
  const site = useSettings((s) => s.linkSite)
  if (!pinned) return null
  const close = () => usePreview.setState({ pinned: undefined })
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center" onClick={close}>
      <BackClose onClose={close} />
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-card border border-border bg-card p-5 sm:max-w-lg sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <PreviewBody target={pinned} />
        <div className="mt-4 flex gap-2">
          <a
            className="rounded bg-accent px-4 py-2 font-medium text-accent-text"
            href={ruleLink(pinned.entity, pinned.content, site[pinned.entity.edition])}
            target="_blank"
            rel="noopener"
          >
            {t('rules.open')}
          </a>
          <button className="rounded border border-border px-4 py-2" onClick={close}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}
