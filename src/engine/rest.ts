// Short and long rests as pure functions: they return the new character and
// a list of changes for the rest dialog and the history.
import type { ContentIndex } from '../content'
import type { RechargeOn } from '../content/schema'
import type { Character } from './character'
import { computeSheet, type ResourceState, type Sheet } from './derive'
import { editionRules } from './editions'
import { resolveScaled } from './formula'

export type RestChange =
  | { kind: 'hp'; before: number; after: number }
  | { kind: 'tempHp'; before: number; after: number }
  | { kind: 'resource'; key: string; name: string; before: number; after: number; max: number }
  | { kind: 'hitDice'; die: number; before: number; after: number; total: number }
  | { kind: 'exhaustion'; before: number; after: number }
  | { kind: 'deathSaves' }
  | { kind: 'stateEnded'; name: string }

export type RestResult = { character: Character; changes: RestChange[] }

/** Remaining uses a resource gets back on the given rest. Dice recharges use the player's roll. */
function regained(r: ResourceState, on: RechargeOn, sheet: Sheet, rolls: Record<string, number> = {}): number {
  let best = 0
  for (const rule of r.resource.recharge) {
    if (rule.on !== on) continue
    const amount = rule.dice
      ? (rolls[r.key] ?? 0)
      : rule.amount === 'all'
        ? r.used
        : resolveScaled(rule.amount, {
            pb: sheet.pb.value,
            classLevel: r.source.classLevel,
            level: r.source.classLevel,
            characterLevel: sheet.characterLevel,
            ...sheet.mods,
          })
    best = Math.max(best, Math.min(r.used, amount))
  }
  return best
}

function rechargeResources(char: Character, sheet: Sheet, on: RechargeOn, changes: RestChange[], rolls?: Record<string, number>): Character {
  const resourcesUsed = { ...char.resourcesUsed }
  const inventory = char.inventory.map((e) => ({ ...e }))
  for (const r of sheet.resources) {
    // Slots created by Font of Magic (negative "used") vanish on a Long Rest.
    if (r.used < 0 && on === 'longRest') {
      resourcesUsed[r.key] = 0
      changes.push({ kind: 'resource', key: r.key, name: r.resource.name, before: r.remaining, after: r.max, max: r.max })
      continue
    }
    const back = regained(r, on, sheet, rolls)
    if (back <= 0) continue
    const after = r.used - back
    if (r.source.item && r.source.entity.type === 'item' && r.resource === r.source.entity.charges) {
      const entry = inventory.find((e) => e.uid === r.source.item!.uid)
      if (entry) entry.chargesUsed = after
    } else {
      resourcesUsed[r.key] = after
    }
    changes.push({ kind: 'resource', key: r.key, name: r.resource.name, before: r.remaining, after: r.max - after, max: r.max })
  }
  return { ...char, resourcesUsed, inventory }
}

/**
 * Short rest. `hitDiceRolls` lists the rolled value of each spent die (the
 * player rolls physical dice; the app only records totals), per die size.
 * Each die heals roll + Constitution modifier, minimum 0.
 */
export function shortRest(char: Character, content: ContentIndex, hitDiceRolls: Record<number, number[]> = {}): RestResult {
  const sheet = computeSheet(char, content)
  const changes: RestChange[] = []
  let hp = char.hp.current
  const hitDiceUsed = { ...char.hitDiceUsed }

  for (const pool of sheet.hitDice) {
    const rolls = (hitDiceRolls[pool.die] ?? []).slice(0, pool.total - pool.used)
    if (rolls.length === 0) continue
    for (const roll of rolls) hp += Math.max(0, roll + sheet.mods.con)
    hitDiceUsed[String(pool.die)] = pool.used + rolls.length
    changes.push({ kind: 'hitDice', die: pool.die, before: pool.total - pool.used, after: pool.total - pool.used - rolls.length, total: pool.total })
  }
  hp = Math.min(hp, sheet.hpMax.value)
  if (hp !== char.hp.current) changes.push({ kind: 'hp', before: char.hp.current, after: hp })

  let next: Character = { ...char, hitDiceUsed, hp: { ...char.hp, current: hp } }
  if (hp > 0 && char.hp.current === 0) {
    next = { ...next, deathSaves: { successes: 0, failures: 0 } }
    changes.push({ kind: 'deathSaves' })
  }
  next = rechargeResources(next, sheet, 'shortRest', changes)
  next = endStates(next, sheet, changes)
  return { character: next, changes }
}

/** Rests end states switched on by activities (Rage, Wild Shape…). */
function endStates(char: Character, sheet: Sheet, changes: RestChange[]): Character {
  const ended = sheet.toggles.filter((t) => t.state && t.on)
  if (!ended.length) return char
  for (const t of ended) changes.push({ kind: 'stateEnded', name: t.label })
  const keys = new Set(ended.map((t) => t.key))
  return { ...char, toggles: char.toggles.filter((k) => !keys.has(k)) }
}

/** Resources that come back at dawn by a dice roll (wands, staffs), for the rest dialog. */
export function dawnDice(sheet: Sheet) {
  return sheet.resources
    .filter((r) => r.used > 0)
    .flatMap((r) => r.resource.recharge.filter((x) => x.on === 'dawn' && x.dice).map((x) => ({ key: r.key, name: r.source.item ? `${r.source.entity.name}` : r.resource.name, dice: x.dice!, used: r.used })))
}

/**
 * Long rest: full HP, hit dice and exhaustion per edition, long-rest
 * resources. With `dawn`, item charges that return at dawn come back too
 * (a long rest usually spans a dawn); dice recharges take the rolled values.
 */
export function longRest(char: Character, content: ContentIndex, opts: { dawn?: boolean; dawnRolls?: Record<string, number> } = {}): RestResult {
  const sheet = computeSheet(char, content)
  const rules = editionRules(char.edition)
  const changes: RestChange[] = []

  // Exhaustion drops first: in 5e 2014 level 4 halves the HP maximum.
  const exhaustion = Math.max(0, char.exhaustion - 1)
  if (exhaustion !== char.exhaustion) changes.push({ kind: 'exhaustion', before: char.exhaustion, after: exhaustion })
  const afterExhaustion = computeSheet({ ...char, exhaustion }, content)

  const hpMax = afterExhaustion.hpMax.value
  if (char.hp.current !== hpMax) changes.push({ kind: 'hp', before: char.hp.current, after: hpMax })
  // Temporary HP end on a long rest in both editions.
  if (char.hp.temp > 0) changes.push({ kind: 'tempHp', before: char.hp.temp, after: 0 })

  const hitDiceUsed: Record<string, number> = {}
  for (const pool of sheet.hitDice) {
    const back = Math.min(pool.used, rules.longRestHitDice(pool.total))
    hitDiceUsed[String(pool.die)] = pool.used - back
    if (back > 0) changes.push({ kind: 'hitDice', die: pool.die, before: pool.total - pool.used, after: pool.total - pool.used + back, total: pool.total })
  }

  let next: Character = {
    ...char,
    exhaustion,
    hitDiceUsed,
    hp: { current: hpMax, temp: 0 },
    deathSaves: { successes: 0, failures: 0 },
  }
  next = rechargeResources(next, sheet, 'longRest', changes)
  next = endStates(next, sheet, changes)
  if (opts.dawn) next = rechargeResources(next, computeSheet(next, content), 'dawn', changes, opts.dawnRolls)
  return { character: next, changes }
}
