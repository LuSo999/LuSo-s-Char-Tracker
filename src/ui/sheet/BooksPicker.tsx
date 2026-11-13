import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'

/**
 * Which books' content a character may use (SRD is always on). An empty list
 * means every official book except unofficial / playtest ones.
 */
export function BooksPicker({ content, books, onChange }: { content: ContentIndex; books: string[]; onChange: (books: string[]) => void }) {
  const { t } = useTranslation()
  const all = content.books()
  if (!all.length) return <p className="text-xs text-muted">{t('books.none')}</p>
  const on = (id: string, defaultOff: boolean) => (books.length ? books.includes(id) : !defaultOff)
  const toggle = (id: string) => {
    const current = all.filter((b) => on(b.id, b.defaultOff)).map((b) => b.id)
    onChange(current.includes(id) ? current.filter((x) => x !== id) : [...current, id])
  }
  return (
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
  )
}
