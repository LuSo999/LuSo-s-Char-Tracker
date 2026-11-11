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
  type Effect,
  type Entity,
  type Resource,
  type Skill,
  type Weapon,
} from '../content/schema'
import type { AbilityScores, Character, InventoryEntry } from './character'
import { editionRules } from './editions'
import { resolveScaled, type FormulaVars } from './formula'

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
}

export type ResourceState = {
  key: string
  resource: Resource
  source: ActiveEntity
  max: number
  used: number
  remaining: number
  die?: number
}

export type Toggle = { key: string; label: string; source: ActiveEntity; on: boolean }

export type AttackRow = {
  key: string
  name: string
  item?: InventoryEntry
  weapon?: Weapon
  ability: Ability
  proficient: boolean
  attack: Value
  damageDice: string
  damageBonus: number
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
  available: boolean
  /** Resolved dice, e.g. "1d10" for a level 10 Battle Master's maneuver. */
  rollDice?: string
  rollBonus?: number
  saveDc?: number
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
  active: ActiveEntity[]
  armorProficiencies: string[]
  weaponProficiencies: string[]
  weaponMasteries: string[]
  notes: string[]
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

/** Collect every entity that currently applies to the character. */
export function collectActive(char: Character, content: ContentIndex): ActiveEntity[] {
  const characterLevel = char.classes.reduce((s, c) => s + c.level, 0)
  const out: ActiveEntity[] = []
  const push = (entity: Entity | undefined, grantKey: string, classLevel: number, classId?: string, item?: InventoryEntry) => {
    if (!entity) return
    const hidden = entity.type === 'feature' && entity.upgradeOf !== undefined
    out.push({ entity, grantKey, classLevel, classId, hidden, item })
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
  if (bg.feat) push(content.get(bg.feat), `${bg.id}/feat`, characterLevel)
  for (const f of bg.features) push(content.get(f), f, characterLevel)

  // Entities picked through choices (fighting style, feats, …), recursively.
  for (let i = 0; i < out.length; i++) {
    const ae = out[i]
    for (const choice of ae.entity.choices) {
      if (choice.kind !== 'entity') continue
      for (const selected of char.choices[choiceKey(ae.grantKey, choice.id)] ?? []) {
        push(content.get(selected), `${choiceKey(ae.grantKey, choice.id)}=${selected}`, ae.classLevel, ae.classId)
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
  proficient?: boolean
  bloodied: boolean
}

function effectApplies(effect: Effect, ae: ActiveEntity, ctx: EffectContext, toggles: Set<string>): boolean {
  const w = effect.when
  if (!w) return true
  if (typeof w === 'object') return toggles.has(`${ae.grantKey}#${w.toggle}`)
  switch (w) {
    case 'wearingArmor':
      return ctx.armor !== undefined
    case 'wearingHeavyArmor':
      return ctx.armor?.category === 'heavy'
    case 'noArmor':
      return ctx.armor === undefined
    case 'noShield':
      return !ctx.shield
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
  }
}

export function computeSheet(char: Character, content: ContentIndex): Sheet {
  const rules = editionRules(char.edition)
  const active = collectActive(char, content)
  const characterLevel = char.classes.reduce((s, c) => s + c.level, 0)
  const pbComputed = proficiencyBonus(characterLevel)
  const toggleSet = new Set(char.toggles)
  const notes: string[] = []

  const equipped = char.inventory.filter((e) => e.equipped)
  const equippedItems = equipped.map((e) => ({ entry: e, item: content.item(e.itemId) }))
  const bodyArmor = equippedItems.find((x) => x.item?.kind === 'armor' && x.item.category !== 'shield')?.item as Armor | undefined
  const shield = equippedItems.find((x) => x.item?.kind === 'armor' && x.item.category === 'shield')?.item as Armor | undefined
  const baseCtx: EffectContext = { armor: bodyArmor, shield: shield !== undefined, bloodied: false }

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
      for (const s of char.choices[choiceKey(ae.grantKey, choice.id)] ?? []) skillProf.set(s as Skill, Math.max(skillProf.get(s as Skill) ?? 0, 1))
    }
  }
  for (const { effect, ae } of allEffects) {
    const m = /^proficiency:(\w+):(.+)$/.exec(effect.target)
    if (!m || !effectApplies(effect, ae, baseCtx, toggleSet)) continue
    const [, kind, id] = m
    const level = resolveScaled(effect.value, vars(ae)) || 1
    if (kind === 'skill') skillProf.set(id as Skill, Math.max(skillProf.get(id as Skill) ?? 0, level))
    else if (kind === 'save') saveProf.add(id as Ability)
    else if (kind === 'armor') armorProf.add(id)
    else if (kind === 'weapon') weaponProf.add(id)
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
    const v = withExhaustion({ value: r.value + check.value, parts: [...r.parts, ...check.parts.slice(1)] })
    skillValues[s] = { ...override(`skill:${s}`, v.value, v.parts), proficiency }
  }

  const passive = applyEffects('passive:perception', 10 + skillValues.perception.value, '10 + Perception', vars)
  const passivePerception = override('passive:perception', passive.value, passive.parts)

  // Initiative is a Dexterity check in both editions.
  const initCtx = { ...baseCtx, proficient: false }
  const init = applyEffects('initiative', mods.dex, 'Dexterity', vars, initCtx)
  const initCheck = applyEffects('check:dex', 0, '', vars, initCtx)
  const initV = withExhaustion({ value: init.value + initCheck.value, parts: [...init.parts, ...initCheck.parts.slice(1)] })
  const initiative = override('initiative', initV.value, initV.parts)

  // --- Armor Class --------------------------------------------------------
  let acBase: number
  let acLabel: string
  if (bodyArmor) {
    const dex = bodyArmor.ac.dex ? Math.min(mods.dex, bodyArmor.ac.maxDex ?? Infinity) : 0
    acBase = bodyArmor.ac.base + dex
    acLabel = bodyArmor.name
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
    speedR = { value: speedR.value - 10, parts: [...speedR.parts, { label: `${bodyArmor.name} (Str ${bodyArmor.strMin})`, value: -10 }] }
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
      resources.push({ key, resource, source: ae, max, used, remaining: max - used, die })
    }
  }

  // --- Weapon masteries (2024) ------------------------------------------------
  const weaponMasteries = active.flatMap((ae) =>
    ae.entity.choices.filter((c) => c.kind === 'weaponMastery').flatMap((c) => char.choices[choiceKey(ae.grantKey, c.id)] ?? []),
  )

  // --- Attacks --------------------------------------------------------------
  const attacksPerAction = Math.max(1, applyEffects('attacksPerAction', 1, '', vars).value)
  const isProficient = (w: Weapon) => weaponProf.has(w.category) || weaponProf.has(w.id) || (w.baseItem !== undefined && weaponProf.has(w.baseItem))

  function attackRow(key: string, name: string, w: Weapon | undefined, entry: InventoryEntry | undefined): AttackRow {
    const props = w?.properties ?? []
    const ranged = w?.range === 'ranged'
    const ability: Ability = ranged ? 'dex' : props.includes('finesse') && mods.dex > mods.str ? 'dex' : 'str'
    const proficient = w ? isProficient(w) : true
    const ctx: EffectContext = { ...baseCtx, weapon: w ?? ({ range: 'melee' } as Weapon) }
    // Bonuses on the weapon itself apply only to that weapon; others to all matching attacks.
    const notOtherWeapon = (ae: ActiveEntity) => !(ae.item && ae.entity.type === 'item' && ae.entity.kind === 'weapon' && ae.item.uid !== entry?.uid)
    const atk = withExhaustion(
      applyEffects('attack', mods[ability] + (proficient ? pb : 0), proficient ? `${ability.toUpperCase()} + proficiency` : ability.toUpperCase(), vars, ctx, notOtherWeapon),
    )
    const dmg = applyEffects('damage', mods[ability], ability.toUpperCase(), vars, ctx, notOtherWeapon)
    const crit = applyEffects('critRange', 20, '', vars, ctx, notOtherWeapon)
    const twoHanded = entry?.twoHanded && w?.versatileDamage
    const mastery = w && char.edition === '2024' && w.mastery && (weaponMasteries.includes(w.id) || (w.baseItem && weaponMasteries.includes(w.baseItem))) ? w.mastery : undefined

    let ammo: AttackRow['ammo']
    if (w?.properties.includes('ammunition') && char.settings.trackAmmunition) {
      const ammoEntry =
        char.inventory.find((e) => e.uid === entry?.ammoUid) ??
        char.inventory.find((e) => {
          const it = content.item(e.itemId)
          return it?.kind === 'ammunition' && it.ammoKind === w.ammunition && e.quantity > 0
        })
      ammo = { uid: ammoEntry?.uid, remaining: ammoEntry?.quantity ?? 0, name: ammoEntry && (ammoEntry.label ?? content.item(ammoEntry.itemId)?.name) }
    } else if (w?.properties.includes('thrown') && entry && char.settings.trackAmmunition) {
      ammo = { uid: entry.uid, remaining: entry.quantity, name: entry.label ?? w.name }
    }

    return {
      key,
      name,
      item: entry,
      weapon: w,
      ability,
      proficient,
      attack: override(`attack:${key}`, atk.value, atk.parts),
      damageDice: (twoHanded ? w?.versatileDamage : w?.damage?.dice) ?? '1',
      damageBonus: dmg.value,
      damageType: w?.damage?.type ?? 'bludgeoning',
      critRange: crit.value,
      reach: ranged ? undefined : props.includes('reach') ? 10 : 5,
      range: ranged ? w?.distance : undefined,
      thrown: props.includes('thrown') ? w?.distance : undefined,
      properties: props,
      mastery,
      ammo,
      attacksPerAction,
    }
  }

  const attacks: AttackRow[] = []
  for (const { entry, item } of equippedItems) {
    if (item?.kind !== 'weapon') continue
    attacks.push(attackRow(entry.uid, entry.label ?? item.name, item, entry))
  }
  // Unarmed Strike: 1 + Strength modifier bludgeoning in both editions.
  const unarmed = attackRow('unarmed', 'Unarmed Strike', undefined, undefined)
  unarmed.damageDice = '1'
  attacks.push(unarmed)

  // --- Activities -------------------------------------------------------------
  const activities: ActivityRow[] = []
  for (const ae of active) {
    if (ae.hidden) continue
    for (const activity of ae.entity.activities) {
      if (activity.minLevel !== undefined && characterLevel < activity.minLevel) continue
      // Activity formulas may also use skill totals (e.g. "athletics" for a 2014 grapple check).
      const v = { ...vars(ae), ...Object.fromEntries(Object.entries(skillValues).map(([k, sv]) => [k.replace(/-/g, '_'), sv.value])) }
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
        available,
        rollDice: resolveDice(activity.roll?.dice, v),
        rollBonus: activity.roll?.bonus === undefined ? undefined : resolveScaled(activity.roll.bonus, v),
        saveDc: activity.saveDc === undefined ? undefined : resolveScaled(activity.saveDc, v),
      })
    }
  }

  // --- Toggles ------------------------------------------------------------------
  const toggles: Toggle[] = []
  for (const { effect, ae } of allEffects) {
    if (typeof effect.when !== 'object') continue
    const key = `${ae.grantKey}#${effect.when.toggle}`
    if (!toggles.some((t) => t.key === key)) toggles.push({ key, label: effect.when.toggle, source: ae, on: toggleSet.has(key) })
  }

  notes.push(...rules.exhaustionNotes(char.exhaustion))
  if (bodyArmor && !armorProf.has(bodyArmor.category) && !armorProf.has('all')) notes.push(`Not proficient with ${bodyArmor.name}`)

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
    active,
    armorProficiencies: [...armorProf],
    weaponProficiencies: [...weaponProf],
    weaponMasteries,
    notes,
  }
}
