// Mechanics for SRD entities that the source data only has as prose.
// Every entry was checked against the SRD text (5.1 for 2014, 5.2.1 for 2024);
// the class-table numbers are additionally cross-checked against the source
// data's level tables below. Mark anything uncertain with `verified: false`.
import type { Edition } from '../src/content/schema.ts'
import { barbarian } from './overlay/barbarian.ts'
import type { ClassOverlay } from './overlay/common.ts'
import { monk } from './overlay/monk.ts'
import { paladin } from './overlay/paladin.ts'
import { ranger } from './overlay/ranger.ts'
import { bard } from './overlay/bard.ts'
import { cleric } from './overlay/cleric.ts'
import { druid } from './overlay/druid.ts'
import { sorcerer } from './overlay/sorcerer.ts'
import { warlock } from './overlay/warlock.ts'
import { species } from './overlay/species.ts'
import { rogue } from './overlay/rogue.ts'

/** Per-class overlays (scripts/overlay/*.ts). */
const classOverlays: ClassOverlay[] = [barbarian, monk, rogue, paladin, ranger, bard, cleric, druid, sorcerer, warlock, species]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any
type Patch = Record<string, unknown>

const all = 'all' as const
const shortAndLong = (short: number | 'all' = all) => [
  { on: 'shortRest', amount: short },
  { on: 'longRest', amount: all },
]
const longOnly = [{ on: 'longRest', amount: all }]

// --- 5e 2014 (SRD 5.1) --------------------------------------------------------------

const fightingStyles2014: Record<string, Patch> = {
  'fighter-fighting-style-archery': { effects: [{ target: 'attack', value: 2, when: 'rangedWeapon' }] },
  'fighter-fighting-style-defense': { effects: [{ target: 'ac', value: 1, when: 'wearingArmor' }] },
  'fighter-fighting-style-dueling': {
    effects: [{ target: 'damage', value: 2, when: { toggle: 'One-handed melee weapon, no other weapon' } }],
  },
  'fighter-fighting-style-great-weapon-fighting': {},
  'fighter-fighting-style-protection': {
    activities: [
      { id: 'protect', name: 'Protection', actionType: 'reaction', summary: 'Impose Disadvantage on an attack against an ally within 5 ft (needs a shield).' },
    ],
  },
  'fighter-fighting-style-two-weapon-fighting': { effects: [{ target: 'offhandAbilityMod', value: 1 }] },
}

const overlay2014: Record<string, Patch> = {
  ...fightingStyles2014,
  'second-wind': {
    actionType: 'bonusAction',
    resources: [{ id: 'second-wind', name: 'Second Wind', max: 1, recharge: shortAndLong() }],
    activities: [
      {
        id: 'use', name: 'Second Wind', actionType: 'bonusAction', cost: [{ resource: 'second-wind' }],
        roll: { dice: '1d10', bonus: 'level', kind: 'heal' }, summary: 'Regain 1d10 + Fighter level HP.',
      },
    ],
  },
  'action-surge-1-use': {
    name: 'Action Surge',
    resources: [{ id: 'action-surge', name: 'Action Surge', max: { byLevel: { 2: 1, 17: 2 } }, recharge: shortAndLong() }],
    activities: [
      { id: 'use', name: 'Action Surge', actionType: 'other', cost: [{ resource: 'action-surge' }], grants: 'action', fx: 'power', summary: 'Take one additional action this turn (once per turn).' },
    ],
  },
  'action-surge-2-uses': { upgradeOf: 'action-surge-1-use' },
  'indomitable-1-use': {
    name: 'Indomitable',
    resources: [{ id: 'indomitable', name: 'Indomitable', max: { byLevel: { 9: 1, 13: 2, 17: 3 } }, recharge: longOnly }],
    activities: [{ id: 'use', name: 'Indomitable', actionType: 'other', cost: [{ resource: 'indomitable' }], summary: 'Reroll a failed saving throw.' }],
  },
  'indomitable-2-uses': { upgradeOf: 'indomitable-1-use' },
  'indomitable-3-uses': { upgradeOf: 'indomitable-1-use' },
  'extra-attack-1': { effects: [{ target: 'attacksPerAction', op: 'max', value: 2 }] },
  'extra-attack-2': { upgradeOf: 'extra-attack-1', effects: [{ target: 'attacksPerAction', op: 'max', value: 3 }] },
  'extra-attack-3': { upgradeOf: 'extra-attack-1', effects: [{ target: 'attacksPerAction', op: 'max', value: 4 }] },
  'martial-archetype-improvement-1': { upgradeOf: 'martial-archetype' },
  'martial-archetype-improvement-2': { upgradeOf: 'martial-archetype' },
  'martial-archetype-improvement-3': { upgradeOf: 'martial-archetype' },
  'martial-archetype-improvement-4': { upgradeOf: 'martial-archetype' },
  // Wizard
  'arcane-recovery': {
    resources: [{ id: 'arcane-recovery', name: 'Arcane Recovery', max: 1, recharge: longOnly }],
    activities: [{ id: 'use', name: 'Arcane Recovery', actionType: 'other', cost: [{ resource: 'arcane-recovery' }], roll: { bonus: 'ceil(level / 2)', kind: 'other' }, summary: 'After a Short Rest: recover spell slots with this combined level (none 6th+). Restore them on the slot dots.' }],
  },
  // Champion
  'improved-critical': { effects: [{ target: 'critRange', op: 'min', value: 19, when: 'weaponAttack' }] },
  'superior-critical': { upgradeOf: 'improved-critical', effects: [{ target: 'critRange', op: 'min', value: 18, when: 'weaponAttack' }] },
  'remarkable-athlete': {
    effects: ['str', 'dex', 'con'].map((a) => ({ target: `check:${a}`, value: 'ceil(pb / 2)', when: 'notProficient' })),
  },
  'additional-fighting-style': {},
  survivor: {},
  // Potions of Healing: drinking takes an action (SRD 5.1 Adventuring Gear).
  ...Object.fromEntries(
    [
      ['potion-of-healing-common', '2d4', 2],
      ['potion-of-healing-greater', '4d4', 4],
      ['potion-of-healing-superior', '8d4', 8],
      ['potion-of-healing-supreme', '10d4', 20],
    ].map(([id, dice, bonus]) => [
      id,
      { activities: [{ id: 'drink', name: 'Drink', actionType: 'action', cost: [{ resource: '@quantity' }], roll: { dice, bonus, kind: 'heal' } }] },
    ]),
  ),
}

/** 2014 Ability Score Improvement features: +2 to one or +1 to two, max 20. */
function asi2014(byId: Map<string, Raw>) {
  for (const e of byId.values()) {
    if (e.type === 'feature' && /-ability-score-improvement-\d+$/.test(e.id)) {
      e.choices = [{ id: 'asi', label: 'Ability Score Improvement', kind: 'abilityPoints', points: 2, perOption: 2, scoreCap: 20 }]
    }
  }
}

// --- 5.5e 2024 (SRD 5.2.1) ----------------------------------------------------------

const overlay2024: Record<string, Patch> = {
  'fighter-fighting-style': {
    choices: [{ id: 'feat', label: 'Fighting Style feat', kind: 'entity', from: { type: 'feat', tags: ['fighting-style'] }, changeable: 'levelUp' }],
  },
  'fighter-second-wind': {
    actionType: 'bonusAction',
    resources: [{ id: 'second-wind', name: 'Second Wind', max: { byLevel: { 1: 2, 4: 3, 10: 4 } }, recharge: shortAndLong(1) }],
    activities: [
      {
        id: 'use', name: 'Second Wind', actionType: 'bonusAction', cost: [{ resource: 'second-wind' }],
        roll: { dice: '1d10', bonus: 'level', kind: 'heal' }, summary: 'Regain 1d10 + Fighter level HP.',
      },
    ],
  },
  'fighter-weapon-mastery': {
    choices: [{ id: 'weapons', label: 'Weapon Mastery', kind: 'weaponMastery', count: { byLevel: { 1: 3, 4: 4, 10: 5, 16: 6 } }, changeable: 'longRest' }],
  },
  'fighter-action-surge': {
    resources: [{ id: 'action-surge', name: 'Action Surge', max: { byLevel: { 2: 1, 17: 2 } }, recharge: shortAndLong() }],
    activities: [
      { id: 'use', name: 'Action Surge', actionType: 'other', cost: [{ resource: 'action-surge' }], grants: 'action', fx: 'power', summary: 'Take one additional action (not Magic) this turn; once per turn.' },
    ],
  },
  'fighter-tactical-mind': {
    activities: [
      {
        id: 'use', name: 'Tactical Mind', actionType: 'other', cost: [{ resource: 'second-wind' }],
        roll: { dice: '1d10', kind: 'other' }, summary: 'Failed ability check: add 1d10. If it still fails, the use is not spent.',
      },
    ],
  },
  'fighter-ability-score-improvement': {
    choices: [{ id: 'feat', label: 'Feat', kind: 'entity', from: { type: 'feat', tags: ['general'] } }],
  },
  'fighter-extra-attack': { effects: [{ target: 'attacksPerAction', op: 'max', value: 2 }] },
  'fighter-two-extra-attacks': { upgradeOf: 'fighter-extra-attack', effects: [{ target: 'attacksPerAction', op: 'max', value: 3 }] },
  'fighter-three-extra-attacks': { upgradeOf: 'fighter-extra-attack', effects: [{ target: 'attacksPerAction', op: 'max', value: 4 }] },
  'fighter-indomitable': {
    resources: [{ id: 'indomitable', name: 'Indomitable', max: { byLevel: { 9: 1, 13: 2, 17: 3 } }, recharge: longOnly }],
    activities: [
      { id: 'use', name: 'Indomitable', actionType: 'other', cost: [{ resource: 'indomitable' }], roll: { bonus: 'level', kind: 'other' }, summary: 'Reroll a failed save with a bonus equal to Fighter level.' },
    ],
  },
  'fighter-epic-boon': {
    choices: [{ id: 'feat', label: 'Epic Boon', kind: 'entity', from: { type: 'feat', tags: ['epic-boon'] } }],
  },
  // Wizard
  'wizard-arcane-recovery': {
    resources: [{ id: 'arcane-recovery', name: 'Arcane Recovery', max: 1, recharge: longOnly }],
    activities: [{ id: 'use', name: 'Arcane Recovery', actionType: 'other', cost: [{ resource: 'arcane-recovery' }], roll: { bonus: 'ceil(level / 2)', kind: 'other' }, summary: 'After a Short Rest: recover spell slots with this combined level (none level 6+). Restore them on the slot dots.' }],
  },
  'wizard-scholar': {
    choices: [{ id: 'skill', label: 'Expertise', kind: 'skill', expertise: true, options: ['arcana', 'history', 'investigation', 'medicine', 'nature', 'religion'] }],
  },
  // Magic Initiate: two cantrips and a level 1 spell from one list, cast once per Long Rest for free.
  'magic-initiate': {
    repeatable: true,
    choices: [
      { id: 'list', label: 'Spell list', kind: 'option', options: ['cleric', 'druid', 'wizard'] },
      { id: 'cantrips', label: 'Cantrips', kind: 'spell', count: 2, spellLevel: 0, classesFromChoice: 'list' },
      { id: 'spell', label: 'Level 1 spell', kind: 'spell', count: 1, spellLevel: 1, classesFromChoice: 'list' },
      { id: 'ability', label: 'Spellcasting ability', kind: 'ability', options: ['int', 'wis', 'cha'] },
    ],
    spells: [
      { fromChoice: 'cantrips', abilityFromChoice: 'ability' },
      { fromChoice: 'spell', abilityFromChoice: 'ability', freeCast: 'magic-initiate' },
    ],
    resources: [{ id: 'magic-initiate', name: 'Magic Initiate (free cast)', max: 1, recharge: longOnly }],
  },
  acolyte: { featPresets: { list: ['cleric'] } },
  sage: { featPresets: { list: ['wizard'] } },
  // Champion
  'champion-improved-critical': { effects: [{ target: 'critRange', op: 'min', value: 19 }] },
  'champion-superior-critical': { upgradeOf: 'champion-improved-critical', effects: [{ target: 'critRange', op: 'min', value: 18 }] },
  'champion-remarkable-athlete': {
    effects: [
      { target: 'advantage:initiative', note: 'Advantage on Initiative rolls' },
      { target: 'advantage:skill:athletics', note: 'Advantage on Strength (Athletics) checks' },
    ],
  },
  'champion-additional-fighting-style': {
    choices: [{ id: 'feat', label: 'Fighting Style feat', kind: 'entity', from: { type: 'feat', tags: ['fighting-style'] } }],
  },
  'champion-survivor': {
    effects: [{ target: 'advantage:save:death', note: 'Advantage on Death Saving Throws; 18–20 counts as 20' }],
  },
  // Feats
  'ability-score-improvement': {
    repeatable: true,
    choices: [{ id: 'asi', label: 'Ability Score Improvement', kind: 'abilityPoints', points: 2, perOption: 2, scoreCap: 20 }],
  },
  grappler: {
    choices: [{ id: 'asi', label: 'Ability Score Increase', kind: 'abilityPoints', points: 1, perOption: 1, scoreCap: 20, options: ['str', 'dex'] }],
  },
  alert: { effects: [{ target: 'initiative', value: 'pb' }] },
  'two-weapon-fighting': { effects: [{ target: 'offhandAbilityMod', value: 1 }] },
  'powerful-build': { effects: [{ target: 'carrySize', value: 1 }] },
  archery: { effects: [{ target: 'attack', value: 2, when: 'rangedWeapon' }] },
  defense: { effects: [{ target: 'ac', value: 1, when: 'wearingArmor' }] },
  skilled: {
    choices: [{ id: 'proficiencies', label: 'Skills or tools', kind: 'skill', count: 3, changeable: 'never' }],
  },
  // Goliath
  'large-form': {
    // Available from character level 5.
    resources: [{ id: 'large-form', name: 'Large Form', max: { byLevel: { 5: 1 }, per: 'characterLevel' }, recharge: longOnly }],
    activities: [{ id: 'use', name: 'Large Form', actionType: 'bonusAction', cost: [{ resource: 'large-form' }], minLevel: 5, fx: 'magic', summary: 'Become Large for 10 minutes: Advantage on Strength checks, Speed +10 ft.' }],
    effects: [{ target: 'speed', value: 10, when: { toggle: 'Large Form active' } }],
  },
  // Potions: drinking any potion is a Bonus Action (SRD 5.2.1 Magic Items → Potions).
  'potion-of-healing': {
    kind: 'potion',
    consumable: true,
    activities: [{ id: 'drink', name: 'Drink', actionType: 'bonusAction', cost: [{ resource: '@quantity' }], roll: { dice: '2d4', bonus: 2, kind: 'heal' } }],
  },
}

/** Giant Ancestry options share one pool: PB uses per Long Rest. */
const giantAncestry: Record<string, { actionType: string; roll?: Raw; summary: string }> = {
  'giant-ancestry-clouds-jaunt': { actionType: 'bonusAction', summary: 'Teleport up to 30 ft to a space you can see.' },
  'giant-ancestry-fires-burn': { actionType: 'other', roll: { dice: '1d10', kind: 'damage' }, summary: 'On hit: +1d10 Fire damage.' },
  'giant-ancestry-frosts-chill': { actionType: 'other', roll: { dice: '1d6', kind: 'damage' }, summary: 'On hit: +1d6 Cold damage, target Speed −10 ft.' },
  'giant-ancestry-hills-tumble': { actionType: 'other', summary: 'On hit vs Large or smaller: target is Prone.' },
  'giant-ancestry-stones-endurance': { actionType: 'reaction', roll: { dice: '1d12', bonus: 'con', kind: 'other' }, summary: 'When you take damage: reduce it by 1d12 + Con.' },
  'giant-ancestry-storms-thunder': { actionType: 'reaction', roll: { dice: '1d8', kind: 'damage' }, summary: 'When a creature within 60 ft damages you: 1d8 Thunder damage to it.' },
}

function epicBoons(byId: Map<string, Raw>) {
  for (const e of byId.values()) {
    if (e.type === 'feat' && e.category === 'epic-boon' && /one ability score of your choice by 1, to a maximum of 30/.test(e.text ?? '')) {
      e.choices = [{ id: 'asi', label: 'Ability Score Increase', kind: 'abilityPoints', points: 1, perOption: 1, scoreCap: 30 }]
    }
  }
}

// --- Apply ----------------------------------------------------------------------------

/** Cross-check hand-written step tables against the class table columns. */
function checkTable(byId: Map<string, Raw>, classId: string, column: string, table: Record<number, number>, problems: string[]) {
  const progression = byId.get(classId)?.progression?.[column]
  if (!progression) return problems.push(`${classId}: no "${column}" column to check against`)
  for (let level = 1; level <= 20; level++) {
    let expected = 0
    for (const [l, v] of Object.entries(table)) if (Number(l) <= level) expected = v
    const actual = progression[level] ?? 0
    if (actual !== expected) problems.push(`${classId} ${column} at level ${level}: overlay ${expected}, table ${actual}`)
  }
}

/**
 * Combat options every character has, always active (tag "core").
 * 2024 (SRD 5.2.1 Rules Glossary, Unarmed Strike): Grapple / Shove force a
 * Str or Dex save (target's choice) vs 8 + Str + PB.
 * 2014 (SRD 5.1 Combat, Grappling / Shoving a Creature): a Strength (Athletics)
 * check contested by the target's Athletics or Acrobatics.
 * In both, each replaces one attack of the Attack action.
 */
function coreCombat(edition: Edition): Raw {
  const save = { saveDc: '8 + str + pb', saveAbility: 'str' }
  const contest = { roll: { bonus: 'athletics', kind: 'other' } }
  const grapple = edition === '2024'
    ? { ...save, summary: 'Target makes a Str or Dex save (its choice) or is Grappled. Needs a free hand; target at most one size larger.' }
    : { ...contest, summary: 'Athletics check vs the target\'s Athletics or Acrobatics; on a win it is Grappled. Needs a free hand.' }
  const shove = edition === '2024'
    ? { ...save, summary: 'Target makes a Str or Dex save (its choice) or is pushed 5 ft away or knocked Prone.' }
    : { ...contest, summary: 'Athletics check vs the target\'s Athletics or Acrobatics; on a win push it 5 ft or knock it Prone.' }
  return {
    id: 'core-combat',
    edition,
    type: 'feature',
    name: edition === '2024' ? 'Unarmed Strike options' : 'Special melee attacks',
    description: 'Grapple and Shove replace one attack of the Attack action.',
    source: { book: edition === '2014' ? 'srd-5.1' : 'srd-5.2' },
    tags: ['core'],
    activities: [
      { id: 'grapple', name: 'Grapple', actionType: 'action', costsAttack: true, fx: 'physical', ...grapple },
      { id: 'shove', name: 'Shove', actionType: 'action', costsAttack: true, fx: 'physical', ...shove },
    ],
  }
}

export function applyOverlay(edition: Edition, byId: Map<string, Raw>): string[] {
  const problems: string[] = []
  byId.set('core-combat', coreCombat(edition))
  for (const o of classOverlays) for (const e of o.entities?.[edition] ?? []) byId.set(e.id, e)
  const patches = { ...(edition === '2014' ? overlay2014 : overlay2024), ...Object.assign({}, ...classOverlays.map((o) => o[edition])) }
  for (const o of classOverlays) for (const [cls, column, table] of o.checks?.[edition] ?? []) checkTable(byId, cls, column, table, problems)
  for (const [id, patch] of Object.entries(patches)) {
    const e = byId.get(id)
    if (!e) {
      problems.push(`overlay: no entity "${id}"`)
      continue
    }
    Object.assign(e, patch)
  }

  if (edition === '2014') {
    asi2014(byId)
    // The Champion's Additional Fighting Style offers the same options as Fighting Style.
    const styles = byId.get('fighter-fighting-style')?.choices?.[0]
    const additional = byId.get('additional-fighting-style')
    if (styles && additional) additional.choices = [{ ...styles }]
    checkTable(byId, 'fighter', 'action_surges', { 2: 1, 17: 2 }, problems)
    checkTable(byId, 'fighter', 'indomitable_uses', { 9: 1, 13: 2, 17: 3 }, problems)
    checkTable(byId, 'fighter', 'extra_attacks', { 5: 1, 11: 2, 20: 3 }, problems)
  } else {
    // Every class's Ability Score Improvement grants a general feat, Epic Boon an epic boon feat.
    for (const e of byId.values()) {
      if (e.type !== 'feature' || e.choices?.length) continue
      if (/-ability-score-improvement$/.test(e.id)) e.choices = [{ id: 'feat', label: 'Feat', kind: 'entity', from: { type: 'feat', tags: ['general'] } }]
      if (/-epic-boon$/.test(e.id)) e.choices = [{ id: 'feat', label: 'Epic Boon', kind: 'entity', from: { type: 'feat', tags: ['epic-boon'] } }]
    }
    epicBoons(byId)
    for (const [id, a] of Object.entries(giantAncestry)) {
      // The trait shares its id with the subspecies in the source data.
      const e = byId.get(`${id}-trait`)
      if (!e) {
        problems.push(`overlay: no entity "${id}"`)
        continue
      }
      e.resources = [{ id: 'giant-ancestry', name: 'Giant Ancestry', max: 'pb', recharge: longOnly }]
      e.activities = [{ id: 'use', name: e.name.replace(/^Giant Ancestry: /, ''), actionType: a.actionType, cost: [{ resource: 'giant-ancestry' }], roll: a.roll, summary: a.summary, fx: 'magic' }]
    }
    checkTable(byId, 'fighter', 'second_wind_uses', { 1: 2, 4: 3, 10: 4 }, problems)
    checkTable(byId, 'fighter', 'weapon_mastery', { 1: 3, 4: 4, 10: 5, 16: 6 }, problems)
  }
  return problems
}
