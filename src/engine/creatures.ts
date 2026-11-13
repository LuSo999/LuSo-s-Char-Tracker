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
}

export type CreatureView = {
  creature: Creature
  /** Resolved bonuses and senses (they may be formulas). */
  saves: Partial<Record<Ability, number>>
  skills: Record<string, number>
  senses: Record<string, number>
  passivePerception?: number
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
export function viewCreature(creature: Creature, vars: FormulaVars, adjust?: CompanionGrant['adjust']): CreatureView {
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
  const hp = n(creature.hp) + adj(adjust?.hpBonus) + dieCount * adj(adjust?.hpPerDie)
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
    mods: Object.fromEntries(Object.entries(creature.scores).map(([a, s]) => [a, mod(s)])) as Record<Ability, number>,
    actions: creature.actions.map((a) => ({
      name: a.name,
      description: a.description,
      actionType: a.actionType,
      attack: a.attack ? { bonus: n(a.attack.bonus) + adj(adjust?.attack), range: a.attack.range } : undefined,
      damage: a.damage
        .map((d, i) => {
          // The damage bonus goes on the first part of an attack (Ranger's Companion: + pb).
          const bonus = n(d.bonus) + (i === 0 && a.attack ? adj(adjust?.damage) : 0)
          const dice = typeof d.dice === 'string' ? d.dice : (() => { const c = n(d.dice.count); return c > 0 ? `${c}d${n(d.dice.die)}` : '' })()
          const amount = dice ? `${dice}${bonus ? signed(bonus) : ''}` : String(bonus)
          return `${amount} ${d.type}`
        })
        .join(' + '),
      save: a.save ? { ability: a.save.ability, dc: n(a.save.dc) } : undefined,
    })),
  }
}

export const crLabel = (cr: number) => (cr === 0.125 ? '1/8' : cr === 0.25 ? '1/4' : cr === 0.5 ? '1/2' : String(cr))

/** Wild Shape limits from effects (shape:maxCr, shape:fly, shape:swim, shape:forms). */
export type ShapeRules = { maxCr: number; fly: boolean; swim: boolean; forms?: number; extra?: string[] }

/** Beasts the druid could turn into under these rules. */
export function eligibleShapes(content: ContentIndex, rules: ShapeRules): Creature[] {
  return content
    .all('creature')
    .filter((c) => {
      if (rules.extra?.includes(c.id)) return true
      const speeds = c.speed as Record<string, unknown>
      return c.creatureType === 'beast' && c.cr <= rules.maxCr && (rules.fly || !speeds.fly) && (rules.swim || !speeds.swim)
    })
    .sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name))
}

/** The creatures a companion grant offers: its listed ids plus those matching its filter. */
export function grantCreatures(grant: CompanionGrant, content: ContentIndex): Creature[] {
  const listed = grant.creatures.map((id) => content.getTyped(id, 'creature')).filter((c): c is Creature => !!c)
  const f = grant.filter
  const filtered = f
    ? content.all('creature').filter((c) => (!f.creatureType || c.creatureType === f.creatureType) && (f.maxCr === undefined || c.cr <= f.maxCr) && (!f.tag || c.tags.includes(f.tag)))
    : []
  const seen = new Set<string>()
  return [...listed, ...filtered].filter((c) => !seen.has(c.id) && seen.add(c.id)).sort((a, b) => a.cr - b.cr || a.name.localeCompare(b.name))
}

/** Where a companion can come from: a feature or a spell the character has. */
export type CompanionSource = { entity: Entity; grant: CompanionGrant; classId?: string; classLevel: number; spellAttack: number; spellDc: number }
