// Cleric and Life Domain. Checked against SRD 5.1 (2014) and SRD 5.2.1 (2024).
import { longOnly, option, shortAndLong, type ClassOverlay } from './common.ts'

const lifeSpells2014 = [
  ['bless', 1], ['cure-wounds', 1], ['lesser-restoration', 3], ['spiritual-weapon', 3], ['beacon-of-hope', 5],
  ['revivify', 5], ['death-ward', 7], ['guardian-of-faith', 7], ['mass-cure-wounds', 9], ['raise-dead', 9],
] as const
const lifeSpells2024 = [
  ['aid', 3], ['bless', 3], ['cure-wounds', 3], ['lesser-restoration', 3], ['mass-healing-word', 5],
  ['revivify', 5], ['aura-of-life', 7], ['death-ward', 7], ['greater-restoration', 9], ['mass-cure-wounds', 9],
] as const
const granted = (list: readonly (readonly [string, number])[]) => list.map(([id, minLevel]) => ({ id, minLevel }))
const divineStrike = (counts: Record<number, number>, summary: string) => ({
  activities: [{ id: 'use', name: 'Divine Strike', actionType: 'other', attack: true, perTurn: 1, roll: { dice: { count: { byLevel: counts }, die: 8 }, kind: 'damage' }, summary }],
})

export const cleric: ClassOverlay = {
  entities: {
    '2024': [
      option('2024', 'cleric-protector', 'Protector', 'cleric', 'cleric-divine-order', 'Proficiency with Martial weapons and training with Heavy armor.', {
        effects: [{ target: 'proficiency:weapon:martial', value: 1 }, { target: 'proficiency:armor:heavy', value: 1 }],
      }),
      option('2024', 'cleric-thaumaturge', 'Thaumaturge', 'cleric', 'cleric-divine-order', 'One extra Cleric cantrip; add your Wisdom modifier (min +1) to Intelligence (Arcana or Religion) checks.', {
        effects: [{ target: 'skill:arcana', value: 'max(1, wis)' }, { target: 'skill:religion', value: 'max(1, wis)' }],
        choices: [{ id: 'cantrip', label: 'Cleric cantrip', kind: 'spell', spellLevel: 0, spellClasses: ['cleric'] }],
        spells: [{ fromChoice: 'cantrip' }],
      }),
      option('2024', 'cleric-divine-strike', 'Divine Strike', 'cleric', 'cleric-blessed-strikes', 'Once per turn, a weapon hit deals an extra 1d8 Necrotic or Radiant (2d8 from level 14).', divineStrike({ 7: 1, 14: 2 }, 'Once per turn, weapon hit: Necrotic or Radiant.')),
      option('2024', 'cleric-potent-spellcasting', 'Potent Spellcasting', 'cleric', 'cleric-blessed-strikes', 'Add your Wisdom modifier to the damage of Cleric cantrips. Level 14: a damaging cantrip also gives Temp HP equal to twice your Wisdom modifier.'),
    ],
  },

  '2014': {
    'channel-divinity-1-rest': {
      name: 'Channel Divinity',
      resources: [{ id: 'channel-divinity', name: 'Channel Divinity', max: { byLevel: { 2: 1, 6: 2, 18: 3 } }, recharge: shortAndLong() }],
    },
    'channel-divinity-2-rest': { upgradeOf: 'channel-divinity-1-rest' },
    'channel-divinity-3-rest': { upgradeOf: 'channel-divinity-1-rest' },
    'channel-divinity-turn-undead': {
      activities: [{ id: 'use', name: 'Turn Undead', actionType: 'action', cost: [{ resource: 'channel-divinity' }], saveDc: '8 + pb + wis', saveAbility: 'wis', fx: 'magic', summary: 'Undead within 30 ft: turned for 1 minute or until damaged. From 5th: low-CR undead are destroyed.' }],
    },
    'destroy-undead-cr-1-2-or-below': { name: 'Destroy Undead' },
    'destroy-undead-cr-1-or-below': { upgradeOf: 'destroy-undead-cr-1-2-or-below' },
    'destroy-undead-cr-2-or-below': { upgradeOf: 'destroy-undead-cr-1-2-or-below' },
    'destroy-undead-cr-3-or-below': { upgradeOf: 'destroy-undead-cr-1-2-or-below' },
    'destroy-undead-cr-4-or-below': { upgradeOf: 'destroy-undead-cr-1-2-or-below' },
    'divine-domain-improvement-1': { upgradeOf: 'divine-domain' },
    'divine-domain-improvement-2': { upgradeOf: 'divine-domain' },
    'divine-domain-improvement-3': { upgradeOf: 'divine-domain' },
    'divine-domain-improvement-4': { upgradeOf: 'divine-domain' },
    'divine-intervention': {
      resources: [{ id: 'divine-intervention', name: 'Divine Intervention', max: 1, recharge: longOnly }],
      activities: [{ id: 'use', name: 'Divine Intervention', actionType: 'action', cost: [{ resource: 'divine-intervention' }], roll: { dice: '1d100', kind: 'other' }, fx: 'magic', summary: 'Roll d100: at or under your Cleric level, your deity intervenes (automatic from 20th). On success, wait 7 days.' }],
    },
    'divine-intervention-improvement': { upgradeOf: 'divine-intervention' },
    // Life Domain
    life: { spells: granted(lifeSpells2014) },
    'bonus-proficiency': { effects: [{ target: 'proficiency:armor:heavy', value: 1 }] },
    'channel-divinity-preserve-life': {
      activities: [{ id: 'use', name: 'Preserve Life', actionType: 'action', cost: [{ resource: 'channel-divinity' }], roll: { bonus: '5 * level', kind: 'other' }, fx: 'magic', summary: 'Divide this many HP among creatures within 30 ft, each up to half its HP maximum. Not undead or constructs.' }],
    },
    'divine-strike': divineStrike({ 8: 1, 14: 2 }, 'Once per turn, weapon hit: radiant.'),
  },

  '2024': {
    'cleric-divine-order': {
      choices: [{ id: 'order', label: 'Divine Order', kind: 'entity', from: { ids: ['cleric-protector', 'cleric-thaumaturge'] } }],
    },
    'cleric-channel-divinity': {
      resources: [{ id: 'channel-divinity', name: 'Channel Divinity', max: { byLevel: { 2: 2, 6: 3, 18: 4 } }, recharge: shortAndLong(1) }],
      activities: [
        {
          id: 'spark', name: 'Divine Spark', actionType: 'action', cost: [{ resource: 'channel-divinity' }], saveDc: '8 + wis + pb', saveAbility: 'con', fx: 'magic',
          roll: { dice: { count: { byLevel: { 2: 1, 7: 2, 13: 3, 18: 4 } }, die: 8 }, bonus: 'wis', kind: 'other' },
          summary: 'Creature within 30 ft: heal that much, or Con save vs Necrotic / Radiant (half on success).',
        },
        { id: 'turn', name: 'Turn Undead', actionType: 'action', cost: [{ resource: 'channel-divinity' }], saveDc: '8 + wis + pb', saveAbility: 'wis', fx: 'magic', summary: 'Undead within 30 ft: Frightened and Incapacitated for 1 minute or until damaged.' },
      ],
    },
    'cleric-sear-undead': {
      activities: [{ id: 'use', name: 'Sear Undead', actionType: 'other', roll: { dice: { count: 'max(1, wis)', die: 8 }, kind: 'damage' }, summary: 'With Turn Undead: each Undead that fails takes this much Radiant.' }],
    },
    'cleric-blessed-strikes': {
      choices: [{ id: 'option', label: 'Blessed Strikes', kind: 'entity', from: { ids: ['cleric-divine-strike', 'cleric-potent-spellcasting'] } }],
    },
    'cleric-divine-intervention': {
      resources: [{ id: 'divine-intervention', name: 'Divine Intervention', max: 1, recharge: longOnly }],
      activities: [{ id: 'use', name: 'Divine Intervention', actionType: 'action', cost: [{ resource: 'divine-intervention' }], fx: 'magic', summary: 'Magic action: cast any Cleric spell of level 5 or lower (no Reaction spells) without a slot or Material components. Level 20: Wish.' }],
    },
    // Life Domain
    'life-domain-spells': { spells: granted(lifeSpells2024) },
    'life-preserve-life': {
      activities: [{ id: 'use', name: 'Preserve Life', actionType: 'action', cost: [{ resource: 'channel-divinity' }], roll: { bonus: '5 * level', kind: 'other' }, fx: 'magic', summary: 'Divide this many HP among Bloodied creatures within 30 ft, each up to half its HP maximum.' }],
    },
  },

  checks: {
    '2014': [['cleric', 'channel_divinity_charges', { 2: 1, 6: 2, 18: 3 }]],
    '2024': [['cleric', 'channel_divinity_charges', { 2: 2, 6: 3, 18: 4 }]],
  },
}
