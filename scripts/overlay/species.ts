// Spells from species traits. Checked against SRD 5.1 (2014) and SRD 5.2.1 (2024).
// 2024 lineages / legacies: a cantrip at level 1, a spell at character levels 3
// and 5 — always prepared, once per Long Rest without a slot (or with slots);
// Int, Wis or Cha is the spellcasting ability, chosen with the lineage.
import { longOnly, type ClassOverlay } from './common.ts'

const abilityChoice = { id: 'ability', label: 'Spellcasting ability', kind: 'ability', options: ['int', 'wis', 'cha'] }
const lineage = (cantrips: string[], level3: string, level5: string) => ({
  choices: [abilityChoice],
  resources: [
    { id: 'lineage-3', name: 'Lineage spell (level 3)', max: 1, recharge: longOnly },
    { id: 'lineage-5', name: 'Lineage spell (level 5)', max: 1, recharge: longOnly },
  ],
  spells: [
    ...cantrips.map((id) => ({ id, abilityFromChoice: 'ability' })),
    { id: level3, minLevel: 3, freeCast: 'lineage-3', abilityFromChoice: 'ability' },
    { id: level5, minLevel: 5, freeCast: 'lineage-5', abilityFromChoice: 'ability' },
  ],
})

export const species: ClassOverlay = {
  '2014': {
    'high-elf-cantrip': {
      choices: [{ id: 'cantrip', label: 'Wizard cantrip', kind: 'spell', spellLevel: 0, spellClasses: ['wizard'] }],
      spells: [{ fromChoice: 'cantrip', ability: 'int' }],
    },
    'infernal-legacy': {
      resources: [
        { id: 'infernal-legacy-rebuke', name: 'Hellish Rebuke (free cast, 2nd level)', max: 1, recharge: longOnly },
        { id: 'infernal-legacy-darkness', name: 'Darkness (free cast)', max: 1, recharge: longOnly },
      ],
      spells: [
        { id: 'thaumaturgy', ability: 'cha' },
        { id: 'hellish-rebuke', minLevel: 3, freeCast: 'infernal-legacy-rebuke', ability: 'cha' },
        { id: 'darkness', minLevel: 5, freeCast: 'infernal-legacy-darkness', ability: 'cha' },
      ],
    },
  },
  '2024': {
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
