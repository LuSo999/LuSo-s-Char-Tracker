// Barbarian and Path of the Berserker. Checked against SRD 5.1 (2014) and SRD 5.2.1 (2024).
import { longOnly, note, shortAndLong, type ClassOverlay } from './common.ts'

const rageDamage = { byLevel: { 1: 2, 9: 3, 16: 4 } }
const raging = { toggle: 'Raging' }

export const barbarian: ClassOverlay = {
  '2014': {
    rage: {
      resources: [{ id: 'rage', name: 'Rage', max: { byLevel: { 1: 2, 3: 3, 6: 4, 12: 5, 17: 6, 20: 99 } }, recharge: longOnly }],
      activities: [
        {
          id: 'rage', name: 'Rage', actionType: 'bonusAction', cost: [{ resource: 'rage' }], toggle: 'Raging', fx: 'power',
          summary: 'Not in heavy armor. 1 minute; ends early if you haven’t attacked or taken damage since your last turn. Unlimited at level 20.',
        },
      ],
      effects: [
        { target: 'damage', value: rageDamage, when: [raging, 'strengthAttack', 'meleeWeapon'] },
        note('Raging: resistance to bludgeoning, piercing and slashing; advantage on Strength checks and saves; no spells or concentration.', 'Raging'),
      ],
    },
    'barbarian-unarmored-defense': { effects: [{ target: 'unarmoredAc', op: 'set', value: '10 + dex + con' }] },
    'reckless-attack': {
      activities: [
        {
          id: 'reckless', name: 'Reckless Attack', actionType: 'other', toggle: 'Reckless', fx: 'physical',
          summary: 'First attack this turn: advantage on Strength melee weapon attacks this turn; attacks against you have advantage until your next turn.',
        },
      ],
      effects: [note('Reckless: attack rolls against you have advantage until your next turn.', 'Reckless')],
    },
    'fast-movement': { effects: [{ target: 'speed', value: 10, when: 'notHeavyArmor' }] },
    'barbarian-extra-attack': { effects: [{ target: 'attacksPerAction', op: 'max', value: 2 }] },
    'primal-path-improvement-1': { upgradeOf: 'primal-path' },
    'primal-path-improvement-2': { upgradeOf: 'primal-path' },
    'primal-path-improvement-3': { upgradeOf: 'primal-path' },
    'brutal-critical-1-die': { name: 'Brutal Critical' },
    'brutal-critical-2-dice': { upgradeOf: 'brutal-critical-1-die' },
    'brutal-critical-3-dice': { upgradeOf: 'brutal-critical-1-die' },
    'relentless-rage': {
      activities: [{ id: 'use', name: 'Relentless Rage', actionType: 'other', saveDc: 10, saveAbility: 'con', summary: 'At 0 HP while raging: DC 10 Con save to drop to 1 HP instead; +5 DC each use until a short or long rest.' }],
    },
    'primal-champion': {
      effects: [
        { target: 'score:str', value: 4, max: 24 },
        { target: 'score:con', value: 4, max: 24 },
      ],
    },
    // Path of the Berserker
    frenzy: {
      activities: [
        {
          id: 'frenzy', name: 'Frenzy', actionType: 'other', toggle: 'Frenzied', fx: 'power',
          summary: 'When you rage: frenzy. While raging, one melee weapon attack as a Bonus Action each turn; one level of exhaustion when the rage ends.',
        },
      ],
      effects: [note('Frenzied: one melee weapon attack as a Bonus Action each turn; exhaustion when the rage ends.', 'Frenzied')],
    },
    'mindless-rage': { effects: [note('Raging: can’t be charmed or frightened (suspended if it happens before).', 'Raging')] },
    'intimidating-presence': {
      activities: [
        { id: 'use', name: 'Intimidating Presence', actionType: 'action', saveDc: '8 + pb + cha', saveAbility: 'wis', summary: 'One creature within 30 ft that can see or hear you is frightened; repeat with your action to extend.' },
      ],
    },
    retaliation: {
      activities: [{ id: 'use', name: 'Retaliation', attack: true, actionType: 'reaction', fx: 'physical', summary: 'When a creature within 5 ft damages you: one melee weapon attack against it.' }],
    },
  },

  '2024': {
    'barbarian-rage': {
      resources: [{ id: 'rage', name: 'Rage', max: { byLevel: { 1: 2, 3: 3, 6: 4, 12: 5, 17: 6 } }, recharge: shortAndLong(1) }],
      activities: [
        {
          id: 'rage', name: 'Rage', actionType: 'bonusAction', cost: [{ resource: 'rage' }], toggle: 'Raging', fx: 'power',
          summary: 'Not in Heavy armor. Lasts to the end of your next turn; extend it by attacking, forcing a save or a Bonus Action. Up to 10 minutes.',
        },
      ],
      effects: [
        { target: 'damage', value: rageDamage, when: [raging, 'strengthAttack'] },
        note('Raging: Resistance to Bludgeoning, Piercing, Slashing; Advantage on Strength checks and saves; no spells or Concentration.', 'Raging'),
      ],
    },
    'barbarian-unarmored-defense': { effects: [{ target: 'unarmoredAc', op: 'set', value: '10 + dex + con' }] },
    'barbarian-weapon-mastery': {
      choices: [{ id: 'weapons', label: 'Weapon Mastery', kind: 'weaponMastery', count: { byLevel: { 1: 2, 4: 3, 10: 4 } }, changeable: 'longRest' }],
    },
    'barbarian-reckless-attack': {
      activities: [
        {
          id: 'reckless', name: 'Reckless Attack', actionType: 'other', toggle: 'Reckless', fx: 'physical',
          summary: 'On your first attack roll this turn: Advantage on Strength attacks until your next turn; attacks against you have Advantage too.',
        },
      ],
      effects: [note('Reckless: attack rolls against you have Advantage until your next turn.', 'Reckless')],
    },
    'barbarian-primal-knowledge': {
      choices: [{ id: 'skill', label: 'Skill', kind: 'skill', options: ['animal-handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'] }],
      effects: [note('Raging: Acrobatics, Intimidation, Perception, Stealth and Survival checks can use Strength.', 'Raging')],
    },
    'barbarian-fast-movement': { effects: [{ target: 'speed', value: 10, when: 'notHeavyArmor' }] },
    'barbarian-brutal-strike': {
      activities: [
        {
          id: 'use', name: 'Brutal Strike', attack: true, actionType: 'other', perTurn: 1, fx: 'physical',
          roll: { dice: { count: { byLevel: { 9: 1, 17: 2 } }, die: 10 }, kind: 'damage' },
          summary: 'Reckless: forgo Advantage on one Strength attack; on a hit +damage and Forceful Blow (push 15 ft) or Hamstring Blow (Speed −15 ft). Level 13: Staggering / Sundering Blow. Level 17: two effects.',
        },
      ],
    },
    'barbarian-improved-brutal-strike-1': { upgradeOf: 'barbarian-brutal-strike' },
    'barbarian-improved-brutal-strike-2': { upgradeOf: 'barbarian-brutal-strike' },
    'barbarian-relentless-rage': {
      activities: [{ id: 'use', name: 'Relentless Rage', actionType: 'other', saveDc: 10, saveAbility: 'con', summary: 'At 0 HP while raging: DC 10 Con save to have HP = twice your Barbarian level; +5 DC each use until a Short or Long Rest.' }],
    },
    'barbarian-persistent-rage': {
      resources: [{ id: 'persistent-rage', name: 'Persistent Rage', max: 1, recharge: longOnly }],
      activities: [{ id: 'use', name: 'Persistent Rage', actionType: 'other', cost: [{ resource: 'persistent-rage' }], summary: 'When you roll Initiative: regain all uses of Rage (restore them on the dots). Rage lasts 10 minutes.' }],
    },
    'barbarian-primal-champion': {
      effects: [
        { target: 'score:str', value: 4, max: 25 },
        { target: 'score:con', value: 4, max: 25 },
      ],
    },
    // Path of the Berserker
    'berserker-frenzy': {
      activities: [
        {
          id: 'use', name: 'Frenzy', actionType: 'other', perTurn: 1, attack: true, fx: 'power',
          roll: { dice: { count: { byLevel: { 3: 2, 9: 3, 16: 4 } }, die: 6 }, kind: 'damage' },
          summary: 'Raging and Reckless: extra damage to the first target you hit with a Strength attack this turn.',
        },
      ],
    },
    'berserker-mindless-rage': { effects: [note('Raging: Immunity to Charmed and Frightened (ends them when you rage).', 'Raging')] },
    'berserker-retaliation': {
      activities: [{ id: 'use', name: 'Retaliation', attack: true, actionType: 'reaction', fx: 'physical', summary: 'When a creature within 5 ft damages you: one melee attack against it.' }],
    },
    'berserker-intimidating-presence': {
      resources: [{ id: 'intimidating-presence', name: 'Intimidating Presence', max: 1, recharge: longOnly }],
      activities: [
        {
          id: 'use', name: 'Intimidating Presence', actionType: 'bonusAction', cost: [{ resource: 'intimidating-presence' }], saveDc: '8 + str + pb', saveAbility: 'wis', fx: 'power',
          summary: 'Chosen creatures in a 30-ft Emanation: Frightened for 1 minute, repeat the save each turn. Spend a Rage to use it again.',
        },
      ],
    },
  },

  checks: {
    '2014': [
      ['barbarian', 'rage_count', { 1: 2, 3: 3, 6: 4, 12: 5, 17: 6, 20: 9999 }],
      ['barbarian', 'rage_damage_bonus', { 1: 2, 9: 3, 16: 4 }],
      ['barbarian', 'brutal_critical_dice', { 9: 1, 13: 2, 17: 3 }],
    ],
    '2024': [
      ['barbarian', 'rage_count', { 1: 2, 3: 3, 6: 4, 12: 5, 17: 6 }],
      ['barbarian', 'rage_damage_bonus', { 1: 2, 9: 3, 16: 4 }],
      ['barbarian', 'weapon_mastery', { 1: 2, 4: 3, 10: 4 }],
    ],
  },
}
