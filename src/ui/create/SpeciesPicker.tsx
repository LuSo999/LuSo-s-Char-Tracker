// Species (race) step of character creation: alphabetical list with a search bar and filters
// (size, what the traits give: darkvision, flying, swimming, climbing, resistances; book; and the
// ability bonus for 2014 races).
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import { abilities, type Ability, type Species } from '../../content/schema'
import { RuleRef } from '../rules/RuleRef'
import { OtherEditionBadge } from '../sheet/BooksPicker'
import { signed } from '../sheet/format'

const features = ['darkvision', 'fly', 'swim', 'climb', 'resistance'] as const
type Feature = (typeof features)[number]

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** What a species' traits (and its subspecies' traits) give, from their effects. */
function featuresOf(s: Species, content: ContentIndex): Set<Feature> {
  const out = new Set<Feature>()
  const traitIds = [...s.traits, ...s.subspecies.flatMap((id) => content.getTyped(id, 'subspecies')?.traits ?? [])]
  for (const id of traitIds) {
    for (const e of content.get(id)?.effects ?? []) {
      if (e.target === 'sense:darkvision') out.add('darkvision')
      else if (e.target === 'speed:fly') out.add('fly')
      else if (e.target === 'speed:swim') out.add('swim')
      else if (e.target === 'speed:climb') out.add('climb')
      else if (e.target.startsWith('resistance:')) out.add('resistance')
    }
  }
  return out
}

export function SpeciesPicker({
  species,
  content,
  value,
  onChange,
  radio,
}: {
  species: Species[]
  content: ContentIndex
  value: string
  onChange: (id: string) => void
  radio: (on: boolean) => string
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [sizes, setSizes] = useState<string[]>([])
  const [feats, setFeats] = useState<Feature[]>([])
  const [book, setBook] = useState('')
  const [ability, setAbility] = useState<Ability>()

  const rows = useMemo(
    () =>
      [...species]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => ({
          s,
          traits: s.traits.map((id) => content.get(id)?.name ?? id),
          // Searchable too: subspecies and their traits (Breath Weapon comes with the Draconic Ancestor).
          more: s.subspecies.flatMap((id) => {
            const sub = content.getTyped(id, 'subspecies')
            return sub ? [sub.name, ...sub.traits.map((tid) => content.get(tid)?.name ?? tid)] : []
          }),
          features: featuresOf(s, content),
          sizes: s.size.split(/\s*(?:,|\bor\b|\/)\s*/i).filter(Boolean),
        })),
    [species, content],
  )
  const allSizes = [...new Set(rows.flatMap((r) => r.sizes))].sort((a, b) => ['Tiny', 'Small', 'Medium', 'Large'].indexOf(a) - ['Tiny', 'Small', 'Medium', 'Large'].indexOf(b))
  const bookNames = new Map(content.books().map((b) => [b.id, b.name]))
  const bookOf = (s: Species) => s.source.book
  const bookLabel = (id: string) => bookNames.get(id) ?? (id.startsWith('srd') ? t('books.srd') : id.startsWith('homebrew') ? 'Homebrew' : id)
  const allBooks = [...new Set(rows.map((r) => bookOf(r.s)))]
  const anyAbility = rows.some((r) => r.s.abilityBonuses.length)
  const availableFeatures = features.filter((f) => rows.some((r) => r.features.has(f)))

  const q = norm(query.trim())
  const shown = rows.filter(
    (r) =>
      (!q || norm(r.s.name).includes(q) || [...r.traits, ...r.more].some((n) => norm(n).includes(q))) &&
      (!sizes.length || r.sizes.some((x) => sizes.includes(x))) &&
      feats.every((f) => r.features.has(f)) &&
      (!book || bookOf(r.s) === book) &&
      (!ability || r.s.abilityBonuses.some((b) => b.ability === ability && b.bonus > 0)),
  )
  const filtered = !!(q || sizes.length || feats.length || book || ability)
  const selectedHidden = !!value && !shown.some((r) => r.s.id === value)

  const chip = (on: boolean) => `rounded-full border px-2.5 py-0.5 text-xs ${on ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          className="min-w-48 flex-1 rounded border border-border bg-card px-2 py-1 text-sm"
          placeholder={t('create.speciesSearch')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {allBooks.length > 1 && (
          <select className="rounded border border-border bg-card px-2 py-1 text-sm" value={book} onChange={(e) => setBook(e.target.value)} aria-label={t('create.speciesBook')}>
            <option value="">{t('create.speciesAllBooks')}</option>
            {allBooks.map((b) => (
              <option key={b} value={b}>
                {bookLabel(b)}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {allSizes.length > 1 &&
          allSizes.map((size) => (
            <button key={size} className={chip(sizes.includes(size))} onClick={() => setSizes(toggle(sizes, size))}>
              {size}
            </button>
          ))}
        {allSizes.length > 1 && availableFeatures.length > 0 && <span className="mx-1 h-4 w-px bg-border" />}
        {availableFeatures.map((f) => (
          <button key={f} className={chip(feats.includes(f))} onClick={() => setFeats(toggle(feats, f))}>
            {t(`create.speciesFeature.${f}`)}
          </button>
        ))}
        {anyAbility && <span className="mx-1 h-4 w-px bg-border" />}
        {anyAbility &&
          abilities.map((a) => (
            <button key={a} className={chip(ability === a)} onClick={() => setAbility(ability === a ? undefined : a)} title={t('create.speciesAbility')}>
              {a.toUpperCase()} +
            </button>
          ))}
        {filtered && (
          <button
            className="ml-1 text-xs text-muted hover:underline"
            onClick={() => {
              setQuery('')
              setSizes([])
              setFeats([])
              setBook('')
              setAbility(undefined)
            }}
          >
            ✕ {t('create.speciesClear')}
          </button>
        )}
        <span className="ml-auto text-xs text-muted">{t('create.speciesCount', { shown: shown.length, total: rows.length })}</span>
      </div>
      {selectedHidden && <p className="text-xs text-muted">{t('create.speciesSelectedHidden', { name: content.get(value)?.name ?? value })}</p>}
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {shown.map(({ s, traits }) => (
          <li key={s.id}>
            <label className={radio(value === s.id)}>
              <input type="radio" className="mt-1" checked={value === s.id} onChange={() => onChange(s.id)} />
              <span>
                <RuleRef entity={s} content={content} className="font-semibold">
                  {s.name}
                </RuleRef>
                <OtherEditionBadge tags={s.tags} />
                <span className="ml-2 text-xs text-muted">
                  {s.size} · {s.speed} ft
                  {s.abilityBonuses.length > 0 && ` · ${s.abilityBonuses.map((b) => `${b.ability.toUpperCase()} ${signed(b.bonus)}`).join(', ')}`}
                </span>
                <span className="block text-xs text-muted">{traits.join(', ')}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="text-sm text-muted">{t('create.speciesNone')}</p>}
    </div>
  )
}
