import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * A panel sliding in from a side of the sheet. It doesn't block the rest of
 * the sheet (no backdrop), so HP and actions stay usable; on phones it fills
 * the screen. Escape closes it.
 */
export function SidePanel({
  side,
  title,
  onClose,
  children,
  header,
}: {
  side: 'left' | 'right'
  title: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  header?: React.ReactNode
}) {
  const { t } = useTranslation()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <aside
      className={`fixed inset-y-0 z-30 flex w-full flex-col bg-card shadow-2xl sm:w-[34rem] ${side === 'left' ? 'left-0 border-r' : 'right-0 border-l'} border-border`}
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <header className="border-b border-border p-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-semibold">{title}</h2>
          <button className="text-2xl leading-none text-muted" aria-label={t('close')} onClick={onClose}>
            ×
          </button>
        </div>
        {header}
      </header>
      <div className="flex-1 overflow-y-auto p-3">{children}</div>
    </aside>
  )
}

/**
 * Tall vertical tab on the edge of the sheet that opens a side panel
 * (desktop). Both read top to bottom; icon and arrow stay upright, the arrow
 * pointing to where the panel slides in from.
 */
export function EdgeHandle({ side, icon, label, onClick }: { side: 'left' | 'right'; icon: string; label: string; onClick: () => void }) {
  const arrow = side === 'left' ? '▸' : '◂'
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`fixed top-1/2 z-20 hidden min-h-64 w-9 -translate-y-1/2 flex-col items-center justify-center gap-2 border border-border bg-card py-5 text-sm font-semibold shadow-md hover:bg-accent hover:text-accent-text sm:flex ${side === 'left' ? 'left-0 rounded-r-card border-l-0' : 'right-0 rounded-l-card border-r-0'}`}
    >
      <span aria-hidden className="text-xs">{arrow}</span>
      <span aria-hidden className="text-base">{icon}</span>
      <span style={{ writingMode: 'vertical-rl' }} className="tracking-wide">
        {label}
      </span>
      <span aria-hidden className="text-xs">{arrow}</span>
    </button>
  )
}
