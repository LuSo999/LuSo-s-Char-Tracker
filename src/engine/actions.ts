// Everything a player does to a character during play, as pure functions.
// Each returns the new character and history items describing the change
// (before/after values), or an error when the action isn't allowed.
//
// Death and damage rules are the same in SRD 5.1 and 5.2.1 ("Damage at 0 Hit
// Points", "Massive Damage", "Death Saving Throws").
import type { Character } from './character'
import type { ActivityRow, AttackRow, Sheet } from './derive'
import { trackShot } from './inventory'
import type { RestChange } from './rest'

export type HistoryKind = 'game' | 'sheet'

/** One change inside a history group. Text is rendered from `type` + params. */
export type HistoryItem = {
  type: string
  params?: Record<string, string | number>
  before?: number | string
  after?: number | string
  /** Content id, for the rule preview in history. */
  entity?: string
}

export type ActionResult =
  | { ok: true; character: Character; items: HistoryItem[]; groupType: string; kind: HistoryKind }
  | { ok: false; error: string; params?: Record<string, string | number> }

const ok = (character: Character, groupType: string, items: HistoryItem[], kind: HistoryKind = 'game'): ActionResult => ({
  ok: true,
  character,
  items,
  groupType,
  kind,
})

// --- Hit points -----------------------------------------------------------------

/** Damage: temporary HP first, never below 0; damage at 0 HP costs death saves. */
export function takeDamage(char: Character, sheet: Sheet, amount: number, critical = false): ActionResult {
  if (!(amount > 0)) return { ok: false, error: 'positiveAmount' }
  const items: HistoryItem[] = []
  let remaining = amount
  let temp = char.hp.temp
  if (temp > 0) {
    const absorbed = Math.min(temp, remaining)
    items.push({ type: 'tempHp', before: temp, after: temp - absorbed })
    temp -= absorbed
    remaining -= absorbed
  }
  const before = char.hp.current
  const current = Math.max(0, before - remaining)
  let deathSaves = char.deathSaves
  if (remaining > 0 && before > 0) items.push({ type: 'damage', params: { amount }, before, after: current })

  const hpMax = sheet.hpMax.value
  if (before > 0 && current === 0 && remaining - before >= hpMax) {
    items.push({ type: 'massiveDamage' })
  } else if (before === 0 && remaining > 0) {
    if (remaining >= hpMax) items.push({ type: 'massiveDamage' })
    const failures = Math.min(3, deathSaves.failures + (critical ? 2 : 1))
    items.push({ type: 'deathSaveFailure', params: { amount }, before: deathSaves.failures, after: failures })
    deathSaves = { ...deathSaves, failures }
  } else if (current === 0 && before > 0) {
    items.push({ type: 'unconscious' })
  }
  return ok({ ...char, hp: { current, temp }, deathSaves }, 'damage', items)
}

/** Healing: up to the HP maximum; any healing at 0 HP resets death saves. */
export function heal(char: Character, sheet: Sheet, amount: number, source?: { name: string; entity?: string }): ActionResult {
  if (!(amount > 0)) return { ok: false, error: 'positiveAmount' }
  const before = char.hp.current
  const current = Math.min(sheet.hpMax.value, before + amount)
  const items: HistoryItem[] = [{ type: 'heal', params: { amount, ...(source ? { source: source.name } : {}) }, before, after: current, entity: source?.entity }]
  let deathSaves = char.deathSaves
  if (before === 0 && current > 0 && (deathSaves.successes || deathSaves.failures)) {
    deathSaves = { successes: 0, failures: 0 }
    items.push({ type: 'deathSavesReset' })
  }
  return ok({ ...char, hp: { ...char.hp, current }, deathSaves }, 'heal', items)
}

/** "+3" heals, "-3" damages. */
export function adjustHp(char: Character, sheet: Sheet, delta: number): ActionResult {
  return delta < 0 ? takeDamage(char, sheet, -delta) : heal(char, sheet, delta)
}

/** Overwrite current HP directly (clamped to 0…max). */
export function setHp(char: Character, sheet: Sheet, value: number): ActionResult {
  const current = Math.max(0, Math.min(sheet.hpMax.value, Math.round(value)))
  if (current === char.hp.current) return { ok: false, error: 'noChange' }
  return ok({ ...char, hp: { ...char.hp, current } }, 'setHp', [{ type: 'setHp', before: char.hp.current, after: current }])
}

/** Temporary HP don't stack: the new value replaces the old one. */
export function setTempHp(char: Character, value: number): ActionResult {
  const temp = Math.max(0, Math.round(value))
  if (temp === char.hp.temp) return { ok: false, error: 'noChange' }
  return ok({ ...char, hp: { ...char.hp, temp } }, 'tempHp', [{ type: 'tempHp', before: char.hp.temp, after: temp }])
}

export function setDeathSaves(char: Character, successes: number, failures: number): ActionResult {
  const s = Math.max(0, Math.min(3, successes))
  const f = Math.max(0, Math.min(3, failures))
  const items: HistoryItem[] = []
  if (s !== char.deathSaves.successes) items.push({ type: 'deathSaveSuccesses', before: char.deathSaves.successes, after: s })
  if (f !== char.deathSaves.failures) items.push({ type: 'deathSaveFailures', before: char.deathSaves.failures, after: f })
  if (!items.length) return { ok: false, error: 'noChange' }
  if (s === 3) items.push({ type: 'stable' })
  if (f === 3) items.push({ type: 'dead' })
  return ok({ ...char, deathSaves: { successes: s, failures: f } }, 'deathSaves', items)
}

/**
 * A rolled death saving throw (d20, entered by the player): 10+ succeeds,
 * a 1 counts as two failures, a 20 restores 1 HP. Three successes make the
 * character Stable, three failures mean death.
 */
export function rollDeathSave(char: Character, roll: number): ActionResult {
  if (!(roll >= 1 && roll <= 20) || !Number.isInteger(roll)) return { ok: false, error: 'd20Range' }
  if (char.hp.current > 0) return { ok: false, error: 'notDying' }
  const { successes, failures } = char.deathSaves
  if (successes >= 3 || failures >= 3) return { ok: false, error: 'notDying' }
  const items: HistoryItem[] = [{ type: 'deathSaveRoll', params: { roll } }]
  if (roll === 20) {
    items.push({ type: 'setHp', before: 0, after: 1 }, { type: 'deathSavesReset' })
    return ok({ ...char, hp: { ...char.hp, current: 1 }, deathSaves: { successes: 0, failures: 0 } }, 'deathSaves', items)
  }
  const next = roll >= 10 ? { successes: successes + 1, failures } : { successes, failures: Math.min(3, failures + (roll === 1 ? 2 : 1)) }
  if (next.successes !== successes) items.push({ type: 'deathSaveSuccesses', before: successes, after: next.successes })
  if (next.failures !== failures) items.push({ type: 'deathSaveFailures', before: failures, after: next.failures })
  if (next.successes === 3) items.push({ type: 'stable' })
  if (next.failures === 3) items.push({ type: 'dead' })
  return ok({ ...char, deathSaves: next }, 'deathSaves', items)
}

// --- Resources ------------------------------------------------------------------

/** Remaining amount for a resource key as the sheet sees it. */
function remainingOf(char: Character, sheet: Sheet, key: string): { remaining: number; max: number; name: string } | undefined {
  if (key.startsWith('quantity:')) {
    const entry = char.inventory.find((e) => e.uid === key.slice('quantity:'.length))
    return entry && { remaining: entry.quantity, max: entry.quantity, name: entry.label ?? entry.itemId }
  }
  const r = sheet.resources.find((x) => x.key === key)
  return r && { remaining: r.remaining, max: r.max, name: r.resource.name }
}

/** Write a new "remaining" value for a resource key (uses, item charges or item quantity). */
function withRemaining(char: Character, sheet: Sheet, key: string, remaining: number): Character {
  if (key.startsWith('quantity:')) {
    const uid = key.slice('quantity:'.length)
    return { ...char, inventory: char.inventory.map((e) => (e.uid === uid ? { ...e, quantity: remaining } : e)) }
  }
  const r = sheet.resources.find((x) => x.key === key)!
  const used = r.max - remaining
  if (r.source.item && r.source.entity.type === 'item' && r.resource === r.source.entity.charges) {
    const uid = r.source.item.uid
    return { ...char, inventory: char.inventory.map((e) => (e.uid === uid ? { ...e, chargesUsed: used } : e)) }
  }
  return { ...char, resourcesUsed: { ...char.resourcesUsed, [key]: used } }
}

/** Manually set how many uses remain (clicking the dots). */
export function setResourceRemaining(char: Character, sheet: Sheet, key: string, remaining: number): ActionResult {
  const r = remainingOf(char, sheet, key)
  if (!r) return { ok: false, error: 'unknownResource' }
  const value = Math.max(0, Math.min(r.max, remaining))
  if (value === r.remaining) return { ok: false, error: 'noChange' }
  return ok(withRemaining(char, sheet, key, value), 'resource', [{ type: 'resource', params: { name: r.name }, before: r.remaining, after: value }])
}

/**
 * Use an action from the list: pay its costs and, for healing, apply the
 * rolled total. `roll` is what the player rolled on the dice (bonus is added here).
 */
export function performActivity(char: Character, sheet: Sheet, row: ActivityRow, roll?: number): ActionResult {
  let next = char
  const name = row.source.entity.type === 'item' ? `${row.source.entity.name}` : row.activity.name
  const items: HistoryItem[] = [{ type: 'use', params: { name }, entity: row.source.entity.id }]
  for (const cost of row.costs) {
    const r = remainingOf(next, sheet, cost.resourceKey)
    if (!r || r.remaining < cost.amount) return { ok: false, error: 'notEnough', params: { name: r?.name ?? cost.resourceKey } }
    next = withRemaining(next, sheet, cost.resourceKey, r.remaining - cost.amount)
    items.push({ type: 'resource', params: { name: r.name }, before: r.remaining, after: r.remaining - cost.amount })
  }
  if (roll !== undefined && row.activity.roll?.kind === 'heal') {
    const total = roll + (row.rollBonus ?? 0)
    const healed = heal(next, sheet, total, { name, entity: row.source.entity.id })
    if (healed.ok) {
      next = healed.character
      items.push(...healed.items)
    }
  }
  return ok(next, 'use', items)
}

/**
 * A weapon attack: recorded in history; spends ammunition (or a thrown weapon
 * from the stack) when tracked, or a round from the magazine of a reload
 * weapon. `label` names special attacks (off-hand, Cleave).
 */
export function makeAttack(char: Character, attack: AttackRow, label?: string, opts: { thrown?: boolean } = {}): ActionResult {
  const items: HistoryItem[] = [{ type: 'attack', params: { name: label ?? attack.name }, entity: attack.weapon?.id }]
  // A melee weapon with the Thrown property is only used up when actually thrown.
  if (attack.properties.includes('thrown') && attack.weapon?.range === 'melee' && !opts.thrown) return ok(char, 'attack', items)
  if (opts.thrown) items[0] = { type: 'thrownAttack', params: { name: label ?? attack.name }, entity: attack.weapon?.id }
  if (attack.loaded) {
    if (attack.loaded.rounds <= 0) return { ok: false, error: 'magazineEmpty', params: { name: attack.name } }
    items.push({ type: 'loaded', params: { name: attack.name }, before: attack.loaded.rounds, after: attack.loaded.rounds - 1 })
    return ok(trackShot(char, attack), 'attack', items)
  }
  if (!attack.ammo) return ok(char, 'attack', items)
  const entry = attack.ammo.uid ? char.inventory.find((e) => e.uid === attack.ammo!.uid) : undefined
  if (!entry || entry.quantity <= 0) return { ok: false, error: 'noAmmo' }
  items.push({ type: 'quantity', params: { name: attack.ammo.name ?? entry.itemId }, before: entry.quantity, after: entry.quantity - 1 })
  const spent = { ...char, inventory: char.inventory.map((e) => (e.uid === entry.uid ? { ...e, quantity: e.quantity - 1 } : e)) }
  return ok(trackShot(spent, attack), 'attack', items)
}

// --- Conditions and toggles -----------------------------------------------------------

export function toggleCondition(char: Character, conditionId: string, name: string): ActionResult {
  const has = char.conditions.includes(conditionId)
  const conditions = has ? char.conditions.filter((c) => c !== conditionId) : [...char.conditions, conditionId]
  return ok({ ...char, conditions }, 'condition', [{ type: has ? 'conditionRemoved' : 'conditionAdded', params: { name }, entity: conditionId }])
}

export function setExhaustion(char: Character, level: number): ActionResult {
  const value = Math.max(0, Math.min(6, level))
  if (value === char.exhaustion) return { ok: false, error: 'noChange' }
  return ok({ ...char, exhaustion: value }, 'condition', [{ type: 'exhaustion', before: char.exhaustion, after: value, entity: 'exhaustion' }])
}

export function toggleEffect(char: Character, key: string, label: string): ActionResult {
  const on = char.toggles.includes(key)
  const toggles = on ? char.toggles.filter((t) => t !== key) : [...char.toggles, key]
  return ok({ ...char, toggles }, 'toggle', [{ type: on ? 'toggleOff' : 'toggleOn', params: { name: label } }])
}

// --- Rests ------------------------------------------------------------------------------

export function restItems(changes: RestChange[]): HistoryItem[] {
  return changes.map((c): HistoryItem => {
    switch (c.kind) {
      case 'hp':
        return { type: 'setHp', before: c.before, after: c.after }
      case 'tempHp':
        return { type: 'tempHp', before: c.before, after: c.after }
      case 'resource':
        return { type: 'resource', params: { name: c.name }, before: c.before, after: c.after }
      case 'hitDice':
        return { type: 'hitDice', params: { die: c.die }, before: c.before, after: c.after }
      case 'exhaustion':
        return { type: 'exhaustion', before: c.before, after: c.after, entity: 'exhaustion' }
      case 'deathSaves':
        return { type: 'deathSavesReset' }
    }
  })
}
