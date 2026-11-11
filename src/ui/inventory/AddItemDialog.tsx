import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Item } from '../../content/schema'
import { addItem } from '../../engine/inventory'
import { magicName } from '../../engine/items'
import { RuleRef } from '../rules/RuleRef'
import { useRun, useSheet } from '../sheet/context'
import { Dialog } from '../sheet/RestDialog'

const kindIcon: Record<string, string> = {
  weapon: '⚔️', armor: '🛡️', ammunition: '🏹', potion: '🧪', ring: '💍', wand: '🪄', staff: '🦯', rod: '🦯', scroll: '📜', tool: '🔧', pack: '🎒', gear: '📦', wondrous: '✨',
}

/** Search all items available to the character; magic weapons/armor ask for their base item. */
export function AddItemDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { character, content } = useSheet()
  const run = useRun()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Item>()
  const [baseId, setBaseId] = useState('')
  const [quantity, setQuantityState] = useState(1)

  const all = useMemo(
    () => content.all('item').filter((i) => !i.tags.includes('variant-group')).sort((a, b) => a.name.localeCompare(b.name)),
    [content],
  )
  const q = query.trim().toLowerCase()
  const results = (q ? all.filter((i) => i.name.toLowerCase().includes(q)) : all).slice(0, 80)
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
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
