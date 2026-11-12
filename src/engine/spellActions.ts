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
  if (row.castable) {
    for (const s of sc.slots) if (s.level >= spell.level && left(s.key) > 0) out.push({ kind: 'slot', level: s.level })
    // Pact slots: the Warlock's own spells, or any spell when multiclassing (both SRDs).
    if (sc.pact && sc.pact.level >= spell.level && left('pact') > 0) out.push({ kind: 'pact' })
  }
  if (row.freeCast && left(row.freeCast) > 0) out.push({ kind: 'free' })
  if (row.canRitual) out.push({ kind: 'ritual' })
  return out
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
  if (how.kind === 'slot') {
    if (how.level < spell.level) return { ok: false, error: 'slotTooLow' }
    if (!spend(`slot:${how.level}`)) return { ok: false, error: 'noSlot', params: { level: how.level } }
    level = how.level
  } else if (how.kind === 'pact') {
    if (!spend('pact')) return { ok: false, error: 'noSlot', params: { level: sheet.spellcasting.pact?.level ?? 0 } }
    level = sheet.spellcasting.pact!.level
  } else if (how.kind === 'free') {
    if (!row.freeCast || !spend(row.freeCast)) return { ok: false, error: 'notEnough', params: { name: spell.name } }
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
