import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import type { ActionType, Entity } from '../../content/schema'
import type { AttackRow, ActivityRow, Sheet } from '../../engine/derive'
import { RuleRef } from '../rules/RuleRef'
import { Dots, Panel } from './common'
import { actionTypeClass, actionTypeShort, signed } from './format'

type Filter = 'all' | ActionType

/** One row in the BG3-style action list. */
type Row = {
  key: string
  name: string
  entity?: Entity
  actionType: ActionType
  details: React.ReactNode[]
  uses?: { remaining: number; max: number }
  available: boolean
  order: number
}

const sectionOrder = { attack: 0, activity: 1, item: 2 }

function attackRow(a: AttackRow, content: ContentIndex): Row {
  const details: React.ReactNode[] = [
    <strong key="hit">{signed(a.attack.value)}</strong>,
    <span key="dmg">
      {/* A flat "1" (Unarmed Strike) is shown as its total. */}
      {a.damageDice === '1' ? Math.max(1, 1 + a.damageBonus) : `${a.damageDice}${a.damageBonus ? signed(a.damageBonus) : ''}`} {a.damageType}
    </span>,
  ]
  if (a.reach) details.push(<span key="reach">{a.reach} ft</span>)
  if (a.range) details.push(<span key="range">{a.range.normal}/{a.range.long ?? a.range.normal} ft</span>)
  if (a.thrown) details.push(<span key="thrown">thrown {a.thrown.normal}/{a.thrown.long ?? a.thrown.normal} ft</span>)
  if (a.critRange < 20) details.push(<span key="crit">crit {a.critRange}–20</span>)
  if (a.mastery) {
    details.push(
      <RuleRef key="mastery" entity={content.get(a.mastery)} content={content} className="rounded bg-accent/15 px-1.5 text-xs font-semibold text-accent">
        {content.get(a.mastery)?.name ?? a.mastery}
      </RuleRef>,
    )
  }
  if (a.attacksPerAction > 1) details.push(<span key="x">×{a.attacksPerAction}</span>)
  return {
    key: `attack:${a.key}`,
    name: a.name,
    entity: a.weapon,
    actionType: 'action',
    details,
    uses: a.ammo ? { remaining: a.ammo.remaining, max: a.ammo.remaining } : undefined,
    available: !a.ammo || a.ammo.remaining > 0,
    order: sectionOrder.attack,
  }
}

function activityRow(a: ActivityRow): Row {
  const details: React.ReactNode[] = []
  if (a.rollDice || a.rollBonus !== undefined) {
    const kind = a.activity.roll?.kind === 'heal' ? 'HP' : ''
    details.push(
      <span key="roll">
        {a.rollDice ?? ''}
        {a.rollBonus !== undefined ? signed(a.rollBonus) : ''} {kind}
      </span>,
    )
  }
  if (a.saveDc !== undefined) {
    details.push(
      <strong key="dc">
        DC {a.saveDc}
        {a.activity.saveAbility ? ` ${a.activity.saveAbility.toUpperCase()}` : ''}
      </strong>,
    )
  }
  if (a.activity.summary) {
    details.push(
      <span key="sum" className="min-w-0 flex-1 truncate text-muted" title={a.activity.summary}>
        {a.activity.summary}
      </span>,
    )
  }
  const isItem = a.source.entity.type === 'item'
  return {
    key: `activity:${a.key}`,
    name: isItem ? `${a.source.entity.name}` : a.activity.name,
    entity: a.source.entity,
    actionType: a.actionType,
    details,
    uses: a.uses && { remaining: a.uses.remaining, max: a.uses.max },
    available: a.available,
    order: isItem ? sectionOrder.item : sectionOrder.activity,
  }
}

export function ActionList({ sheet, content }: { sheet: Sheet; content: ContentIndex }) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<Filter>('all')
  const rows = [...sheet.attacks.map((a) => attackRow(a, content)), ...sheet.activities.map(activityRow)].sort((a, b) => a.order - b.order)
  const visible = rows.filter((r) => filter === 'all' || r.actionType === filter)
  const filters: Filter[] = ['all', 'action', 'bonusAction', 'reaction', 'other']
  const count = (f: Filter) => rows.filter((r) => f === 'all' || r.actionType === f).length

  return (
    <Panel title={t('sheet.actions')} className="flex min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap gap-1" role="tablist">
        {filters.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`rounded-full border px-3 py-1 text-sm ${filter === f ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
            onClick={() => setFilter(f)}
          >
            {t(`actionFilter.${f}`)} <span className="opacity-60">{count(f)}</span>
          </button>
        ))}
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
        {visible.map((r) => (
          <li key={r.key} className={`flex items-start gap-3 py-1.5 ${r.available ? '' : 'opacity-45'}`}>
            <span className={`mt-0.5 w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-semibold ${actionTypeClass[r.actionType]}`}>
              {actionTypeShort[r.actionType]}
            </span>
            <div className="min-w-0 flex-1">
              <RuleRef entity={r.entity} content={content} className="font-semibold">
                {r.name}
              </RuleRef>
              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">{r.details}</div>
            </div>
            {r.uses && (
              <span className="shrink-0 pt-1 text-sm" title={t('sheet.usesLeft')}>
                {r.uses.max === r.uses.remaining && r.uses.max > 10 ? `${r.uses.remaining}` : <Dots remaining={r.uses.remaining} max={r.uses.max} />}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  )
}
