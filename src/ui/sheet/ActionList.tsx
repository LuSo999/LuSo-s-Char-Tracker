import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ContentIndex } from '../../content'
import type { ActionType, Entity } from '../../content/schema'
import { makeAttack, performActivity } from '../../engine/actions'
import type { ActivityRow, AttackRow } from '../../engine/derive'
import { RuleRef } from '../rules/RuleRef'
import { useSettings } from '../../state/settings'
import { centerOf, fx } from '../fx/fx'
import { toast } from '../toast'
import { Dots, Panel } from './common'
import { useRun, useSheet } from './context'
import { actionTypeClass, actionTypeIcon, actionTypeShort, signed } from './format'
import { rememberTurn, slotFree, slotMax, snapshotTurn, useTurn, type Slot } from './turn'

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
  const chip = (slot: Slot, label: string) => {
    const used = turn[slot]
    const max = slotMax(turn, slot)
    const flashing = turn.flash?.slot === slot
    return (
      <span
        // Changing the key restarts the flash animation on repeated refusals.
        key={flashing ? `${slot}-${turn.flash!.at}` : slot}
        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${flashing ? 'fx-flash' : ''} ${used >= max ? 'border-border bg-border/60 text-muted line-through' : 'border-accent text-accent'}`}
      >
        <span aria-hidden>{actionTypeIcon[slot]}</span> {label} {Math.max(0, max - used)}/{max}
      </span>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chip('action', t('turn.action'))}
      {chip('bonusAction', t('turn.bonusAction'))}
      {chip('reaction', t('turn.reaction'))}
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

/**
 * Strict mode: the needed action is used up. Weapon attacks can still be an
 * Opportunity Attack (Reaction) or an off-hand attack (Bonus action); anything
 * the app doesn't know about can be allowed once.
 */
function BlockedPrompt({ row, need, onChoose }: { row: Row; need: Slot; onChoose: (slot: Slot | 'ignore' | 'newTurn' | 'cancel') => void }) {
  const { t } = useTranslation()
  const turn = useTurn()
  const btn = 'rounded border border-border px-2.5 py-0.5 hover:bg-bg'
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 rounded border border-danger bg-danger/5 p-2 text-sm">
      <span className="font-semibold text-danger">⛔ {t('turn.blocked', { slot: t(`turn.${need}`) })}</span>
      {row.attack && need === 'action' && slotFree(turn, 'reaction') && (
        <button className={btn} onClick={() => onChoose('reaction')}>
          {actionTypeIcon.reaction} {t('turn.asReaction')}
        </button>
      )}
      {row.attack && need === 'action' && slotFree(turn, 'bonusAction') && (
        <button className={btn} onClick={() => onChoose('bonusAction')}>
          {actionTypeIcon.bonusAction} {t('turn.asBonus')}
        </button>
      )}
      <button className={btn} onClick={() => onChoose('ignore')} title={t('turn.ignoreHint')}>
        {t('turn.ignoreOnce')}
      </button>
      <button className={`${btn} font-semibold`} onClick={() => onChoose('newTurn')}>
        🔄 {t('turn.newTurn')}
      </button>
      <button className="text-muted underline" onClick={() => onChoose('cancel')}>
        {t('cancel')}
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
  const mode = useSettings((s) => s.turnMode)
  const [filter, setFilter] = useState<Filter>('all')
  const [prompt, setPrompt] = useState<string>()
  const [blocked, setBlocked] = useState<{ key: string; need: Slot; at?: { x: number; y: number } }>()
  const [denied, setDenied] = useState<{ key: string; at: number }>()
  const rows = [...sheet.attacks.map((a) => attackRow(a, content)), ...sheet.activities.map(activityRow)].sort((a, b) => a.order - b.order)
  const visible = rows.filter((r) => filter === 'all' || r.actionType === filter)
  const filters: Filter[] = ['all', 'action', 'bonusAction', 'reaction', 'other']
  const count = (f: Filter) => rows.filter((r) => f === 'all' || r.actionType === f).length

  /** Which turn slot a row needs right now ('none' for free things and Extra Attack follow-ups). */
  const needOf = (r: Row): Slot | 'none' => {
    if (r.attack) return turn.attacksLeft > 0 ? 'none' : 'action'
    return r.actionType === 'other' ? 'none' : r.actionType
  }

  /** Pay, record and animate. `slot` is the turn slot actually spent ('none' when ignored). */
  async function perform(r: Row, slot: Slot | 'none', at?: { x: number; y: number }, roll?: number) {
    const before = snapshotTurn()
    const result = r.attack ? makeAttack(character, r.attack) : performActivity(character, sheet, r.activity!, roll)
    const group = await run(result)
    if (!group) return
    if (mode !== 'off') {
      turn.use(slot, r.attack && slot === 'action' ? { perAction: r.attack.attacksPerAction } : undefined)
      if (r.activity?.activity.grants === 'action') turn.surge()
      rememberTurn(group.id, before)
    }
    const kind = r.attack ? (r.attack.weapon?.magic ? 'magic' : 'physical') : r.activity?.activity.fx
    if (kind) fx(kind, at)
  }

  async function activate(r: Row, el: Element) {
    const at = centerOf(el)
    if (!r.available) {
      // Nothing left of the resource itself: always refused, whatever the turn mode.
      setDenied({ key: r.key, at: Date.now() })
      fx('deny')
      return toast(t(r.attack ? 'errors.noAmmo' : 'errors.notEnough', { name: r.name }), { tone: 'error' })
    }
    const need = needOf(r)
    if (mode !== 'off' && need !== 'none' && !slotFree(turn, need)) {
      turn.flashSlot(need)
      if (mode === 'strict') {
        fx('deny')
        return setBlocked({ key: r.key, need, at })
      }
    }
    if (r.activity?.activity.roll?.kind === 'heal') return setPrompt(r.key)
    await perform(r, need, at)
  }

  async function chooseBlocked(r: Row, choice: Slot | 'ignore' | 'newTurn' | 'cancel') {
    const at = blocked?.at
    setBlocked(undefined)
    if (choice === 'cancel') return
    if (choice === 'newTurn') {
      turn.newTurn()
      return void activate(r, document.body)
    }
    if (r.activity?.activity.roll?.kind === 'heal') return setPrompt(r.key)
    await perform(r, choice === 'ignore' ? 'none' : choice, at)
  }

  async function finishRoll(r: Row, roll?: number) {
    setPrompt(undefined)
    if (roll === -1) return
    const need = needOf(r)
    await perform(r, mode === 'strict' && need !== 'none' && !slotFree(turn, need) ? 'none' : need, undefined, roll)
  }

  return (
    <Panel title={t('sheet.actions')} icon="⚔️" className="flex min-h-0 flex-1 flex-col">
      {mode !== 'off' && <TurnBar />}
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
          <li key={denied?.key === r.key ? `${r.key}-${denied.at}` : r.key} className={`rounded py-1.5 ${r.available ? '' : 'opacity-45'} ${denied?.key === r.key ? 'fx-flash' : ''}`}>
            <div
              role="button"
              tabIndex={0}
              className="flex cursor-pointer items-start gap-3 rounded px-1 hover:bg-bg"
              onClick={(e) => void activate(r, e.currentTarget)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                void activate(r, e.currentTarget)
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
            {blocked?.key === r.key && <BlockedPrompt row={r} need={blocked.need} onChoose={(c) => void chooseBlocked(r, c)} />}
            {prompt === r.key && r.activity && <RollPrompt row={r.activity} onDone={(roll) => void finishRoll(r, roll)} />}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-muted">{t('sheet.actionsHint')}</p>
    </Panel>
  )
}
