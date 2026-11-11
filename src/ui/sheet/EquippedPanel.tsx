import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import type { Item } from '../../content/schema'
import type { Character } from '../../engine/character'
import type { Sheet } from '../../engine/derive'
import { RuleRef } from '../rules/RuleRef'
import { Dots, Panel } from './common'

const ATTUNEMENT_SLOTS = 3

function itemDetail(item: Item): string {
  if (item.kind === 'weapon') return [item.damage && `${item.damage.dice} ${item.damage.type}`, item.properties.join(', ')].filter(Boolean).join(' · ')
  if (item.kind === 'armor') return item.category === 'shield' ? `+${item.ac.base} AC` : `AC ${item.ac.base}${item.ac.dex ? ' + Dex' : ''}`
  return item.description
}

export function EquippedPanel({ character, sheet, content }: { character: Character; sheet: Sheet; content: ContentIndex }) {
  const { t } = useTranslation()
  const equipped = character.inventory.filter((e) => e.equipped)
  const attuned = character.inventory.filter((e) => e.attuned).length

  return (
    <Panel>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted">
          <span className="mr-1.5" aria-hidden>
            🎒
          </span>
          {t('sheet.equipped')}
        </h2>
        <span className="text-xs text-muted">
          {t('sheet.attunement')}: {attuned}/{ATTUNEMENT_SLOTS} ·{' '}
          {Object.entries(character.currency)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${v} ${k.toUpperCase()}`)
            .join(' · ') || '0 GP'}
        </span>
      </div>
      {equipped.length === 0 && <p className="text-sm text-muted">{t('sheet.none')}</p>}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
        {equipped.map((entry) => {
          const item = content.item(entry.itemId)
          const charges = sheet.resources.find((r) => r.key.startsWith(`item:${entry.uid}:`))
          return (
            <li
              key={entry.uid}
              className={`rounded border px-2 py-1 ${item?.magic ? 'border-accent bg-accent/5' : 'border-border'}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <RuleRef entity={item} content={content} className="font-semibold">
                  {entry.label ?? item?.name ?? entry.itemId}
                  {entry.quantity > 1 && <span className="ml-1 font-normal text-muted">×{entry.quantity}</span>}
                </RuleRef>
                {item?.attunement && (
                  <span className={`text-[10px] font-semibold uppercase ${entry.attuned ? 'text-accent' : 'text-muted'}`}>
                    {entry.attuned ? t('sheet.attuned') : t('sheet.notAttuned')}
                  </span>
                )}
              </div>
              {item && <div className="truncate text-xs text-muted">{itemDetail(item)}</div>}
              {!item && <div className="text-xs text-danger">{t('sheet.missingContent')}</div>}
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
