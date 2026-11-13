// Edit-mode changes: manual overrides of computed values, the character's own
// names / summaries / links for rules content, and basic details. They go to
// the sheet history (kind "sheet") with old and new values, and can be undone.
import type { Ability } from '../content/schema'
import type { ActionResult, HistoryItem } from './actions'
import type { Character } from './character'

const ok = (character: Character, items: HistoryItem[], groupType = 'edit'): ActionResult => ({ ok: true, character, items, groupType, kind: 'sheet' })

/**
 * Override a computed value (key as in Character.overrides, e.g. "ac",
 * "skill:stealth", "attack:<uid>", "resource:<key>:max"). `undefined` removes
 * the override and returns to the computed value.
 */
export function setOverride(char: Character, key: string, value: number | undefined, label: string, computed: number): ActionResult {
  const before = char.overrides[key]
  const overrides = { ...char.overrides }
  if (value === undefined) {
    if (before === undefined) return { ok: false, error: 'noChange' }
    delete overrides[key]
    return ok({ ...char, overrides }, [{ type: 'overrideReset', params: { what: label }, before, after: computed }])
  }
  const v = Math.round(value)
  if (v === (before ?? computed) && before !== undefined) return { ok: false, error: 'noChange' }
  // Typing the computed value again simply clears the override.
  if (v === computed) return before === undefined ? { ok: false, error: 'noChange' } : setOverride(char, key, undefined, label, computed)
  overrides[key] = v
  return ok({ ...char, overrides }, [{ type: 'override', params: { what: label }, before: before ?? computed, after: v }])
}

export function resetAllOverrides(char: Character): ActionResult {
  const count = Object.keys(char.overrides).length
  if (!count) return { ok: false, error: 'noChange' }
  return ok({ ...char, overrides: {} }, [{ type: 'overridesReset', params: { count } }])
}

type TextPatch = { name?: string; description?: string; url?: string }

/** The character's own name / summary / link for a rules entity. Empty strings reset a field. */
export function customize(char: Character, entityId: string, originalName: string, patch: TextPatch): ActionResult {
  const before = char.customizations[entityId] ?? {}
  const next: TextPatch = { ...before }
  const items: HistoryItem[] = []
  for (const field of ['name', 'description', 'url'] as const) {
    if (!(field in patch)) continue
    const value = patch[field]?.trim() || undefined
    if (value === before[field]) continue
    if (value === undefined) delete next[field]
    else next[field] = value
    // Without an earlier change the "before" is the original (the name; summaries and links stay blank to keep history short).
    const prev = before[field] ?? (field === 'name' ? originalName : '')
    items.push({ type: value === undefined ? 'customReset' : 'customized', params: { what: originalName, field }, before: prev, after: value ?? '', entity: entityId })
  }
  if (!items.length) return { ok: false, error: 'noChange' }
  const customizations = { ...char.customizations }
  if (Object.keys(next).length) customizations[entityId] = next
  else delete customizations[entityId]
  return ok({ ...char, customizations }, items)
}

export function setName(char: Character, name: string): ActionResult {
  const v = name.trim()
  if (!v || v === char.name) return { ok: false, error: 'noChange' }
  return ok({ ...char, name: v }, [{ type: 'renamed', before: char.name, after: v }])
}

/** The ability score before any bonus (rolled / point buy / standard array). */
export function setBaseScore(char: Character, ability: Ability, value: number): ActionResult {
  const v = Math.max(1, Math.min(30, Math.round(value)))
  if (v === char.baseScores[ability]) return { ok: false, error: 'noChange' }
  return ok({ ...char, baseScores: { ...char.baseScores, [ability]: v } }, [{ type: 'baseScore', params: { ability: ability.toUpperCase() }, before: char.baseScores[ability], after: v }])
}

export function setItemLabel(char: Character, uid: string, label: string, original: string): ActionResult {
  const e = char.inventory.find((x) => x.uid === uid)
  if (!e) return { ok: false, error: 'unknownItem' }
  const v = label.trim() || undefined
  if (v === e.label) return { ok: false, error: 'noChange' }
  return ok({ ...char, inventory: char.inventory.map((x) => (x.uid === uid ? { ...x, label: v } : x)) }, [
    { type: 'itemRenamed', before: e.label ?? original, after: v ?? original },
  ])
}

export function addReminder(char: Character, text: string): ActionResult {
  const v = text.trim()
  if (!v) return { ok: false, error: 'noChange' }
  const uid = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return ok({ ...char, reminders: [...char.reminders, { uid, text: v }] }, [{ type: 'reminderAdded', params: { text: v } }])
}

export function removeReminder(char: Character, uid: string): ActionResult {
  const r = char.reminders.find((x) => x.uid === uid)
  if (!r) return { ok: false, error: 'noChange' }
  return ok({ ...char, reminders: char.reminders.filter((x) => x.uid !== uid) }, [{ type: 'reminderRemoved', params: { text: r.text } }])
}

/** Which books' content the character may use (empty: every official book). */
export function setBooks(char: Character, books: string[]): ActionResult {
  if (JSON.stringify(char.books) === JSON.stringify(books)) return { ok: false, error: 'noChange' }
  return { ok: true, character: { ...char, books }, items: [{ type: 'books', before: char.books.join(', ') || '*', after: books.join(', ') || '*' }], groupType: 'edit', kind: 'sheet' }
}
