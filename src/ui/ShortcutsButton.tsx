import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** ⌨️ button in the header with the list of keyboard shortcuts. */
export function ShortcutsButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open])
  const items = t('shortcuts.items', { returnObjects: true }) as [string, string][]
  return (
    <div ref={ref} className="relative">
      <button
        className="rounded border border-border px-2 py-1 text-sm hover:bg-bg"
        aria-expanded={open}
        title={t('shortcuts.button')}
        aria-label={t('shortcuts.button')}
        onClick={() => setOpen(!open)}
      >
        ⌨️
      </button>
      {open && (
        <div role="dialog" aria-label={t('shortcuts.title')} className="absolute right-0 top-full z-40 mt-1 w-80 rounded-card border border-border bg-card p-3 text-sm shadow-lg">
          <p className="mb-2 font-semibold">⌨️ {t('shortcuts.title')}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            {items.map(([keys, what]) => (
              <div key={keys} className="contents">
                <dt>
                  <kbd className="whitespace-nowrap rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-xs">{keys}</kbd>
                </dt>
                <dd className="text-muted">{what}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
