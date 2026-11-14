// Stat blocks in play: Wild Shape forms and companions (familiars, steeds, beast companions,
// summons). Scaled stat blocks are formulas of the owner's numbers and the spell slot.
import type { Ability, CompanionGrant, Creature, CreatureAction, Entity } from '../content/schema'
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
  /** Temporary HP it arrives with. */
  tempHp: number
  ac: number
  hpMax: number
  speeds: Record<string, number>
  mods: Record<Ability, number>
  actions: CreatureActionView[]
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
const mod = (score: number) => Math.floor((score - 10) / 2)

/** Numbers of a creature with the owner's formula vars (slot, pb, spellAttack, spellDc, wis…). */
export function viewCreature(creature: Creature, vars: FormulaVars, adjust?: CompanionGrant['adjust'], choice?: string): CreatureView {
  const pick = (s: string) => (choice ? s.replace(/@choice/g, choice) : s)
  const n = (v: Parameters<typeof resolveScaled>[0]) => {
    try {
      return Math.floor(resolveScaled(v, vars))
    } catch {
      return 0
    }
  }
  const speeds: Record<string, number> = {}
  for (const [k, v] of Object.entries(creature.speed)) {
    const ft = n(v)
    if (ft > 0) speeds[k] = ft
  }
  const adj = (v: Parameters<typeof resolveScaled>[0] | undefined) => (v === undefined ? 0 : n(v))
  const dieCount = Number(/^(\d+)d/.exec(creature.hitDice ?? '')?.[1] ?? 0) || (creature.hitDice ? n(creature.hitDice) : 0)
  const hp = Math.floor((n(creature.hp) + adj(adjust?.hpBonus) + dieCount * adj(adjust?.hpPerDie)) * (adjust?.hpFactor ?? 1))
  const rec = <K extends string>(r: Partial<Record<K, Parameters<typeof resolveScaled>[0]>>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, n(v as Parameters<typeof resolveScaled>[0])])) as Record<K, number>
  return {
    creature,
    saves: rec(creature.saves),
    skills: rec(creature.skills),
    senses: rec(creature.senses),
    passivePerception: creature.passivePerception === undefined ? undefined : n(creature.passivePerception),
    tempHp: adj(adjust?.tempHp),
    ac: n(creature.ac) + adj(adjust?.ac),
    hpMax: Math.max(1, hp, adj(adjust?.hpMin)),
    speeds,
    mods: Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map((a) => [a, creature.scores ? mod(creature.scores[a as Ability]) : 0])) as Record<Ability, number>,
    resistances: creature.resistances.map(pick),
    immunities: creature.immunities.map(pick),
    actions: creature.actions.map((a) => ({
      name: pick(a.name),
      description: pick(a.description),
      actionType: a.actionType,
      attack: a.attack ? { bonus: n(a.attack.bonus) + adj(adjust?.attack), range: a.attack.range } : undefined,
      damage: a.damage
        .map((d, i) => {
          // The damage bonus goes on the first part of an attack (Ranger's Companion: + pb).
          const bonus = n(d.bonus) + (i === 0 && a.attack ? adj(adjust?.damage) : 0)
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
