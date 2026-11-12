// Bard and College of Lore. Checked against SRD 5.1 (2014) and SRD 5.2.1 (2024).
import type { ClassOverlay } from './common.ts'

const inspirationDie = { byLevel: { 1: 6, 5: 8, 10: 10, 15: 12 } }
// Font of Inspiration (level 5): uses come back on a Short Rest too.
const inspiration = (actionSummary: string) => ({
  name: 'Bardic Inspiration',
  resources: [{ id: 'bardic-inspiration', name: 'Bardic Inspiration', max: 'max(1, cha)', recharge: [{ on: 'longRest', amount: 'all' }, { on: 'shortRest', amount: { byLevel: { 1: 0, 5: 99 } } }] }],
  activities: [
    { id: 'use', name: 'Bardic Inspiration', actionType: 'bonusAction', cost: [{ resource: 'bardic-inspiration' }], roll: { dice: { count: 1, die: inspirationDie }, kind: 'other' }, fx: 'magic', summary: actionSummary },
  ],
})
const jack = { effects: ['str', 'dex', 'con', 'int', 'wis', 'cha'].map((a) => ({ target: `check:${a}`, value: 'floor(pb / 2)', when: 'notProficient' })) }
const cuttingWords = (summary: string) => ({
  activities: [{ id: 'use', name: 'Cutting Words', actionType: 'reaction', cost: [{ resource: 'bardic-inspiration' }], roll: { dice: { count: 1, die: inspirationDie }, kind: 'other' }, fx: 'magic', summary }],
})
const peerless = (summary: string) => ({
  activities: [{ id: 'use', name: 'Peerless Skill', actionType: 'other', cost: [{ resource: 'bardic-inspiration' }], roll: { dice: { count: 1, die: inspirationDie }, kind: 'other' }, summary }],
})

export const bard: ClassOverlay = {
  '2014': {
    'bardic-inspiration-d6': inspiration('A creature within 60 ft gets a die to add to one ability check, attack roll or save within 10 minutes.'),
    'bardic-inspiration-d8': { upgradeOf: 'bardic-inspiration-d6' },
    'bardic-inspiration-d10': { upgradeOf: 'bardic-inspiration-d6' },
    'bardic-inspiration-d12': { upgradeOf: 'bardic-inspiration-d6' },
    'jack-of-all-trades': jack,
    'song-of-rest-d6': {
      name: 'Song of Rest',
      activities: [{ id: 'use', name: 'Song of Rest', actionType: 'other', roll: { dice: { count: 1, die: { byLevel: { 2: 6, 9: 8, 13: 10, 17: 12 } } }, kind: 'other' }, summary: 'Short Rest: allies who spend Hit Dice regain this many extra HP.' }],
    },
    'song-of-rest-d8': { upgradeOf: 'song-of-rest-d6' },
    'song-of-rest-d10': { upgradeOf: 'song-of-rest-d6' },
    'song-of-rest-d12': { upgradeOf: 'song-of-rest-d6' },
    'bard-expertise-1': { name: 'Expertise', choices: [{ id: 'skills', label: 'Expertise', kind: 'skill', expertise: true, count: 2 }] },
    'bard-expertise-2': { name: 'Expertise (10th level)', choices: [{ id: 'skills', label: 'Expertise', kind: 'skill', expertise: true, count: 2 }] },
    'bard-college-improvement-1': { upgradeOf: 'bard-college' },
    'bard-college-improvement-2': { upgradeOf: 'bard-college' },
    countercharm: {
      activities: [{ id: 'use', name: 'Countercharm', actionType: 'action', toggle: 'Countercharm', fx: 'magic', summary: 'Until the end of your next turn: you and friends within 30 ft have advantage on saves against being frightened or charmed.' }],
    },
    'magical-secrets-1': { name: 'Magical Secrets', choices: [{ id: 'spells', label: 'Magical Secrets', kind: 'spell', count: 2 }], spells: [{ fromChoice: 'spells' }] },
    'magical-secrets-2': { name: 'Magical Secrets (14th)', choices: [{ id: 'spells', label: 'Magical Secrets', kind: 'spell', count: 2 }], spells: [{ fromChoice: 'spells' }] },
    'magical-secrets-3': { name: 'Magical Secrets (18th)', choices: [{ id: 'spells', label: 'Magical Secrets', kind: 'spell', count: 2 }], spells: [{ fromChoice: 'spells' }] },
    'superior-inspiration': { activities: [{ id: 'use', name: 'Superior Inspiration', actionType: 'other', restore: [{ resource: 'bardic-inspiration', amount: 1, upTo: true }], summary: 'Roll initiative with no Bardic Inspiration left: regain one.' }] },
    // College of Lore
    'bonus-proficiencies': { choices: [{ id: 'skills', label: 'Skills', kind: 'skill', count: 3 }] },
    'cutting-words': cuttingWords('When a creature within 60 ft makes an attack roll, ability check or damage roll: subtract the die.'),
    'additional-magical-secrets': { choices: [{ id: 'spells', label: 'Additional Magical Secrets', kind: 'spell', count: 2 }], spells: [{ fromChoice: 'spells' }] },
    'peerless-skill': peerless('Add your Bardic Inspiration die to one of your ability checks.'),
  },

  '2024': {
    'bard-bardic-inspiration': inspiration('A creature within 60 ft gets a die; within 1 hour it adds it to a failed D20 Test.'),
    'bard-expertise': { choices: [{ id: 'skills', label: 'Expertise', kind: 'skill', expertise: true, count: { byLevel: { 2: 2, 9: 4 } } }] },
    'bard-jack-of-all-trades': jack,
    'bard-countercharm': {
      activities: [{ id: 'use', name: 'Countercharm', actionType: 'reaction', fx: 'magic', summary: 'You or a creature within 30 ft fails a save against Charmed or Frightened: reroll with Advantage.' }],
    },
    'bard-superior-inspiration': { activities: [{ id: 'use', name: 'Superior Inspiration', actionType: 'other', restore: [{ resource: 'bardic-inspiration', amount: 2, upTo: true }], summary: 'When you roll Initiative: regain Bardic Inspiration until you have two.' }] },
    'bard-font-of-inspiration': {
      activities: [{ id: 'use', name: 'Font of Inspiration: spend a slot', actionType: 'other', slotCost: true, restore: [{ resource: 'bardic-inspiration', amount: 1 }], fx: 'magic', summary: 'Expend a spell slot to regain one Bardic Inspiration (no action).' }],
    },
    'bard-words-of-creation': { spells: [{ id: 'power-word-heal' }, { id: 'power-word-kill' }] },
    // College of Lore
    'lore-bonus-proficiencies': { choices: [{ id: 'skills', label: 'Skills', kind: 'skill', count: 3 }] },
    'lore-cutting-words': cuttingWords('When a creature within 60 ft makes a damage roll or succeeds on an ability check or attack roll: subtract the die.'),
    'lore-magical-discoveries': {
      choices: [{ id: 'spells', label: 'Magical Discoveries', kind: 'spell', count: 2, spellClasses: ['cleric', 'druid', 'wizard'] }],
      spells: [{ fromChoice: 'spells' }],
    },
    'lore-peerless-skill': peerless('Failed ability check or attack roll: add the die. On a failure the use isn’t spent.'),
  },

  checks: {
    '2014': [['bard', 'bardic_inspiration_die', inspirationDie.byLevel], ['bard', 'song_of_rest_die', { 2: 6, 9: 8, 13: 10, 17: 12 }]],
    '2024': [['bard', 'bardic_inspiration_die', inspirationDie.byLevel]],
  },
}
