// Everything a player does to a character during play, as pure functions.
// Each returns the new character and history items describing the change
// (before/after values), or an error when the action isn't allowed.
//
// Death and damage rules are the same in SRD 5.1 and 5.2.1 ("Damage at 0 Hit
// Points", "Massive Damage", "Death Saving Throws").
import type { Character } from './character'
import type { ActivityRow, AttackRow, Sheet } from './derive'
import { trackShot } from './inventory'
import { concentrationDc, incapacitating } from './spellActions'
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
  let shape = char.shape
  let toggles = char.toggles
  if (shape && sheet.shape?.hp && remaining > 0) {
    const beastBefore = sheet.shape.hp.current
    const beastAfter = Math.max(0, beastBefore - remaining)
    items.push({ type: 'shapeHp', before: beastBefore, after: beastAfter })
    remaining -= beastBefore - beastAfter
    if (beastAfter === 0) {
      items.push({ type: 'shapeEnd', params: { name: sheet.shape.creature.name } })
      shape = undefined
      toggles = toggles.filter((t) => t !== 'state:Wild Shape')
    } else shape = { ...shape, hp: beastAfter }
  }
  const before = char.hp.current
  const current = Math.max(0, before - remaining)
  let deathSaves = char.deathSaves
  if (remaining > 0 && before > 0) items.push({ type: 'damage', params: { amount }, before, after: current })
  if (!items.length) items.push({ type: 'damage', params: { amount }, before, after: current })

  const hpMax = sheet.hpMax.value
  if (before > 0 && current === 0 && remaining - before >= hpMax) {
    items.push({ type: 'massiveDamage' })
  } else if (before === 0 && remaining > 0) {
    if (remaining >= hpMax) items.push({ type: 'massiveDamage' })
    const failures = Math.min(3, deathSaves.failures + (critical ? 2 : 1))
    items.push({ type: 'deathSaveFailure', params: { amount }, before: deathSaves.failures, after: failures })
    // A stable creature that takes damage stops being stable.
    deathSaves = { successes: deathSaves.successes >= 3 ? 0 : deathSaves.successes, failures }
  } else if (current === 0 && before > 0) {
    items.push({ type: 'unconscious' })
  }
  if (char.concentration) {
    if (current === 0) items.push({ type: 'concentrationEnd', params: { name: char.concentration.name } })
    else items.push({ type: 'concentrationCheck', params: { name: char.concentration.name, dc: concentrationDc(amount, char.edition) } })
  }
  // Dropping to 0 HP (Unconscious) ends Concentration, and states like Rage and Wild Shape.
  const concentration = current === 0 ? undefined : char.concentration
  let next: Character = { ...char, hp: { current, temp }, deathSaves, concentration, shape, toggles }
  if (current === 0 && before > 0) next = endAllStates(next, sheet, items)
  return ok(next, 'damage', items)
}

/** Unconscious (or 2024 Incapacitated): every state switched on by an activity ends, and the beast form with it. */
function endAllStates(char: Character, sheet: Sheet, items: HistoryItem[]): Character {
  const keys = char.toggles.filter((t) => t.startsWith('state:'))
  if (!keys.length && !char.shape) return char
  const ended = endStates(char, sheet, keys)
  items.push(...ended.items)
  return { ...ended.character, shape: undefined }
}

/** Healing: up to the HP maximum; any healing at 0 HP resets death saves. */
export function heal(char: Character, sheet: Sheet, amount: number, source?: { name: string; entity?: string }): ActionResult {
  if (!(amount > 0)) return { ok: false, error: 'positiveAmount' }
  // 2014 Wild Shape: healing goes to the beast form.
  if (char.shape && sheet.shape?.hp) {
    const b = sheet.shape.hp.current
    const a = Math.min(sheet.shape.hp.max, b + amount)
    if (a === b) return { ok: false, error: 'noChange' }
    return ok({ ...char, shape: { ...char.shape, hp: a } }, 'heal', [{ type: 'shapeHp', params: { amount }, before: b, after: a }])
  }
  const before = char.hp.current
  const current = Math.max(before, Math.min(sheet.hpMax.value, before + amount))
  if (current === before) return { ok: false, error: 'noChange' }
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
  const items: HistoryItem[] = [{ type: 'setHp', before: char.hp.current, after: current }]
  let deathSaves = char.deathSaves
  if (char.hp.current === 0 && current > 0 && (deathSaves.successes || deathSaves.failures)) {
    deathSaves = { successes: 0, failures: 0 }
    items.push({ type: 'deathSavesReset' })
  }
  return ok({ ...char, hp: { ...char.hp, current }, deathSaves }, 'setHp', items)
}

/** Hit Point Dice left of one die size (spent ones come back on a Long Rest). */
export function setHitDiceRemaining(char: Character, sheet: Sheet, die: number, remaining: number): ActionResult {
  const pool = sheet.hitDice.find((p) => p.die === die)
  if (!pool) return { ok: false, error: 'noChange' }
  const left = Math.max(0, Math.min(pool.total, remaining))
  const before = pool.total - pool.used
  if (left === before) return { ok: false, error: 'noChange' }
  return ok({ ...char, hitDiceUsed: { ...char.hitDiceUsed, [String(die)]: pool.total - left } }, 'hitDice', [{ type: 'hitDiceLeft', params: { die }, before, after: left }])
}

/** Experience points: never below 0. */
export function adjustXp(char: Character, delta: number): ActionResult {
  const after = char.xp + Math.round(delta)
  if (after < 0) return { ok: false, error: 'notEnoughXp' }
  if (after === char.xp) return { ok: false, error: 'noChange' }
  return ok({ ...char, xp: after }, 'xp', [{ type: 'xp', before: char.xp, after }])
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
  if (key === 'hitDie') {
    const left = sheet.hitDice.reduce((s, h) => s + h.total - (char.hitDiceUsed[String(h.die)] ?? 0), 0)
    return { remaining: left, max: sheet.hitDice.reduce((s, h) => s + h.total, 0), name: 'Hit Point Dice' }
  }
  if (key.startsWith('quantity:')) {
    const entry = char.inventory.find((e) => e.uid === key.slice('quantity:'.length))
    return entry && { remaining: entry.quantity, max: entry.quantity, name: entry.label ?? entry.itemId }
  }
  const r = sheet.resources.find((x) => x.key === key)
  return r && { remaining: r.remaining, max: r.max, name: r.resource.name }
}

/** Write a new "remaining" value for a resource key (uses, item charges or item quantity). */
/** Remaining uses taking earlier changes to the same character into account. */
function currentRemaining(char: Character, sheet: Sheet, key: string): number | undefined {
  const r = sheet.resources.find((x) => x.key === key)
  if (!r || r.source.item) return r?.remaining
  return r.max - (char.resourcesUsed[key] ?? 0)
}

function withRemaining(char: Character, sheet: Sheet, key: string, remaining: number): Character {
  if (key === 'hitDie') {
    // Spend from the largest die that has some left.
    let toSpend = (remainingOf(char, sheet, key)?.remaining ?? 0) - remaining
    const used = { ...char.hitDiceUsed }
    for (const h of [...sheet.hitDice].sort((a, b) => b.die - a.die)) {
      while (toSpend > 0 && (used[String(h.die)] ?? 0) < h.total) {
        used[String(h.die)] = (used[String(h.die)] ?? 0) + 1
        toSpend--
      }
    }
    return { ...char, hitDiceUsed: used }
  }
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
/**
 * Use an activity: pay its costs, switch on its state, apply its roll.
 * `roll` is the player's dice total for heal / Temp HP rolls, or — for pool
 * features (spendInput) — the number of points spent; `opts.spendOnly` spends
 * them without healing (Lay on Hands curing Poisoned).
 */
export function performActivity(
  char: Character,
  sheet: Sheet,
  row: ActivityRow,
  roll?: number,
  opts: { spendOnly?: boolean; slotKey?: string; recover?: number[]; spent?: number } = {},
): ActionResult {
  let next = char
  const name = row.source.entity.type === 'item' ? `${row.source.entity.name}` : row.activity.name
  const items: HistoryItem[] = [{ type: 'use', params: { name }, entity: row.source.entity.id }]
  // Dice pools: `spent` dice, `roll` is their total; point pools: `roll` is the points.
  const spend = row.activity.spendDice ? opts.spent : row.activity.spendInput && roll !== undefined ? Math.max(1, Math.round(roll)) : undefined
  for (const [i, cost] of row.costs.entries()) {
    const amount = i === 0 && spend !== undefined ? spend : cost.amount
    const r = remainingOf(next, sheet, cost.resourceKey)
    if (!r || r.remaining < amount) return { ok: false, error: 'notEnough', params: { name: r?.name ?? cost.resourceKey } }
    next = withRemaining(next, sheet, cost.resourceKey, r.remaining - amount)
    items.push({ type: 'resource', params: { name: r.name }, before: r.remaining, after: r.remaining - amount })
  }
  // Font of Inspiration, Wild Resurgence…: also expends a spell slot the player picks.
  if (row.activity.slotCost) {
    const r = opts.slotKey && remainingOf(next, sheet, opts.slotKey)
    if (!r || r.remaining <= 0) return { ok: false, error: 'noSlot', params: { level: opts.slotKey?.replace('slot:', '') ?? '?' } }
    const slotLevel = opts.slotKey === 'pact' ? (sheet.spellcasting.pact?.level ?? 1) : Number(opts.slotKey!.replace('slot:', ''))
    if (row.activity.slotMin && slotLevel < row.activity.slotMin) return { ok: false, error: 'slotTooLow' }
    next = withRemaining(next, sheet, opts.slotKey!, r.remaining - 1)
    items.push({ type: 'resource', params: { name: r.name }, before: r.remaining, after: r.remaining - 1 })
    // Arcane Ward: the slot refills a pool by its level.
    const per = row.activity.restorePerSlotLevel
    const target = per && sheet.resources.find((x) => x.resource.id === per.resource)
    if (per && target) {
      const current = currentRemaining(next, sheet, target.key) ?? target.remaining
      const after = Math.min(target.max, current + per.amount * slotLevel)
      if (after !== current) {
        next = withRemaining(next, sheet, target.key, after)
        items.push({ type: 'resource', params: { name: target.resource.name }, before: current, after })
      }
    }
  }
  // Uncanny Metabolism, Magical Cunning…: give resources back.
  for (const back of row.restores) {
    const r = remainingOf(next, sheet, back.resourceKey)
    if (!r) continue
    const current = currentRemaining(next, sheet, back.resourceKey) ?? r.remaining
    const after = back.amount === 'all' ? r.max : back.upTo ? Math.max(current, Math.min(r.max, back.amount)) : Math.min(r.max, current + back.amount)
    if (after === current) continue
    next = withRemaining(next, sheet, back.resourceKey, after)
    items.push({ type: 'resource', params: { name: r.name }, before: current, after })
  }
  // Arcane Recovery, Natural Recovery: chosen expended slots, combined level within the budget, none above 5.
  if (row.recoverSlots !== undefined && opts.recover?.length) {
    const total = opts.recover.reduce((a, b) => a + b, 0)
    if (total > row.recoverSlots || opts.recover.some((l) => l > 5)) return { ok: false, error: 'slotTooHigh', params: { level: Math.max(...opts.recover) } }
    for (const level of opts.recover) {
      const key = `slot:${level}`
      const r = remainingOf(next, sheet, key)
      const current = currentRemaining(next, sheet, key)
      if (!r || current === undefined || current >= r.max) return { ok: false, error: 'noChange' }
      next = withRemaining(next, sheet, key, current + 1)
      items.push({ type: 'resource', params: { name: r.name }, before: current, after: current + 1 })
    }
  }
  // Rage, Wild Shape…: the activity switches its state on.
  const state = row.activity.toggle && `state:${row.activity.toggle}`
  if (state && !next.toggles.includes(state)) {
    next = { ...next, toggles: [...next.toggles, state] }
    items.push({ type: 'toggleOn', params: { name: row.activity.toggle! } })
  }
  const kind = row.activity.roll?.kind
  if (roll !== undefined && !opts.spendOnly && kind === 'heal') {
    const total = row.activity.spendDice ? roll + (row.rollBonus ?? 0) : (spend ?? roll + (row.rollBonus ?? 0))
    const healed = heal(next, sheet, total, { name, entity: row.source.entity.id })
    if (healed.ok) {
      next = healed.character
      items.push(...healed.items)
    }
  }
  if (roll !== undefined && kind === 'temp') {
    // Temporary HP don't stack: keep the higher amount.
    const total = Math.max(0, roll + (row.rollBonus ?? 0))
    if (total > next.hp.temp) {
      items.push({ type: 'tempHp', before: next.hp.temp, after: total })
      next = { ...next, hp: { ...next.hp, temp: total } }
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
  const items: HistoryItem[] = [{ type: has ? 'conditionRemoved' : 'conditionAdded', params: { name }, entity: conditionId }]
  // Becoming Incapacitated ends Concentration.
  let concentration = char.concentration
  if (!has && concentration && incapacitating.has(conditionId)) {
    items.push({ type: 'concentrationEnd', params: { name: concentration.name } })
    concentration = undefined
  }
  return ok({ ...char, conditions, concentration }, 'condition', items)
}

export function setExhaustion(char: Character, level: number): ActionResult {
  const value = Math.max(0, Math.min(6, level))
  if (value === char.exhaustion) return { ok: false, error: 'noChange' }
  return ok({ ...char, exhaustion: value }, 'condition', [{ type: 'exhaustion', before: char.exhaustion, after: value, entity: 'exhaustion' }])
}

export function toggleEffect(char: Character, key: string, label: string, sheet?: Sheet): ActionResult {
  const on = char.toggles.includes(key)
  if (on && sheet) {
    const ended = endStates(char, sheet, [key])
    return ok(ended.character, 'toggle', ended.items)
  }
  const toggles = on ? char.toggles.filter((t) => t !== key) : [...char.toggles, key]
  return ok({ ...char, toggles }, 'toggle', [{ type: on ? 'toggleOff' : 'toggleOn', params: { name: label } }])
}

/**
 * Switch states off, with the states tied to them (Frenzied ends with
 * Raging) and what ending them costs (2014 Frenzy: one level of Exhaustion).
 */
export function endStates(char: Character, sheet: Sheet, keys: string[]): { character: Character; items: HistoryItem[] } {
  const ending = new Set(keys.filter((k) => char.toggles.includes(k)))
  const stateActivities = sheet.active.flatMap((ae) => ae.entity.activities.filter((a) => a.toggle))
  for (let grew = true; grew; ) {
    grew = false
    for (const a of stateActivities) {
      const key = `state:${a.toggle}`
      if (a.endsWith && ending.has(`state:${a.endsWith}`) && char.toggles.includes(key) && !ending.has(key)) {
        ending.add(key)
        grew = true
      }
    }
  }
  const items: HistoryItem[] = []
  let exhaustion = char.exhaustion
  for (const key of ending) {
    items.push({ type: 'toggleOff', params: { name: key.replace(/^state:/, '').replace(/^.*#/, '') } })
    const onEnd = stateActivities.find((a) => `state:${a.toggle}` === key)?.onEnd
    if (onEnd?.exhaustion) {
      const after = Math.min(6, exhaustion + onEnd.exhaustion)
      items.push({ type: 'exhaustion', before: exhaustion, after, entity: 'exhaustion' })
      exhaustion = after
    }
  }
  // "Once per Rage": resources tied to an ending state come back.
  const resourcesUsed = { ...char.resourcesUsed }
  for (const r of sheet.resources) {
    if (r.resource.resetWith && ending.has(`state:${r.resource.resetWith}`) && (resourcesUsed[r.key] ?? 0) > 0) {
      items.push({ type: 'resource', params: { name: r.resource.name }, before: r.remaining, after: r.max })
      delete resourcesUsed[r.key]
    }
  }
  const shape = ending.has('state:Wild Shape') ? undefined : char.shape
  return { character: { ...char, exhaustion, resourcesUsed, toggles: char.toggles.filter((k) => !ending.has(k)), shape }, items }
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
      case 'stateEnded':
        return { type: 'toggleOff', params: { name: c.name } }
    }
  })
}
