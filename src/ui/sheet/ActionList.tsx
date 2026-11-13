import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import type { ContentIndex } from '../../content'
import type { ActionType, Entity } from '../../content/schema'
import { makeAttack, performActivity } from '../../engine/actions'
import { pickUpThrown, recoverAmmo, reload, selectAmmo } from '../../engine/inventory'
import { offhandEligible } from '../../engine/items'
import type { ActivityRow, AttackRow } from '../../engine/derive'
import type { CreatureActionView } from '../../engine/creatures'
import { startShape } from '../../engine/shape'
import { ShapePicker } from '../creatures/ShapePicker'
import { actionSummary } from '../creatures/format'
import { spellBrief, spellDice, upcastNote, type SpellRow } from '../../engine/spells'
import { useCastSpell } from '../spells/useCastSpell'
import { CastPrompt } from '../spells/CastPrompt'
import { useOnResetFilters } from './shortcuts'
import { castOptions, fontOfMagic, slotCost } from '../../engine/spellActions'
import { RuleRef } from '../rules/RuleRef'
import { useSettings } from '../../state/settings'
import { centerOf, fx } from '../fx/fx'
import { toast } from '../toast'
import { Dots, Panel } from './common'
import { useRun, useSheet } from './context'
import { Editable } from './Editable'
import { actionTypeClass, actionTypeIcon, actionTypeShort, categoryIcon, signed, type ActionCategory } from './format'
import { attacksLeft, rememberTurn, slotFree, slotMax, snapshotTurn, useTurn, type Slot } from './turn'
import { Term } from '../rules/Term'
import { actionTypeTerm } from '../rules/terms'

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
  /** A beast-form or companion action from a stat block (no engine cost; the turn tracker counts beast-form actions). */
  creature?: { action: CreatureActionView; shape: boolean }
}

const sectionOrder = { attack: 0, activity: 1, spell: 2, item: 3 }

function spellRow(r: SpellRow, characterLevel: number, mod: number): Row {
  const s = r.spell
  const dice = spellDice(s, Math.max(1, s.level), characterLevel, mod, r.damageBonus)
  const details: React.ReactNode[] = [
    s.level === 0 ? (
      <Term key="lvl" id="rule-cantrip" className="text-xs text-muted">Cantrip</Term>
    ) : (
      <Term key="lvl" id="rule-spell-slots" className="text-xs text-muted">{`L${s.level}`}</Term>
    ),
  ]
  if (s.attack) details.push(<Term key="hit" id="rule-spell-attack"><strong>{signed(r.attackBonus)}</strong></Term>)
  if (s.save) details.push(<Term key="dc" id="rule-saving-throw"><strong>DC {r.dc} {s.save.toUpperCase()}</strong></Term>)
  if (dice.damage) details.push(<span key="dmg">{dice.damage}</span>)
  if (dice.heal) details.push(<span key="heal">❤️ {dice.heal}</span>)
  details.push(<span key="range" className="text-xs text-muted">{s.range}</span>)
  if (s.concentration) details.push(<Term key="c" id="rule-concentration" className="text-xs">🔮</Term>)
  return {
    key: `spell:${r.key}`,
    name: s.name,
    entity: s,
    actionType: s.actionType,
    // Spells that hit or hurt a target with an attack roll or a damaging save, vs every other spell.
    category: s.attack || (s.save && s.damage) ? 'spellAttack' : 'magic',
    brief: [spellBrief(s), upcastNote(s), ...r.notes].filter(Boolean).join(' '),
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
  if (a.thrown) details.push(<span key="thrown"><Term id="property-thrown">thrown</Term> {a.thrown.normal}/{a.thrown.long ?? a.thrown.normal} ft</span>)
  if (a.critRange < 20) details.push(<Term key="crit" id="rule-critical-hit">crit {a.critRange}–20</Term>)
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
      <span key="notes" className="min-w-0 flex-1 truncate text-xs text-muted" title={a.notes.map((n) => i18n.t(`attackNotes.${n}`, { defaultValue: n })).join('\n')}>
        ⓘ {a.notes.map((n) => i18n.t(`attackNotes.${n}`, { defaultValue: n })).join(' · ')}
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
    const kind = a.activity.roll?.kind === 'heal' ? 'HP' : a.activity.roll?.kind === 'temp' ? 'Temp HP' : ''
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
    category: a.activity.costsAttack || a.activity.attack ? 'weapon' : a.activity.fx === 'magic' || (isItem && 'magic' in a.source.entity && a.source.entity.magic) ? 'magic' : 'other',
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
        <Term id={actionTypeTerm(slot)!}>
          <span aria-hidden>{actionTypeIcon[slot]}</span> {label}
        </Term>{' '}
        {Math.max(0, max - used)}/{max}
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
          <Term id="rule-saving-throw">
            DC <strong>{caster.dc}</strong>
          </Term>{' '}
          ·{' '}
          <Term id="rule-spell-attack">
            <strong>{signed(caster.attack)}</strong> {t('spells.toHit')}
          </Term>
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
/**
 * Slot choice for activities: expend one slot (Font of Inspiration, Wild
 * Resurgence) or recover expended slots up to a combined level (Arcane Recovery).
 */
function SlotPrompt({ row, onDone }: { row: ActivityRow; onDone: (opts?: { slotKey?: string; recover?: number[] }) => void }) {
  const { t } = useTranslation()
  const { sheet } = useSheet()
  const [picked, setPicked] = useState<number[]>([])
  const res = (key: string) => sheet.resources.find((r) => r.key === key)
  const slots = [...sheet.spellcasting.slots.map((s) => ({ key: s.key, level: s.level })), ...(sheet.spellcasting.pact ? [{ key: 'pact', level: sheet.spellcasting.pact.level }] : [])].filter(
    (s) => s.level >= (row.activity.slotMin ?? 1),
  )
  if (row.recoverSlots === undefined) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded border border-violet-500/60 bg-violet-500/5 p-2 text-sm">
        <span className="font-semibold">{t('slots.spend')}</span>
        {slots.map((s) => (
          <button key={s.key} disabled={(res(s.key)?.remaining ?? 0) <= 0} className="rounded border border-violet-500/60 px-2 py-0.5 hover:bg-violet-500/10 disabled:opacity-40" onClick={() => onDone({ slotKey: s.key })}>
            {s.key === 'pact' ? t('spells.castPact', { level: s.level }) : t('spells.castAt', { level: s.level })} <span className="text-xs text-muted">({res(s.key)?.remaining ?? 0})</span>
          </button>
        ))}
        <button className="text-muted underline" onClick={() => onDone()}>
          {t('cancel')}
        </button>
      </div>
    )
  }
  const budget = row.recoverSlots
  const used = picked.reduce((a, b) => a + b, 0)
  const expended = (level: number) => (res(`slot:${level}`)?.used ?? 0) - picked.filter((l) => l === level).length
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded border border-violet-500/60 bg-violet-500/5 p-2 text-sm">
      <span className="font-semibold">{t('slots.recover', { used, budget })}</span>
      {sheet.spellcasting.slots
        .filter((s) => s.level <= 5)
        .map((s) => (
          <button
            key={s.key}
            disabled={expended(s.level) <= 0 || used + s.level > budget}
            className="rounded border border-violet-500/60 px-2 py-0.5 hover:bg-violet-500/10 disabled:opacity-40"
            onClick={() => setPicked([...picked, s.level])}
          >
            + {t('spells.castAt', { level: s.level })} <span className="text-xs text-muted">({Math.max(0, expended(s.level))})</span>
          </button>
        ))}
      {picked.length > 0 && <span className="text-xs">{picked.map((l) => `L${l}`).join(' + ')}</span>}
      <button disabled={!picked.length} className="rounded bg-accent px-3 py-0.5 font-semibold text-accent-text disabled:opacity-50" onClick={() => onDone({ recover: picked })}>
        {t('slots.apply')}
      </button>
      {picked.length > 0 && (
        <button className="text-muted underline" onClick={() => setPicked([])}>
          {t('slots.clear')}
        </button>
      )}
      <button className="text-muted underline" onClick={() => onDone()}>
        {t('cancel')}
      </button>
    </div>
  )
}

/** Font of Magic: pick the slot level to create (for Sorcery Points) or to turn into points. */
function FontPrompt({ row, onDone }: { row: ActivityRow; onDone: () => void }) {
  const { t } = useTranslation()
  const { character, sheet } = useSheet()
  const run = useRun()
  const mode = row.activity.fontOfMagic!
  const points = sheet.resources.find((r) => r.resource.id === 'sorcery-points')
  const slots = sheet.spellcasting.slots.filter((s) => s.level <= 5)
  const left = (key: string) => sheet.resources.find((r) => r.key === key)?.remaining ?? 0
  async function pick(level: number) {
    if (!points) return
    const group = await run(fontOfMagic(character, sheet, points.key, mode, level, row.source.classLevel))
    if (group) {
      fx('magic')
      if (mode === 'create' && useSettings.getState().turnMode !== 'off') {
        // Creating a slot takes a Bonus Action.
        useTurn.getState().use('bonusAction')
      }
    }
    onDone()
  }
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded border border-violet-500/60 bg-violet-500/5 p-2 text-sm">
      <span className="font-semibold">{t(mode === 'create' ? 'font.create' : 'font.convert')}</span>
      <span className="text-xs text-muted">({points?.remaining ?? 0} SP)</span>
      {slots.map((s) => {
        const cost = slotCost[s.level]
        const disabled = mode === 'create' ? (points?.remaining ?? 0) < cost.points || (character.edition === '2024' && row.source.classLevel < cost.minLevel) : left(s.key) <= 0
        return (
          <button key={s.level} disabled={disabled} className="rounded border border-violet-500/60 px-2 py-0.5 hover:bg-violet-500/10 disabled:opacity-40" onClick={() => void pick(s.level)}>
            {t('spells.castAt', { level: s.level })} <span className="text-xs text-muted">{mode === 'create' ? `−${cost.points} SP` : `+${s.level} SP`}</span>
          </button>
        )
      })}
      <button className="text-muted underline" onClick={onDone}>
        {t('cancel')}
      </button>
    </div>
  )
}

/** Activities that ask for a number first: healing / Temp HP rolls, and points spent from a pool. */
const healing = (r: Row) => ['heal', 'temp'].includes(r.activity?.activity.roll?.kind ?? '')
const slotPicker = (r: Row) => !!r.activity && (r.activity.activity.slotCost || r.activity.recoverSlots !== undefined)
const needsPrompt = (r: Row) => !!r.activity && (r.activity.activity.spendInput || !!r.activity.activity.fontOfMagic || slotPicker(r) || (healing(r) && !!r.activity.rollDice))
/** Healing / Temp HP without dice (Dark One's Blessing): the bonus applies straight away. */
const autoRoll = (r: Row) => (healing(r) && !r.activity?.rollDice ? 0 : undefined)

function RollPrompt({ row, onDone }: { row: ActivityRow; onDone: (roll?: number, spendOnly?: boolean, spent?: number) => void }) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [dice, setDice] = useState('')
  const n = Number.parseInt(value, 10)
  if (row.activity.spendDice) {
    // Dice pool: how many dice, then their rolled total.
    const max = row.uses?.remaining ?? 0
    const d = Number.parseInt(dice, 10)
    const okDice = Number.isFinite(d) && d >= 1 && d <= max
    const okRoll = okDice && Number.isFinite(n) && n >= d && n <= d * row.activity.spendDice
    return (
      <form
        className="mt-1 flex flex-wrap items-center gap-2 rounded border border-accent bg-accent/5 p-2 text-sm"
        onSubmit={(e) => {
          e.preventDefault()
          if (okRoll) onDone(n, false, d)
        }}
      >
        <label className="flex items-center gap-2">
          {t('roll.diceCount', { max })}
          <input autoFocus inputMode="numeric" className="w-12 rounded border border-border bg-card px-1.5 py-0.5 text-center" value={dice} onChange={(e) => setDice(e.target.value.replace(/\D/g, ''))} />
        </label>
        {okDice && (
          <label className="flex items-center gap-2">
            {t('roll.prompt', { dice: `${d}d${row.activity.spendDice}${row.rollBonus ? ` + ${row.rollBonus}` : ''}` })}
            <input inputMode="numeric" className="w-14 rounded border border-border bg-card px-1.5 py-0.5 text-center" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} />
          </label>
        )}
        <button type="submit" disabled={!okRoll} className="rounded bg-accent px-3 py-0.5 font-semibold text-accent-text disabled:opacity-50">
          {t('roll.apply')}
        </button>
        <button type="button" className="text-muted underline" onClick={() => onDone(-1)}>
          {t('cancel')}
        </button>
      </form>
    )
  }
  if (row.activity.spendInput) {
    const max = row.uses?.remaining ?? 0
    const ok = Number.isFinite(n) && n >= 1 && n <= max
    return (
      <form
        className="mt-1 flex flex-wrap items-center gap-2 rounded border border-accent bg-accent/5 p-2 text-sm"
        onSubmit={(e) => {
          e.preventDefault()
          if (ok) onDone(n)
        }}
      >
        <label className="flex items-center gap-2">
          {t('roll.spendPrompt', { max })}
          <input autoFocus inputMode="numeric" className="w-14 rounded border border-border bg-card px-1.5 py-0.5 text-center" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} />
        </label>
        {row.activity.roll?.kind === 'heal' && (
          <button type="submit" disabled={!ok} className="rounded bg-accent px-3 py-0.5 font-semibold text-accent-text disabled:opacity-50">
            {t('roll.healPoints', { n: ok ? n : '…' })}
          </button>
        )}
        <button type={row.activity.roll?.kind === 'heal' ? 'button' : 'submit'} disabled={!ok} className="rounded border border-border px-3 py-0.5 disabled:opacity-50" onClick={() => ok && row.activity.roll?.kind === 'heal' && onDone(n, true)}>
          {t('roll.spendOnly')}
        </button>
        <button type="button" className="text-muted underline" onClick={() => onDone(-1)}>
          {t('cancel')}
        </button>
      </form>
    )
  }
  const total = Number.isFinite(n) ? n + (row.rollBonus ?? 0) : undefined
  const temp = row.activity.roll?.kind === 'temp'
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
      {total !== undefined && <span className="text-muted">{t(temp ? 'roll.temp' : 'roll.heals', { total })}</span>}
      <button type="submit" disabled={total === undefined} className="rounded bg-accent px-3 py-0.5 font-semibold text-accent-text disabled:opacity-50">
        {t('roll.apply')}
      </button>
      {!temp && (
        <button type="button" className="rounded border border-border px-3 py-0.5" onClick={() => onDone(undefined)}>
          {t('roll.withoutHealing')}
        </button>
      )}
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
  const creatureRow = (a: CreatureActionView, i: number, owner: string, shape: boolean, entity: Entity): Row => ({
    key: `${shape ? 'shape' : owner}:${i}`,
    name: shape ? a.name : `${owner}: ${a.name}`,
    entity,
    actionType: a.actionType,
    category: shape ? (a.attack ? 'weapon' : 'other') : 'companion',
    details: [<strong key="s">{actionSummary(a, t('statBlock.toHit'))}</strong>],
    brief: a.description,
    available: true,
    order: shape ? -1 : 50,
    creature: { action: a, shape },
  })
  const rows = [
    // Wild Shape: the beast's actions take the place of weapon attacks.
    ...(sheet.shape?.actions.map((a, i) => creatureRow(a, i, sheet.shape!.creature.name, true, sheet.shape!.creature)) ?? []),
    ...sheet.attacks.map((a) => attackRow(a, content)),
    ...sheet.activities.map(activityRow),
    // Only spells marked ★ in the Spellcasting panel; the rest live in that panel. No casting in Wild Shape.
    ...sheet.spellcasting.rows
      .filter((r) => !sheet.shape && !r.ritualOnly && character.favoriteSpells.includes(r.spell.id))
      .map((r) => spellRow(r, sheet.characterLevel, sheet.mods[r.ability])),
    ...sheet.companions.flatMap((c) => c.actions.map((a, i) => ({ ...creatureRow(a, i, c.entry.name ?? c.creature.name, false, c.creature), key: `${c.entry.uid}:${i}` }))),
  ].sort((a, b) => a.order - b.order)
  const [shaping, setShaping] = useState<Row>()
  /** The form limits of a shapechange row: Wild Shape's, or its own group's (Boon of Fluid Forms). */
  const rulesOf = (r: Row) => {
    const group = r.activity?.activity.shapeGroup
    return group ? sheet.shapeRulesBy[group] : sheet.shapeRules
  }
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
  const categories: CategoryFilter[] = ['all', 'weapon', 'spellAttack', 'magic', 'other', ...(sheet.companions.length ? (['companion'] as const) : [])]
  // Each filter row counts within the other row's current choice.
  const count = (f: Filter) => rows.filter((r) => typeOk(r, f) && categoryOk(r, category)).length
  const countCategory = (c: CategoryFilter) => rows.filter((r) => typeOk(r, filter) && categoryOk(r, c)).length
  const perAction = sheet.attacks[0]?.attacksPerAction ?? 1

  /** Melee weapons with the Thrown property: clicking the row is a melee attack; throwing has its own button. */
  const meleeThrown = (r: Row) => !!r.attack?.properties.includes('thrown') && r.attack.weapon?.range === 'melee'

  /** Attacks and things that replace an attack belong to the Attack action. */
  const attackLike = (r: Row) => !!r.attack || !!r.activity?.activity.costsAttack || (!!r.creature?.shape && !!r.creature.action.attack)
  /** Turn slots a row spends right now: an attack within a running Attack action spends none. */
  const slotsOf = (r: Row): Slot[] => {
    const slots: Slot[] = []
    if (attackLike(r) && attacksLeft(turn) === 0) slots.push('action')
    const type = r.actionType
    if ((r.activity || r.spellRow || r.creature?.shape) && type !== 'other' && !(attackLike(r) && type === 'action')) slots.push(type)
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
  async function perform(
    r: Row,
    as?: Slot | 'ignore',
    at?: { x: number; y: number },
    roll?: number,
    thrown = false,
    spendOnly = false,
    slots: { slotKey?: string; recover?: number[]; spent?: number } = {},
    shapeId?: string,
  ) {
    if (r.creature) {
      // Stat block actions: the turn tracker counts beast-form actions; companions act on their own.
      if (r.creature.shape && mode !== 'off' && as !== 'ignore') {
        if (attackLike(r)) turn.attack(r.name, perAction, true)
        else for (const s of slotsOf(r)) turn.use(s)
      }
      return fx(r.creature.action.attack ? 'physical' : 'power', at)
    }
    let result = r.attack ? makeAttack(character, r.attack, undefined, { thrown }) : performActivity(character, sheet, r.activity!, roll, { spendOnly, ...slots })
    if (result.ok && shapeId) {
      // Wild Shape: pay the use and take the chosen form in one step.
      const shaped = startShape(result.character, content, shapeId, r.activity?.activity.shapeGroup)
      if (shaped.ok) result = { ...result, character: shaped.character, items: [...result.items, ...shaped.items] }
    }
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
    // Wild Shape: choose the beast form first.
    if (r.activity?.activity.toggle === 'Wild Shape' && rulesOf(r)) return setShaping(r)
    if (needsPrompt(r)) return setPrompt(r.key)
    await perform(r, undefined, at, autoRoll(r), thrown)
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
    if (needsPrompt(r)) return setPrompt(r.key)
    await perform(r, choice, at, autoRoll(r))
  }

  async function finishRoll(r: Row, roll?: number, spendOnly = false, spent?: number) {
    setPrompt(undefined)
    if (roll === -1) return
    await perform(r, mode === 'strict' && problemOf(r) ? 'ignore' : undefined, undefined, roll, false, spendOnly, { spent })
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
      <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5 sm:flex-wrap" role="tablist" aria-label={t('actionFilter.byCategory')}>
        {categories.map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={category === c}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-sm ${category === c ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
            onClick={() => setCategory(c)}
          >
            {c !== 'all' && <span aria-hidden>{categoryIcon[c]} </span>}
            {t(`actionCategory.${c}`)} <span className="opacity-60">{countCategory(c)}</span>
          </button>
        ))}
      </div>
      <div className="mb-2 mt-1 flex gap-1 overflow-x-auto pb-0.5 sm:flex-wrap" role="tablist" aria-label={t('actionFilter.byType')}>
        {filters.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs ${filter === f ? 'border-accent bg-accent text-accent-text' : 'border-border hover:bg-bg'}`}
            onClick={() => setFilter(f)}
          >
            {f !== 'all' && <span aria-hidden>{actionTypeIcon[f]} </span>}
            {t(`actionFilter.${f}`)} <span className="opacity-60">{count(f)}</span>
          </button>
        ))}
      </div>
      {shaping && (
        <ShapePicker
          rules={rulesOf(shaping)!}
          onClose={() => setShaping(undefined)}
          onPick={(id) => {
            const r = shaping
            setShaping(undefined)
            void perform(r, undefined, undefined, autoRoll(r), false, false, {}, id)
          }}
        />
      )}
      <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
        {visible.map((r) => (
          <li key={denied?.key === r.key ? `${r.key}-${denied.at}` : r.key} className={`rounded py-1.5 ${r.available ? '' : 'opacity-45'} ${denied?.key === r.key ? 'fx-flash' : ''}`}>
            <div
              role="button"
              tabIndex={0}
              className="flex cursor-pointer items-start gap-2 rounded px-1 hover:bg-bg sm:gap-3"
              onClick={(e) => void activate(r, e.currentTarget)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                void activate(r, e.currentTarget)
              }}
            >
              <span className={`mt-0.5 w-16 shrink-0 rounded px-1 py-0.5 text-center text-[11px] sm:w-20 sm:px-1.5 font-semibold ${actionTypeClass[r.actionType]}`}>
                {actionTypeTerm(r.actionType, !!r.spellRow) ? (
                  <Term id={actionTypeTerm(r.actionType, !!r.spellRow)!}>
                    <span aria-hidden>{actionTypeIcon[r.actionType]}</span> {actionTypeShort[r.actionType]}
                  </Term>
                ) : (
                  <>
                    <span aria-hidden>{actionTypeIcon[r.actionType]}</span> {actionTypeShort[r.actionType]}
                  </>
                )}
              </span>
              <span className="mt-0.5 w-5 shrink-0 text-center text-lg leading-none sm:w-6" title={t(`actionCategory.${r.category}`)} aria-label={t(`actionCategory.${r.category}`)}>
                {categoryIcon[r.category]}
              </span>
              <div className="min-w-0 flex-1">
                <RuleRef entity={r.entity} content={content} className="font-semibold" editable={!r.attack && !r.spellRow}>
                  {r.name}
                </RuleRef>
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-sm [&>*]:whitespace-nowrap">{r.details}</div>
                {r.brief && (
                  <p className="truncate text-xs text-muted" title={r.brief}>
                    {r.brief}
                  </p>
                )}
              </div>
              {/* Extra buttons wrap into a narrow column on small phones instead of squeezing the name. */}
              <div className="flex shrink-0 flex-wrap items-start justify-end gap-1 max-sm:max-w-[5.5rem]">
                {/* Several kinds of ammunition (plain / magic arrows): switch right here. */}
                {r.attack?.item && r.attack.weapon?.ammunition && (() => {
                  const choices = sheet.items.filter((x) => x.ammoKind === r.attack!.weapon!.ammunition && x.entry.quantity > 0)
                  if (choices.length < 2) return null
                  return (
                    <select
                      className="max-w-[9rem] rounded border border-border bg-card px-1 py-0.5 text-xs"
                      aria-label={t('inventory.ammo')}
                      value={r.attack.ammo?.uid ?? ''}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      onChange={(e) => void run(selectAmmo(character, content, r.attack!.item!.uid, e.target.value))}
                    >
                      {choices.map((x) => (
                        <option key={x.entry.uid} value={x.entry.uid}>
                          {x.name} ×{x.entry.quantity}
                        </option>
                      ))}
                    </select>
                  )
                })()}
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
                    {r.uses.max > 4 ? (r.uses.max === r.uses.remaining ? `×${r.uses.remaining}` : `${r.uses.remaining}/${r.uses.max}`) : <Dots remaining={r.uses.remaining} max={r.uses.max} />}
                  </span>
                )}
              </div>
            </div>
            {casting === r.key && r.spellRow && (
              <CastPrompt
                row={r.spellRow}
                onDone={() => setCasting(undefined)}
              />
            )}
            {blocked?.key === r.key && <BlockedPrompt row={r} problem={blocked.problem} onChoose={(c) => void chooseBlocked(r, c)} />}
            {prompt === r.key && r.activity?.activity.fontOfMagic && <FontPrompt row={r.activity} onDone={() => setPrompt(undefined)} />}
            {prompt === r.key && r.activity && slotPicker(r) && (
              <SlotPrompt
                row={r.activity}
                onDone={(opts) => {
                  setPrompt(undefined)
                  if (opts) void perform(r, mode === 'strict' && problemOf(r) ? 'ignore' : undefined, undefined, autoRoll(r), false, false, opts)
                }}
              />
            )}
            {prompt === r.key && r.activity && !r.activity.activity.fontOfMagic && !slotPicker(r) && <RollPrompt row={r.activity} onDone={(roll, spendOnly, spent) => void finishRoll(r, roll, spendOnly, spent)} />}
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
