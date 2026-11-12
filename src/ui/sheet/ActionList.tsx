import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import type { ContentIndex } from '../../content'
import type { ActionType, Entity } from '../../content/schema'
import { makeAttack, performActivity } from '../../engine/actions'
import { pickUpThrown, recoverAmmo, reload } from '../../engine/inventory'
import { offhandEligible } from '../../engine/items'
import type { ActivityRow, AttackRow } from '../../engine/derive'
import { spellBrief, spellDice, upcastNote, type SpellRow } from '../../engine/spells'
import { useCastSpell } from '../spells/useCastSpell'
import { CastPrompt } from '../spells/CastPrompt'
import { useOnResetFilters } from './shortcuts'
import { castOptions } from '../../engine/spellActions'
import { RuleRef } from '../rules/RuleRef'
import { useSettings } from '../../state/settings'
import { centerOf, fx } from '../fx/fx'
import { toast } from '../toast'
import { Dots, Panel } from './common'
import { useRun, useSheet } from './context'
import { Editable } from './Editable'
import { actionTypeClass, actionTypeIcon, actionTypeShort, categoryIcon, signed, type ActionCategory } from './format'
import { attacksLeft, rememberTurn, slotFree, slotMax, snapshotTurn, useTurn, type Slot } from './turn'

type Filter = 'all' | ActionType
type CategoryFilter = 'all' | ActionCategory

/** One row in the BG3-style action list. */
type Row = {
  key: string
  name: string
  entity?: Entity
  actionType: ActionType
  category: ActionCategory
  /** One-line effect shown under the details (spells). */
  brief?: string
  details: React.ReactNode[]
  uses?: { remaining: number; max: number }
  available: boolean
  order: number
  attack?: AttackRow
  activity?: ActivityRow
  spellRow?: SpellRow
}

const sectionOrder = { attack: 0, activity: 1, spell: 2, item: 3 }

function spellRow(r: SpellRow, characterLevel: number, mod: number): Row {
  const s = r.spell
  const dice = spellDice(s, Math.max(1, s.level), characterLevel, mod)
  const details: React.ReactNode[] = [<span key="lvl" className="text-xs text-muted">{s.level === 0 ? 'Cantrip' : `L${s.level}`}</span>]
  if (s.attack) details.push(<strong key="hit">{signed(r.attackBonus)}</strong>)
  if (s.save) details.push(<strong key="dc">DC {r.dc} {s.save.toUpperCase()}</strong>)
  if (dice.damage) details.push(<span key="dmg">{dice.damage}</span>)
  if (dice.heal) details.push(<span key="heal">❤️ {dice.heal}</span>)
  details.push(<span key="range" className="text-xs text-muted">{s.range}</span>)
  if (s.concentration) details.push(<span key="c" className="text-xs">🔮</span>)
  return {
    key: `spell:${r.key}`,
    name: s.name,
    entity: s,
    actionType: s.actionType,
    // Spells that hit or hurt a target with an attack roll or a damaging save, vs every other spell.
    category: s.attack || (s.save && s.damage) ? 'spellAttack' : 'magic',
    brief: [spellBrief(s), upcastNote(s)].filter(Boolean).join(' '),
    details,
    available: true,
    order: sectionOrder.spell,
    spellRow: r,
  }
}

function attackRow(a: AttackRow, content: ContentIndex): Row {
  const details: React.ReactNode[] = [
    <strong key="hit">
      <Editable value={a.attack} overrideKey={`attack:${a.key}`} label={`${a.name}: ${i18n.t('edit.attackBonus')}`} format={signed} />
    </strong>,
    <span key="dmg">
      {/* A flat "1" (Unarmed Strike) is shown as its total. */}
      {a.damageDice === '1' ? (
        <Editable value={a.damage} overrideKey={`damage:${a.key}`} label={`${a.name}: ${i18n.t('edit.damageBonus')}`} format={(n) => String(Math.max(1, 1 + n))} />
      ) : (
        <>
          {a.damageDice}
          {a.damage.value || a.damage.overridden ? (
            <Editable value={a.damage} overrideKey={`damage:${a.key}`} label={`${a.name}: ${i18n.t('edit.damageBonus')}`} format={signed} />
          ) : null}
        </>
      )}{' '}
      {a.damageType}
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
  if (a.loaded) details.push(<span key="loaded">🔫 {a.loaded.rounds}/{a.loaded.size}</span>)
  if (a.notes.length) {
    details.push(
      <span key="notes" className="min-w-0 flex-1 truncate text-xs text-muted" title={a.notes.map((n) => i18n.t(`attackNotes.${n}`)).join('\n')}>
        ⓘ {a.notes.map((n) => i18n.t(`attackNotes.${n}`)).join(' · ')}
      </span>,
    )
  }
  return {
    key: `attack:${a.key}`,
    name: a.name,
    entity: a.weapon,
    actionType: 'action',
    category: 'weapon',
    details,
    uses: a.ammo ? { remaining: a.ammo.remaining, max: a.ammo.remaining } : undefined,
    // A melee weapon with Thrown can still strike in melee when none are left to throw.
    available: (!a.ammo || a.ammo.remaining > 0 || !!a.loaded || a.weapon?.range === 'melee') && (!a.loaded || a.loaded.rounds > 0),
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
  if (a.dc) {
    details.push(
      <strong key="dc">
        DC <Editable value={a.dc} overrideKey={`dc:${a.source.grantKey}:${a.activity.id}`} label={`${a.activity.name}: DC`} />
        {a.activity.saveAbility ? ` ${a.activity.saveAbility.toUpperCase()}` : ''}
      </strong>,
    )
  }
  if (a.activity.costsAttack) details.push(<span key="replaces" className="rounded bg-emerald-600/15 px-1.5 text-xs font-semibold">⚔️ {i18n.t('turn.replacesAttack')}</span>)
  if (a.activity.perTurn) details.push(<span key="perTurn" className="text-xs text-muted">{i18n.t('turn.perTurn', { count: a.activity.perTurn })}</span>)
  if (a.activity.perAttack) details.push(<span key="perAttack" className="text-xs text-muted">{i18n.t('turn.perAttack')}</span>)
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
    // Maneuvers, Grapple/Shove and the like replace an attack; magic items and spell-like features are magic.
    category: a.activity.costsAttack ? 'weapon' : a.activity.fx === 'magic' || (isItem && 'magic' in a.source.entity && a.source.entity.magic) ? 'magic' : 'other',
    details,
    uses: a.uses && { remaining: a.uses.remaining, max: a.uses.max },
    available: a.available,
    order: isItem ? sectionOrder.item : sectionOrder.activity,
    activity: a,
  }
}

export function TurnBar() {
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
      <button
        className="ml-auto rounded-card border-2 border-accent bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent hover:bg-accent hover:text-accent-text"
        onClick={turn.newTurn}
        title={`${t('turn.newTurnHint')} (N)`}
      >
        🔄 {t('turn.newTurn')}
      </button>
    </div>
  )
}

/** The Attack action in progress: attacks made and left, with the weapon-switching reminder. */
function AttackBanner() {
  const { t } = useTranslation()
  const { character } = useSheet()
  const turn = useTurn()
  const aa = turn.attackAction
  if (!aa) return null
  const left = aa.total - aa.used
  return (
    <div
      key={turn.flash?.slot === 'attack' ? turn.flash.at : 'banner'}
      className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-emerald-600/50 bg-emerald-600/10 px-2 py-1 text-sm ${turn.flash?.slot === 'attack' ? 'fx-flash' : ''}`}
    >
      <span className="font-semibold">
        ⚔️ {t('turn.attackAction', { used: aa.used, total: aa.total })}
        {left > 0 && <span className="ml-1 text-emerald-700 dark:text-emerald-300">· {t('turn.attacksLeft', { count: left })}</span>}
      </span>
      <span className="text-muted">{aa.names.join(', ')}</span>
      <span className="text-xs text-muted">🔁 {t(character.edition === '2024' ? 'turn.switch2024' : 'turn.switch2014')}</span>
      <button className="ml-auto rounded border border-border px-2 py-0.5 text-xs hover:bg-bg" onClick={turn.endAttack}>
        {t('turn.endAttack')}
      </button>
    </div>
  )
}

type Problem = { kind: 'slot'; slot: Slot } | { kind: 'perTurn' } | { kind: 'perAttack' }
type Choice = Slot | 'ignore' | 'newTurn' | 'cancel'

/** Summary of spellcasting in the action panel; opens the Spellcasting panel. */
function MagicTile({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation()
  const { character, sheet } = useSheet()
  const sc = sheet.spellcasting
  const left = (key: string) => sheet.resources.find((r) => r.key === key)
  const caster = sc.casters[0]
  const favorites = sc.rows.filter((r) => character.favoriteSpells.includes(r.spell.id)).length
  return (
    <button
      onClick={onOpen}
      className="mt-2 flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-card border-2 border-violet-500/50 bg-violet-500/10 px-3 py-2 text-left text-sm hover:bg-violet-500/20"
    >
      <span className="font-heading text-base font-semibold">✨ {t('spells.magic')}</span>
      {caster && (
        <span>
          DC <strong>{caster.dc}</strong> · <strong>{signed(caster.attack)}</strong> {t('spells.toHit')}
        </span>
      )}
      {sc.slots.map((s) => {
        const st = left(s.key)!
        return (
          <span key={s.key} className="flex items-center gap-1 text-xs">
            {s.level}. <Dots remaining={st.remaining} max={st.max} />
          </span>
        )
      })}
      {sc.pact && (
        <span className="flex items-center gap-1 text-xs">
          {t('spells.pactShort', { level: sc.pact.level })} <Dots remaining={left('pact')!.remaining} max={left('pact')!.max} />
        </span>
      )}
      {character.concentration && <span className="text-violet-700 dark:text-violet-300">🔮 {character.concentration.name}</span>}
      <span className="ml-auto text-xs text-muted">
        ★ {t('spells.inActions', { count: favorites })} · {t('spells.open')} ›
      </span>
    </button>
  )
}

/**
 * Strict mode: something isn't available. Weapon attacks can still be an
 * Opportunity Attack (Reaction) or an off-hand attack (Bonus action); anything
 * the app doesn't know about can be allowed once.
 */
function BlockedPrompt({ row, problem, onChoose }: { row: Row; problem: Problem; onChoose: (c: Choice) => void }) {
  const { t } = useTranslation()
  const turn = useTurn()
  const btn = 'rounded border border-border px-2.5 py-0.5 hover:bg-bg'
  const message =
    problem.kind === 'slot' ? t('turn.blocked', { slot: t(`turn.${problem.slot}`) }) : problem.kind === 'perTurn' ? t('turn.blockedPerTurn') : t('turn.blockedPerAttack')
  const weaponAttack = row.attack && problem.kind === 'slot' && problem.slot === 'action'
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 rounded border border-danger bg-danger/5 p-2 text-sm">
      <span className="font-semibold text-danger">⛔ {message}</span>
      {weaponAttack && slotFree(turn, 'reaction') && (
        <button className={btn} onClick={() => onChoose('reaction')}>
          {actionTypeIcon.reaction} {t('turn.asReaction')}
        </button>
      )}
      {weaponAttack && slotFree(turn, 'bonusAction') && (
        <button className={btn} onClick={() => onChoose('bonusAction')}>
          {actionTypeIcon.bonusAction} {t('turn.asBonus')}
        </button>
      )}
      <button className={btn} onClick={() => onChoose('ignore')} title={t('turn.ignoreHint')}>
        {t('turn.ignoreOnce')}
      </button>
      {problem.kind === 'slot' && (
        <button className={`${btn} font-semibold`} onClick={() => onChoose('newTurn')}>
          🔄 {t('turn.newTurn')}
        </button>
      )}
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

export function ActionList({ onOpenSpells }: { onOpenSpells?: () => void }) {
  const { t } = useTranslation()
  const { character, sheet, content } = useSheet()
  const run = useRun()
  const turn = useTurn()
  const mode = useSettings((s) => s.turnMode)
  const [filter, setFilter] = useState<Filter>('all')
  const [prompt, setPrompt] = useState<string>()
  const [blocked, setBlocked] = useState<{ key: string; problem: Problem; at?: { x: number; y: number } }>()
  const [denied, setDenied] = useState<{ key: string; at: number }>()
  const rows = [
    ...sheet.attacks.map((a) => attackRow(a, content)),
    ...sheet.activities.map(activityRow),
    // Only spells marked ★ in the Spellcasting panel; the rest live in that panel.
    ...sheet.spellcasting.rows
      .filter((r) => !r.ritualOnly && character.favoriteSpells.includes(r.spell.id))
      .map((r) => spellRow(r, sheet.characterLevel, sheet.mods[r.ability])),
  ].sort((a, b) => a.order - b.order)
  const [casting, setCasting] = useState<string>()
  const { quickCast } = useCastSpell()
  const [category, setCategory] = useState<CategoryFilter>('all')
  useOnResetFilters(
    useCallback(() => {
      setFilter('all')
      setCategory('all')
    }, []),
  )
  const typeOk = (r: Row, f: Filter) => f === 'all' || r.actionType === f
  const categoryOk = (r: Row, c: CategoryFilter) => c === 'all' || r.category === c
  const visible = rows.filter((r) => typeOk(r, filter) && categoryOk(r, category))
  const filters: Filter[] = ['all', 'action', 'bonusAction', 'reaction', 'other']
  const categories: CategoryFilter[] = ['all', 'weapon', 'spellAttack', 'magic', 'other']
  // Each filter row counts within the other row's current choice.
  const count = (f: Filter) => rows.filter((r) => typeOk(r, f) && categoryOk(r, category)).length
  const countCategory = (c: CategoryFilter) => rows.filter((r) => typeOk(r, filter) && categoryOk(r, c)).length
  const perAction = sheet.attacks[0]?.attacksPerAction ?? 1

  /** Melee weapons with the Thrown property: clicking the row is a melee attack; throwing has its own button. */
  const meleeThrown = (r: Row) => !!r.attack?.properties.includes('thrown') && r.attack.weapon?.range === 'melee'

  /** Attacks and things that replace an attack belong to the Attack action. */
  const attackLike = (r: Row) => !!r.attack || !!r.activity?.activity.costsAttack
  /** Turn slots a row spends right now: an attack within a running Attack action spends none. */
  const slotsOf = (r: Row): Slot[] => {
    const slots: Slot[] = []
    if (attackLike(r) && attacksLeft(turn) === 0) slots.push('action')
    const type = r.actionType
    if ((r.activity || r.spellRow) && type !== 'other' && !(attackLike(r) && type === 'action')) slots.push(type)
    return slots
  }
  const limitKey = (r: Row) => `activity:${r.key}`
  const problemOf = (r: Row): Problem | undefined => {
    const slot = slotsOf(r).find((x) => !slotFree(turn, x))
    if (slot) return { kind: 'slot', slot }
    const a = r.activity?.activity
    if (a?.perTurn && (turn.perTurn[limitKey(r)] ?? 0) >= a.perTurn) return { kind: 'perTurn' }
    if (a?.perAttack && turn.perAttack.includes(a.perAttack)) return { kind: 'perAttack' }
  }

  /** Pay, record and animate. `as` spends a different slot (Opportunity Attack…) or none ("ignore"). */
  async function perform(r: Row, as?: Slot | 'ignore', at?: { x: number; y: number }, roll?: number, thrown = false) {
    const result = r.attack ? makeAttack(character, r.attack, undefined, { thrown }) : performActivity(character, sheet, r.activity!, roll)
    if (!result.ok) return void run(result)
    const before = snapshotTurn()
    let actionId: string | undefined
    if (mode !== 'off') {
      const pay = as !== 'ignore'
      if (as === 'reaction' || as === 'bonusAction') {
        // A single attack outside the Attack action (Opportunity Attack, off-hand attack).
        turn.use(as)
      } else if (attackLike(r)) {
        actionId = turn.attack(r.name, perAction, pay)
        if (r.attack?.item && offhandEligible(r.attack.weapon, character.edition)) turn.setLightAttack(r.attack.item.uid)
        if (pay) for (const s of slotsOf(r).filter((x) => x !== 'action')) turn.use(s)
      } else if (pay) {
        for (const s of slotsOf(r)) turn.use(s)
      }
      const a = r.activity?.activity
      if (a?.grants === 'action') turn.surge()
      if (a?.perTurn) turn.countPerTurn(limitKey(r))
      if (a?.perAttack) turn.markPerAttack(a.perAttack)
      // A maneuver used on an attack belongs to that Attack action in history.
      if (!actionId && a?.perAttack) actionId = useTurn.getState().attackAction?.id
    }
    const group = await run(result, { actionId })
    if (group) rememberTurn(group.id, before)
    const kind = r.attack ? (r.attack.weapon?.magic ? 'magic' : 'physical') : r.activity?.activity.fx
    if (kind) fx(kind, at)
  }

  async function activate(r: Row, el: Element, thrown = false) {
    const at = centerOf(el)
    if (!r.available && (thrown || !meleeThrown(r))) {
      // Nothing left of the resource itself: always refused, whatever the turn mode.
      setDenied({ key: r.key, at: Date.now() })
      fx('deny')
      return toast(t(r.attack ? 'errors.noAmmo' : 'errors.notEnough', { name: r.name }), { tone: 'error' })
    }
    const problem = mode === 'off' ? undefined : problemOf(r)
    if (problem) {
      turn.flashSlot(problem.kind === 'slot' ? problem.slot : 'attack')
      if (mode === 'strict') {
        fx('deny')
        return setBlocked({ key: r.key, problem, at })
      }
    }
    if (r.spellRow) {
      // Cast right away with the default slot (undo is in history); ▾ picks another slot.
      return void quickCast(r.spellRow, undefined, at)
    }
    if (r.activity?.activity.roll?.kind === 'heal') return setPrompt(r.key)
    await perform(r, undefined, at, undefined, thrown)
  }

  async function chooseBlocked(r: Row, choice: Choice) {
    const at = blocked?.at
    setBlocked(undefined)
    if (choice === 'cancel') return
    if (choice === 'newTurn') {
      turn.newTurn()
      return void activate(r, document.body)
    }
    if (r.spellRow) return void quickCast(r.spellRow, choice, at)
    if (r.activity?.activity.roll?.kind === 'heal') return setPrompt(r.key)
    await perform(r, choice, at)
  }

  async function finishRoll(r: Row, roll?: number) {
    setPrompt(undefined)
    if (roll === -1) return
    await perform(r, mode === 'strict' && problemOf(r) ? 'ignore' : undefined, undefined, roll)
  }

  /** Cleave (2024 mastery): one extra attack per turn against a second creature. */
  async function cleave(r: Row, el: Element) {
    const at = centerOf(el)
    const key = 'mastery:cleave'
    if (mode !== 'off' && (turn.perTurn[key] ?? 0) >= 1) {
      turn.flashSlot('attack')
      if (mode === 'strict') {
        fx('deny')
        return toast(t('turn.blockedPerTurn'), { tone: 'error' })
      }
    }
    const result = makeAttack(character, { ...r.attack!, name: `Cleave: ${r.attack!.name}`, ammo: undefined })
    if (!result.ok) return void run(result)
    const before = snapshotTurn()
    if (mode !== 'off') turn.countPerTurn(key)
    const group = await run(result)
    if (group) rememberTurn(group.id, before)
    fx('physical', at)
  }

  /**
   * Light property extra attack with a different Light weapon: a Bonus Action,
   * no ability modifier to damage. 2024 Nick mastery: part of the Attack action
   * instead, once per turn.
   */
  const lightRow = rows.find((x) => x.attack?.item?.uid === turn.lightAttack)
  const offhandAllowed = (r: Row) =>
    !!r.attack?.offhand && !!turn.lightAttack && (turn.lightAttack !== r.attack.item?.uid || (r.attack.item?.quantity ?? 0) >= 2)
  const nickAvailable = (r: Row) =>
    character.edition === '2024' && (r.attack?.mastery === 'nick' || lightRow?.attack?.mastery === 'nick') && !(turn.perTurn['mastery:nick'] ?? 0)

  async function offhand(r: Row, el: Element) {
    const at = centerOf(el)
    const nick = nickAvailable(r)
    if (mode !== 'off' && !nick && !slotFree(turn, 'bonusAction')) {
      turn.flashSlot('bonusAction')
      if (mode === 'strict') {
        fx('deny')
        return toast(t('turn.blocked', { slot: t('turn.bonusAction') }), { tone: 'error' })
      }
    }
    const label = `${t('turn.offhand')}: ${r.attack!.name}`
    const result = makeAttack(character, { ...r.attack!, damageBonus: r.attack!.offhand!.damageBonus }, label)
    if (!result.ok) return void run(result)
    const before = snapshotTurn()
    if (mode !== 'off') {
      if (nick) turn.countPerTurn('mastery:nick')
      else turn.use('bonusAction')
      turn.setLightAttack('')
    }
    const group = await run(result, { actionId: nick ? useTurn.getState().attackAction?.id : undefined })
    if (group) rememberTurn(group.id, before)
    fx('physical', at)
  }

  const fired = Object.values(character.ammoSpent).reduce((a, b) => a + b, 0)
  const thrown = Object.values(character.thrownOut).reduce((a, b) => a + b, 0)

  return (
    <Panel title={t('sheet.actions')} icon="⚔️" className="flex min-h-0 flex-1 flex-col">
      {mode !== 'off' && <TurnBar />}
      {sheet.spellcasting.any && onOpenSpells && <MagicTile onOpen={onOpenSpells} />}
      {mode !== 'off' && <AttackBanner />}
      <div className="mt-2 flex flex-wrap gap-1" role="tablist" aria-label={t('actionFilter.byCategory')}>
        {categories.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={category === c}
            className={`rounded-full border px-3 py-1 text-sm ${category === c ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
            onClick={() => setCategory(c)}
          >
            {c !== 'all' && <span aria-hidden>{categoryIcon[c]} </span>}
            {t(`actionCategory.${c}`)} <span className="opacity-60">{countCategory(c)}</span>
          </button>
        ))}
      </div>
      <div className="mb-2 mt-1 flex flex-wrap gap-1" role="tablist" aria-label={t('actionFilter.byType')}>
        {filters.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${filter === f ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
            onClick={() => setFilter(f)}
          >
            {f !== 'all' && <span aria-hidden>{actionTypeIcon[f]} </span>}
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
              <span className="mt-0.5 w-6 shrink-0 text-center text-lg leading-none" title={t(`actionCategory.${r.category}`)} aria-label={t(`actionCategory.${r.category}`)}>
                {categoryIcon[r.category]}
              </span>
              <div className="min-w-0 flex-1">
                <RuleRef entity={r.entity} content={content} className="font-semibold" editable={!r.attack && !r.spellRow}>
                  {r.name}
                </RuleRef>
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">{r.details}</div>
                {r.brief && (
                  <p className="truncate text-xs text-muted" title={r.brief}>
                    {r.brief}
                  </p>
                )}
              </div>
              {meleeThrown(r) && (
                <button
                  className="shrink-0 rounded border border-border px-2 py-0.5 text-xs font-semibold hover:bg-bg disabled:opacity-40"
                  disabled={!r.available}
                  title={t('turn.throwHint')}
                  onClick={(e) => {
                    e.stopPropagation()
                    void activate(r, e.currentTarget, true)
                  }}
                >
                  🎯 {t('turn.throw')}
                </button>
              )}
              {offhandAllowed(r) && (
                <button
                  className="shrink-0 rounded border border-amber-500 px-2 py-0.5 text-xs font-semibold text-amber-700 hover:bg-amber-500 hover:text-white dark:text-amber-300"
                  title={t('turn.offhandHint', { damage: `${r.attack!.damageDice}${r.attack!.offhand!.damageBonus ? signed(r.attack!.offhand!.damageBonus) : ''}` })}
                  onClick={(e) => {
                    e.stopPropagation()
                    void offhand(r, e.currentTarget)
                  }}
                >
                  {nickAvailable(r) ? `🗡️ Nick` : `✨ ${t('turn.offhand')}`}
                </button>
              )}
              {r.attack?.loaded && (
                <button
                  className="shrink-0 rounded border border-border px-2 py-0.5 text-xs font-semibold hover:bg-bg"
                  onClick={(e) => {
                    e.stopPropagation()
                    void run(reload(character, r.attack!))
                  }}
                >
                  🔄 {t('turn.reload')}
                </button>
              )}
              {r.attack?.mastery === 'cleave' && (
                <button
                  className="shrink-0 rounded border border-accent px-2 py-0.5 text-xs font-semibold text-accent hover:bg-accent hover:text-accent-text"
                  title={t('turn.cleaveHint')}
                  onClick={(e) => {
                    e.stopPropagation()
                    void cleave(r, e.currentTarget)
                  }}
                >
                  ↯ Cleave
                </button>
              )}
              {r.spellRow && castOptions(r.spellRow, sheet).length > 1 && (
                <button
                  className="shrink-0 rounded border border-violet-500/60 px-1.5 py-0.5 text-xs font-semibold text-violet-700 hover:bg-violet-500/10 dark:text-violet-300"
                  title={t('spells.castHow')}
                  aria-label={t('spells.castHow')}
                  onClick={(e) => {
                    e.stopPropagation()
                    setCasting(casting === r.key ? undefined : r.key)
                  }}
                >
                  ▾
                </button>
              )}
              {r.uses && (
                <span className="shrink-0 pt-1 text-sm" title={t('sheet.usesLeft')}>
                  {r.uses.max === r.uses.remaining && r.uses.max > 10 ? `${r.uses.remaining}` : <Dots remaining={r.uses.remaining} max={r.uses.max} />}
                </span>
              )}
            </div>
            {casting === r.key && r.spellRow && (
              <CastPrompt
                row={r.spellRow}
                onDone={() => setCasting(undefined)}
              />
            )}
            {blocked?.key === r.key && <BlockedPrompt row={r} problem={blocked.problem} onChoose={(c) => void chooseBlocked(r, c)} />}
            {prompt === r.key && r.activity && <RollPrompt row={r.activity} onDone={(roll) => void finishRoll(r, roll)} />}
          </li>
        ))}
      </ul>
      {(fired > 0 || thrown > 0) && (
        <div className="mt-1 flex flex-wrap gap-2">
          {fired > 0 && (
            <button className="rounded border border-accent px-3 py-1 text-sm font-semibold text-accent hover:bg-accent/10" onClick={() => void run(recoverAmmo(character, content))}>
              🏹 {t('turn.recoverAmmo', { count: fired })}
            </button>
          )}
          {thrown > 0 && (
            <button className="rounded border border-accent px-3 py-1 text-sm font-semibold text-accent hover:bg-accent/10" onClick={() => void run(pickUpThrown(character, content))}>
              🫴 {t('turn.pickUp', { count: thrown })}
            </button>
          )}
        </div>
      )}
      <p className="mt-1 text-xs text-muted">{t('sheet.actionsHint')}</p>
    </Panel>
  )
}
