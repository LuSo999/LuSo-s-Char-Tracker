import { useOfficial } from '../../state/official'
import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'

type Toggle = { on: boolean; onChange: (on: boolean) => void }

/**
 * Which books' content a character may use (SRD is always on). An empty list
 * means every official book except unofficial / playtest ones. For 5.5e
 * characters also: 2014 subclasses, and 2014 species and feats.
 */
export function BooksPicker({
  content,
  books,
  onChange,
  legacy,
  legacyOrigins,
}: {
  content: ContentIndex
  books: string[]
  onChange: (books: string[]) => void
  legacy?: Toggle
  legacyOrigins?: Toggle
}) {
  const { t } = useTranslation()
  const official = useOfficial()
  const all = content.withLegacySubclasses(!!legacy?.on, !!legacyOrigins?.on).books()
  const box = (o: Toggle | undefined, label: string, hint: string) =>
    o && (
      <label className="mb-2 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={o.on} onChange={(e) => o.onChange(e.target.checked)} />
        <span>
          {label}
          <span className="block text-xs text-muted">{hint}</span>
        </span>
      </label>
    )
  const legacyBoxes = content.edition === '2024' && (
    <>
      {box(legacy, t('books.legacy'), t('books.legacyHint'))}
      {box(legacyOrigins, t('books.legacyOrigins'), t('books.legacyOriginsHint'))}
    </>
  )
  if (!all.length)
    return (
      <>
        {legacyBoxes}
        <p className="text-xs text-muted">{official.status === 'noAccess' ? t('content.noAccess') : official.status === 'error' ? t('content.error', { message: official.error }) : t('books.none')}</p>
      </>
    )
  const on = (id: string, defaultOff: boolean) => (books.length ? books.includes(id) : !defaultOff)
  const toggle = (id: string) => {
    const current = all.filter((b) => on(b.id, b.defaultOff)).map((b) => b.id)
    onChange(current.includes(id) ? current.filter((x) => x !== id) : [...current, id])
  }
  return (
    <>
      {legacyBoxes}
      <ul className="grid gap-1 text-sm sm:grid-cols-2">
        <li className="text-muted">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked disabled /> {t('books.srd')}
          </label>
        </li>
        {all.map((b) => (
          <li key={b.id}>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={on(b.id, b.defaultOff)} onChange={() => toggle(b.id)} />
              {b.name}
              {b.defaultOff && <span className="text-xs text-muted">({t('books.unofficial')})</span>}
            </label>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Marks content from another edition (5e 2014 species / feats / subclasses on a 5.5e character). */
export function OtherEditionBadge({ tags }: { tags: string[] }) {
  const { t } = useTranslation()
  if (!tags.includes('legacy-2014')) return null
  return (
    <span className="ml-1.5 rounded border border-amber-500/60 bg-amber-500/10 px-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300" title={t('books.otherEditionHint')}>
      ⚠️ {t('books.otherEdition')}
    </span>
  )
}
