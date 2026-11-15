// Stat blocks in play: Wild Shape forms and companions (familiars, steeds, beast companions,
// summons). Scaled stat blocks are formulas of the owner's numbers and the spell slot.
import { skills, type Ability, type CompanionGrant, type Creature, type CreatureAction, type Entity } from '../content/schema'
import type { ContentIndex } from '../content'
import { resolveScaled, type FormulaVars } from './formula'

export type CreatureActionView = {
  name: string
  description: string
  actionType: CreatureAction['actionType']
  attack?: { bonus: number; range?: string }
  /** "1d8+3 piercing + 1d4 poison" */
  damage: string
  save?: { ability: Ability; dc: number }
  uses?: { max: number; recharge: 'shortRest' | 'longRest' | 'roll' }
}

export type CreatureView = {
  creature: Creature
  /** Resolved bonuses and senses (they may be formulas). */
  saves: Partial<Record<Ability, number>>
  skills: Record<string, number>
  senses: Record<string, number>
  passivePerception?: number
  /** With the arrival pick applied ("@choice"). */
  resistances: string[]
  immunities: string[]
  conditionImmunities: string[]
  /** Temporary HP it arrives with. */
  tempHp: number
  ac: number
  hpMax: number
  speeds: Record<string, number>
  mods: Record<Ability, number>
  actions: CreatureActionView[]
  /** Where AC, HP, attack and damage changes come from (for breakdown tooltips). */
  parts: { ac: Part[]; hp: Part[]; attack: Part[]; damage: Part[] }
  /** Reminders from the owner's features ("companion:note"). */
  notes: { note: string; source: string }[]
}

/** One contribution to a number (same shape as the sheet's breakdown parts). */
export type Part = { label: string; value: number }

/** A resolved change to one stat of a creature. */
export type CreatureMod = { op: 'add' | 'set' | 'min' | 'max'; value: number; label: string }

/**
 * Changes to a creature on top of its stat block: the owner's effects "companion:<stat>"
 * (stats: ac, attack, damage, hp, hpPerDie, tempHp, speed, speed:<mode>, save:<ability|all>,
 * skill:<skill>, sense:<sense>, resistance:<type>, immunity:<type>, conditionImmunity:<condition>).
 */
export type CreatureMods = { stats: Record<string, CreatureMod[]>; notes: { note: string; source: string }[] }

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const mod = (score: number) => Math.floor((score - 10) / 2)

/** Adds first, then "set", "max" (at least) and "min" (at most) — like the character's own effects. */
function applyMods(base: number, baseLabel: string, mods: CreatureMod[] = []): { value: number; parts: Part[] } {
  let value = base
  const parts: Part[] = baseLabel ? [{ label: baseLabel, value: base }] : []
  for (const m of mods.filter((x) => x.op === 'add')) {
    value += m.value
    parts.push({ label: m.label, value: m.value })
  }
  for (const m of mods.filter((x) => x.op !== 'add')) {
    const next = m.op === 'set' ? m.value : m.op === 'max' ? Math.max(value, m.value) : Math.min(value, m.value)
    if (next !== value) parts.push({ label: m.label, value: next - value })
    value = next
  }
  return { value, parts }
}

const sumAdds = (mods: CreatureMod[] | undefined) => (mods ?? []).filter((m) => m.op === 'add').reduce((s, m) => s + m.value, 0)

/**
 * Numbers of a creature with the owner's formula vars (slot, pb, spellAttack, spellDc, wis…),
 * its grant's fixed `adjust` and the owner's effects on it.
 */
export function viewCreature(creature: Creature, vars: FormulaVars, adjust?: CompanionGrant['adjust'], choice?: string, opts: { mods?: CreatureMods; adjustLabel?: string } = {}): CreatureView {
  const pick = (s: string) => (choice ? s.replace(/@choice/g, choice) : s)
  const n = (v: Parameters<typeof resolveScaled>[0]) => {
    try {
      return Math.floor(resolveScaled(v, vars))
    } catch {
      return 0
    }
  }
  // The grant's adjust is one more source of "add" changes.
  const stats: Record<string, CreatureMod[]> = {}
  const push = (k: string, m: CreatureMod) => (stats[k] ??= []).push(m)
  const adjustLabel = opts.adjustLabel ?? 'Adjust'
  if (adjust) {
    for (const [k, stat] of [['ac', 'ac'], ['attack', 'attack'], ['damage', 'damage'], ['hpBonus', 'hp'], ['hpPerDie', 'hpPerDie'], ['tempHp', 'tempHp']] as const) {
      if (adjust[k] !== undefined) push(stat, { op: 'add', value: n(adjust[k]), label: adjustLabel })
    }
  }
  for (const [k, list] of Object.entries(opts.mods?.stats ?? {})) for (const m of list) push(k, m)

  const speeds: Record<string, number> = {}
  for (const [k, v] of Object.entries(creature.speed)) {
    const ft = n(v)
    if (ft > 0) speeds[k] = ft
  }
  if (stats.speed && speeds.walk !== undefined) speeds.walk = applyMods(speeds.walk, '', stats.speed).value
  for (const [k, list] of Object.entries(stats)) {
    const mode = /^speed:(\w+)$/.exec(k)?.[1]
    if (mode) speeds[mode] = Math.max(0, applyMods(speeds[mode] ?? 0, '', list).value)
  }

  const dieCount = Number(/^(\d+)d/.exec(creature.hitDice ?? '')?.[1] ?? 0) || (creature.hitDice ? n(creature.hitDice) : 0)
  const perDie = sumAdds(stats.hpPerDie)
  const hpBase = n(creature.hp)
  const hpAdds = (stats.hp ?? []).filter((m) => m.op === 'add')
  const raw = Math.floor((hpBase + sumAdds(hpAdds) + dieCount * perDie) * (adjust?.hpFactor ?? 1))
  const hpRest = applyMods(raw, '', (stats.hp ?? []).filter((m) => m.op !== 'add'))
  const hpParts: Part[] = [{ label: creature.name, value: hpBase }, ...hpAdds.map((m) => ({ label: m.label, value: m.value })), ...(perDie ? [{ label: `${dieCount} × ${perDie}`, value: dieCount * perDie }] : []), ...hpRest.parts]
  const hpMin = adjust?.hpMin === undefined ? 0 : n(adjust.hpMin)
  const acR = applyMods(n(creature.ac), creature.name, stats.ac)
  const attackBonus = sumAdds(stats.attack)
  const damageBonus = sumAdds(stats.damage)
  const mods = Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map((a) => [a, creature.scores ? mod(creature.scores[a as Ability]) : 0])) as Record<Ability, number>

  const rec = <K extends string>(r: Partial<Record<K, Parameters<typeof resolveScaled>[0]>>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, n(v as Parameters<typeof resolveScaled>[0])])) as Record<K, number>
  const saves: Partial<Record<Ability, number>> = rec(creature.saves)
  const skillsOut: Record<string, number> = rec(creature.skills)
  const senses: Record<string, number> = rec(creature.senses)
  const resistances = creature.resistances.map(pick)
  const immunities = creature.immunities.map(pick)
  const conditionImmunities = [...creature.conditionImmunities]
  for (const [k, list] of Object.entries(stats)) {
    const [kind, arg] = [k.split(':')[0], k.split(':').slice(1).join(':')]
    if (kind === 'save') for (const a of arg === 'all' ? (Object.keys(mods) as Ability[]) : [arg as Ability]) saves[a] = applyMods(saves[a] ?? mods[a] ?? 0, '', list).value
    else if (kind === 'skill') skillsOut[arg] = applyMods(skillsOut[arg] ?? mods[(skills as Record<string, Ability>)[arg]] ?? 0, '', list).value
    else if (kind === 'sense') {
      const max = list.filter((m) => m.op !== 'add').reduce((x, m) => Math.max(x, m.value), senses[arg] ?? 0)
      senses[arg] = max + sumAdds(list)
    } else if (kind === 'resistance' && !resistances.includes(arg)) resistances.push(arg)
    else if (kind === 'immunity' && !immunities.includes(arg)) immunities.push(arg)
    else if (kind === 'conditionImmunity' && !conditionImmunities.includes(arg)) conditionImmunities.push(arg)
  }
  const plus = (list: CreatureMod[] | undefined) => (list ?? []).filter((m) => m.op === 'add').map((m) => ({ label: m.label, value: m.value }))
  return {
    creature,
    saves,
    skills: skillsOut,
    senses,
    passivePerception: creature.passivePerception === undefined ? undefined : n(creature.passivePerception),
    tempHp: sumAdds(stats.tempHp),
    ac: acR.value,
    hpMax: Math.max(1, hpRest.value, hpMin),
    speeds,
    mods,
    resistances,
    immunities,
    conditionImmunities,
    parts: { ac: acR.parts, hp: hpMin > hpRest.value ? [...hpParts, { label: `min ${hpMin}`, value: hpMin - hpRest.value }] : hpParts, attack: plus(stats.attack), damage: plus(stats.damage) },
    notes: opts.mods?.notes ?? [],
    actions: creature.actions.map((a) => ({
      name: pick(a.name),
      description: pick(a.description),
      actionType: a.actionType,
      attack: a.attack ? { bonus: n(a.attack.bonus) + attackBonus, range: a.attack.range } : undefined,
      damage: a.damage
        .map((d, i) => {
          // The damage bonus goes on the first part of an attack (Ranger's Companion: + pb).
          const bonus = n(d.bonus) + (i === 0 && a.attack ? damageBonus : 0)
          const dice = typeof d.dice === 'string' ? d.dice : (() => { const c = n(d.dice.count); return c > 0 ? `${c}d${n(d.dice.die)}` : '' })()
          const amount = dice ? `${dice}${bonus ? signed(bonus) : ''}` : String(bonus)
          return `${amount} ${pick(d.type)}`
        })
        .join(' + '),
      save: a.save ? { ability: a.save.ability, dc: n(a.save.dc) } : undefined,
      uses: a.uses ? { max: Math.max(1, n(a.uses.max)), recharge: a.uses.recharge } : usesFromName(a.name),
    })),
  }
}

/** Limited uses written only in the action's name: "(3/Day)", "(Recharge 5–6)", "(1/Long Rest)", "1/Short Rest". */
export function usesFromName(name: string): CreatureActionView['uses'] {
  const perDay = /\((\d+)\/Day\b/i.exec(name)
  if (perDay) return { max: Number(perDay[1]), recharge: 'longRest' }
  if (/\bRecharge\s+\d/i.test(name)) return { max: 1, recharge: 'roll' }
  const perRest = /\b(\d+)\s*\/\s*(Long|Short) Rest\b/i.exec(name)
  if (perRest) return { max: Number(perRest[1]), recharge: perRest[2].toLowerCase() === 'short' ? 'shortRest' : 'longRest' }
  return undefined
}

export const crLabel = (cr: number) => (cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr))

/** Wild Shape limits from effects (shape:maxCr, shape:fly, shape:swim, shape:forms). */
export type ShapeRules = { maxCr: number; fly: boolean; swim: boolean; forms?: number; extra?: string[]; types?: string[] }

/** Stat blocks made for one spell or feature (spirits, primal beasts): never ordinary forms or familiars. */
const isSpecial = (c: Creature) => c.tags.includes('summon') || c.tags.includes('companion')

/** Beasts the druid could turn into under these rules. */
export function eligibleShapes(content: ContentIndex, rules: ShapeRules): Creature[] {
  return content
    .all('creature')
    .filter((c) => {
      if (rules.extra?.includes(c.id)) return true
      if (isSpecial(c)) return false
      const speeds = c.speed as Record<string, unknown>
      const typeOk = c.creatureType === 'beast' || !!rules.types?.includes(c.creatureType)
      return typeOk && c.cr <= rules.maxCr && (rules.fly || !speeds.fly) && (rules.swim || !speeds.swim)
    })
    .sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name))
}

/** The creatures a companion grant offers: its listed ids plus those matching its filter. */
export function grantCreatures(grant: CompanionGrant, content: ContentIndex): Creature[] {
  const listed = grant.creatures.map((id) => content.getTyped(id, 'creature')).filter((c): c is Creature => !!c)
  const f = grant.filter
  const filtered = f
    ? content.all('creature').filter((c) => !isSpecial(c) && (!f.creatureType || c.creatureType === f.creatureType) && (f.maxCr === undefined || c.cr <= f.maxCr) && (!f.tag || c.tags.includes(f.tag)))
    : []
  const seen = new Set<string>()
  return [...listed, ...filtered].filter((c) => !seen.has(c.id) && seen.add(c.id)).sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name))
}

/** Where a companion can come from: a feature or a spell the character has. */
export type CompanionSource = { entity: Entity; grant: CompanionGrant; classId?: string; classLevel: number; spellAttack: number; spellDc: number }

/** The formula vars a companion's stat block reads. */
export function companionVars(sheet: { mods: Record<Ability, number>; pb: { value: number }; characterLevel: number }, source: CompanionSource | undefined, slot: number | undefined): FormulaVars {
  return {
    ...sheet.mods,
    pb: sheet.pb.value,
    characterLevel: sheet.characterLevel,
    level: source?.classLevel ?? sheet.characterLevel,
    classLevel: source?.classLevel ?? sheet.characterLevel,
    slot: source?.grant.fixed?.slot ?? slot ?? 0,
    spellAttack: source?.grant.fixed?.spellAttack ?? source?.spellAttack ?? 0,
    spellDc: source?.grant.fixed?.spellDc ?? source?.spellDc ?? 0,
  }
}
