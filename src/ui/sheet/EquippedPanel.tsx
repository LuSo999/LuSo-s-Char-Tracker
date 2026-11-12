import { useTranslation } from 'react-i18next'
import type { Item } from '../../content/schema'
import { ATTUNEMENT_SLOTS } from '../../engine/inventory'
import type { ResolvedEntry } from '../../engine/items'
import { RuleRef } from '../rules/RuleRef'
import { Dots, Panel } from './common'
import { useSheet } from './context'
import { PropertyList, Term } from '../rules/Term'

function itemDetail(r: ResolvedEntry, item: Item): React.ReactNode {
  if (r.weapon) {
    return (
      <>
        {r.weapon.damage && `${r.weapon.damage.dice} ${r.weapon.damage.type}`}
        {r.weapon.damage && r.weapon.properties.length > 0 && ' · '}
        <PropertyList properties={r.weapon.properties} />
      </>
    )
  }
  if (r.armor) return r.armor.category === 'shield' ? `+${r.armor.ac.base} AC` : `AC ${r.armor.ac.base}${r.armor.ac.dex ? ' + Dex' : ''}`
  return item.description
}

export function EquippedPanel({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation()
  const { character, sheet, content } = useSheet()
  const equipped = sheet.items.filter((r) => r.entry.equipped)
  const attuned = character.inventory.filter((e) => e.attuned).length

  return (
    <Panel>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <button className="font-heading text-sm font-semibold uppercase tracking-wide text-muted hover:text-accent" onClick={onOpen} title={t('inventory.open')}>
          <span className="mr-1.5" aria-hidden>
            🎒
          </span>
          {t('sheet.equipped')} <span className="normal-case">→</span>
        </button>
        <span className="text-xs text-muted">
          <Term id="rule-attunement">🔗 {attuned}/{ATTUNEMENT_SLOTS}</Term> · ⚖️ {sheet.weight.total}/{sheet.weight.capacity} lb ·{' '}
          {Object.entries(character.currency)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${v} ${k.toUpperCase()}`)
            .join(' · ') || '0 GP'}
        </span>
      </div>
      {equipped.length === 0 && <p className="text-sm text-muted">{t('sheet.none')}</p>}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
        {equipped.map((r) => {
          const charges = sheet.resources.find((x) => x.key === `item:${r.entry.uid}:charges`)
          return (
            <li key={r.entry.uid} className={`rounded border px-2 py-1 ${r.item.magic ? 'border-accent bg-accent/5' : 'border-border'}`}>
              <div className="flex items-baseline justify-between gap-2">
                <RuleRef entity={r.item} content={content} className="font-semibold">
                  {r.item.magic && <span aria-hidden>✨ </span>}
                  {r.name}
                  {r.entry.quantity > 1 && <span className="ml-1 font-normal text-muted">×{r.entry.quantity}</span>}
                </RuleRef>
                {r.item.attunement && (
                  <span className={`text-[10px] font-semibold uppercase ${r.entry.attuned ? 'text-violet-600' : 'text-muted'}`}>
                    🔗 {r.entry.attuned ? t('sheet.attuned') : t('sheet.notAttuned')}
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-muted">{itemDetail(r, r.item)}</div>
              {charges && (
                <div className="mt-1">
                  <Dots remaining={charges.remaining} max={charges.max} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
