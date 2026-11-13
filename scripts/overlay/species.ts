// Spells from species traits. Checked against SRD 5.1 (2014) and SRD 5.2.1 (2024).
// 2024 lineages / legacies: a cantrip at level 1, a spell at character levels 3
// and 5 — always prepared, once per Long Rest without a slot (or with slots);
// Int, Wis or Cha is the spellcasting ability, chosen with the lineage.
import { longOnly, shortAndLong, type ClassOverlay, type Patch } from './common.ts'


// Senses, resistances and save notes (shown on the sheet: Abilities panel).
const darkvision = (range: number): Patch => ({ effects: [{ target: 'sense:darkvision', op: 'max', value: range }] })
const resist = (type: string, saveNote?: string): Patch => ({
  effects: [{ target: `resistance:${type}`, value: 1 }, ...(saveNote ? [{ target: 'advantage:save:condition', note: saveNote }] : [])],
})
const saveNote = (text: string): Patch => ({ effects: [{ target: 'advantage:save:condition', note: text }] })
const relentless: Patch = {
  resources: [{ id: 'relentless-endurance', name: 'Relentless Endurance', max: 1, recharge: longOnly }],
  activities: [
    { id: 'use', name: 'Relentless Endurance', actionType: 'other', cost: [{ resource: 'relentless-endurance' }], roll: { bonus: 1, kind: 'heal' }, summary: 'Reduced to 0 HP but not killed outright: drop to 1 HP instead.' },
  ],
}

const abilityChoice = { id: 'ability', label: 'Spellcasting ability', kind: 'ability', options: ['int', 'wis', 'cha'] }
const lineage = (cantrips: string[], level3: string, level5: string) => ({
  choices: [abilityChoice],
  resources: [
    // The free casts exist once the spell is learned (character levels 3 and 5).
    { id: 'lineage-3', name: 'Lineage spell (level 3)', max: { byLevel: { 3: 1 }, per: 'characterLevel' }, recharge: longOnly },
    { id: 'lineage-5', name: 'Lineage spell (level 5)', max: { byLevel: { 5: 1 }, per: 'characterLevel' }, recharge: longOnly },
  ],
  spells: [
    ...cantrips.map((id) => ({ id, abilityFromChoice: 'ability' })),
    { id: level3, minLevel: 3, freeCast: 'lineage-3', abilityFromChoice: 'ability' },
    { id: level5, minLevel: 5, freeCast: 'lineage-5', abilityFromChoice: 'ability' },
  ],
})

export const species: ClassOverlay = {
  '2014': {
    // SRD 5.1 racial traits. Weapon / tool / skill / language proficiencies and
    // Draconic Ancestry come from the source data (scripts/build-srd.ts).
    'darkvision-trait': darkvision(60),
    'dwarven-resilience': resist('poison', 'Advantage on saves against poison'),
    'dwarven-toughness': { effects: [{ target: 'hpPerLevel', value: 1 }] },
    'fey-ancestry': saveNote('Advantage on saves against being Charmed; magic can’t put you to sleep'),
    brave: saveNote('Advantage on saves against being Frightened'),
    'gnome-cunning': saveNote('Advantage on Int, Wis and Cha saves against magic'),
    'hellish-resistance': resist('fire'),
    'relentless-endurance': relentless,
    'high-elf-cantrip': {
      choices: [{ id: 'cantrip', label: 'Wizard cantrip', kind: 'spell', spellLevel: 0, spellClasses: ['wizard'] }],
      spells: [{ fromChoice: 'cantrip', ability: 'int' }],
    },
    'infernal-legacy': {
      resources: [
        { id: 'infernal-legacy-rebuke', name: 'Hellish Rebuke (free cast, 2nd level)', max: { byLevel: { 3: 1 }, per: 'characterLevel' }, recharge: longOnly },
        { id: 'infernal-legacy-darkness', name: 'Darkness (free cast)', max: { byLevel: { 5: 1 }, per: 'characterLevel' }, recharge: longOnly },
      ],
      spells: [
        { id: 'thaumaturgy', ability: 'cha' },
        { id: 'hellish-rebuke', minLevel: 3, freeCast: 'infernal-legacy-rebuke', freeLevel: 2, ability: 'cha' },
        { id: 'darkness', minLevel: 5, freeCast: 'infernal-legacy-darkness', ability: 'cha' },
      ],
    },
  },
  '2024': {
    // SRD 5.2.1 species traits.
    'darkvision-60': darkvision(60),
    'darkvision-120': darkvision(120),
    'dwarven-resilience': resist('poison', 'Advantage on saves to avoid or end Poisoned'),
    'dwarven-toughness': { effects: [{ target: 'hpPerLevel', value: 1 }] },
    stonecunning: {
      resources: [{ id: 'stonecunning', name: 'Stonecunning', max: 'pb', recharge: longOnly }],
      activities: [{ id: 'use', name: 'Stonecunning', actionType: 'bonusAction', cost: [{ resource: 'stonecunning' }], fx: 'magic', summary: 'Tremorsense 60 ft for 10 minutes while on or touching stone.' }],
    },
    'fey-ancestry': saveNote('Advantage on saves to avoid or end Charmed'),
    'keen-senses': { choices: [{ id: 'skill', label: 'Keen Senses', kind: 'skill', options: ['insight', 'perception', 'survival'] }] },
    'gnomish-cunning': saveNote('Advantage on Int, Wis and Cha saves'),
    brave: saveNote('Advantage on saves to avoid or end Frightened'),
    // Human and Tiefling: Medium or Small, chosen with the species.
    human: { choices: [{ id: 'size', label: 'Size', kind: 'option', options: ['Medium', 'Small'] }] },
    tiefling: { choices: [{ id: 'size', label: 'Size', kind: 'option', options: ['Medium', 'Small'] }] },
    resourceful: {
      resources: [{ id: 'heroic-inspiration', name: 'Heroic Inspiration', max: 1, recharge: longOnly }],
      activities: [{ id: 'use', name: 'Heroic Inspiration', actionType: 'other', cost: [{ resource: 'heroic-inspiration' }], summary: 'Reroll any die you just rolled; use the new roll.' }],
    },
    skillful: { choices: [{ id: 'skill', label: 'Skillful', kind: 'skill' }] },
    versatile: { choices: [{ id: 'feat', label: 'Origin feat', kind: 'entity', from: { type: 'feat', tags: ['origin'] } }] },
    'adrenaline-rush': {
      resources: [{ id: 'adrenaline-rush', name: 'Adrenaline Rush', max: 'pb', recharge: shortAndLong() }],
      activities: [{ id: 'use', name: 'Adrenaline Rush', actionType: 'bonusAction', cost: [{ resource: 'adrenaline-rush' }], roll: { bonus: 'pb', kind: 'temp' }, fx: 'power', summary: 'Dash as a Bonus Action and gain Temporary HP equal to your Proficiency Bonus.' }],
    },
    'relentless-endurance': relentless,
    'draconic-flight': {
      resources: [{ id: 'draconic-flight', name: 'Draconic Flight', max: { byLevel: { 5: 1 }, per: 'characterLevel' }, recharge: longOnly }],
      activities: [{ id: 'use', name: 'Draconic Flight', actionType: 'bonusAction', cost: [{ resource: 'draconic-flight' }], minLevel: 5, fx: 'magic', toggle: 'Flying (Draconic Flight)', summary: 'Spectral wings for 10 minutes: Fly Speed equal to your Speed.' }],
      effects: [{ target: 'note', note: 'Draconic Flight: Fly Speed equal to your Speed (10 minutes)', when: { toggle: 'Flying (Draconic Flight)' } }],
    },
    'wood-elf-speed-increase': { effects: [{ target: 'speed', value: 5 }] },
    'elven-lineage-drow': lineage(['dancing-lights'], 'faerie-fire', 'darkness'),
    'elven-lineage-high-elf': lineage(['prestidigitation'], 'detect-magic', 'misty-step'),
    'elven-lineage-wood-elf': lineage(['druidcraft'], 'longstrider', 'pass-without-trace'),
    'fiendish-legacy-abyssal': lineage(['poison-spray', 'thaumaturgy'], 'ray-of-sickness', 'hold-person'),
    'fiendish-legacy-chthonic': lineage(['chill-touch', 'thaumaturgy'], 'false-life', 'ray-of-enfeeblement'),
    'fiendish-legacy-infernal': lineage(['fire-bolt', 'thaumaturgy'], 'hellish-rebuke', 'darkness'),
    'gnomish-lineage-forest-gnome': {
      choices: [abilityChoice],
      resources: [{ id: 'speak-with-animals', name: 'Speak with Animals (free casts)', max: 'pb', recharge: longOnly }],
      spells: [
        { id: 'minor-illusion', abilityFromChoice: 'ability' },
        { id: 'speak-with-animals', freeCast: 'speak-with-animals', abilityFromChoice: 'ability' },
      ],
    },
    'gnomish-lineage-rock-gnome': {
      choices: [abilityChoice],
      spells: [
        { id: 'mending', abilityFromChoice: 'ability' },
        { id: 'prestidigitation', abilityFromChoice: 'ability' },
      ],
    },
  },
}
