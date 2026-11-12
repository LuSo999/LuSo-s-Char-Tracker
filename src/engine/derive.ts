// Computes everything shown on the sheet from stored character state and
// content. Order for every value: base from the rules → modifiers from active
// features and equipped items → manual override from edit mode.
import type { ContentIndex } from '../content'
import {
  abilities,
  skills,
  type Ability,
  type ActionType,
  type Activity,
  type Armor,
  type Dice,
  type Edition,
  type Effect,
  type Entity,
  type Resource,
  type Skill,
  type Weapon,
} from '../content/schema'
import type { AbilityScores, Character, InventoryEntry } from './character'
import { editionRules } from './editions'
import { resolveScaled, type FormulaVars } from './formula'
import { carryingCapacity, offhandEligible, resolveEntry, totalWeight, type ResolvedEntry } from './items'
import { computeSpellcasting, type Spellcasting } from './spells'

/** One contribution to a number, for the breakdown shown in previews. */
export type Part = { label: string; value: number }

export type Value = {
  value: number
  computed: number
  overridden: boolean
  parts: Part[]
}

/** An entity currently contributing to the character, with the context it is evaluated in. */
export type ActiveEntity = {
  entity: Entity
  /** Stable key used for choices and toggles (see Character.choices). */
  grantKey: string
  /** Level in the owning class; character level for non-class entities. */
  classLevel: number
  classId?: string
  /** Upgrade features are folded into their base feature in the UI. */
  hidden: boolean
  item?: InventoryEntry
  /** Fixed selections for this entity's choices (e.g. a background's origin feat). */
  presets?: Record<string, string[]>
}

export type ResourceState = {
  key: string
  resource: Resource
  source: ActiveEntity
  max: number
  /** Maximum before a manual override. */
  maxComputed: number
  maxOverridden: boolean
  used: number
  remaining: number
  die?: number
}

export type Toggle = { key: string; label: string; source: ActiveEntity; on: boolean; /** Switched on by an activity (Rage), off by rests. */ state: boolean }

export type AttackRow = {
  key: string
  name: string
  item?: InventoryEntry
  weapon?: Weapon
  ability: Ability
  proficient: boolean
  attack: Value
  damageDice: string
  /** Damage bonus (same as damage.value); `damage` carries the breakdown and override state. */
  damageBonus: number
  damage: Value
  damageType: string
  critRange: number
  reach?: number
  range?: { normal: number; long?: number }
  thrown?: { normal: number; long?: number }
  properties: string[]
  mastery?: string
  /** Remaining ammunition (undefined when not tracked or not needed). */
  ammo?: { uid?: string; remaining: number; name?: string }
  attacksPerAction: number
  /** Rounds in the magazine for weapons with the reload property. */
  loaded?: { rounds: number; size: number }
  /** Light-property extra attack: damage bonus without the ability modifier (unless negative or a feature adds it). */
  offhand?: { damageBonus: number }
  /** Rules reminders the app can't apply itself (codes, translated in the UI). */
  notes: string[]
}

export type ActivityRow = {
  key: string
  activity: Activity
  source: ActiveEntity
  actionType: ActionType
  /** Remaining uses of the first cost resource, if any. */
  uses?: { remaining: number; max: number; resourceKey: string }
  /** Every cost, resolved to resource keys ("quantity:<uid>" spends the item itself). */
  costs: { resourceKey: string; amount: number }[]
  /** Resources it gives back, resolved (see Activity.restore). */
  restores: { resourceKey: string; amount: number | 'all'; upTo: boolean }[]
  /** Combined slot levels it recovers (Arcane Recovery). */
  recoverSlots?: number
  available: boolean
  /** Resolved dice, e.g. "1d10" for a level 10 Battle Master's maneuver. */
  rollDice?: string
  rollBonus?: number
  saveDc?: number
  /** Save DC with breakdown/override state (key "dc:<activity key>"). */
  dc?: Value
}

export type Sheet = {
  characterLevel: number
  pb: Value
  scores: Record<Ability, Value>
  mods: Record<Ability, number>
  saves: Record<Ability, Value & { proficient: boolean }>
  skills: Record<Skill, Value & { proficiency: number }>
  passivePerception: Value
  initiative: Value
  ac: Value
  speed: Value
  hpMax: Value
  hitDice: { die: number; total: number; used: number }[]
  attacks: AttackRow[]
  activities: ActivityRow[]
  resources: ResourceState[]
  toggles: Toggle[]
  /** How many items can be attuned at once (3; target "attunementSlots", op max). */
  attunementSlots: number
  /** Effect notes that apply right now (shown in the reminders strip). */
  reminders: { note: string; entity: Entity }[]
  active: ActiveEntity[]
  armorProficiencies: string[]
  weaponProficiencies: string[]
  toolProficiencies: string[]
  /** Darkvision etc. in feet. */
  senses: Record<string, number>
  /** Damage types the character resists. */
  resistances: string[]
  /** Advantages on particular saves (against Poisoned, Charmed…). */
  saveNotes: { note: string; entity: Entity }[]
  languages: string[]
  weaponMasteries: string[]
  notes: string[]
  /** Carried weight and capacity in pounds. */
  weight: { total: number; capacity: number }
  /** Inventory entries resolved to what they are in play. */
  items: ResolvedEntry[]
  spellcasting: Spellcasting
}

// ---------------------------------------------------------------------------

export function proficiencyBonus(characterLevel: number) {
  return 2 + Math.floor((characterLevel - 1) / 4)
}

export function abilityMod(score: number) {
  return Math.floor((score - 10) / 2)
}

export function resolveDice(dice: Dice | undefined, vars: FormulaVars): string | undefined {
  if (dice === undefined) return undefined
  if (typeof dice === 'string') return dice
  return `${resolveScaled(dice.count, vars)}d${resolveScaled(dice.die, vars)}`
}

export function choiceKey(grantKey: string, choiceId: string) {
  return `${grantKey}/${choiceId}`
}

/** What the player picked for a choice, or the entity's fixed preset. */
export function selections(char: Character, ae: ActiveEntity, choiceId: string): string[] {
  return char.choices[choiceKey(ae.grantKey, choiceId)] ?? ae.presets?.[choiceId] ?? []
}

/** Collect every entity that currently applies to the character. */
export function collectActive(char: Character, content: ContentIndex): ActiveEntity[] {
  const characterLevel = char.classes.reduce((s, c) => s + c.level, 0)
  const out: ActiveEntity[] = []
  const push = (entity: Entity | undefined, grantKey: string, classLevel: number, classId?: string, item?: InventoryEntry, presets?: Record<string, string[]>) => {
    if (!entity) return
    const hidden = entity.type === 'feature' && entity.upgradeOf !== undefined
    out.push({ entity, grantKey, classLevel, classId, hidden, item, presets })
  }

  for (const entry of char.classes) {
    const cls = content.require(entry.classId, 'class')
    push(cls, cls.id, entry.level, cls.id)
    pushLevels(cls.id, cls.levels, entry.level, cls.id)
    if (entry.subclassId) {
      const sub = content.require(entry.subclassId, 'subclass')
      push(sub, sub.id, entry.level, cls.id)
      pushLevels(sub.id, sub.levels, entry.level, cls.id)
    }
  }

  function pushLevels(ownerId: string, levels: { level: number; features: string[] }[], upTo: number, classId: string) {
    const count = new Map<string, number>()
    for (const l of levels) for (const f of l.features) count.set(f, (count.get(f) ?? 0) + 1)
    for (const l of levels) {
      if (l.level > upTo) continue
      for (const f of l.features) {
        const key = (count.get(f) ?? 0) > 1 ? `${f}@${ownerId}:${l.level}` : f
        push(content.get(f), key, upTo, classId)
      }
    }
  }

  // Rules every character has (Grapple, Shove).
  for (const core of content.all('feature').filter((f) => f.tags.includes('core'))) push(core, core.id, characterLevel)

  const species = content.require(char.speciesId, 'species')
  push(species, species.id, characterLevel)
  for (const t of species.traits) push(content.get(t), t, characterLevel)
  if (char.subspeciesId) {
    const sub = content.require(char.subspeciesId, 'subspecies')
    push(sub, sub.id, characterLevel)
    for (const t of sub.traits) push(content.get(t), t, characterLevel)
  }

  const bg = content.require(char.backgroundId, 'background')
  push(bg, bg.id, characterLevel)
  if (bg.feat) push(content.get(bg.feat), `${bg.id}/feat`, characterLevel, undefined, undefined, bg.featPresets)
  for (const f of bg.features) push(content.get(f), f, characterLevel)

  // Extras: granted by the DM, from the backstory, or the character's own features.
  for (const extra of char.extras) {
    const entity = extra.custom ?? (extra.entityId ? content.get(extra.entityId) : undefined)
    push(entity, `extra:${extra.uid}`, characterLevel, char.classes[0].classId)
  }

  // Entities picked through choices (fighting style, feats, …), recursively.
  for (let i = 0; i < out.length; i++) {
    const ae = out[i]
    for (const choice of ae.entity.choices) {
      if (choice.kind !== 'entity') continue
      const seen = new Map<string, number>()
      for (const selected of char.choices[choiceKey(ae.grantKey, choice.id)] ?? []) {
        // A repeatable option picked again (2024 Agonizing Blast for another cantrip) gets its own key.
        const n = (seen.get(selected) ?? 0) + 1
        seen.set(selected, n)
        push(content.get(selected), `${choiceKey(ae.grantKey, choice.id)}=${selected}${n > 1 ? `#${n}` : ''}`, ae.classLevel, ae.classId)
      }
    }
  }

  // Equipped items apply; consumables (potions, scrolls) are usable straight from the pack.
  for (const entry of char.inventory) {
    const item = content.item(entry.itemId)
    if (!item) continue
    const usable = entry.equipped ? !item.attunement || entry.attuned : item.consumable && entry.quantity > 0
    if (usable) push(item, `item:${entry.uid}`, characterLevel, undefined, entry)
  }

  return out
}

type EffectContext = {
  armor?: Armor
  shield: boolean
  weapon?: Weapon
  /** Ability used by the attack being computed. */
  ability?: Ability
  /** The attack is an Unarmed Strike. */
  unarmed?: boolean
  proficient?: boolean
  bloodied: boolean
  edition: Edition
  /** Reminders: conditions about a particular attack count as met. */
  anyAttack?: boolean
}

/**
 * Monk weapons. 2014 (SRD 5.1 Martial Arts): shortswords and simple melee
 * weapons without Two-Handed or Heavy. 2024 (SRD 5.2.1): Simple melee weapons
 * and Martial melee weapons with the Light property.
 */
const bgTools = (content: ContentIndex, char: Character) => content.getTyped(char.backgroundId, 'background')?.tools ?? []

export function isMonkWeapon(w: Weapon | undefined, edition: Edition): boolean {
  if (!w || w.range !== 'melee') return false
  const base = w.baseItem ?? w.id
  if (edition === '2014') return base === 'shortsword' || (w.category === 'simple' && !w.properties.includes('two-handed') && !w.properties.includes('heavy'))
  return w.category === 'simple' || w.properties.includes('light')
}

type When = Exclude<Effect['when'], undefined>
function effectApplies(effect: Effect, ae: ActiveEntity, ctx: EffectContext, toggles: Set<string>): boolean {
  return effect.when === undefined || whenHolds(effect.when, ae, ctx, toggles)
}

function whenHolds(w: When, ae: ActiveEntity, ctx: EffectContext, toggles: Set<string>): boolean {
  if (Array.isArray(w)) return w.every((x) => whenHolds(x, ae, ctx, toggles))
  if (typeof w === 'object') return toggles.has(`${ae.grantKey}#${w.toggle}`)
  if (ctx.anyAttack && ['rangedWeapon', 'meleeWeapon', 'weaponAttack', 'strengthAttack', 'martialArts', 'notProficient'].includes(w)) return true
  switch (w) {
    case 'wearingArmor':
      return ctx.armor !== undefined
    case 'wearingHeavyArmor':
      return ctx.armor?.category === 'heavy'
    case 'noArmor':
      return ctx.armor === undefined
    case 'noShield':
      return !ctx.shield
    case 'noArmorNoShield':
      return ctx.armor === undefined && !ctx.shield
    case 'wieldingShield':
      return ctx.shield
    case 'rangedWeapon':
      return ctx.weapon?.range === 'ranged'
    case 'meleeWeapon':
      return ctx.weapon?.range === 'melee'
    case 'weaponAttack':
      return ctx.weapon !== undefined
    case 'bloodied':
      return ctx.bloodied
    case 'notProficient':
      return ctx.proficient === false
    case 'strengthAttack':
      return ctx.ability === 'str'
    case 'notHeavyArmor':
      return ctx.armor?.category !== 'heavy'
    case 'martialArts':
      return !!ctx.unarmed || isMonkWeapon(ctx.weapon, ctx.edition)
  }
}

export function computeSheet(char: Character, content: ContentIndex): Sheet {
  const rules = editionRules(char.edition)
  const active = collectActive(char, content)
  const characterLevel = char.classes.reduce((s, c) => s + c.level, 0)
  const pbComputed = proficiencyBonus(characterLevel)
  // States switched on by activities (Raging) are shared by every effect that names them: one switch
  // "state:<name>". Other toggles belong to their entity ("<grantKey>#<name>").
  const stateNames = new Set(active.flatMap((ae) => ae.entity.activities.flatMap((a) => (a.toggle ? [a.toggle] : []))))
  const togglesIn = (w: Effect['when']): string[] => (w === undefined ? [] : Array.isArray(w) ? w.flatMap(togglesIn) : typeof w === 'object' ? [w.toggle] : [])
  const toggleSet = new Set(char.toggles)
  for (const ae of active) {
    for (const e of ae.entity.effects) for (const name of togglesIn(e.when)) if (stateNames.has(name) && char.toggles.includes(`state:${name}`)) toggleSet.add(`${ae.grantKey}#${name}`)
  }
  const notes: string[] = []

  const items = char.inventory.map((e) => resolveEntry(e, content)).filter((r): r is ResolvedEntry => r !== undefined)
  const equippedItems = items.filter((r) => r.entry.equipped && (!r.item.attunement || r.entry.attuned || r.weapon || r.armor))
  // Magic armor protects like its base armor; its own bonus comes through its effects.
  const bodyArmorEntry = equippedItems.find((r) => r.armor && r.armor.category !== 'shield')
  const bodyArmor = bodyArmorEntry?.armor
  const shield = equippedItems.find((r) => r.armor?.category === 'shield')?.armor
  const baseCtx: EffectContext = { armor: bodyArmor, shield: shield !== undefined, bloodied: false, edition: char.edition }

  // Effects keyed by the entity they come from, so formulas use the right level.
  const allEffects = active.flatMap((ae) => ae.entity.effects.map((effect) => ({ effect, ae })))

  const override = (key: string, computed: number, parts: Part[]): Value => {
    const o = char.overrides[key]
    return typeof o === 'number'
      ? { value: o, computed, overridden: true, parts }
      : { value: computed, computed, overridden: false, parts }
  }

  /** Apply all matching effects for a target to a base value. */
  function applyEffects(target: string, base: number, baseLabel: string, vars: (ae: ActiveEntity) => FormulaVars, ctx = baseCtx, filter?: (ae: ActiveEntity) => boolean) {
    const parts: Part[] = [{ label: baseLabel, value: base }]
    let value = base
    const matching = allEffects.filter(
      ({ effect, ae }) => effect.target === target && (!filter || filter(ae)) && effectApplies(effect, ae, ctx, toggleSet),
    )
    for (const { effect, ae } of matching.filter((m) => m.effect.op === 'add')) {
      const v = resolveScaled(effect.value, vars(ae))
      value += v
      parts.push({ label: ae.entity.name, value: v })
    }
    for (const { effect, ae } of matching.filter((m) => m.effect.op !== 'add')) {
      const v = resolveScaled(effect.value, vars(ae))
      const before = value
      if (effect.op === 'set') value = v
      else if (effect.op === 'min') value = Math.min(value, v)
      else value = Math.max(value, v)
      if (value !== before) parts.push({ label: ae.entity.name, value: value - before })
    }
    return { value, parts }
  }

  // --- Proficiency bonus and ability scores -------------------------------
  const levelVars = (ae: ActiveEntity): FormulaVars => ({
    pb: pbComputed,
    classLevel: ae.classLevel,
    level: ae.classLevel,
    characterLevel,
  })
  const pbApplied = applyEffects('pb', pbComputed, 'Character level', levelVars)
  const pb = override('pb', pbApplied.value, pbApplied.parts).value

  const scoreBase: AbilityScores = { ...char.baseScores }
  const scoreParts: Record<Ability, Part[]> = Object.fromEntries(abilities.map((a) => [a, [{ label: 'Base', value: char.baseScores[a] }]])) as Record<Ability, Part[]>
  const addScore = (a: Ability, v: number, label: string, cap?: number) => {
    const before = scoreBase[a]
    scoreBase[a] = cap === undefined ? before + v : Math.max(before, Math.min(before + v, cap))
    if (scoreBase[a] !== before) scoreParts[a].push({ label, value: scoreBase[a] - before })
  }

  // Fixed racial bonuses (2014) and background increases (2024).
  for (const ae of active) {
    if (ae.entity.type === 'species' || ae.entity.type === 'subspecies')
      for (const b of ae.entity.abilityBonuses) addScore(b.ability, b.bonus, ae.entity.name)
  }
  for (const [a, v] of Object.entries(char.backgroundBonuses)) addScore(a as Ability, v, 'Background')

  // Ability point choices (Ability Score Improvement and feats): "str+2".
  for (const ae of active) {
    for (const choice of ae.entity.choices) {
      if (choice.kind !== 'abilityPoints') continue
      for (const sel of char.choices[choiceKey(ae.grantKey, choice.id)] ?? []) {
        const m = /^(str|dex|con|int|wis|cha)\+(\d+)$/.exec(sel)
        if (m) addScore(m[1] as Ability, Number(m[2]), ae.entity.name, choice.scoreCap ?? 20)
      }
    }
  }

  const scores = {} as Record<Ability, Value>
  for (const a of abilities) {
    let value = scoreBase[a]
    for (const { effect, ae } of allEffects.filter((x) => x.effect.target === `score:${a}` && effectApplies(x.effect, x.ae, baseCtx, toggleSet))) {
      const v = resolveScaled(effect.value, levelVars(ae))
      const before = value
      if (effect.op === 'set') value = Math.max(value, v)
      else value = effect.max === undefined ? value + v : Math.max(value, Math.min(value + v, effect.max))
      if (value !== before) scoreParts[a].push({ label: ae.entity.name, value: value - before })
    }
    scores[a] = override(`score:${a}`, value, scoreParts[a])
  }
  const mods = Object.fromEntries(abilities.map((a) => [a, abilityMod(scores[a].value)])) as Record<Ability, number>

  const vars = (ae: ActiveEntity): FormulaVars => ({
    ...levelVars(ae),
    pb,
    ...mods,
    strScore: scores.str.value,
    dexScore: scores.dex.value,
    conScore: scores.con.value,
    intScore: scores.int.value,
    wisScore: scores.wis.value,
    chaScore: scores.cha.value,
  })

  // --- Proficiencies ------------------------------------------------------
  const primary = content.require(char.classes[0].classId, 'class')
  const saveProf = new Set<Ability>(primary.savingThrows)
  const armorProf = new Set(primary.proficiencies.armor)
  const weaponProf = new Set(primary.proficiencies.weapons)
  for (const entry of char.classes.slice(1)) {
    const mc = content.require(entry.classId, 'class').multiclass
    mc?.proficiencies.armor.forEach((p) => armorProf.add(p))
    mc?.proficiencies.weapons.forEach((p) => weaponProf.add(p))
  }

  // Tools and languages: class, background, species, and choices.
  const toolProf = new Set<string>([...primary.proficiencies.tools, ...bgTools(content, char)])
  for (const entry of char.classes.slice(1)) content.require(entry.classId, 'class').multiclass?.proficiencies.tools.forEach((p) => toolProf.add(p))
  const languageSet = new Set<string>(content.getTyped(char.speciesId, 'species')?.languages ?? [])
  for (const ae of active) {
    for (const choice of ae.entity.choices) {
      if (choice.kind !== 'tool' && choice.kind !== 'language') continue
      for (const v of char.choices[choiceKey(ae.grantKey, choice.id)] ?? []) (choice.kind === 'tool' ? toolProf : languageSet).add(v)
    }
  }

  const skillProf = new Map<Skill, number>()
  const bg = content.require(char.backgroundId, 'background')
  bg.skills.forEach((s) => skillProf.set(s, 1))
  for (const ae of active) {
    for (const choice of ae.entity.choices) {
      if (choice.kind !== 'skill') continue
      // Class skill choices apply only to the starting class; multiclass ones only to later classes.
      if (ae.entity.type === 'class') {
        const isPrimary = ae.entity.id === primary.id
        if ((choice.id === 'skills') !== isPrimary) continue
      }
      const level = choice.expertise ? 2 : 1
      for (const s of char.choices[choiceKey(ae.grantKey, choice.id)] ?? []) skillProf.set(s as Skill, Math.max(skillProf.get(s as Skill) ?? 0, level))
    }
  }
  for (const { effect, ae } of allEffects) {
    const m = /^proficiency:(\w+):(.+)$/.exec(effect.target)
    if (!m || !effectApplies(effect, ae, baseCtx, toggleSet)) continue
    const [, kind, id] = m
    const level = resolveScaled(effect.value, vars(ae)) || 1
    if (kind === 'skill') skillProf.set(id as Skill, Math.max(skillProf.get(id as Skill) ?? 0, level))
    else if (kind === 'save') for (const a of id === 'all' ? abilities : [id as Ability]) saveProf.add(a)
    else if (kind === 'armor') armorProf.add(id)
    else if (kind === 'weapon') weaponProf.add(id)
    else if (kind === 'tool') toolProf.add(id)
    else if (kind === 'language') languageSet.add(id)
  }

  const d20Penalty = rules.exhaustionD20Penalty(char.exhaustion)
  const withExhaustion = (v: { value: number; parts: Part[] }) =>
    d20Penalty ? { value: v.value - d20Penalty, parts: [...v.parts, { label: 'Exhaustion', value: -d20Penalty }] } : v

  // --- Saves, skills, initiative, passive Perception -------------------------
  const saves = {} as Sheet['saves']
  for (const a of abilities) {
    const proficient = saveProf.has(a)
    const base = mods[a] + (proficient ? pb : 0)
    let r = applyEffects(`save:${a}`, base, proficient ? 'Modifier + proficiency' : 'Modifier', vars)
    const all = applyEffects('save:all', 0, '', vars)
    r = withExhaustion({ value: r.value + all.value, parts: [...r.parts, ...all.parts.slice(1)] })
    saves[a] = { ...override(`save:${a}`, r.value, r.parts), proficient }
  }

  const skillValues = {} as Sheet['skills']
  for (const s of Object.keys(skills) as Skill[]) {
    const a = skills[s]
    const proficiency = skillProf.get(s) ?? 0
    const base = mods[a] + pb * proficiency
    const ctx = { ...baseCtx, proficient: proficiency > 0 }
    const r = applyEffects(`skill:${s}`, base, proficiency ? 'Modifier + proficiency' : 'Modifier', vars, ctx)
    const check = applyEffects(`check:${a}`, 0, '', vars, ctx)
    const checkAll = applyEffects('check:all', 0, '', vars, ctx)
    const v = withExhaustion({ value: r.value + check.value + checkAll.value, parts: [...r.parts, ...check.parts.slice(1), ...checkAll.parts.slice(1)] })
    skillValues[s] = { ...override(`skill:${s}`, v.value, v.parts), proficiency }
  }

  const passive = applyEffects('passive:perception', 10 + skillValues.perception.value, '10 + Perception', vars)
  const passivePerception = override('passive:perception', passive.value, passive.parts)

  // Initiative is a Dexterity check in both editions.
  const initCtx = { ...baseCtx, proficient: false }
  const init = applyEffects('initiative', mods.dex, 'Dexterity', vars, initCtx)
  const initCheck = applyEffects('check:dex', 0, '', vars, initCtx)
  const initAll = applyEffects('check:all', 0, '', vars, initCtx)
  const initV = withExhaustion({
    value: init.value + initCheck.value + initAll.value,
    parts: [...init.parts, ...initCheck.parts.slice(1), ...initAll.parts.slice(1)],
  })
  const initiative = override('initiative', initV.value, initV.parts)

  // --- Armor Class --------------------------------------------------------
  let acBase: number
  let acLabel: string
  if (bodyArmor) {
    const dex = bodyArmor.ac.dex ? Math.min(mods.dex, bodyArmor.ac.maxDex ?? Infinity) : 0
    acBase = bodyArmor.ac.base + dex
    acLabel = bodyArmorEntry!.name
  } else {
    acBase = 10 + mods.dex
    acLabel = 'Unarmored (10 + Dex)'
    // Alternative unarmored formulas (e.g. Unarmored Defense); the best one wins.
    for (const { effect, ae } of allEffects) {
      if (effect.target !== 'unarmoredAc' || !effectApplies(effect, ae, baseCtx, toggleSet)) continue
      const v = resolveScaled(effect.value, vars(ae))
      if (v > acBase) {
        acBase = v
        acLabel = ae.entity.name
      }
    }
  }
  const acParts: Part[] = [{ label: acLabel, value: acBase }]
  if (shield) {
    acBase += shield.ac.base
    acParts.push({ label: shield.name, value: shield.ac.base })
  }
  const acR = applyEffects('ac', acBase, '', vars)
  const ac = override('ac', acR.value, [...acParts, ...acR.parts.slice(1)])

  // --- Speed --------------------------------------------------------------
  const species = content.require(char.speciesId, 'species')
  let speedR = applyEffects('speed', species.speed, species.name, vars)
  if (bodyArmor?.category === 'heavy' && bodyArmor.strMin > scores.str.value) {
    // Both editions: heavy armor without the Strength requirement costs 10 ft.
    speedR = { value: speedR.value - 10, parts: [...speedR.parts, { label: `${bodyArmorEntry!.name} (Str ${bodyArmor.strMin})`, value: -10 }] }
  }
  const exhaustedSpeed = rules.exhaustedSpeed(speedR.value, char.exhaustion)
  if (exhaustedSpeed !== speedR.value) speedR.parts.push({ label: 'Exhaustion', value: exhaustedSpeed - speedR.value })
  const speed = override('speed', Math.max(0, exhaustedSpeed), speedR.parts)

  // --- Hit points and hit dice ---------------------------------------------
  const hpParts: Part[] = []
  let hp = 0
  char.classes.forEach((entry, i) => {
    const cls = content.require(entry.classId, 'class')
    const avg = cls.hitDie / 2 + 1
    for (let lvl = 1; lvl <= entry.level; lvl++) {
      const isFirst = i === 0 && lvl === 1
      const rollIndex = i === 0 ? lvl - 2 : lvl - 1
      const roll = isFirst ? cls.hitDie : (entry.hpRolls[rollIndex] ?? avg)
      // A level never grants less than 1 HP.
      const gained = Math.max(1, roll + mods.con)
      hp += gained
      hpParts.push({ label: `${cls.name} ${lvl}`, value: gained })
    }
  })
  const hpR = applyEffects('hpMax', hp, '', vars)
  const perLevel = applyEffects('hpPerLevel', 0, '', vars)
  let hpMaxComputed = hpR.value + perLevel.value * characterLevel
  const hpAllParts = [...hpParts, ...hpR.parts.slice(1), ...perLevel.parts.slice(1).map((p) => ({ ...p, value: p.value * characterLevel }))]
  const exhaustedMax = rules.exhaustedHpMax(hpMaxComputed, char.exhaustion)
  if (exhaustedMax !== hpMaxComputed) {
    hpAllParts.push({ label: 'Exhaustion', value: exhaustedMax - hpMaxComputed })
    hpMaxComputed = exhaustedMax
  }
  const hpMax = override('hpMax', hpMaxComputed, hpAllParts)
  baseCtx.bloodied = char.hp.current <= Math.floor(hpMax.value / 2)

  const diceByDie = new Map<number, number>()
  for (const entry of char.classes) {
    const die = content.require(entry.classId, 'class').hitDie
    diceByDie.set(die, (diceByDie.get(die) ?? 0) + entry.level)
  }
  const hitDice = [...diceByDie.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([die, total]) => ({ die, total, used: Math.min(total, char.hitDiceUsed[String(die)] ?? 0) }))

  // --- Resources ----------------------------------------------------------
  const resources: ResourceState[] = []
  for (const ae of active) {
    if (ae.hidden) continue
    const pools = ae.entity.type === 'item' && ae.entity.charges ? [...ae.entity.resources, ae.entity.charges] : ae.entity.resources
    for (const resource of pools) {
      // Item resources are per inventory entry; others are per resource id.
      const key = ae.item ? `item:${ae.item.uid}:${resource.id}` : resource.id
      if (resources.some((r) => r.key === key)) continue
      const maxComputed = Math.max(0, Math.floor(resolveScaled(resource.max, vars(ae))))
      const ov = char.overrides[`resource:${key}:max`]
      const max = typeof ov === 'number' ? ov : maxComputed
      if (max <= 0) continue
      const used = Math.min(max, ae.item && ae.entity.type === 'item' && resource === ae.entity.charges ? ae.item.chargesUsed : (char.resourcesUsed[key] ?? 0))
      const die = resource.die === undefined ? undefined : resolveScaled(resource.die, vars(ae))
      resources.push({ key, resource, source: ae, max, maxComputed, maxOverridden: typeof ov === 'number', used, remaining: max - used, die })
    }
  }

  // --- Spellcasting: slots become resources so rests restore them -------------
  const spellcasting = computeSpellcasting(char, content, active, {
    pb,
    mods,
    characterLevel,
    dcBonus: applyEffects('spellDc', 0, '', vars).value,
    attackBonus: applyEffects('spellAttack', 0, '', vars).value,
  })
  const casterAe = active.find((ae) => ae.entity.type === 'class') ?? active[0]
  for (const resource of spellcasting.resources) {
    const ov = char.overrides[`resource:${resource.id}:max`]
    const maxComputed = resource.max as number
    const max = typeof ov === 'number' ? ov : maxComputed
    const used = Math.min(max, char.resourcesUsed[resource.id] ?? 0)
    resources.push({ key: resource.id, resource, source: casterAe, max, maxComputed, maxOverridden: typeof ov === 'number', used, remaining: max - used })
  }

  // --- Weapon masteries (2024) ------------------------------------------------
  const weaponMasteries = active.flatMap((ae) =>
    ae.entity.choices.filter((c) => c.kind === 'weaponMastery').flatMap((c) => char.choices[choiceKey(ae.grantKey, c.id)] ?? []),
  )

  // --- Attacks --------------------------------------------------------------
  const attacksPerAction = Math.max(1, applyEffects('attacksPerAction', 1, '', vars).value)
  const isProficient = (w: Weapon) => weaponProf.has(w.category) || weaponProf.has(w.id) || (w.baseItem !== undefined && weaponProf.has(w.baseItem))

  const offhandMod = applyEffects('offhandAbilityMod', 0, '', vars).value > 0
  const sizeName = content.require(char.speciesId, 'species').size

  // Martial Arts (Monk): Dex for Unarmed Strikes and Monk weapons, and the Martial Arts die.
  const martialArtsCtx: EffectContext = { ...baseCtx, unarmed: true }
  const martialArts = applyEffects('martialArts', 0, '', vars, martialArtsCtx).value > 0
  const martialDie = applyEffects('martialArtsDie', 0, '', vars, martialArtsCtx).value
  const dieSize = (dice: string | undefined) => Number(/d(\d+)/.exec(dice ?? '')?.[1] ?? 0)

  function attackRow(key: string, name: string, w: Weapon | undefined, entry: InventoryEntry | undefined): AttackRow {
    const props = w?.properties ?? []
    const ranged = w?.range === 'ranged'
    const monk = martialArts && (!w || isMonkWeapon(w, char.edition))
    const ability: Ability = ranged ? 'dex' : (props.includes('finesse') || monk) && mods.dex > mods.str ? 'dex' : 'str'
    const proficient = w ? isProficient(w) : true
    const ctx: EffectContext = { ...baseCtx, weapon: w ?? ({ range: 'melee' } as Weapon), ability, unarmed: !w }

    // Ammunition in use: the chosen entry, or the first one of the right kind.
    const needsAmmo = !!w?.properties.includes('ammunition')
    const ammoEntry = needsAmmo
      ? (items.find((r) => r.entry.uid === entry?.ammoUid && r.ammoKind === w!.ammunition) ??
        items.find((r) => r.ammoKind === w!.ammunition && r.entry.quantity > 0) ??
        items.find((r) => r.ammoKind === w!.ammunition))
      : undefined

    // Item bonuses to attack and damage apply only to attacks made with that item (or its ammunition).
    const ownItem = (ae: ActiveEntity) => !(ae.item && ae.entity.type === 'item' && ae.item.uid !== entry?.uid)
    const ammoEffects = (target: string) =>
      (ammoEntry?.item.effects ?? []).filter((e) => e.target === target).map((e) => ({ label: ammoEntry!.name, value: resolveScaled(e.value, levelVars(active[0])) }))
    const withAmmo = (r: { value: number; parts: Part[] }, target: string) => {
      const extra = ammoEffects(target)
      return { value: r.value + extra.reduce((s2, p) => s2 + p.value, 0), parts: [...r.parts, ...extra] }
    }

    const atk = withExhaustion(
      withAmmo(applyEffects('attack', mods[ability] + (proficient ? pb : 0), proficient ? `${ability.toUpperCase()} + proficiency` : ability.toUpperCase(), vars, ctx, ownItem), 'attack'),
    )
    const dmg = withAmmo(applyEffects('damage', mods[ability], ability.toUpperCase(), vars, ctx, ownItem), 'damage')
    const crit = applyEffects('critRange', 20, '', vars, ctx, ownItem)
    const twoHanded = entry?.twoHanded && w?.versatileDamage
    const mastery = w && char.edition === '2024' && w.mastery && (weaponMasteries.includes(w.id) || (w.baseItem && weaponMasteries.includes(w.baseItem))) ? w.mastery : undefined

    let ammo: AttackRow['ammo']
    if (needsAmmo && char.settings.trackAmmunition) {
      ammo = { uid: ammoEntry?.entry.uid, remaining: ammoEntry?.entry.quantity ?? 0, name: ammoEntry?.name }
    } else if (props.includes('thrown') && entry && char.settings.trackAmmunition) {
      ammo = { uid: entry.uid, remaining: entry.quantity, name }
    }

    // Reminders the app can't decide (range, adjacent enemies, loading, heavy weapons).
    const notes: string[] = []
    if (ranged || props.includes('thrown')) notes.push('longRange', 'adjacent')
    if (props.includes('loading')) notes.push('loading')
    if (props.includes('heavy')) {
      if (char.edition === '2014' && sizeName === 'Small') notes.push('heavySmall')
      if (char.edition === '2024' && (ranged ? scores.dex.value : scores.str.value) < 13) notes.push('heavyWeak')
    }

    const baseDice = (twoHanded ? w?.versatileDamage : w?.damage?.dice) ?? '1'
    const martialDice = monk && martialDie > dieSize(baseDice) ? `1d${martialDie}` : undefined
    return {
      key,
      name,
      item: entry,
      weapon: w,
      ability,
      proficient,
      attack: override(`attack:${key}`, atk.value, atk.parts),
      damageDice: martialDice ?? baseDice,
      damageBonus: override(`damage:${key}`, dmg.value, dmg.parts).value,
      damage: override(`damage:${key}`, dmg.value, dmg.parts),
      damageType: w?.damage?.type ?? 'bludgeoning',
      critRange: crit.value,
      reach: ranged ? undefined : props.includes('reach') ? 10 : 5,
      range: ranged ? w?.distance : undefined,
      thrown: props.includes('thrown') ? w?.distance : undefined,
      properties: props,
      mastery,
      ammo,
      attacksPerAction,
      loaded: w?.reload ? { rounds: Math.min(w.reload, entry?.loaded ?? 0), size: w.reload } : undefined,
      offhand: offhandEligible(w, char.edition)
        ? { damageBonus: dmg.value - mods[ability] + (mods[ability] < 0 || offhandMod ? mods[ability] : 0) }
        : undefined,
      notes,
    }
  }

  const attacks: AttackRow[] = []
  for (const r of equippedItems) {
    if (!r.weapon) continue
    attacks.push(attackRow(r.entry.uid, r.name, r.weapon, r.entry))
  }
  // Unarmed Strike: 1 + Strength modifier bludgeoning in both editions.
  const unarmed = attackRow('unarmed', 'Unarmed Strike', undefined, undefined)
  if (unarmed.damageDice === '1') unarmed.damageDice = '1'
  attacks.push(unarmed)

  // --- Activities -------------------------------------------------------------
  const activities: ActivityRow[] = []
  for (const ae of active) {
    if (ae.hidden) continue
    for (const activity of ae.entity.activities) {
      if (activity.minLevel !== undefined && characterLevel < activity.minLevel) continue
      // Activity formulas may also use skill totals (e.g. "athletics" for a 2014 grapple check).
      // ... and resource counts: used_<id> / max_<id> (Relentless Rage DC, Magical Cunning's half of the Pact slots).
      const v = {
        ...vars(ae),
        ...Object.fromEntries(Object.entries(skillValues).map(([k, sv]) => [k.replace(/-/g, '_'), sv.value])),
        ...Object.fromEntries(resources.flatMap((r) => [[`used_${r.key.replace(/[^a-z0-9]/gi, '_')}`, Math.max(0, r.used)], [`max_${r.key.replace(/[^a-z0-9]/gi, '_')}`, r.max]])),
      }
      // "@quantity" spends the item itself (potions); other costs name a resource id.
      const pool = (resource: string): ActivityRow['uses'] => {
        if (resource === '@quantity') {
          return ae.item ? { remaining: ae.item.quantity, max: ae.item.quantity, resourceKey: `quantity:${ae.item.uid}` } : undefined
        }
        const key = ae.item && ae.entity.type === 'item' && [...ae.entity.resources, ae.entity.charges].some((r) => r?.id === resource) ? `item:${ae.item.uid}:${resource}` : resource
        const r = resources.find((x) => x.key === key)
        return r && { remaining: r.remaining, max: r.max, resourceKey: r.key }
      }
      const available = activity.cost.every((c) => (pool(c.resource)?.remaining ?? 0) >= c.amount)
      activities.push({
        key: `${ae.grantKey}:${activity.id}`,
        activity,
        source: ae,
        actionType: activity.actionType,
        uses: activity.cost[0] ? pool(activity.cost[0].resource) : undefined,
        costs: activity.cost.map((c) => ({ resourceKey: pool(c.resource)?.resourceKey ?? c.resource, amount: c.amount })),
        restores: activity.restore.map((r) => ({ resourceKey: pool(r.resource)?.resourceKey ?? r.resource, amount: r.amount === 'all' ? 'all' : resolveScaled(r.amount, v), upTo: r.upTo })),
        recoverSlots: activity.recoverSlots === undefined ? undefined : resolveScaled(activity.recoverSlots, v),
        available,
        rollDice: resolveDice(activity.roll?.dice, v),
        rollBonus: activity.roll?.bonus === undefined ? undefined : resolveScaled(activity.roll.bonus, v),
        ...(() => {
          if (activity.saveDc === undefined) return {}
          const dc = override(`dc:${ae.grantKey}:${activity.id}`, resolveScaled(activity.saveDc, v), [{ label: String(activity.saveDc), value: resolveScaled(activity.saveDc, v) }])
          return { saveDc: dc.value, dc }
        })(),
      })
    }
  }

  // --- Toggles ------------------------------------------------------------------
  // Switches for conditional effects; "state" ones (Raging) are switched on by an activity and off by rests.
  const toggles: Toggle[] = []
  const addToggle = (ae: ActiveEntity, name: string) => {
    const state = stateNames.has(name)
    const key = state ? `state:${name}` : `${ae.grantKey}#${name}`
    if (!toggles.some((t) => t.key === key)) toggles.push({ key, label: name, source: ae, on: char.toggles.includes(key), state })
  }
  for (const ae of active) for (const a of ae.entity.activities) if (a.toggle) addToggle(ae, a.toggle)
  for (const { effect, ae } of allEffects) for (const name of togglesIn(effect.when)) addToggle(ae, name)

  // Reminders: effect notes whose conditions hold (a Rage note only while Raging).
  // Save advantages are listed with the saving throws, not in the reminders strip.
  const isSaveNote = (target: string) => /^(advantage|disadvantage):save:/.test(target)
  const reminders = allEffects
    .filter(({ effect, ae }) => effect.note && !isSaveNote(effect.target) && !ae.hidden && effectApplies(effect, ae, { ...baseCtx, anyAttack: true }, toggleSet))
    .map(({ effect, ae }) => ({ note: effect.note!, entity: ae.entity }))
  const saveNotes = allEffects
    .filter(({ effect, ae }) => effect.note && isSaveNote(effect.target) && effectApplies(effect, ae, baseCtx, toggleSet))
    .map(({ effect, ae }) => ({ note: effect.note!, entity: ae.entity }))

  // Senses ("sense:darkvision", op max) and damage resistances ("resistance:fire").
  const senses: Record<string, number> = {}
  const resistances = new Set<string>()
  for (const { effect, ae } of allEffects) {
    if (!effectApplies(effect, ae, baseCtx, toggleSet)) continue
    const sense = /^sense:(\w+)$/.exec(effect.target)
    if (sense) senses[sense[1]] = Math.max(senses[sense[1]] ?? 0, resolveScaled(effect.value, vars(ae)))
    const res = /^resistance:(\w+)$/.exec(effect.target)
    if (res) resistances.add(res[1])
  }

  // Carrying capacity: Strength × 15 (size-adjusted); Powerful Build counts as one size larger.
  const carrySize = applyEffects('carrySize', 0, '', vars).value
  const weight = { total: totalWeight(char, content), capacity: carryingCapacity(scores.str.value, sizeName, carrySize) }
  if (weight.total > weight.capacity) notes.push('Over carrying capacity')

  notes.push(...rules.exhaustionNotes(char.exhaustion))
  if (bodyArmor && !armorProf.has(bodyArmor.category) && !armorProf.has('all')) notes.push(`Not proficient with ${bodyArmorEntry!.name}`)

  return {
    characterLevel,
    pb: override('pb', pbApplied.value, pbApplied.parts),
    scores,
    mods,
    saves,
    skills: skillValues,
    passivePerception,
    initiative,
    ac,
    speed,
    hpMax,
    hitDice,
    attacks,
    activities,
    resources,
    toggles,
    reminders,
    attunementSlots: applyEffects('attunementSlots', 3, '', vars).value,
    active,
    armorProficiencies: [...armorProf],
    weaponProficiencies: [...weaponProf],
    toolProficiencies: [...toolProf],
    senses,
    resistances: [...resistances],
    saveNotes,
    languages: [...languageSet],
    weaponMasteries,
    notes,
    weight,
    items,
    spellcasting,
  }
}
