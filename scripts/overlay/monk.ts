// Monk and Way / Warrior of the Open Hand. Checked against SRD 5.1 (2014) and SRD 5.2.1 (2024).
import { longOnly, shortAndLong, type ClassOverlay } from './common.ts'

const movement = { byLevel: { 2: 10, 6: 15, 10: 20, 14: 25, 18: 30 } }

export const monk: ClassOverlay = {
  '2014': {
    'monk-unarmored-defense': { effects: [{ target: 'unarmoredAc', op: 'set', value: '10 + dex + wis', when: 'noShield' }] },
    'martial-arts': {
      effects: [
        { target: 'martialArts', value: 1 },
        { target: 'martialArtsDie', op: 'max', value: { byLevel: { 1: 4, 5: 6, 11: 8, 17: 10 } } },
      ],
      activities: [
        { id: 'strike', name: 'Martial Arts: Unarmed Strike', attack: true, actionType: 'bonusAction', fx: 'physical', summary: 'After the Attack action with an unarmed strike or a monk weapon: one unarmed strike.' },
      ],
    },
    ki: {
      resources: [{ id: 'ki', name: 'Ki', max: 'level', recharge: shortAndLong() }],
    },
    'flurry-of-blows': {
      activities: [{ id: 'use', name: 'Flurry of Blows', attack: true, actionType: 'bonusAction', cost: [{ resource: 'ki' }], fx: 'physical', summary: 'After the Attack action: two unarmed strikes.' }],
    },
    'patient-defense': {
      activities: [{ id: 'use', name: 'Patient Defense', actionType: 'bonusAction', cost: [{ resource: 'ki' }], summary: 'Take the Dodge action.' }],
    },
    'step-of-the-wind': {
      activities: [{ id: 'use', name: 'Step of the Wind', actionType: 'bonusAction', cost: [{ resource: 'ki' }], summary: 'Disengage or Dash; jump distance doubled this turn.' }],
    },
    'unarmored-movement-1': { name: 'Unarmored Movement', effects: [{ target: 'speed', value: movement, when: 'noArmorNoShield' }] },
    'unarmored-movement-2': { upgradeOf: 'unarmored-movement-1' },
    'deflect-missiles': {
      activities: [
        {
          id: 'use', name: 'Deflect Missiles', actionType: 'reaction', roll: { dice: '1d10', bonus: 'dex + level', kind: 'other' },
          summary: 'Hit by a ranged weapon attack: reduce the damage. At 0 you can catch it and throw it back (below).',
        },
        { id: 'throw', name: 'Deflect Missiles: throw back', actionType: 'other', attack: true, cost: [{ resource: 'ki' }], roll: { dice: { count: 1, die: { byLevel: { 1: 4, 5: 6, 11: 8, 17: 10 } } }, bonus: 'max(str, dex)', kind: 'damage' }, summary: 'Caught missile: ranged attack (monk weapon, 20/60 ft).' },
      ],
    },
    'slow-fall': {
      activities: [{ id: 'use', name: 'Slow Fall', actionType: 'reaction', roll: { bonus: '5 * level', kind: 'other' }, summary: 'Reduce falling damage by five times your Monk level.' }],
    },
    'monk-extra-attack': { effects: [{ target: 'attacksPerAction', op: 'max', value: 2 }] },
    'stunning-strike': {
      activities: [
        { id: 'use', name: 'Stunning Strike', attack: true, actionType: 'other', cost: [{ resource: 'ki' }], saveDc: '8 + pb + wis', saveAbility: 'con', fx: 'power', summary: 'Melee weapon hit: Con save or stunned until the end of your next turn.' },
      ],
    },
    'stillness-of-mind': {
      activities: [{ id: 'use', name: 'Stillness of Mind', actionType: 'action', summary: 'End one effect that causes you to be charmed or frightened.' }],
    },
    'diamond-soul': {
      effects: [{ target: 'proficiency:save:all', value: 1 }],
      activities: [{ id: 'use', name: 'Diamond Soul', actionType: 'other', cost: [{ resource: 'ki' }], summary: 'Reroll a failed saving throw and use the new roll.' }],
    },
    'perfect-self': {
      activities: [{ id: 'use', name: 'Perfect Self', actionType: 'other', restore: [{ resource: 'ki', amount: 4, upTo: true }], summary: 'Roll initiative with no ki left: regain 4 ki points.' }],
    },
    'empty-body': {
      activities: [
        { id: 'invisible', name: 'Empty Body', actionType: 'action', cost: [{ resource: 'ki', amount: 4 }], fx: 'magic', summary: 'Invisible for 1 minute and resistance to all damage but force.' },
        { id: 'astral', name: 'Empty Body: Astral Projection', actionType: 'action', cost: [{ resource: 'ki', amount: 8 }], fx: 'magic', summary: 'Cast Astral Projection on yourself only, without material components.' },
      ],
    },
    // Way of the Open Hand
    'open-hand-technique': {
      activities: [
        { id: 'use', name: 'Open Hand Technique', attack: true, actionType: 'other', saveDc: '8 + pb + wis', fx: 'physical', summary: 'Flurry of Blows hit: Dex save or prone; or Str save or pushed 15 ft; or no reactions until your next turn.' },
      ],
    },
    'wholeness-of-body': {
      resources: [{ id: 'wholeness-of-body', name: 'Wholeness of Body', max: 1, recharge: longOnly }],
      activities: [{ id: 'use', name: 'Wholeness of Body', actionType: 'action', cost: [{ resource: 'wholeness-of-body' }], roll: { bonus: '3 * level', kind: 'heal' }, fx: 'magic', summary: 'Regain HP equal to three times your Monk level.' }],
    },
    'quivering-palm': {
      activities: [
        { id: 'use', name: 'Quivering Palm', attack: true, actionType: 'other', cost: [{ resource: 'ki', amount: 3 }], saveDc: '8 + pb + wis', saveAbility: 'con', fx: 'power', summary: 'Unarmed hit: set vibrations. Later, an action ends them: Con save or drop to 0 HP; success: 10d10 necrotic.' },
      ],
    },
  },

  '2024': {
    'monk-martial-arts': {
      effects: [
        { target: 'martialArts', value: 1 },
        { target: 'martialArtsDie', op: 'max', value: { byLevel: { 1: 6, 5: 8, 11: 10, 17: 12 } } },
      ],
      activities: [{ id: 'strike', name: 'Bonus Unarmed Strike', attack: true, actionType: 'bonusAction', fx: 'physical', summary: 'Make an Unarmed Strike.' }],
    },
    'monk-unarmored-defense': { effects: [{ target: 'unarmoredAc', op: 'set', value: '10 + dex + wis', when: 'noShield' }] },
    'monk-monks-focus': {
      resources: [{ id: 'focus', name: 'Focus Points', max: 'level', recharge: shortAndLong() }],
      activities: [
        {
          id: 'flurry', name: 'Flurry of Blows', attack: true, actionType: 'bonusAction', cost: [{ resource: 'focus' }], fx: 'physical',
          summary: 'Two Unarmed Strikes (three from Monk level 10).',
        },
        { id: 'patient', name: 'Patient Defense', actionType: 'bonusAction', summary: 'Take the Disengage action (free). With 1 Focus Point: Patient Defense (Focus).' },
        { id: 'patient-focus', name: 'Patient Defense (Focus)', actionType: 'bonusAction', cost: [{ resource: 'focus' }], summary: 'Disengage and Dodge (level 10: also Temp HP equal to two Martial Arts die rolls).' },
        { id: 'step', name: 'Step of the Wind', actionType: 'bonusAction', summary: 'Take the Dash action (free). With 1 Focus Point: Step of the Wind (Focus).' },
        { id: 'step-focus', name: 'Step of the Wind (Focus)', actionType: 'bonusAction', cost: [{ resource: 'focus' }], summary: 'Disengage and Dash; jump distance doubled (level 10: take a willing creature along).' },
      ],
    },
    'monk-unarmored-movement': { effects: [{ target: 'speed', value: movement, when: 'noArmorNoShield' }] },
    'monk-uncanny-metabolism': {
      resources: [{ id: 'uncanny-metabolism', name: 'Uncanny Metabolism', max: 1, recharge: longOnly }],
      activities: [
        {
          id: 'use', name: 'Uncanny Metabolism', actionType: 'other', cost: [{ resource: 'uncanny-metabolism' }],
          roll: { dice: { count: 1, die: { byLevel: { 1: 6, 5: 8, 11: 10, 17: 12 } } }, bonus: 'level', kind: 'heal' },
          restore: [{ resource: 'focus', amount: 'all' }],
          summary: 'When you roll Initiative: regain all Focus Points and heal Martial Arts die + Monk level.',
        },
      ],
    },
    'monk-deflect-attacks': {
      activities: [
        {
          id: 'use', name: 'Deflect Attacks', actionType: 'reaction', roll: { dice: '1d10', bonus: 'dex + level', kind: 'other' },
          summary: 'Hit by an attack dealing Bludgeoning, Piercing or Slashing (any type from level 13): reduce the damage. At 0 you can redirect it (below).',
        },
        {
          id: 'redirect', name: 'Deflect Attacks: redirect', actionType: 'other', attack: true, cost: [{ resource: 'focus' }], saveDc: '8 + dex + pb', saveAbility: 'dex',
          roll: { dice: { count: 2, die: { byLevel: { 1: 6, 5: 8, 11: 10, 17: 12 } } }, bonus: 'dex', kind: 'damage' }, summary: 'Damage reduced to 0: a creature within 5 ft (60 ft if the attack was ranged) makes a Dex save or takes this damage.',
        },
      ],
    },
    'monk-slow-fall': {
      activities: [{ id: 'use', name: 'Slow Fall', actionType: 'reaction', roll: { bonus: '5 * level', kind: 'other' }, summary: 'Reduce falling damage by five times your Monk level.' }],
    },
    'monk-extra-attack': { effects: [{ target: 'attacksPerAction', op: 'max', value: 2 }] },
    'monk-stunning-strike': {
      activities: [
        {
          id: 'use', name: 'Stunning Strike', attack: true, actionType: 'other', cost: [{ resource: 'focus' }], perTurn: 1, saveDc: '8 + wis + pb', saveAbility: 'con', fx: 'power',
          summary: 'Monk weapon or Unarmed Strike hit: Stunned until the start of your next turn; on a success its Speed is halved and the next attack against it has Advantage.',
        },
      ],
    },
    'monk-disciplined-survivor': {
      effects: [{ target: 'proficiency:save:all', value: 1 }],
      activities: [{ id: 'use', name: 'Disciplined Survivor', actionType: 'other', cost: [{ resource: 'focus' }], summary: 'Reroll a failed saving throw (must use the new roll).' }],
    },
    'monk-superior-defense': {
      activities: [
        { id: 'use', name: 'Superior Defense', actionType: 'other', cost: [{ resource: 'focus', amount: 3 }], toggle: 'Superior Defense', fx: 'power', summary: 'At the start of your turn: Resistance to all damage except Force for 1 minute or until Incapacitated.' },
      ],
    },
    'monk-body-and-mind': {
      effects: [
        { target: 'score:dex', value: 4, max: 25 },
        { target: 'score:wis', value: 4, max: 25 },
      ],
    },
    // Warrior of the Open Hand
    'open-hand-technique': {
      activities: [
        { id: 'use', name: 'Open Hand Technique', attack: true, actionType: 'other', saveDc: '8 + wis + pb', fx: 'physical', summary: 'Flurry of Blows hit: Addle (no Opportunity Attacks), Push (Str save or pushed 15 ft) or Topple (Dex save or Prone).' },
      ],
    },
    'open-hand-wholeness-of-body': {
      resources: [{ id: 'wholeness-of-body', name: 'Wholeness of Body', max: 'max(1, wis)', recharge: longOnly }],
      activities: [
        {
          id: 'use', name: 'Wholeness of Body', actionType: 'bonusAction', cost: [{ resource: 'wholeness-of-body' }], fx: 'magic',
          roll: { dice: { count: 1, die: { byLevel: { 1: 6, 5: 8, 11: 10, 17: 12 } } }, bonus: 'max(1, wis)', kind: 'heal' },
          summary: 'Roll your Martial Arts die and heal that + Wisdom modifier (minimum 1).',
        },
      ],
    },
    'open-hand-quivering-palm': {
      activities: [
        { id: 'use', name: 'Quivering Palm', attack: true, actionType: 'other', cost: [{ resource: 'focus', amount: 4 }], saveDc: '8 + wis + pb', saveAbility: 'con', fx: 'power', roll: { dice: '10d12', kind: 'damage' }, summary: 'Unarmed hit: vibrations. Later end them (part of an Attack action): Con save, 10d12 Force, half on success.' },
      ],
    },
  },

  checks: {
    '2014': [
      ['monk', 'ki_points', { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 17: 17, 18: 18, 19: 19, 20: 20 }],
      ['monk', 'unarmored_movement', movement.byLevel],
    ],
    '2024': [
      ['monk', 'martial_arts_die', { 1: 6, 5: 8, 11: 10, 17: 12 }],
      ['monk', 'focus_points', { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 17: 17, 18: 18, 19: 19, 20: 20 }],
      ['monk', 'unarmored_movement_bonus', movement.byLevel],
    ],
  },
}
