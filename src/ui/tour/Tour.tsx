// The guided tour overlay: one step at a time, the part of the page it talks about lit up (the
// rest dimmed) and a card with the text next to it. A step names its spots by data-tour="…"
// (several spots light up together; on a phone the first visible alternative is used); a step
// without a visible spot shows the card in the middle.
import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export type TourStep = {
  id: string
  /** data-tour names in order of preference (the first with something visible wins); a list lights up together. */
  spots?: (string | string[])[]
  title: string
  body: ReactNode
}

type Rect = { top: number; left: number; width: number; height: number }
const PAD = 6

const elements = (spot: string | string[]) => (Array.isArray(spot) ? spot : [spot]).flatMap((name) => [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)])

function findRect(spots: TourStep['spots']): Rect | undefined {
  for (const spot of spots ?? []) {
    const rects = elements(spot)
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
    if (!rects.length) continue
    const top = Math.min(...rects.map((r) => r.top))
    const left = Math.min(...rects.map((r) => r.left))
    const bottom = Math.max(...rects.map((r) => r.bottom))
    const right = Math.max(...rects.map((r) => r.right))
    return { top: top - PAD, left: left - PAD, width: right - left + 2 * PAD, height: bottom - top + 2 * PAD }
  }
  return undefined
}

function firstElement(spots: TourStep['spots']): HTMLElement | undefined {
  for (const spot of spots ?? []) {
    const el = elements(spot).find((e) => e.getBoundingClientRect().width > 0)
    if (el) return el
  }
  return undefined
}

export function Tour({ steps, onClose, finish }: { steps: TourStep[]; onClose: () => void; finish?: ReactNode }) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect>()
  const [, setTick] = useState(0)
  const step = steps[index]
  const last = index === steps.length - 1

  const measure = useCallback(() => setRect(findRect(step.spots)), [step])

  // Bring the spot into view, then measure (again once smooth scrolling is done).
  useLayoutEffect(() => {
    const el = firstElement(step.spots)
    // A tall spot (the action list) starts at its top; small ones go to the middle.
    el?.scrollIntoView({ block: el.getBoundingClientRect().height > window.innerHeight * 0.6 ? 'start' : 'center', behavior: 'smooth' })
    const timers = [0, 150, 400, 800].map((ms) => setTimeout(measure, ms))
    return () => timers.forEach(clearTimeout)
  }, [step, measure])

  useEffect(() => {
    const update = () => {
      measure()
      setTick((n) => n + 1)
    }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [measure])

  const go = (i: number) => setIndex(Math.max(0, Math.min(steps.length - 1, i)))
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === 'Enter') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  // The card: below the spot if there is room, else above, else (phones, big spots) at the bottom.
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cardW = Math.min(380, vw - 24)
  let cardStyle: React.CSSProperties
  if (!rect) cardStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: Math.min(460, vw - 24) }
  else if (vw < 640) {
    // Phones: the card at the bottom, or at the top when the spot is in the lower half.
    cardStyle = rect.top + rect.height / 2 > vh / 2 ? { top: 12, left: 12, right: 12 } : { bottom: 12, left: 12, right: 12 }
  } else {
    const left = Math.max(12, Math.min(vw - cardW - 12, rect.left + rect.width / 2 - cardW / 2))
    const below = rect.top + rect.height + 12
    if (below + 220 < vh) cardStyle = { top: below, left, width: cardW }
    else if (rect.top - 232 > 0) cardStyle = { top: rect.top - 12, left, width: cardW, transform: 'translateY(-100%)' }
    else cardStyle = { bottom: 12, left, width: cardW }
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={step.title}>
      {/* Clicks outside the card do nothing: the tour shows, the sheet stays as it is. */}
      <div className="absolute inset-0" />
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-accent transition-all duration-300"
          style={{ ...rect, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)' }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-black/55" />
      )}
      <div className="absolute max-h-[calc(100vh-24px)] overflow-y-auto rounded-xl border border-border bg-card p-4 text-sm text-text shadow-2xl" style={cardStyle}>
        <div className="mb-1 flex items-start gap-2">
          <h2 className="flex-1 font-heading text-base font-semibold">{step.title}</h2>
          <span className="text-xs text-muted">
            {index + 1} / {steps.length}
          </span>
        </div>
        <div className="space-y-2 text-sm leading-relaxed">{step.body}</div>
        {last && finish && <div className="mt-3">{finish}</div>}
        <div className="mt-4 flex items-center gap-2">
          <button className="text-xs text-muted hover:underline" onClick={onClose}>
            {last ? t('tour.close') : t('tour.skip')}
          </button>
          <span className="ml-auto" />
          {index > 0 && (
            <button className="rounded border border-border px-3 py-1 hover:bg-bg" onClick={() => go(index - 1)}>
              ‹ {t('tour.back')}
            </button>
          )}
          {!last && (
            <button autoFocus className="rounded bg-accent px-3 py-1 font-semibold text-accent-text" onClick={() => go(index + 1)}>
              {t('tour.next')} ›
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
