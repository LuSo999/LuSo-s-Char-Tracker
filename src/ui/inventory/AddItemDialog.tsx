import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Item } from '../../content/schema'
import { addItem } from '../../engine/inventory'
import { magicName } from '../../engine/items'
import { RuleRef } from '../rules/RuleRef'
import { useRun, useSheet } from '../sheet/context'
import { Dialog } from '../sheet/RestDialog'
import { categories, defaultFilters, filterItems, rarities, type ItemFilters } from './itemFilters'

const categoryIcon: Record<string, string> = { all: '🔎', weapon: '⚔️', armor: '🛡️', ammunition: '🏹', potion: '🧪', gear: '📦', wondrous: '✨' }

const kindIcon: Record<string, string> = {
  weapon: '⚔️', armor: '🛡️', ammunition: '🏹', potion: '🧪', ring: '💍', wand: '🪄', staff: '🦯', rod: '🦯', scroll: '📜', tool: '🔧', pack: '🎒', gear: '📦', wondrous: '✨',
}

/** Search all items available to the character; magic weapons/armor ask for their base item. */
export function AddItemDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { character, content } = useSheet()
  const run = useRun()
  const [filters, setFilters] = useState<ItemFilters>(defaultFilters)
  const set = (patch: Partial<ItemFilters>) => setFilters((f) => ({ ...f, ...patch }))
  const [picked, setPicked] = useState<Item>()
  const [baseId, setBaseId] = useState('')
  const [quantity, setQuantityState] = useState(1)

  const all = useMemo(
    () => content.all('item').filter((i) => !i.tags.includes('variant-group')).sort((a, b) => a.name.localeCompare(b.name)),
    [content],
  )
  const bookOf = (i: Item) => content.pack(i.id)?.name ?? i.source.book
  const books = [...new Set(all.map(bookOf))]
  const found = filterItems(all, filters, bookOf)
  const LIMIT = 150
  const results = found.slice(0, LIMIT)
  const subOptions = filters.category === 'weapon' ? ['simple', 'martial', 'melee', 'ranged'] : filters.category === 'armor' ? ['light', 'medium', 'heavy', 'shield'] : []
  const select = 'rounded border border-border bg-card px-1.5 py-0.5 text-sm'
  const baseOptions = picked && 'baseOptions' in picked ? (picked.baseOptions ?? []).map((id) => content.item(id)).filter((i): i is Item => !!i) : []

  async function add() {
    if (!picked) return
    const base = baseOptions.length === 1 ? baseOptions[0].id : baseId || undefined
    if (await run(addItem(character, content, picked.id, quantity, base))) onClose()
  }

  return (
    <Dialog title={t('inventory.add')} onClose={onClose}>
      {!picked ? (
        <>
          <input
            autoFocus
            className="w-full rounded border border-border bg-card px-2 py-1.5"
            placeholder={t('inventory.searchItems')}
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {categories.map((c) => (
              <button
                key={c}
                className={`rounded-full border px-2.5 py-0.5 text-sm ${filters.category === c ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
                onClick={() => set({ category: c, sub: '' })}
              >
                {categoryIcon[c]} {t(`itemFilters.categories.${c}`)}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {subOptions.length > 0 && (
              <select className={select} value={filters.sub} onChange={(e) => set({ sub: e.target.value })} aria-label={t('itemFilters.type')}>
                <option value="">{t('itemFilters.anyType')}</option>
                {subOptions.map((o) => (
                  <option key={o} value={o}>
                    {t(`itemFilters.sub.${o}`)}
                  </option>
                ))}
              </select>
            )}
            <select className={select} value={filters.magic} onChange={(e) => set({ magic: e.target.value as ItemFilters['magic'], rarity: '' })} aria-label={t('itemFilters.magic')}>
              <option value="all">{t('itemFilters.magicAll')}</option>
              <option value="magic">✨ {t('itemFilters.magicOnly')}</option>
              <option value="mundane">{t('itemFilters.mundaneOnly')}</option>
            </select>
            {filters.magic !== 'mundane' && (
              <select className={select} value={filters.rarity} onChange={(e) => set({ rarity: e.target.value })} aria-label={t('itemFilters.rarity')}>
                <option value="">{t('itemFilters.anyRarity')}</option>
                {rarities.map((r) => (
                  <option key={r} value={r}>
                    {r[0].toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
            )}
            <select className={select} value={filters.attunement} onChange={(e) => set({ attunement: e.target.value as ItemFilters['attunement'] })} aria-label={t('itemFilters.attunement')}>
              <option value="all">🔗 {t('itemFilters.attunementAny')}</option>
              <option value="yes">🔗 {t('itemFilters.attunementYes')}</option>
              <option value="no">{t('itemFilters.attunementNo')}</option>
            </select>
            {books.length > 1 && (
              <select className={select} value={filters.book} onChange={(e) => set({ book: e.target.value })} aria-label={t('itemFilters.book')}>
                <option value="">📚 {t('itemFilters.anyBook')}</option>
                {books.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}
            <select className={select} value={filters.sort} onChange={(e) => set({ sort: e.target.value as ItemFilters['sort'] })} aria-label={t('itemFilters.sort')}>
              <option value="name">↕ {t('itemFilters.sortName')}</option>
              <option value="cost">↕ {t('itemFilters.sortCost')}</option>
              <option value="rarity">↕ {t('itemFilters.sortRarity')}</option>
            </select>
            {JSON.stringify(filters) !== JSON.stringify(defaultFilters) && (
              <button className="text-muted underline" onClick={() => setFilters(defaultFilters)}>
                {t('itemFilters.reset')}
              </button>
            )}
            <span className="ml-auto text-xs text-muted">
              {t('itemFilters.found', { count: found.length })}
              {found.length > LIMIT ? ` · ${t('itemFilters.showing', { count: LIMIT })}` : ''}
            </span>
          </div>
          <ul className="mt-2 max-h-[55vh] divide-y divide-border overflow-y-auto">
            {results.map((i) => (
              <li key={i.id}>
                <button
                  className="flex w-full items-baseline gap-2 px-1 py-1.5 text-left hover:bg-bg"
                  onClick={() => {
                    setPicked(i)
                    setBaseId('')
                    setQuantityState(i.kind === 'ammunition' ? ('bundle' in i && i.bundle ? i.bundle : 1) : 1)
                  }}
                >
                  <span aria-hidden>{kindIcon[i.kind] ?? '📦'}</span>
                  <RuleRef entity={i} content={content} className="flex-1 font-medium">
                    {i.name}
                  </RuleRef>
                  <span className="text-xs text-muted">
                    {i.magic ? (i.rarity ?? '') : i.cost ? `${i.cost.amount} ${i.cost.unit}` : ''}
                    {i.attunement ? ' · 🔗' : ''}
                  </span>
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="py-2 text-sm text-muted">{t('inventory.noResults')}</li>}
          </ul>
        </>
      ) : (
        <div className="space-y-3">
          <p className="font-semibold">
            {kindIcon[picked.kind] ?? '📦'} {picked.name}
          </p>
          <p className="text-sm text-muted">{picked.description}</p>
          {baseOptions.length > 1 && (
            <label className="block text-sm">
              {t('inventory.chooseBase')}
              <select className="mt-1 block w-full rounded border border-border bg-card px-2 py-1" value={baseId} onChange={(e) => setBaseId(e.target.value)}>
                <option value="">—</option>
                {baseOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {magicName(picked, b)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            {t('inventory.howMany')}
            <input
              inputMode="numeric"
              className="w-20 rounded border border-border bg-card px-2 py-1"
              value={quantity}
              onChange={(e) => setQuantityState(Math.max(1, Number.parseInt(e.target.value.replace(/\D/g, ''), 10) || 1))}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button className="rounded border border-border px-4 py-2" onClick={() => setPicked(undefined)}>
              ← {t('inventory.back')}
            </button>
            <button
              className="rounded bg-accent px-4 py-2 font-semibold text-accent-text disabled:opacity-50"
              disabled={baseOptions.length > 1 && !baseId}
              onClick={() => void add()}
            >
              {t('inventory.addConfirm')}
            </button>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">{t('inventory.characterLabel', { name: character.name })}</p>
    </Dialog>
  )
}
