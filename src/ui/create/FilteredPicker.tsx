// One choice from a list in character creation (class, species, background): alphabetical,
// with a search bar, chip filters, a book filter, a count and a note when the selected item is
// hidden by the filters.
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import type { Entity } from '../../content/schema'

export type ChipGroup<T> = {
  id: string
  /** any: one of the picked chips; all: every picked chip; one: a single chip at a time. */
  mode: 'any' | 'all' | 'one'
  options: { value: string; label: string; title?: string; test: (item: T) => boolean }[]
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function FilteredPicker<T extends Entity>({
  items,
  content,
  value,
  onChange,
  search,
  groups,
  render,
  radio,
}: {
  items: T[]
  content: ContentIndex
  value: string
  onChange: (id: string) => void
  /** Texts the search looks in besides the name. */
  search: (item: T) => string[]
  groups: ChipGroup<T>[]
  render: (item: T) => ReactNode
  radio: (on: boolean) => string
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [book, setBook] = useState('')

  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name))
  // Only chips that tell items apart (some have it, some don't).
  const shownGroups = groups.map((g) => ({ ...g, options: g.options.filter((o) => sorted.some(o.test) && !sorted.every(o.test)) })).filter((g) => g.options.length)
  const bookNames = new Map(content.books().map((b) => [b.id, b.name]))
  const bookLabel = (id: string) => bookNames.get(id) ?? (id.startsWith('srd') ? t('books.srd') : id.startsWith('homebrew') ? 'Homebrew' : id)
  const allBooks = [...new Set(sorted.map((i) => i.source.book))]

  const q = norm(query.trim())
  const shown = sorted.filter((item) => {
    if (q && !norm(item.name).includes(q) && !search(item).some((s) => norm(s).includes(q))) return false
    if (book && item.source.book !== book) return false
    return shownGroups.every((g) => {
      const sel = g.options.filter((o) => picked[g.id]?.includes(o.value))
      if (!sel.length) return true
      return g.mode === 'any' ? sel.some((o) => o.test(item)) : sel.every((o) => o.test(item))
    })
  })
  const filtered = !!(q || book || Object.values(picked).some((v) => v.length))
  const selectedHidden = !!value && !shown.some((i) => i.id === value)

  const chip = (on: boolean) => `rounded-full border px-2.5 py-0.5 text-xs ${on ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`
  const toggle = (g: ChipGroup<T>, v: string) =>
    setPicked((p) => {
      const cur = p[g.id] ?? []
      const next = cur.includes(v) ? cur.filter((x) => x !== v) : g.mode === 'one' ? [v] : [...cur, v]
      return { ...p, [g.id]: next }
    })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input type="search" className="min-w-48 flex-1 rounded border border-border bg-card px-2 py-1 text-sm" placeholder={t('create.filterSearch')} value={query} onChange={(e) => setQuery(e.target.value)} />
        {allBooks.length > 1 && (
          <select className="rounded border border-border bg-card px-2 py-1 text-sm" value={book} onChange={(e) => setBook(e.target.value)} aria-label={t('create.filterBook')}>
            <option value="">{t('create.filterAllBooks')}</option>
            {allBooks.map((b) => (
              <option key={b} value={b}>
                {bookLabel(b)}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {shownGroups.map((g, gi) => (
          <span key={g.id} className="contents">
            {gi > 0 && <span className="mx-1 h-4 w-px bg-border" />}
            {g.options.map((o) => (
              <button key={o.value} className={chip(!!picked[g.id]?.includes(o.value))} title={o.title} onClick={() => toggle(g, o.value)}>
                {o.label}
              </button>
            ))}
          </span>
        ))}
        {filtered && (
          <button
            className="ml-1 text-xs text-muted hover:underline"
            onClick={() => {
              setQuery('')
              setPicked({})
              setBook('')
            }}
          >
            ✕ {t('create.filterClear')}
          </button>
        )}
        <span className="ml-auto text-xs text-muted">
          {shown.length} / {sorted.length}
        </span>
      </div>
      {selectedHidden && <p className="text-xs text-muted">{t('create.filterSelectedHidden', { name: content.get(value)?.name ?? value })}</p>}
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {shown.map((item) => (
          <li key={item.id}>
            <label className={radio(value === item.id)}>
              <input type="radio" className="mt-1" checked={value === item.id} onChange={() => onChange(item.id)} />
              <span>{render(item)}</span>
            </label>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="text-sm text-muted">{t('create.filterNone')}</p>}
    </div>
  )
}
