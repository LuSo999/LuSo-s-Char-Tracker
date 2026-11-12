// Casting spells and managing the spell list, as pure functions with history
// items. Concentration (SRD 5.1 / 5.2.1): starting another Concentration
// spell ends the previous one; damage calls for a Constitution save of
// DC max(10, half the damage) — rounded down and capped at 30 in 2024;
// becoming Incapacitated ends it.
import type { ContentIndex } from '../content'
import type { ActionResult, HistoryItem } from './actions'
import type { Character } from './character'
import { choiceKey, type ActiveEntity, type Sheet } from './derive'
import type { SpellRow } from './spells'

export type CastHow = { kind: 'slot'; level: number } | { kind: 'pact' } | { kind: 'free' } | { kind: 'ritual' } | { kind: 'cantrip' }

const ok = (character: Character, items: HistoryItem[], groupType: string, kind: 'game' | 'sheet' = 'game'): ActionResult => ({ ok: true, character, items, groupType, kind })

/** Conditions that include Incapacitated (and so end Concentration). */
export const incapacitating = new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious'])

export function concentrationDc(damage: number, edition: string) {
  const dc = Math.max(10, Math.floor(damage / 2))
  return edition === '2024' ? Math.min(30, dc) : dc
}

/** Slot levels this spell can be cast with right now (upcasting included). */
export function castOptions(row: SpellRow, sheet: Sheet): CastHow[] {
  const sc = sheet.spellcasting
  const spell = row.spell
  if (spell.level === 0) return [{ kind: 'cantrip' }]
  const out: CastHow[] = []
  const left = (key: string) => sheet.resources.find((r) => r.key === key)?.remaining ?? 0
  if (row.castable && (!row.limit || left(row.limit) > 0)) {
    for (const s of sc.slots) if (s.level >= spell.level && left(s.key) > 0) out.push({ kind: 'slot', level: s.level })
    // Pact slots: the Warlock's own spells, or any spell when multiclassing (both SRDs).
    if (sc.pact && sc.pact.level >= spell.level && left('pact') > 0) out.push({ kind: 'pact' })
  }
  if (row.atWill || (row.freeCast && left(row.freeCast) > 0)) out.push({ kind: 'free' })
  if (row.canRitual) out.push({ kind: 'ritual' })
  return out
}

/**
 * The cast used by a plain click: a cantrip, the free cast, the lowest slot
 * that fits, Pact slots, and a ritual only when nothing else is left.
 */
export function defaultCast(options: CastHow[]): CastHow | undefined {
  const rank = (o: CastHow) => (o.kind === 'cantrip' ? 0 : o.kind === 'free' ? 1 : o.kind === 'slot' ? 2 + o.level / 10 : o.kind === 'pact' ? 3 : 4)
  return [...options].sort((a, b) => rank(a) - rank(b))[0]
}

export function castSpell(char: Character, sheet: Sheet, row: SpellRow, how: CastHow): ActionResult {
  const spell = row.spell
  const items: HistoryItem[] = []
  let next: Character = char
  const spend = (key: string) => {
    const r = sheet.resources.find((x) => x.key === key)
    if (!r || r.remaining <= 0) return false
    next = { ...next, resourcesUsed: { ...next.resourcesUsed, [key]: r.used + 1 } }
    items.push({ type: 'resource', params: { name: r.resource.name }, before: r.remaining, after: r.remaining - 1 })
    return true
  }
  let level = spell.level
  if ((how.kind === 'slot' || how.kind === 'pact') && row.limit && !spend(row.limit)) return { ok: false, error: 'notEnough', params: { name: spell.name } }
  if (how.kind === 'slot') {
    if (how.level < spell.level) return { ok: false, error: 'slotTooLow' }
    if (!spend(`slot:${how.level}`)) return { ok: false, error: 'noSlot', params: { level: how.level } }
    level = how.level
  } else if (how.kind === 'pact') {
    if (!spend('pact')) return { ok: false, error: 'noSlot', params: { level: sheet.spellcasting.pact?.level ?? 0 } }
    level = sheet.spellcasting.pact!.level
  } else if (how.kind === 'free') {
    if (!row.atWill && (!row.freeCast || !spend(row.freeCast))) return { ok: false, error: 'notEnough', params: { name: spell.name } }
    level = row.freeLevel ?? level
  } else if (how.kind === 'ritual') {
    if (!row.canRitual) return { ok: false, error: 'notRitual' }
  } else if (spell.level !== 0) {
    return { ok: false, error: 'noSlot', params: { level: spell.level } }
  }
  items.unshift({
    type: how.kind === 'ritual' ? 'castRitual' : 'cast',
    params: { name: spell.name, level, how: how.kind },
    entity: spell.id,
  })
  if (spell.concentration) {
    if (char.concentration && char.concentration.spellId !== spell.id) items.push({ type: 'concentrationEnd', params: { name: char.concentration.name } })
    next = { ...next, concentration: { spellId: spell.id, name: spell.name } }
    items.push({ type: 'concentrationStart', params: { name: spell.name }, entity: spell.id })
  }
  return ok(next, items, 'cast')
}

export function endConcentration(char: Character): ActionResult {
  if (!char.concentration) return { ok: false, error: 'noChange' }
  const { concentration: _ended, ...rest } = char
  void _ended
  return ok(rest as Character, [{ type: 'concentrationEnd', params: { name: char.concentration.name }, entity: char.concentration.spellId }], 'cast')
}

/**
 * Add or remove a spell from a class's known list (cantrips, known spells,
 * spellbook) or prepared list, within the class limits. `force` allows going
 * over a limit (e.g. the DM allows it) — the UI asks first.
 */
export function setClassSpell(
  char: Character,
  sheet: Sheet,
  content: ContentIndex,
  classId: string,
  list: 'known' | 'prepared',
  spellId: string,
  on: boolean,
  force = false,
): ActionResult {
  const caster = sheet.spellcasting.casters.find((c) => c.classId === classId)
  const spell = content.getTyped(spellId, 'spell')
  if (!caster || !spell) return { ok: false, error: 'unknownEntity' }
  const current = char.spells[classId] ?? { known: [], prepared: [] }
  const has = current[list].includes(spellId)
  if (has === on) return { ok: false, error: 'noChange' }
  if (on && !force) {
    if (spell.level > caster.maxSpellLevel) return { ok: false, error: 'spellTooHigh', params: { level: spell.level } }
    if (spell.level === 0 && caster.cantrips.length >= caster.cantripsMax) return { ok: false, error: 'limitCantrips', params: { max: caster.cantripsMax } }
    if (spell.level > 0) {
      const counted = list === 'prepared' ? caster.prepared.length : caster.mode === 'known' ? caster.known.length : 0
      if ((list === 'prepared' || caster.mode === 'known') && counted >= caster.spellsMax) return { ok: false, error: 'limitSpells', params: { max: caster.spellsMax } }
    }
  }
  const nextList = on ? [...current[list], spellId] : current[list].filter((id) => id !== spellId)
  // Removing a spell from the spellbook / known list also unprepares it.
  const prepared = list === 'known' && !on ? current.prepared.filter((id) => id !== spellId) : current.prepared
  const entry = { ...current, prepared, [list]: nextList }
  const type = list === 'prepared' ? (on ? 'spellPrepared' : 'spellUnprepared') : on ? 'spellLearned' : 'spellForgotten'
  return ok({ ...char, spells: { ...char.spells, [classId]: entry } }, [{ type, params: { name: spell.name, class: caster.name }, entity: spellId }], 'spells', 'sheet')
}

/** Set the selections of an entity's choice (spells of Magic Initiate, a spell list, an ability…). */
export function setChoice(char: Character, ae: ActiveEntity, choiceId: string, values: string[], label: string): ActionResult {
  const key = choiceKey(ae.grantKey, choiceId)
  const before = char.choices[key] ?? []
  if (JSON.stringify(before) === JSON.stringify(values)) return { ok: false, error: 'noChange' }
  return ok({ ...char, choices: { ...char.choices, [key]: values } }, [{ type: 'choice', params: { what: label }, before: before.join(', '), after: values.join(', ') }], 'spells', 'sheet')
}

/** ★ a spell: it shows up in the action list. */
export function toggleFavoriteSpell(char: Character, spellId: string, name: string): ActionResult {
  const on = !char.favoriteSpells.includes(spellId)
  const favoriteSpells = on ? [...char.favoriteSpells, spellId] : char.favoriteSpells.filter((id) => id !== spellId)
  return ok({ ...char, favoriteSpells }, [{ type: on ? 'favoriteOn' : 'favoriteOff', params: { name }, entity: spellId }], 'spells', 'sheet')
}

/**
 * Font of Magic (Sorcerer, both SRDs). Creating a slot costs Sorcery Points
 * by level — 1: 2, 2: 3, 3: 5, 4: 6, 5: 7, no higher than level 5 (2024 also
 * needs Sorcerer level 2 / 3 / 5 / 7 / 9) — and the slot vanishes on a Long
 * Rest: it's tracked as a negative "used" count, which the rest resets.
 * Converting a slot gives points equal to its level, up to the maximum.
 */
export const slotCost: Record<number, { points: number; minLevel: number }> = {
  1: { points: 2, minLevel: 2 },
  2: { points: 3, minLevel: 3 },
  3: { points: 5, minLevel: 5 },
  4: { points: 6, minLevel: 7 },
  5: { points: 7, minLevel: 9 },
}

export function fontOfMagic(char: Character, sheet: Sheet, pointsKey: string, mode: 'create' | 'convert', level: number, sorcererLevel: number): ActionResult {
  const points = sheet.resources.find((r) => r.key === pointsKey)
  const slot = sheet.resources.find((r) => r.key === `slot:${level}`)
  if (!points || !slot) return { ok: false, error: 'noSlot', params: { level } }
  const used = (key: string, r: { used: number }) => char.resourcesUsed[key] ?? r.used
  if (mode === 'create') {
    const cost = slotCost[level]
    if (!cost || (char.edition === '2024' && sorcererLevel < cost.minLevel)) return { ok: false, error: 'slotTooHigh', params: { level } }
    if (points.remaining < cost.points) return { ok: false, error: 'notEnough', params: { name: points.resource.name } }
    const next = { ...char, resourcesUsed: { ...char.resourcesUsed, [pointsKey]: used(pointsKey, points) + cost.points, [slot.key]: used(slot.key, slot) - 1 } }
    return ok(next, [
      { type: 'slotCreated', params: { level }, before: slot.remaining, after: slot.remaining + 1 },
      { type: 'resource', params: { name: points.resource.name }, before: points.remaining, after: points.remaining - cost.points },
    ], 'use')
  }
  if (slot.remaining <= 0) return { ok: false, error: 'noSlot', params: { level } }
  const gain = Math.min(level, points.max - points.remaining)
  if (gain <= 0) return { ok: false, error: 'noChange' }
  const next = { ...char, resourcesUsed: { ...char.resourcesUsed, [pointsKey]: used(pointsKey, points) - gain, [slot.key]: used(slot.key, slot) + 1 } }
  return ok(next, [
    { type: 'slotConverted', params: { level }, before: slot.remaining, after: slot.remaining - 1 },
    { type: 'resource', params: { name: points.resource.name }, before: points.remaining, after: points.remaining + gain },
  ], 'use')
}
