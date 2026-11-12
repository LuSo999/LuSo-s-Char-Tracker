// Paladin and Oath of Devotion. Checked against SRD 5.1 (2014) and SRD 5.2.1 (2024).
import { fightingStyleEffects2014, longOnly, shortAndLong, type ClassOverlay } from './common.ts'

const devotionSpells = (edition: '2014' | '2024') => [
  { id: 'protection-from-evil-and-good', minLevel: 3 },
  { id: edition === '2014' ? 'sanctuary' : 'shield-of-faith', minLevel: 3 },
  { id: edition === '2014' ? 'lesser-restoration' : 'aid', minLevel: 5 },
  { id: 'zone-of-truth', minLevel: 5 },
  { id: 'beacon-of-hope', minLevel: 9 },
  { id: 'dispel-magic', minLevel: 9 },
  { id: 'freedom-of-movement', minLevel: 13 },
  { id: 'guardian-of-faith', minLevel: 13 },
  { id: 'commune', minLevel: 17 },
  { id: 'flame-strike', minLevel: 17 },
]
const layOnHands = (actionType: 'action' | 'bonusAction', edition: '2014' | '2024') => ({
  resources: [{ id: 'lay-on-hands', name: 'Lay on Hands', max: '5 * level', recharge: longOnly }],
  activities: [
    {
      id: 'use', name: 'Lay on Hands', actionType, cost: [{ resource: 'lay-on-hands' }], spendInput: true, roll: { kind: 'heal' }, fx: 'magic',
      summary: edition === '2024'
        ? 'Touch: restore HP from the pool, or spend 5 points to remove Poisoned.'
        : 'Touch: restore HP from the pool, or spend 5 points to cure a disease or neutralize a poison. No effect on undead and constructs.',
    },
  ],
})

export const paladin: ClassOverlay = {
  entities: {
    // 2014 Divine Smite spends a spell slot like a spell: modelled as a spell-like entry so slot choice and history work.
    '2014': [
      {
        id: 'divine-smite-slot', edition: '2014', type: 'spell', name: 'Divine Smite (slot)', source: { book: 'srd-5.1' },
        description: 'When you hit with a melee weapon attack: expend a spell slot for 2d8 radiant damage, +1d8 per slot level above 1st (max 5d8), +1d8 against undead or fiends. Not a spell.',
        level: 1, school: 'evocation', castingTime: 'When you hit with a melee weapon attack', actionType: 'other', range: 'Self', components: [],
        duration: 'Instantaneous', concentration: false, ritual: false, classes: [],
        damage: { type: 'radiant', by: 'slot', dice: { 1: '2d8', 2: '3d8', 3: '4d8', 4: '5d8' } },
        brief: 'Expend a slot on a melee hit: radiant damage (+1d8 vs undead and fiends). Not a spell.',
      },
    ],
  },

  '2014': {
    'divine-sense': {
      resources: [{ id: 'divine-sense', name: 'Divine Sense', max: '1 + max(0, cha)', recharge: longOnly }],
      activities: [{ id: 'use', name: 'Divine Sense', actionType: 'action', cost: [{ resource: 'divine-sense' }], fx: 'magic', summary: 'Until the end of your next turn: know celestials, fiends and undead within 60 ft not behind total cover.' }],
    },
    'lay-on-hands': layOnHands('action', '2014'),
    'fighting-style-defense': fightingStyleEffects2014.defense,
    'fighting-style-dueling': fightingStyleEffects2014.dueling,
    'fighting-style-protection': fightingStyleEffects2014.protection,
    'divine-smite': { spells: [{ id: 'divine-smite-slot' }] },
    'oath-spells': {},
    devotion: { spells: devotionSpells('2014') },
    'channel-divinity': {
      resources: [{ id: 'channel-divinity', name: 'Channel Divinity', max: 1, recharge: shortAndLong() }],
    },
    'paladin-extra-attack': { effects: [{ target: 'attacksPerAction', op: 'max', value: 2 }] },
    'aura-of-protection': {
      effects: [{ target: 'save:all', value: 'max(1, cha)' }],
    },
    'improved-divine-smite': {
      activities: [{ id: 'use', name: 'Improved Divine Smite', actionType: 'other', attack: true, roll: { dice: '1d8', kind: 'damage' }, summary: 'Every melee weapon hit: +1d8 radiant.' }],
    },
    'cleansing-touch': {
      resources: [{ id: 'cleansing-touch', name: 'Cleansing Touch', max: 'max(1, cha)', recharge: longOnly }],
      activities: [{ id: 'use', name: 'Cleansing Touch', actionType: 'action', cost: [{ resource: 'cleansing-touch' }], fx: 'magic', summary: 'End one spell on yourself or a willing creature you touch.' }],
    },
    'sacred-oath-improvement-1': { upgradeOf: 'sacred-oath' },
    'sacred-oath-improvement-2': { upgradeOf: 'sacred-oath' },
    'sacred-oath-improvement-3': { upgradeOf: 'sacred-oath' },
    // Oath of Devotion
    'channel-divinity-sacred-weapon': {
      activities: [
        { id: 'use', name: 'Sacred Weapon', actionType: 'action', cost: [{ resource: 'channel-divinity' }], toggle: 'Sacred Weapon', fx: 'magic', summary: '1 minute: add Charisma (min +1) to attack rolls with one weapon; it sheds light and counts as magical.' },
      ],
      effects: [{ target: 'attack', value: 'max(1, cha)', when: [{ toggle: 'Sacred Weapon' }, 'weaponAttack'] }],
    },
    'channel-divinity-turn-the-unholy': {
      activities: [
        { id: 'use', name: 'Turn the Unholy', actionType: 'action', cost: [{ resource: 'channel-divinity' }], saveDc: '8 + pb + cha', saveAbility: 'wis', fx: 'magic', summary: 'Fiends and undead within 30 ft: turned for 1 minute or until damaged.' },
      ],
    },
    'holy-nimbus': {
      resources: [{ id: 'holy-nimbus', name: 'Holy Nimbus', max: 1, recharge: longOnly }],
      activities: [{ id: 'use', name: 'Holy Nimbus', actionType: 'action', cost: [{ resource: 'holy-nimbus' }], toggle: 'Holy Nimbus', fx: 'magic', summary: '1 minute: sunlight 30 ft; enemies starting there take 10 radiant; advantage on saves against fiend and undead spells.' }],
    },
  },

  '2024': {
    'paladin-lay-on-hands': layOnHands('bonusAction', '2024'),
    'paladin-weapon-mastery': {
      choices: [{ id: 'weapons', label: 'Weapon Mastery', kind: 'weaponMastery', count: 2, changeable: 'longRest' }],
    },
    'paladin-fighting-style': {
      choices: [{ id: 'feat', label: 'Fighting Style feat', kind: 'entity', from: { type: 'feat', tags: ['fighting-style'] }, changeable: 'levelUp' }],
    },
    'paladin-paladins-smite': {
      resources: [{ id: 'paladins-smite', name: "Paladin's Smite (free cast)", max: 1, recharge: longOnly }],
      spells: [{ id: 'divine-smite', freeCast: 'paladins-smite' }],
    },
    'paladin-channel-divinity': {
      resources: [{ id: 'channel-divinity', name: 'Channel Divinity', max: { byLevel: { 3: 2, 11: 3 } }, recharge: shortAndLong(1) }],
      activities: [
        { id: 'divine-sense', name: 'Divine Sense', actionType: 'bonusAction', cost: [{ resource: 'channel-divinity' }], fx: 'magic', summary: '10 minutes: know Celestials, Fiends and Undead within 60 ft and consecrated places.' },
      ],
    },
    'paladin-extra-attack': { effects: [{ target: 'attacksPerAction', op: 'max', value: 2 }] },
    'paladin-faithful-steed': {
      resources: [{ id: 'faithful-steed', name: 'Faithful Steed (free cast)', max: 1, recharge: longOnly }],
      spells: [{ id: 'find-steed', freeCast: 'faithful-steed' }],
    },
    'paladin-aura-of-protection': {
      effects: [{ target: 'save:all', value: 'max(1, cha)' }],
    },
    'paladin-abjure-foes': {
      activities: [
        { id: 'use', name: 'Abjure Foes', actionType: 'action', cost: [{ resource: 'channel-divinity' }], saveDc: '8 + cha + pb', saveAbility: 'wis', fx: 'magic', summary: 'Magic action: up to Cha-mod creatures within 60 ft are Frightened for 1 minute or until damaged; they can only move, act or Bonus Action.' },
      ],
    },
    'paladin-radiant-strikes': {
      activities: [{ id: 'use', name: 'Radiant Strikes', actionType: 'other', attack: true, roll: { dice: '1d8', kind: 'damage' }, summary: 'Every hit with a Melee weapon or Unarmed Strike: +1d8 Radiant.' }],
    },
    'paladin-restoring-touch': {
      activities: [
        { id: 'use', name: 'Restoring Touch', actionType: 'bonusAction', cost: [{ resource: 'lay-on-hands', amount: 5 }], fx: 'magic', summary: 'With Lay on Hands: remove Blinded, Charmed, Deafened, Frightened, Paralyzed or Stunned (5 points each).' },
      ],
    },
    // Oath of Devotion
    'devotion-oath-of-devotion-spells': { spells: devotionSpells('2024') },
    'devotion-sacred-weapon': {
      activities: [
        { id: 'use', name: 'Sacred Weapon', actionType: 'other', cost: [{ resource: 'channel-divinity' }], toggle: 'Sacred Weapon', fx: 'magic', summary: 'With the Attack action, 10 minutes: + Charisma (min +1) to attacks with one Melee weapon; Radiant damage and light.' },
      ],
      effects: [{ target: 'attack', value: 'max(1, cha)', when: [{ toggle: 'Sacred Weapon' }, 'meleeWeapon'] }],
    },
    'devotion-holy-nimbus': {
      resources: [{ id: 'holy-nimbus', name: 'Holy Nimbus', max: 1, recharge: longOnly }],
      activities: [
        { id: 'use', name: 'Holy Nimbus', actionType: 'bonusAction', cost: [{ resource: 'holy-nimbus' }], toggle: 'Holy Nimbus', fx: 'magic', summary: '10 minutes: Advantage on saves forced by Fiends and Undead; enemies starting in your aura take Radiant (Cha + PB); Bright Light. A level 5 slot restores the use.' },
      ],
    },
  },

  checks: {
    '2014': [['paladin', 'aura_range', { 6: 10, 18: 30 }]],
    '2024': [['paladin', 'channel_divinity_charges', { 3: 2, 11: 3 }]],
  },
}
