// Ranger and Hunter. Checked against SRD 5.1 (2014) and SRD 5.2.1 (2024).
import { fightingStyleEffects2014, longOnly, option, type ClassOverlay } from './common.ts'

const enemies = ['aberrations', 'beasts', 'celestials', 'constructs', 'dragons', 'elementals', 'fey', 'fiends', 'giants', 'monstrosities', 'oozes', 'plants', 'undead', 'two kinds of humanoids']
const terrains = ['arctic', 'coast', 'desert', 'forest', 'grassland', 'mountain', 'swamp', 'underdark']
const pick = (label: string, options: string[]) => ({ choices: [{ id: 'option', label, kind: 'option', options }] })
const colossus = (actionSummary: string) => ({
  activities: [{ id: 'use', name: 'Colossus Slayer', actionType: 'other', attack: true, perTurn: 1, roll: { dice: '1d8', kind: 'damage' }, summary: actionSummary }],
})
const hordeBreaker = (summary: string) => ({
  activities: [{ id: 'use', name: 'Horde Breaker', actionType: 'other', attack: true, perTurn: 1, fx: 'physical', summary }],
})

export const ranger: ClassOverlay = {
  entities: {
    '2024': [
      option('2024', 'hunter-colossus-slayer', 'Colossus Slayer', 'hunter', 'hunter-hunters-prey', 'Once per turn, a weapon hit deals an extra 1d8 to a creature missing any of its Hit Points.', colossus('Once per turn, weapon hit vs a creature missing any HP: +1d8.')),
      option('2024', 'hunter-horde-breaker', 'Horde Breaker', 'hunter', 'hunter-hunters-prey', 'Once on each of your turns when you attack with a weapon, you can attack another creature within 5 ft of the original target with the same weapon.', hordeBreaker('Once per turn: another attack with the same weapon against a creature within 5 ft of the target.')),
      option('2024', 'hunter-escape-the-horde', 'Escape the Horde', 'hunter', 'hunter-defensive-tactics', 'Opportunity Attacks have Disadvantage against you.'),
      option('2024', 'hunter-multiattack-defense', 'Multiattack Defense', 'hunter', 'hunter-defensive-tactics', 'When a creature hits you with an attack roll, it has Disadvantage on all other attack rolls against you this turn.'),
    ],
  },

  '2014': {
    'favored-enemy-1-type': { name: 'Favored Enemy', ...pick('Favored enemy', enemies) },
    'favored-enemy-2-types': { name: 'Favored Enemy (2nd)', ...pick('Favored enemy', enemies) },
    'favored-enemy-3-enemies': { name: 'Favored Enemy (3rd)', ...pick('Favored enemy', enemies) },
    'natural-explorer-1-terrain-type': { name: 'Natural Explorer', ...pick('Favored terrain', terrains) },
    'natural-explorer-2-terrain-types': { name: 'Natural Explorer (2nd)', ...pick('Favored terrain', terrains) },
    'natural-explorer-3-terrain-types': { name: 'Natural Explorer (3rd)', ...pick('Favored terrain', terrains) },
    'ranger-fighting-style-archery': fightingStyleEffects2014.archery,
    'ranger-fighting-style-defense': fightingStyleEffects2014.defense,
    'ranger-fighting-style-dueling': fightingStyleEffects2014.dueling,
    'ranger-fighting-style-two-weapon-fighting': fightingStyleEffects2014['two-weapon-fighting'],
    'primeval-awareness': {
      activities: [{ id: 'use', name: 'Primeval Awareness', actionType: 'action', slotCost: true, fx: 'magic', summary: 'Expend a spell slot: for 1 minute per slot level, sense aberrations, celestials, dragons, elementals, fey, fiends and undead within 1 mile (6 in favored terrain).' }],
    },
    'ranger-extra-attack': { effects: [{ target: 'attacksPerAction', op: 'max', value: 2 }] },
    'ranger-archetype-improvement-1': { upgradeOf: 'ranger-archetype' },
    'ranger-archetype-improvement-2': { upgradeOf: 'ranger-archetype' },
    'ranger-archetype-improvement-3': { upgradeOf: 'ranger-archetype' },
    vanish: { activities: [{ id: 'use', name: 'Vanish', actionType: 'bonusAction', summary: 'Take the Hide action. You can’t be tracked by nonmagical means.' }] },
    'foe-slayer': {
      activities: [{ id: 'use', name: 'Foe Slayer', actionType: 'other', attack: true, perTurn: 1, roll: { bonus: 'wis', kind: 'other' }, summary: 'Once per turn against a favored enemy: add Wisdom to the attack or damage roll.' }],
    },
    // Hunter
    'hunters-prey-colossus-slayer': colossus('Once per turn, weapon hit vs a creature below its HP maximum: +1d8.'),
    'hunters-prey-giant-killer': {
      activities: [{ id: 'use', name: 'Giant Killer', actionType: 'reaction', attack: true, fx: 'physical', summary: 'When a Large or larger creature within 5 ft attacks you: attack it.' }],
    },
    'hunters-prey-horde-breaker': hordeBreaker('Once per turn: another attack with the same weapon against a creature within 5 ft of the target.'),
    'multiattack-volley': {
      activities: [{ id: 'use', name: 'Volley', actionType: 'action', attack: true, fx: 'physical', summary: 'Ranged attack against any number of creatures within 10 ft of a point (one ammunition each).' }],
    },
    'multiattack-whirlwind-attack': {
      activities: [{ id: 'use', name: 'Whirlwind Attack', actionType: 'action', attack: true, fx: 'physical', summary: 'Melee attack against any number of creatures within 5 ft.' }],
    },
    'superior-hunters-defense-uncanny-dodge': {
      activities: [{ id: 'use', name: 'Uncanny Dodge', actionType: 'reaction', summary: 'Halve the damage of an attack that hits you.' }],
    },
  },

  '2024': {
    'ranger-favored-enemy': {
      resources: [{ id: 'favored-enemy', name: "Hunter's Mark (free casts)", max: { byLevel: { 1: 2, 5: 3, 9: 4, 13: 5, 17: 6 } }, recharge: longOnly }],
      spells: [{ id: 'hunters-mark', freeCast: 'favored-enemy' }],
    },
    'ranger-weapon-mastery': {
      choices: [{ id: 'weapons', label: 'Weapon Mastery', kind: 'weaponMastery', count: 2, changeable: 'longRest' }],
    },
    'ranger-deft-explorer': {
      choices: [
        { id: 'expertise', label: 'Expertise', kind: 'skill', expertise: true, count: 1 },
        { id: 'languages', label: 'Languages', kind: 'language', count: 2 },
      ],
    },
    'ranger-fighting-style': {
      choices: [{ id: 'feat', label: 'Fighting Style feat', kind: 'entity', from: { type: 'feat', tags: ['fighting-style'] }, changeable: 'levelUp' }],
    },
    'ranger-extra-attack': { effects: [{ target: 'attacksPerAction', op: 'max', value: 2 }] },
    'ranger-roving': { effects: [{ target: 'speed', value: 10, when: 'notHeavyArmor' }] },
    'ranger-expertise': {
      choices: [{ id: 'expertise', label: 'Expertise', kind: 'skill', expertise: true, count: 2 }],
    },
    'ranger-tireless': {
      resources: [{ id: 'tireless', name: 'Tireless', max: 'max(1, wis)', recharge: longOnly }],
      activities: [{ id: 'use', name: 'Tireless', actionType: 'action', cost: [{ resource: 'tireless' }], roll: { dice: '1d8', bonus: 'wis', kind: 'temp' }, fx: 'magic', summary: 'Magic action: Temp HP 1d8 + Wisdom modifier (minimum 1). A Short Rest lowers Exhaustion by 1.' }],
    },
    'ranger-natures-veil': {
      resources: [{ id: 'natures-veil', name: "Nature's Veil", max: 'max(1, wis)', recharge: longOnly }],
      activities: [{ id: 'use', name: "Nature's Veil", actionType: 'bonusAction', cost: [{ resource: 'natures-veil' }], fx: 'magic', summary: 'Invisible until the end of your next turn.' }],
    },
    // Hunter
    'hunter-hunters-prey': {
      choices: [{ id: 'option', label: "Hunter's Prey", kind: 'entity', from: { ids: ['hunter-colossus-slayer', 'hunter-horde-breaker'] }, changeable: 'shortRest' }],
    },
    'hunter-defensive-tactics': {
      choices: [{ id: 'option', label: 'Defensive Tactics', kind: 'entity', from: { ids: ['hunter-escape-the-horde', 'hunter-multiattack-defense'] }, changeable: 'shortRest' }],
    },
    'hunter-superior-hunters-defense': {
      activities: [{ id: 'use', name: "Superior Hunter's Defense", actionType: 'reaction', summary: 'When you take damage: Resistance to it and that damage type until the end of the turn.' }],
    },
  },

  checks: {
    '2014': [
      ['ranger', 'favored_enemies', { 1: 1, 6: 2, 14: 3 }],
      ['ranger', 'favored_terrain', { 1: 1, 6: 2, 10: 3 }],
    ],
    '2024': [['ranger', 'favored_enemies', { 1: 2, 5: 3, 9: 4, 13: 5, 17: 6 }]],
  },
}
