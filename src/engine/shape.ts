// Wild Shape forms and companions: changing shape, the beast's HP, adding and tracking companions.
import type { Character } from './character'
import type { CompanionSource } from './creatures'
import { companionVars, viewCreature } from './creatures'
import { resolveScaled } from './formula'
import type { ContentIndex } from '../content'
import { tableRowState, type Activity, type RollTable } from '../content/schema'
import { computeSheet, type Sheet } from './derive'
import type { ActionResult } from './actions'

const done = (character: Character, groupType: string, items: Extract<ActionResult, { ok: true }>['items']): ActionResult => ({ ok: true, character, items, groupType, kind: 'game' })
const STATE = 'state:Wild Shape'

/** Take a beast form (the Wild Shape use itself is paid by its activity). 2014 forms bring their own HP. */
export function startShape(char: Character, content: ContentIndex, creatureId: string, group?: string): ActionResult {
  const creature = content.getTyped(creatureId, 'creature')
  if (!creature) return { ok: false, error: 'noChange' }
  const hp = char.edition === '2014' ? viewCreature(creature, {}).hpMax : undefined
  const toggles = char.toggles.includes(STATE) ? char.toggles : [...char.toggles, STATE]
  return done({ ...char, shape: { creatureId, hp, ...(group ? { group } : {}) }, toggles }, 'shape', [{ type: 'shapeStart', params: { name: creature.name } }])
}

/** Back to the normal form. */
export function endShape(char: Character, content: ContentIndex): ActionResult {
  if (!char.shape && !char.toggles.includes(STATE)) return { ok: false, error: 'noChange' }
  const name = char.shape ? (content.get(char.shape.creatureId)?.name ?? '') : ''
  return done({ ...char, shape: undefined, toggles: char.toggles.filter((t) => t !== STATE) }, 'shape', [{ type: 'shapeEnd', params: { name } }])
}

/** 2014: set the beast form's current HP; at 0 the druid reverts. */
export function setShapeHp(char: Character, sheet: Sheet, content: ContentIndex, value: number): ActionResult {
  if (!char.shape || !sheet.shape?.hp) return { ok: false, error: 'noChange' }
  const hp = Math.max(0, Math.min(sheet.shape.hp.max, Math.round(value)))
  if (hp === sheet.shape.hp.current) return { ok: false, error: 'noChange' }
  if (hp === 0) {
    const end = endShape(char, content)
    return end.ok ? { ...end, items: [{ type: 'shapeHp', before: sheet.shape.hp.current, after: 0 }, ...end.items] } : end
  }
  return done({ ...char, shape: { ...char.shape, hp } }, 'shape', [{ type: 'shapeHp', before: sheet.shape.hp.current, after: hp }])
}

/** 2024 Wild Shape: the known Beast forms. */
export function setShapeForms(char: Character, forms: string[]): ActionResult {
  return { ok: true, character: { ...char, shapeForms: forms }, items: [{ type: 'shapeForms', params: { count: forms.length } }], groupType: 'shape', kind: 'sheet' }
}

let seq = 0
const uid = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`

/** A new familiar, steed, companion or summon at full HP. Familiars and steeds replace the previous one from the same grant. */
export function addCompanion(char: Character, sheet: Sheet, content: ContentIndex, source: CompanionSource, creatureId: string, slot?: number, choice?: string): ActionResult {
  const creature = content.getTyped(creatureId, 'creature')
  if (!creature) return { ok: false, error: 'noChange' }
  const temp: Character = { ...char, companions: [...char.companions, { uid: uid(), creatureId, sourceId: source.entity.id, grantId: source.grant.id, hp: 0, tempHp: 0, slot, choice, used: {} }] }
  // Resolve its HP with the owner's numbers (scaled stat blocks) and the owner's effects on it ("companion:hp").
  const last = temp.companions[temp.companions.length - 1]
  const view = (() => {
    try {
      return computeSheet(temp, content).companions.find((c) => c.entry.uid === last.uid)
    } catch {
      return undefined
    }
  })() ?? viewCreature(creature, companionVars(sheet, source, slot), source.grant.adjust, choice)
  last.hp = view.hpMax
  last.tempHp = view.tempHp
  const single = source.grant.kind === 'familiar' || source.grant.kind === 'steed' || source.grant.kind === 'companion'
  // Summons with a limit (Eldritch Cannon: 1, 2 from level 15): no more than that at once.
  if (!single && source.grant.max !== undefined) {
    const limit = Math.floor(resolveScaled(source.grant.max, companionVars(sheet, source, slot)))
    const already = char.companions.filter((c) => c.sourceId === source.entity.id && c.grantId === source.grant.id).length
    if (already >= limit) return { ok: false, error: 'tooManyCompanions', params: { max: limit, name: source.entity.name } }
  }
  const companions = single ? temp.companions.filter((c) => c === last || !(c.sourceId === source.entity.id && c.grantId === source.grant.id)) : temp.companions
  return done({ ...char, companions }, 'companion', [{ type: 'companionAdd', params: { name: creature.name } }])
}

export function removeCompanion(char: Character, uidToRemove: string, name: string): ActionResult {
  return done({ ...char, companions: char.companions.filter((c) => c.uid !== uidToRemove) }, 'companion', [{ type: 'companionRemove', params: { name } }])
}

/** Companion HP: damage eats temporary HP first; the max comes from its stat block. */
export function adjustCompanionHp(char: Character, uidOf: string, max: number, delta: number, name: string): ActionResult {
  const c = char.companions.find((x) => x.uid === uidOf)
  if (!c || !delta) return { ok: false, error: 'noChange' }
  let { hp, tempHp } = c
  if (delta < 0) {
    const absorbed = Math.min(tempHp, -delta)
    tempHp -= absorbed
    hp = Math.max(0, hp - (-delta - absorbed))
  } else hp = Math.min(max, hp + delta)
  return done({ ...char, companions: char.companions.map((x) => (x.uid === uidOf ? { ...x, hp, tempHp } : x)) }, 'companion', [{ type: 'companionHp', params: { name }, before: c.hp, after: hp }])
}

export function setCompanionHp(char: Character, uidOf: string, max: number, value: number, name: string): ActionResult {
  const c = char.companions.find((x) => x.uid === uidOf)
  if (!c) return { ok: false, error: 'noChange' }
  const hp = Math.max(0, Math.min(max, Math.round(value)))
  if (hp === c.hp) return { ok: false, error: 'noChange' }
  return done({ ...char, companions: char.companions.map((x) => (x.uid === uidOf ? { ...x, hp } : x)) }, 'companion', [{ type: 'companionHp', params: { name }, before: c.hp, after: hp }])
}

export function setCompanionTempHp(char: Character, uidOf: string, value: number, name: string): ActionResult {
  const c = char.companions.find((x) => x.uid === uidOf)
  const tempHp = Math.max(0, Math.round(value))
  if (!c || tempHp === c.tempHp) return { ok: false, error: 'noChange' }
  return done({ ...char, companions: char.companions.map((x) => (x.uid === uidOf ? { ...x, tempHp } : x)) }, 'companion', [{ type: 'companionTempHp', params: { name }, before: c.tempHp, after: tempHp }])
}

/** Spend (or give back, with a negative amount) one use of a companion's limited action. */
export function spendCompanionAction(char: Character, uidOf: string, action: string, max: number, delta = 1): ActionResult {
  const c = char.companions.find((x) => x.uid === uidOf)
  if (!c) return { ok: false, error: 'noChange' }
  const before = c.used[action] ?? 0
  const after = Math.max(0, Math.min(max, before + delta))
  if (after === before) return delta > 0 ? { ok: false, error: 'notEnough', params: { name: action } } : { ok: false, error: 'noChange' }
  const used = { ...c.used, [action]: after }
  if (!after) delete used[action]
  return done({ ...char, companions: char.companions.map((x) => (x.uid === uidOf ? { ...x, used } : x)) }, 'companion', [{ type: 'companionUse', params: { name: action }, before: max - before, after: max - after }])
}

/** The row of a table the total lands on. */
export const tableOutcome = (table: RollTable, total: number) => table.rows.find((r) => total >= r.min && total <= r.max)

/** Lowest and highest total of a table's dice ("2d6" → 2–12). */
export function diceRange(dice: string): { min: number; max: number } {
  const [count, sides] = dice.split('d').map(Number)
  return { min: count, max: count * sides }
}

/** Roll a table's dice with the app (each die 1…sides). */
export function rollDice(dice: string, random: () => number = Math.random): number {
  const [count, sides] = dice.split('d').map(Number)
  let total = 0
  for (let i = 0; i < count; i++) total += 1 + Math.floor(random() * sides)
  return total
}

/**
 * Apply a table outcome (the activity's cost is paid by performActivity): turn into its creature
 * Wild Shape-style, switch on its state (its effects apply while it lasts), or — for an outcome that is
 * only text — add it to the reminders.
 */
export function rollTable(char: Character, content: ContentIndex, activity: Activity, total: number): ActionResult {
  const table = activity.table
  if (!table) return { ok: false, error: 'noChange' }
  const row = tableOutcome(table, total)
  const items: Extract<ActionResult, { ok: true }>['items'] = [{ type: 'tableRoll', params: { name: activity.name, dice: table.dice, total, result: row?.text || '—' } }]
  let c = char
  if (row?.creature) {
    const shaped = startShape(c, content, row.creature, `table:${activity.id}`)
    if (shaped.ok) {
      c = { ...shaped.character, shape: { ...shaped.character.shape!, ...(table.noOwnAbilities ? { noOwnAbilities: true } : {}) } }
      items.push(...shaped.items)
    }
  }
  if (row && (row.effects.length || row.state)) {
    const key = `state:${tableRowState(activity.name, row)}`
    if (!c.toggles.includes(key)) c = { ...c, toggles: [...c.toggles, key] }
  }
  if (row && !row.creature && !row.effects.length && !row.state && row.text) {
    c = { ...c, reminders: [...c.reminders, { uid: `r${Date.now().toString(36)}${(seq++).toString(36)}`, text: `${activity.name}: ${row.text} (${table.dice} = ${total})` }] }
  }
  return done(c, 'table', items)
}

/** Totals no row of a table covers, and totals more than one row covers (for the editor's warning). */
export function tableProblems(dice: string, rows: { min: number; max: number }[]): { gaps: number[]; overlaps: number[] } {
  if (!/^\d+d\d+$/.test(dice)) return { gaps: [], overlaps: [] }
  const { min, max } = diceRange(dice)
  const gaps: number[] = []
  const overlaps: number[] = []
  for (let n = min; n <= max; n++) {
    const hits = rows.filter((r) => n >= r.min && n <= r.max).length
    if (hits === 0) gaps.push(n)
    if (hits > 1) overlaps.push(n)
  }
  return { gaps, overlaps }
}
