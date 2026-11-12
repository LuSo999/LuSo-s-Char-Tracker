import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setResourceRemaining } from '../../engine/actions'
import {
  adjustCoin,
  coins,
  removeItem,
  selectAmmo,
  setAmmoTracking,
  setCoin,
  setQuantity,
  setTwoHanded,
  toggleAttune,
  toggleEquip,
} from '../../engine/inventory'
import { unitWeight, type ResolvedEntry } from '../../engine/items'
import { fx } from '../fx/fx'
import { RuleRef } from '../rules/RuleRef'
import { Term } from '../rules/Term'
import { Dots } from '../sheet/common'
import { useRun, useSheet } from '../sheet/context'
import { NumberAdjust } from '../sheet/NumberAdjust'
import { AddItemDialog } from './AddItemDialog'
import { SidePanel } from '../sheet/SidePanel'
import { setItemLabel } from '../../engine/edits'
import { magicName } from '../../engine/items'
import { useEditMode } from '../sheet/editMode'

const coinIcon: Record<string, string> = { pp: '⚪', gp: '🟡', ep: '🔘', sp: '⚫', cp: '🟤' }

function ItemRow({ r }: { r: ResolvedEntry }) {
  const { t } = useTranslation()
  const { character, sheet, content } = useSheet()
  const run = useRun()
  const e = r.entry
  const charges = sheet.resources.find((x) => x.key === `item:${e.uid}:charges`)
  const weapon = r.weapon
  const ammoChoices = weapon?.properties.includes('ammunition') ? sheet.items.filter((x) => x.ammoKind === weapon.ammunition) : []
  const equippable = !!(r.weapon || r.armor || r.item.magic || r.item.kind === 'wondrous' || r.item.kind === 'ring')
  const btn = 'rounded border px-2 py-0.5 text-xs font-semibold'
  const edit = useEditMode((s) => s.on)

  return (
    <li className={`rounded border p-2 ${r.item.magic ? 'border-accent/60 bg-accent/5' : 'border-border'}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <RuleRef entity={r.item} content={content} className="min-w-0 flex-1 font-semibold">
          {r.item.magic && <span aria-hidden>✨ </span>}
          {r.name}
          {content.isForeign(r.item.id) && (
            <span className="ml-1.5 rounded border border-border px-1 text-[10px] font-normal text-muted" title={t('itemFilters.foreignHint')}>
              {r.item.edition === '2014' ? '5e (2014)' : '5.5e (2024)'}
            </span>
          )}
        </RuleRef>
        {edit && (
          <button
            className="text-xs text-accent"
            title={t('edit.renameItem')}
            onClick={() => {
              const original = magicName(r.item, r.base)
              const label = prompt(t('edit.renameItemPrompt', { original }), e.label ?? original)
              if (label !== null) void run(setItemLabel(character, e.uid, label === original ? '' : label, original))
            }}
          >
            ✎
          </button>
        )}
        <span className="text-xs text-muted tabular-nums">{Math.round(unitWeight(r) * e.quantity * 100) / 100} lb</span>
        <NumberAdjust
          label={t('inventory.quantity', { name: r.name })}
          value={e.quantity}
          valueClassName="text-sm font-semibold"
          onSet={(v) => void run(setQuantity(character, content, e.uid, v))}
          onDelta={(d) => void run(setQuantity(character, content, e.uid, e.quantity + d))}
        />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {equippable && (
          <button
            className={`${btn} ${e.equipped ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
            onClick={() => void run(toggleEquip(character, content, e.uid))}
          >
            {e.equipped ? `✓ ${t('inventory.equipped')}` : t('inventory.equip')}
          </button>
        )}
        {r.item.attunement && (
          <button
            className={`${btn} ${e.attuned ? 'border-violet-600 bg-violet-600 text-white' : 'border-border hover:bg-bg'}`}
            onClick={async () => {
              const group = await run(toggleAttune(character, content, e.uid, sheet.attunementSlots))
              if (group && !e.attuned) fx('magic')
            }}
          >
            🔗 <Term id="rule-attunement">{e.attuned ? t('inventory.attuned') : t('inventory.attune')}</Term>
          </button>
        )}
        {weapon?.versatileDamage && e.equipped && (
          <button
            className={`${btn} ${e.twoHanded ? 'border-accent text-accent' : 'border-border hover:bg-bg'}`}
            onClick={() => void run(setTwoHanded(character, content, e.uid, !e.twoHanded))}
            title={t('inventory.versatileHint', { dice: weapon.versatileDamage })}
          >
            🤲 {e.twoHanded ? t('inventory.twoHands') : t('inventory.oneHand')}
          </button>
        )}
        {ammoChoices.length > 0 && (
          <label className="flex items-center gap-1 text-xs">
            🏹
            <select
              className="rounded border border-border bg-card px-1"
              value={sheet.attacks.find((a) => a.key === e.uid)?.ammo?.uid ?? ''}
              onChange={(ev) => void run(selectAmmo(character, content, e.uid, ev.target.value))}
            >
              {ammoChoices.map((a) => (
                <option key={a.entry.uid} value={a.entry.uid}>
                  {a.name} ({a.entry.quantity})
                </option>
              ))}
            </select>
          </label>
        )}
        {charges && <Dots remaining={charges.remaining} max={charges.max} onSet={(n) => void run(setResourceRemaining(character, sheet, charges.key, n))} />}
        <button
          className="ml-auto text-xs text-danger hover:underline"
          onClick={() => {
            if (confirm(t('inventory.confirmRemove', { name: r.name }))) void run(removeItem(character, content, e.uid))
          }}
        >
          🗑 {t('inventory.remove')}
        </button>
      </div>
    </li>
  )
}

/** Inventory: money, weight, attunement, equipped items and the backpack. */
export function InventoryDrawer({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { character, sheet } = useSheet()
  const run = useRun()
  const [adding, setAdding] = useState(false)
  const attuned = character.inventory.filter((e) => e.attuned).length
  const { total, capacity } = sheet.weight
  const equipped = sheet.items.filter((r) => r.entry.equipped)
  const pack = sheet.items.filter((r) => !r.entry.equipped)

  return (
    <SidePanel
      side="right"
      title={`🎒 ${t('inventory.title')}`}
      onClose={onClose}
      header={
        <>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div title={t('inventory.capacityHint')}>
              ⚖️ {t('inventory.weight')}: <strong className={total > capacity ? 'text-danger' : ''}>{total}</strong> / {capacity} lb
              <div className="mt-0.5 h-1 overflow-hidden rounded bg-border">
                <div className={`h-full ${total > capacity ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${Math.min(100, (total / capacity) * 100)}%` }} />
              </div>
            </div>
            <div>
              🔗 {t('sheet.attunement')}: <strong className={attuned >= sheet.attunementSlots ? 'text-violet-600' : ''}>{attuned}</strong>/{sheet.attunementSlots}
            </div>
            <label className="col-span-2 flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={character.settings.trackAmmunition} onChange={(e) => void run(setAmmoTracking(character, e.target.checked))} />
              {t('inventory.trackAmmo')}
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {coins.map((c) => (
              <span key={c} className="flex items-center gap-1 text-sm">
                <span aria-hidden>{coinIcon[c]}</span>
                <span className="w-6 font-semibold uppercase text-muted">{c}</span>
                <NumberAdjust
                  label={c.toUpperCase()}
                  value={character.currency[c]}
                  valueClassName="font-semibold"
                  onSet={(v) => void run(setCoin(character, c, v))}
                  onDelta={(d) => void run(adjustCoin(character, c, d))}
                />
              </span>
            ))}
          </div>
        </>
      }
    >
      <div className="space-y-3">
          <button className="w-full rounded border-2 border-dashed border-accent py-1.5 font-semibold text-accent hover:bg-accent/10" onClick={() => setAdding(true)}>
            + {t('inventory.add')}
          </button>
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase text-muted">{t('sheet.equipped')}</h3>
            {equipped.length === 0 && <p className="text-sm text-muted">{t('sheet.none')}</p>}
            <ul className="space-y-1.5">
              {equipped.map((r) => (
                <ItemRow key={r.entry.uid} r={r} />
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase text-muted">{t('inventory.backpack')}</h3>
            {pack.length === 0 && <p className="text-sm text-muted">{t('sheet.none')}</p>}
            <ul className="space-y-1.5">
              {pack.map((r) => (
                <ItemRow key={r.entry.uid} r={r} />
              ))}
            </ul>
          </section>
        </div>
      {adding && <AddItemDialog onClose={() => setAdding(false)} />}
    </SidePanel>
  )
}
