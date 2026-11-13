// Warlock and the Fiend. Checked against SRD 5.1 (2014) and SRD 5.2.1 (2024).
import { chainFamiliar2014, chainFamiliar2024 } from './companions.ts'
import { longOnly, option, shortAndLong, type ClassOverlay, type Patch } from './common.ts'

const atWill = (...ids: string[]) => ({ spells: ids.map((id) => ({ id, atWill: true })) })
/** 2014: cast once with a Warlock spell slot, then not again until a long rest. */
const withSlot = (id: string, invocation: string) => ({
  resources: [{ id: `invocation-${invocation}`, name: `${invocation.replace(/-/g, ' ')} (once per long rest)`, max: 1, recharge: [{ on: 'longRest', amount: 'all' }] }],
  spells: [{ id, limit: `invocation-${invocation}` }],
})
/** Pact slot level by Warlock level: 1st at 1, 2nd at 3 … 5th from 9. */
const pactLevel = 'min(5, ceil(level / 2))'

const invocations2014: Record<string, Patch> = {
  'eldritch-invocation-agonizing-blast': { effects: [{ target: 'spellDamage:eldritch-blast', value: 'cha' }] },
  'eldritch-invocation-armor-of-shadows': atWill('mage-armor'),
  'eldritch-invocation-beast-speech': atWill('speak-with-animals'),
  'eldritch-invocation-beguiling-influence': { effects: [{ target: 'proficiency:skill:deception', value: 1 }, { target: 'proficiency:skill:persuasion', value: 1 }] },
  'eldritch-invocation-book-of-ancient-secrets': {},
  'eldritch-invocation-devils-sight': {},
  'eldritch-invocation-eldritch-sight': atWill('detect-magic'),
  'eldritch-invocation-eldritch-spear': { effects: [{ target: 'spellNote:eldritch-blast', note: 'Eldritch Spear: range 300 ft' }] },
  'eldritch-invocation-eyes-of-the-rune-keeper': {},
  'eldritch-invocation-fiendish-vigor': atWill('false-life'),
  'eldritch-invocation-gaze-of-two-minds': { activities: [{ id: 'use', name: 'Gaze of Two Minds', actionType: 'action', summary: 'Touch a willing humanoid: perceive through its senses until the end of your next turn (action to extend).' }] },
  'eldritch-invocation-mask-of-many-faces': atWill('disguise-self'),
  'eldritch-invocation-misty-visions': atWill('silent-image'),
  'eldritch-invocation-repelling-blast': { effects: [{ target: 'spellNote:eldritch-blast', note: 'Repelling Blast: on a hit push the creature up to 10 ft away' }] },
  'eldritch-invocation-thief-of-five-fates': withSlot('bane', 'thief-of-five-fates'),
  'eldritch-invocation-voice-of-the-chain-master': {},
  'eldritch-invocation-mire-the-mind': withSlot('slow', 'mire-the-mind'),
  'eldritch-invocation-one-with-shadows': { activities: [{ id: 'use', name: 'One with Shadows', actionType: 'action', summary: 'In dim light or darkness: invisible until you move or take an action or reaction.' }] },
  'eldritch-invocation-sign-of-ill-omen': withSlot('bestow-curse', 'sign-of-ill-omen'),
  'eldritch-invocation-thirsting-blade': { effects: [{ target: 'attacksPerAction', op: 'max', value: 2 }] },
  'eldritch-invocation-bewitching-whispers': withSlot('compulsion', 'bewitching-whispers'),
  'eldritch-invocation-dreadful-word': withSlot('confusion', 'dreadful-word'),
  'eldritch-invocation-sculptor-of-flesh': withSlot('polymorph', 'sculptor-of-flesh'),
  'eldritch-invocation-ascendant-step': atWill('levitate'),
  'eldritch-invocation-minions-of-chaos': withSlot('conjure-elemental', 'minions-of-chaos'),
  'eldritch-invocation-otherworldly-leap': atWill('jump'),
  'eldritch-invocation-whispers-of-the-grave': atWill('speak-with-dead'),
  'eldritch-invocation-lifedrinker': {
    activities: [{ id: 'use', name: 'Lifedrinker', actionType: 'other', attack: true, roll: { bonus: 'max(1, cha)', kind: 'damage' }, summary: 'Pact weapon hit: + Charisma necrotic damage.' }],
  },
  'eldritch-invocation-chains-of-carceri': atWill('hold-monster'),
  'eldritch-invocation-master-of-myriad-forms': atWill('alter-self'),
  'eldritch-invocation-visions-of-distant-realms': atWill('arcane-eye'),
  'eldritch-invocation-witch-sight': {},
}

type Inv = [id: string, name: string, text: string, patch?: Patch]
/** The cantrip a repeatable invocation applies to: one you know that meets its prerequisite (filled in by the overlay). */
const cantripChoice = { id: 'cantrip', label: 'Cantrip', kind: 'spell', spellLevel: 0, knownOnly: true, fromPrerequisite: true }
const invocations2024: Inv[] = [
  ['agonizing-blast', 'Agonizing Blast', 'Prerequisite: Warlock 2, a damaging Warlock cantrip. Add your Charisma modifier to that cantrip’s damage rolls. Repeatable.', {
    repeatable: true,
    choices: [cantripChoice],
    effects: [{ target: 'spellDamage:@cantrip', value: 'cha' }],
  }],
  ['armor-of-shadows', 'Armor of Shadows', 'Cast Mage Armor on yourself without a spell slot.', atWill('mage-armor')],
  ['ascendant-step', 'Ascendant Step', 'Prerequisite: Warlock 5. Cast Levitate on yourself without a spell slot.', atWill('levitate')],
  ['devils-sight', "Devil's Sight", 'Prerequisite: Warlock 2. See normally in Dim Light and Darkness, magical or not, within 120 ft.'],
  ['devouring-blade', 'Devouring Blade', 'Prerequisite: Warlock 12, Thirsting Blade. Thirsting Blade gives two extra attacks.', { effects: [{ target: 'attacksPerAction', op: 'max', value: 3 }] }],
  ['eldritch-mind', 'Eldritch Mind', 'Advantage on Constitution saves to maintain Concentration.'],
  ['eldritch-smite', 'Eldritch Smite', 'Prerequisite: Warlock 5, Pact of the Blade. Once per turn on a pact weapon hit: spend a Pact slot for 1d8 Force + 1d8 per slot level; Huge or smaller target falls Prone.', {
    activities: [{ id: 'use', name: 'Eldritch Smite', actionType: 'other', attack: true, perTurn: 1, cost: [{ resource: 'pact' }], roll: { dice: { count: `${pactLevel} + 1`, die: 8 }, kind: 'damage' }, fx: 'magic', summary: 'Pact weapon hit: spend a Pact slot for Force damage; Huge or smaller target falls Prone.' }],
  }],
  ['eldritch-spear', 'Eldritch Spear', 'Prerequisite: Warlock 2, a damaging Warlock cantrip with 10+ ft range. Its range increases by 30 ft × Warlock level. Repeatable.', {
    repeatable: true,
    choices: [cantripChoice],
    effects: [{ target: 'spellNote:@cantrip', value: '30 * level', note: 'Eldritch Spear: range +{value} ft' }],
  }],
  ['fiendish-vigor', 'Fiendish Vigor', 'Prerequisite: Warlock 2. Cast False Life on yourself without a spell slot; you get the maximum Temp HP.', atWill('false-life')],
  ['gaze-of-two-minds', 'Gaze of Two Minds', 'Prerequisite: Warlock 5. Bonus Action: perceive through a willing creature’s senses until the end of your next turn; cast spells from its space within 60 ft.', {
    activities: [{ id: 'use', name: 'Gaze of Two Minds', actionType: 'bonusAction', fx: 'magic', summary: 'Touch a willing creature: perceive through its senses until the end of your next turn (Bonus Action to extend).' }],
  }],
  ['gift-of-the-depths', 'Gift of the Depths', 'Prerequisite: Warlock 5. Breathe underwater, Swim Speed equal to your Speed; cast Water Breathing once per Long Rest without a slot.', {
    resources: [{ id: 'gift-of-the-depths', name: 'Gift of the Depths (free cast)', max: 1, recharge: longOnly }],
    spells: [{ id: 'water-breathing', freeCast: 'gift-of-the-depths' }],
  }],
  ['gift-of-the-protectors', 'Gift of the Protectors', 'Prerequisite: Warlock 9, Pact of the Tome. Creatures named in your Book of Shadows drop to 1 HP instead of 0, once per Long Rest.'],
  ['investment-of-the-chain-master', 'Investment of the Chain Master', 'Prerequisite: Warlock 5, Pact of the Chain. Your familiar gets a Fly or Swim Speed of 40 ft, attacks on your Bonus Action, can deal Necrotic or Radiant, uses your save DC; Reaction to give it Resistance.'],
  ['lessons-of-the-first-ones', 'Lessons of the First Ones', 'Prerequisite: Warlock 2. Gain one Origin feat. Repeatable.', {
    repeatable: true,
    choices: [{ id: 'feat', label: 'Origin feat', kind: 'entity', from: { type: 'feat', tags: ['origin'] } }],
  }],
  ['lifedrinker', 'Lifedrinker', 'Prerequisite: Warlock 9, Pact of the Blade. Once per turn on a pact weapon hit: +1d6 Necrotic, Psychic or Radiant, and you can spend a Hit Point Die to heal.', {
    activities: [{ id: 'use', name: 'Lifedrinker', actionType: 'other', attack: true, perTurn: 1, roll: { dice: '1d6', kind: 'damage' }, summary: 'Pact weapon hit: Necrotic, Psychic or Radiant; may spend a Hit Point Die to heal (roll + Con).' }],
  }],
  ['mask-of-many-faces', 'Mask of Many Faces', 'Prerequisite: Warlock 2. Cast Disguise Self without a spell slot.', atWill('disguise-self')],
  ['master-of-myriad-forms', 'Master of Myriad Forms', 'Prerequisite: Warlock 5. Cast Alter Self without a spell slot.', atWill('alter-self')],
  ['misty-visions', 'Misty Visions', 'Prerequisite: Warlock 2. Cast Silent Image without a spell slot.', atWill('silent-image')],
  ['one-with-shadows', 'One with Shadows', 'Prerequisite: Warlock 5. In Dim Light or Darkness, cast Invisibility on yourself without a spell slot.', atWill('invisibility')],
  ['otherworldly-leap', 'Otherworldly Leap', 'Prerequisite: Warlock 2. Cast Jump on yourself without a spell slot.', atWill('jump')],
  ['pact-of-the-blade', 'Pact of the Blade', 'Bonus Action: conjure or bond a melee pact weapon. You’re proficient with it, can use Charisma for its attack and damage rolls and deal Necrotic, Psychic or Radiant damage.', {
    activities: [{ id: 'use', name: 'Pact of the Blade', actionType: 'bonusAction', fx: 'magic', summary: 'Conjure or bond your pact weapon (Charisma for its attacks; Necrotic, Psychic or Radiant damage).' }],
  }],
  ['pact-of-the-chain', 'Pact of the Chain', 'Learn Find Familiar and cast it as a Magic action without a spell slot; special forms (Imp, Pseudodragon, Quasit…). Forgo one attack so the familiar attacks with its Reaction.', { ...atWill('find-familiar'), companions: [chainFamiliar2024] }],
  ['pact-of-the-tome', 'Pact of the Tome', 'Book of Shadows: three cantrips and two level 1 Ritual spells from any class, prepared while you carry it; it’s your Spellcasting Focus.', {
    choices: [
      { id: 'cantrips', label: 'Book of Shadows cantrips', kind: 'spell', spellLevel: 0, count: 3 },
      { id: 'rituals', label: 'Book of Shadows rituals', kind: 'spell', spellLevel: 1, count: 2 },
    ],
    spells: [{ fromChoice: 'cantrips' }, { fromChoice: 'rituals' }],
  }],
  ['repelling-blast', 'Repelling Blast', 'Prerequisite: Warlock 2, a Warlock attack-roll cantrip. On a hit push a Large or smaller creature 10 ft. Repeatable.', {
    repeatable: true,
    choices: [cantripChoice],
    effects: [{ target: 'spellNote:@cantrip', note: 'Repelling Blast: on a hit push a Large or smaller creature 10 ft' }],
  }],
  ['thirsting-blade', 'Thirsting Blade', 'Prerequisite: Warlock 5, Pact of the Blade. Extra Attack with your pact weapon.', { effects: [{ target: 'attacksPerAction', op: 'max', value: 2 }] }],
  ['visions-of-distant-realms', 'Visions of Distant Realms', 'Prerequisite: Warlock 9. Cast Arcane Eye without a spell slot.', atWill('arcane-eye')],
  ['whispers-of-the-grave', 'Whispers of the Grave', 'Prerequisite: Warlock 7. Cast Speak with Dead without a spell slot.', atWill('speak-with-dead')],
  ['witch-sight', 'Witch Sight', 'Prerequisite: Warlock 15. Truesight 30 ft.'],
]
const fiendSpells2024: [string, number][] = [
  ['burning-hands', 3], ['command', 3], ['scorching-ray', 3], ['suggestion', 3], ['fireball', 5], ['stinking-cloud', 5],
  ['fire-shield', 7], ['wall-of-fire', 7], ['geas', 9], ['insect-plague', 9],
]
const damageTypes = ['acid', 'bludgeoning', 'cold', 'fire', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder']
/** Mystic Arcanum: one spell of each level 6–9, cast once per Long Rest without a slot (pact slots never reach them). */
const arcanum = (spellLevel: number, minLevel: number) => ({
  resources: [{ id: `mystic-arcanum-${spellLevel}`, name: `Mystic Arcanum (level ${spellLevel})`, max: 1, recharge: longOnly }],
  choices: [{ id: `arcanum-${spellLevel}`, label: `Mystic Arcanum (level ${spellLevel})`, kind: 'spell', spellLevel, spellClasses: ['warlock'], changeable: 'levelUp' }],
  spells: [{ fromChoice: `arcanum-${spellLevel}`, freeCast: `mystic-arcanum-${spellLevel}`, minLevel }],
})

export const warlock: ClassOverlay = {
  entities: {
    '2024': invocations2024.map(([id, name, text, patch]) => option('2024', `invocation-${id}`, name, 'warlock', 'warlock-eldritch-invocations', text, patch)),
  },

  '2014': {
    'eldritch-invocations': {
      choices: [{ id: 'invocations', label: 'Eldritch Invocations', kind: 'entity', count: { byLevel: { 2: 2, 5: 3, 7: 4, 9: 5, 12: 6, 15: 7, 18: 8 } }, from: { ids: Object.keys(invocations2014) }, changeable: 'levelUp' }],
    },
    ...invocations2014,
    'pact-of-the-chain': { spells: [{ id: 'find-familiar' }], companions: [chainFamiliar2014] },
    'pact-of-the-blade': { activities: [{ id: 'use', name: 'Pact of the Blade', actionType: 'action', fx: 'magic', summary: 'Create your pact weapon in your empty hand (you are proficient with it; it counts as magical).' }] },
    'pact-of-the-tome': {
      choices: [{ id: 'cantrips', label: 'Book of Shadows cantrips', kind: 'spell', spellLevel: 0, count: 3 }],
      spells: [{ fromChoice: 'cantrips' }],
    },
    'otherworldly-patron-improvement-1': { upgradeOf: 'otherworldly-patron' },
    'otherworldly-patron-improvement-2': { upgradeOf: 'otherworldly-patron' },
    'otherworldly-patron-improvement-3': { upgradeOf: 'otherworldly-patron' },
    'mystic-arcanum-6th-level': { name: 'Mystic Arcanum (6th)', ...arcanum(6, 11) },
    'mystic-arcanum-7th-level': { name: 'Mystic Arcanum (7th)', ...arcanum(7, 13) },
    'mystic-arcanum-8th-level': { name: 'Mystic Arcanum (8th)', ...arcanum(8, 15) },
    'mystic-arcanum-9th-level': { name: 'Mystic Arcanum (9th)', ...arcanum(9, 17) },
    'eldritch-master': {
      resources: [{ id: 'eldritch-master', name: 'Eldritch Master', max: 1, recharge: longOnly }],
      activities: [{ id: 'use', name: 'Eldritch Master', actionType: 'other', cost: [{ resource: 'eldritch-master' }], restore: [{ resource: 'pact', amount: 'all' }], fx: 'magic', summary: '1 minute of entreating your patron: regain all Pact Magic slots.' }],
    },
    // The Fiend
    fiend: { expandedSpells: ['burning-hands', 'command', 'blindness-deafness', 'scorching-ray', 'fireball', 'stinking-cloud', 'fire-shield', 'wall-of-fire', 'flame-strike', 'hallow'] },
    'dark-ones-blessing': {
      activities: [{ id: 'use', name: "Dark One's Blessing", actionType: 'other', roll: { bonus: 'max(1, cha + level)', kind: 'temp' }, fx: 'magic', summary: 'When you reduce a hostile creature to 0 HP: Temp HP = Charisma + Warlock level.' }],
    },
    'dark-ones-own-luck': {
      resources: [{ id: 'dark-ones-own-luck', name: "Dark One's Own Luck", max: 1, recharge: shortAndLong() }],
      activities: [{ id: 'use', name: "Dark One's Own Luck", actionType: 'other', cost: [{ resource: 'dark-ones-own-luck' }], roll: { dice: '1d10', kind: 'other' }, summary: 'Add 1d10 to an ability check or saving throw.' }],
    },
    'fiendish-resilience': { choices: [{ id: 'type', label: 'Resistance', kind: 'option', options: damageTypes, changeable: 'shortRest' }] },
    'hurl-through-hell': {
      resources: [{ id: 'hurl-through-hell', name: 'Hurl Through Hell', max: 1, recharge: longOnly }],
      activities: [{ id: 'use', name: 'Hurl Through Hell', actionType: 'other', attack: true, cost: [{ resource: 'hurl-through-hell' }], roll: { dice: '10d10', kind: 'damage' }, fx: 'magic', summary: 'On a hit: the creature vanishes until the end of your next turn and takes psychic damage unless it is a fiend.' }],
    },
  },

  '2024': {
    'warlock-eldritch-invocations': {
      choices: [{ id: 'invocations', label: 'Eldritch Invocations', kind: 'entity', count: { byLevel: { 1: 1, 2: 3, 5: 5, 7: 6, 9: 7, 12: 8, 15: 9, 18: 10 } }, from: { ids: invocations2024.map(([id]) => `invocation-${id}`) }, changeable: 'levelUp' }],
    },
    'warlock-magical-cunning': {
      resources: [{ id: 'magical-cunning', name: 'Magical Cunning', max: 1, recharge: longOnly }],
      activities: [
        {
          id: 'use', name: 'Magical Cunning', actionType: 'other', cost: [{ resource: 'magical-cunning' }], fx: 'magic',
          restore: [{ resource: 'pact', amount: { byLevel: { 2: 'ceil(max_pact / 2)', 20: 'max_pact' } } }],
          summary: '1-minute rite: regain expended Pact slots, up to half your maximum rounded up (all with Eldritch Master at level 20).',
        },
      ],
    },
    'warlock-contact-patron': {
      resources: [{ id: 'contact-patron', name: 'Contact Patron (free cast)', max: 1, recharge: longOnly }],
      spells: [{ id: 'contact-other-plane', freeCast: 'contact-patron' }],
    },
    'warlock-mystic-arcanum': {
      resources: [6, 7, 8, 9].map((l) => arcanum(l, 0).resources[0]),
      choices: [6, 7, 8, 9].map((l) => arcanum(l, 0).choices[0]),
      spells: ([[6, 11], [7, 13], [8, 15], [9, 17]] as const).map(([l, min]) => arcanum(l, min).spells[0]),
    },
    // Fiend Patron
    'fiend-patron-dark-ones-blessing': {
      activities: [{ id: 'use', name: "Dark One's Blessing", actionType: 'other', roll: { bonus: 'max(1, cha + level)', kind: 'temp' }, fx: 'magic', summary: 'When you (or someone within 10 ft) reduce an enemy to 0 HP: Temp HP = Charisma + Warlock level (min 1).' }],
    },
    'fiend-patron-fiend-spells': { spells: fiendSpells2024.map(([id, minLevel]) => ({ id, minLevel })) },
    'fiend-patron-dark-ones-own-luck': {
      resources: [{ id: 'dark-ones-own-luck', name: "Dark One's Own Luck", max: 'max(1, cha)', recharge: longOnly }],
      activities: [{ id: 'use', name: "Dark One's Own Luck", actionType: 'other', cost: [{ resource: 'dark-ones-own-luck' }], roll: { dice: '1d10', kind: 'other' }, summary: 'Add 1d10 to an ability check or saving throw (once per roll).' }],
    },
    'fiend-patron-fiendish-resilience': { choices: [{ id: 'type', label: 'Resistance', kind: 'option', options: damageTypes, changeable: 'shortRest' }] },
    'fiend-patron-hurl-through-hell': {
      resources: [{ id: 'hurl-through-hell', name: 'Hurl Through Hell', max: 1, recharge: longOnly }],
      activities: [
        { id: 'use', name: 'Hurl Through Hell', actionType: 'other', attack: true, perTurn: 1, cost: [{ resource: 'hurl-through-hell' }], saveDc: '8 + cha + pb', saveAbility: 'cha', roll: { dice: '8d10', kind: 'damage' }, fx: 'magic', summary: 'On a hit: Cha save or the target vanishes until the end of your next turn, Incapacitated, 8d10 Psychic unless a Fiend.' },
        { id: 'restore', name: 'Hurl Through Hell: Pact slot', actionType: 'other', cost: [{ resource: 'pact' }], restore: [{ resource: 'hurl-through-hell', amount: 1 }], summary: 'Expend a Pact Magic slot to restore Hurl Through Hell (no action).' },
      ],
    },
  },

  checks: {
    // 2014 not checked: the source data's invocations_known column is off at levels 4 and 6
    // (3 and 4); the SRD 5.1 Warlock table (p. 46) has 2 at 4th, 3 at 5th–6th, 4 at 7th.
    '2024': [['warlock', 'eldritch_invocations', { 1: 1, 2: 3, 5: 5, 7: 6, 9: 7, 12: 8, 15: 9, 18: 10 }]],
  },
}
