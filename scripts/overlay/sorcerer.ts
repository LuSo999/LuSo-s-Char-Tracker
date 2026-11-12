// Sorcerer and Draconic Bloodline / Draconic Sorcery. Checked against SRD 5.1 (2014) and SRD 5.2.1 (2024).
import { longOnly, note, option, type ClassOverlay } from './common.ts'

const points = { id: 'sorcery-points', name: 'Sorcery Points', max: 'level', recharge: longOnly }
const meta = (name: string, cost: number | 'input', summary: string) => ({
  activities: [
    {
      id: 'use', name, actionType: 'other', fx: 'magic', summary,
      cost: [{ resource: 'sorcery-points', amount: cost === 'input' ? 1 : cost }], ...(cost === 'input' ? { spendInput: true } : {}),
    },
  ],
})
const metamagic2014: Record<string, [string, number | 'input', string]> = {
  'metamagic-careful-spell': ['Careful Spell', 1, 'Up to Cha-mod creatures automatically succeed on the spell’s save.'],
  'metamagic-distant-spell': ['Distant Spell', 1, 'Double the range, or Touch becomes 30 ft.'],
  'metamagic-empowered-spell': ['Empowered Spell', 1, 'Reroll up to Cha-mod damage dice (can combine with another option).'],
  'metamagic-extended-spell': ['Extended Spell', 1, 'Double a duration of 1 minute or more (max 24 hours).'],
  'metamagic-heightened-spell': ['Heightened Spell', 3, 'One target has disadvantage on its first save against the spell.'],
  'metamagic-quickened-spell': ['Quickened Spell', 2, 'Casting time of 1 action becomes 1 bonus action.'],
  'metamagic-subtle-spell': ['Subtle Spell', 1, 'Cast without somatic or verbal components.'],
  'metamagic-twinned-spell': ['Twinned Spell', 'input', 'Single-target spell targets a second creature. Costs the spell’s level (1 for a cantrip).'],
}
const metamagic2024: [string, string, number, string][] = [
  ['careful', 'Careful Spell', 1, 'Up to Cha-mod creatures (min 1) succeed on the save and take no damage on half-damage saves.'],
  ['distant', 'Distant Spell', 1, 'Double a range of 5+ ft, or Touch becomes 30 ft.'],
  ['empowered', 'Empowered Spell', 1, 'Reroll up to Cha-mod damage dice (min 1); combines with other options.'],
  ['extended', 'Extended Spell', 1, 'Double a duration of 1 minute+ (max 24 h); Advantage on Concentration saves for it.'],
  ['heightened', 'Heightened Spell', 2, 'One target has Disadvantage on saves against the spell.'],
  ['quickened', 'Quickened Spell', 2, 'Action casting time becomes a Bonus Action (no other level 1+ spell this turn).'],
  ['seeking', 'Seeking Spell', 1, 'Reroll a missed spell attack roll; combines with other options.'],
  ['subtle', 'Subtle Spell', 1, 'Cast without Verbal, Somatic or non-costly Material components.'],
  ['transmuted', 'Transmuted Spell', 1, 'Change Acid, Cold, Fire, Lightning, Poison or Thunder damage to another of them.'],
  ['twinned', 'Twinned Spell', 1, 'Raise the spell’s effective level by 1 to target one more creature.'],
]
const draconicSpells2024: [string, number][] = [
  ['alter-self', 3], ['chromatic-orb', 3], ['command', 3], ['dragons-breath', 3], ['fear', 5], ['fly', 5],
  ['arcane-eye', 7], ['charm-monster', 7], ['legend-lore', 9], ['summon-dragon', 9],
]
const dragonTypes = ['acid', 'cold', 'fire', 'lightning', 'poison']

export const sorcerer: ClassOverlay = {
  entities: {
    '2024': [
      ...metamagic2024.map(([id, name, cost, summary]) => option('2024', `metamagic-${id}`, name, 'sorcerer', 'sorcerer-metamagic', `Cost: ${cost} Sorcery Point${cost > 1 ? 's' : ''}. ${summary}`, meta(name, cost, summary))),
      ...dragonTypes.map((type) =>
        option('2024', `elemental-affinity-${type}`, `Elemental Affinity: ${type[0].toUpperCase()}${type.slice(1)}`, 'draconic-sorcery', 'draconic-sorcery-elemental-affinity', `Resistance to ${type} damage; add your Charisma modifier to one damage roll of ${type} spells.`),
      ),
    ],
  },

  '2014': {
    'font-of-magic': { resources: [points] },
    'flexible-casting-creating-spell-slots': {
      activities: [{ id: 'use', name: 'Flexible Casting: create a slot', actionType: 'bonusAction', fontOfMagic: 'create', fx: 'magic', summary: 'Sorcery Points → spell slot (1st: 2, 2nd: 3, 3rd: 5, 4th: 6, 5th: 7). Created slots vanish on a long rest.' }],
    },
    'flexible-casting-converting-spell-slot': {
      activities: [{ id: 'use', name: 'Flexible Casting: slot to points', actionType: 'bonusAction', fontOfMagic: 'convert', fx: 'magic', summary: 'Spell slot → Sorcery Points equal to its level.' }],
    },
    'metamagic-1': { name: 'Metamagic', choices: [{ id: 'option', label: 'Metamagic', kind: 'entity', count: 2, from: { ids: Object.keys(metamagic2014) } }] },
    'metamagic-2': { name: 'Metamagic (10th)', choices: [{ id: 'option', label: 'Metamagic', kind: 'entity', count: 1, from: { ids: Object.keys(metamagic2014) } }] },
    'metamagic-3': { name: 'Metamagic (17th)', choices: [{ id: 'option', label: 'Metamagic', kind: 'entity', count: 1, from: { ids: Object.keys(metamagic2014) } }] },
    ...Object.fromEntries(Object.entries(metamagic2014).map(([id, [name, cost, summary]]) => [id, meta(name, cost, summary)])),
    'sorcerous-origin-improvement-1': { upgradeOf: 'sorcerous-origin' },
    'sorcerous-origin-improvement-2': { upgradeOf: 'sorcerous-origin' },
    'sorcerous-origin-improvement-3': { upgradeOf: 'sorcerous-origin' },
    'sorcerous-restoration': {
      activities: [{ id: 'use', name: 'Sorcerous Restoration', actionType: 'other', summary: 'Finishing a short rest: regain 4 Sorcery Points (restore them on the dots).' }],
    },
    // Draconic Bloodline
    'draconic-resilience': {
      effects: [
        { target: 'hpMax', value: 'level' },
        { target: 'unarmoredAc', op: 'set', value: '13 + dex' },
      ],
    },
    'dragon-wings': {
      activities: [{ id: 'use', name: 'Dragon Wings', actionType: 'bonusAction', toggle: 'Dragon Wings', summary: 'Flying speed equal to your speed (not in armor that has no room for wings).' }],
    },
    'draconic-presence': {
      activities: [{ id: 'use', name: 'Draconic Presence', actionType: 'action', cost: [{ resource: 'sorcery-points', amount: 5 }], toggle: 'Draconic Presence', saveDc: '8 + pb + cha', saveAbility: 'wis', fx: 'magic', summary: '60-ft aura for 1 minute (concentration): charmed (awe) or frightened (fear) on a failed save.' }],
    },
  },

  '2024': {
    'sorcerer-innate-sorcery': {
      resources: [{ id: 'innate-sorcery', name: 'Innate Sorcery', max: 2, recharge: longOnly }],
      activities: [{ id: 'use', name: 'Innate Sorcery', actionType: 'bonusAction', cost: [{ resource: 'innate-sorcery' }], toggle: 'Innate Sorcery', fx: 'magic', summary: '1 minute: Sorcerer spell save DC +1 and Advantage on Sorcerer spell attack rolls.' }],
      effects: [{ target: 'spellDc', value: 1, when: { toggle: 'Innate Sorcery' } }, note('Innate Sorcery: Advantage on attack rolls of Sorcerer spells.', 'Innate Sorcery')],
    },
    'sorcerer-font-of-magic': {
      resources: [points],
      activities: [
        { id: 'create', name: 'Font of Magic: create a slot', actionType: 'bonusAction', fontOfMagic: 'create', fx: 'magic', summary: 'Sorcery Points → spell slot (1: 2 SP, 2: 3, 3: 5, 4: 6, 5: 7; needs Sorcerer level 2/3/5/7/9). Vanishes on a Long Rest.' },
        { id: 'convert', name: 'Font of Magic: slot to points', actionType: 'other', fontOfMagic: 'convert', fx: 'magic', summary: 'Spell slot → Sorcery Points equal to its level (no action).' },
      ],
    },
    'sorcerer-metamagic': {
      choices: [{ id: 'options', label: 'Metamagic', kind: 'entity', count: { byLevel: { 2: 2, 10: 4, 17: 6 } }, from: { ids: metamagic2024.map(([id]) => `metamagic-${id}`) }, changeable: 'levelUp' }],
    },
    'sorcerer-sorcerous-restoration': {
      resources: [{ id: 'sorcerous-restoration', name: 'Sorcerous Restoration', max: 1, recharge: longOnly }],
      activities: [{ id: 'use', name: 'Sorcerous Restoration', actionType: 'other', cost: [{ resource: 'sorcerous-restoration' }], roll: { bonus: 'floor(level / 2)', kind: 'other' }, summary: 'After a Short Rest: regain up to this many Sorcery Points (restore them on the dots).' }],
    },
    'sorcerer-sorcery-incarnate': {
      activities: [{ id: 'use', name: 'Innate Sorcery (2 SP)', actionType: 'bonusAction', cost: [{ resource: 'sorcery-points', amount: 2 }], toggle: 'Innate Sorcery', fx: 'magic', summary: 'No Innate Sorcery uses left: activate it for 2 Sorcery Points. While active, up to two Metamagic options per spell.' }],
    },
    // Draconic Sorcery
    'draconic-sorcery-draconic-resilience': {
      effects: [
        { target: 'hpMax', value: 'level' },
        { target: 'unarmoredAc', op: 'set', value: '10 + dex + cha' },
      ],
    },
    'draconic-sorcery-draconic-spells': { spells: draconicSpells2024.map(([id, minLevel]) => ({ id, minLevel })) },
    'draconic-sorcery-elemental-affinity': {
      choices: [{ id: 'type', label: 'Damage type', kind: 'entity', from: { ids: dragonTypes.map((t) => `elemental-affinity-${t}`) } }],
    },
    'draconic-sorcery-dragon-wings': {
      resources: [{ id: 'dragon-wings', name: 'Dragon Wings', max: 1, recharge: longOnly }],
      activities: [{ id: 'use', name: 'Dragon Wings', actionType: 'bonusAction', cost: [{ resource: 'dragon-wings' }], toggle: 'Dragon Wings', fx: 'magic', summary: 'Fly Speed 60 ft for 1 hour. 3 Sorcery Points restore the use.' }],
    },
    'draconic-sorcery-dragon-companion': {
      resources: [{ id: 'dragon-companion', name: 'Dragon Companion (free cast)', max: 1, recharge: longOnly }],
      spells: [{ id: 'summon-dragon', freeCast: 'dragon-companion' }],
    },
  },

  checks: {
    '2014': [['sorcerer', 'sorcery_points', { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 17: 17, 18: 18, 19: 19, 20: 20 }]],
    '2024': [['sorcerer', 'sorcery_points', { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 17: 17, 18: 18, 19: 19, 20: 20 }]],
  },
}
