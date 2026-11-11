import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import type { ActionType, Entity } from '../../content/schema'
import { spendAmmo, performActivity } from '../../engine/actions'
import type { ActivityRow, AttackRow } from '../../engine/derive'
import { RuleRef } from '../rules/RuleRef'
import { toast } from '../toast'
import { Dots, Panel } from './common'
import { useRun, useSheet } from './context'
import { actionTypeClass, actionTypeIcon, actionTypeShort, signed } from './format'
import { useTurn } from './turn'

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
  attack?: AttackRow
  activity?: ActivityRow
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
    attack: a,
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
    activity: a,
  }
}

function TurnBar() {
  const { t } = useTranslation()
  const turn = useTurn()
  const chip = (icon: string, label: string, used: number, max: number) => (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${used >= max ? 'border-border bg-border/60 text-muted line-through' : 'border-accent text-accent'}`}>
      <span aria-hidden>{icon}</span> {label} {Math.max(0, max - used)}/{max}
    </span>
  )
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chip(actionTypeIcon.action, t('turn.action'), turn.action, 1 + turn.extraActions)}
      {chip(actionTypeIcon.bonusAction, t('turn.bonusAction'), turn.bonusAction, 1)}
      {chip(actionTypeIcon.reaction, t('turn.reaction'), turn.reaction, 1)}
      {turn.attacksLeft > 0 && <span className="text-xs font-semibold text-accent">🗡️ {t('turn.attacksLeft', { count: turn.attacksLeft })}</span>}
      <button
        className="ml-auto rounded-card border-2 border-accent bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent hover:bg-accent hover:text-accent-text"
        onClick={turn.newTurn}
        title={t('turn.newTurnHint')}
      >
        🔄 {t('turn.newTurn')}
      </button>
    </div>
  )
}

/** Asks for the physical dice result of a healing action; the bonus is added by the app. */
function RollPrompt({ row, onDone }: { row: ActivityRow; onDone: (roll?: number) => void }) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const n = Number.parseInt(value, 10)
  const total = Number.isFinite(n) ? n + (row.rollBonus ?? 0) : undefined
  return (
    <form
      className="mt-1 flex flex-wrap items-center gap-2 rounded border border-accent bg-accent/5 p-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault()
        if (Number.isFinite(n)) onDone(n)
      }}
    >
      <label className="flex items-center gap-2">
        {t('roll.prompt', { dice: row.rollDice ?? '' })}
        <input autoFocus inputMode="numeric" className="w-14 rounded border border-border bg-card px-1.5 py-0.5 text-center" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} />
      </label>
      {total !== undefined && <span className="text-muted">{t('roll.heals', { total })}</span>}
      <button type="submit" disabled={total === undefined} className="rounded bg-accent px-3 py-0.5 font-semibold text-accent-text disabled:opacity-50">
        {t('roll.apply')}
      </button>
      <button type="button" className="rounded border border-border px-3 py-0.5" onClick={() => onDone(undefined)}>
        {t('roll.withoutHealing')}
      </button>
      <button type="button" className="text-muted underline" onClick={() => onDone(-1)}>
        {t('cancel')}
      </button>
    </form>
  )
}

export function ActionList() {
  const { t } = useTranslation()
  const { character, sheet, content } = useSheet()
  const run = useRun()
  const turn = useTurn()
  const [filter, setFilter] = useState<Filter>('all')
  const [prompt, setPrompt] = useState<string>()
  const rows = [...sheet.attacks.map((a) => attackRow(a, content)), ...sheet.activities.map(activityRow)].sort((a, b) => a.order - b.order)
  const visible = rows.filter((r) => filter === 'all' || r.actionType === filter)
  const filters: Filter[] = ['all', 'action', 'bonusAction', 'reaction', 'other']
  const count = (f: Filter) => rows.filter((r) => f === 'all' || r.actionType === f).length

  async function activate(r: Row) {
    if (r.attack) {
      if (r.attack.ammo && !(await run(spendAmmo(character, r.attack)))) return
      turn.use('action', { perAction: r.attack.attacksPerAction })
      return
    }
    const a = r.activity!
    if (!a.available) return toast(t('errors.notEnough', { name: r.name }), { tone: 'error' })
    if (a.activity.roll?.kind === 'heal') return setPrompt(r.key)
    if (await run(performActivity(character, sheet, a))) {
      turn.use(a.actionType)
      if (a.activity.grants === 'action') turn.surge()
    }
  }

  async function finishRoll(r: Row, roll?: number) {
    setPrompt(undefined)
    if (roll === -1) return
    if (await run(performActivity(character, sheet, r.activity!, roll))) turn.use(r.actionType)
  }

  return (
    <Panel title={t('sheet.actions')} icon="⚔️" className="flex min-h-0 flex-1 flex-col">
      <TurnBar />
      <div className="my-2 flex flex-wrap gap-1" role="tablist">
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
          <li key={r.key} className={`py-1.5 ${r.available ? '' : 'opacity-45'}`}>
            <div
              role="button"
              tabIndex={0}
              className="flex cursor-pointer items-start gap-3 rounded px-1 hover:bg-bg"
              onClick={() => void activate(r)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                void activate(r)
              }}
            >
              <span className={`mt-0.5 w-20 shrink-0 rounded px-1.5 py-0.5 text-center text-[11px] font-semibold ${actionTypeClass[r.actionType]}`}>
                <span aria-hidden>{actionTypeIcon[r.actionType]}</span> {actionTypeShort[r.actionType]}
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
            </div>
            {prompt === r.key && r.activity && <RollPrompt row={r.activity} onDone={(roll) => void finishRoll(r, roll)} />}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-muted">{t('sheet.actionsHint')}</p>
    </Panel>
  )
}
