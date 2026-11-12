// Druid and Circle of the Land. Checked against SRD 5.1 (2014) and SRD 5.2.1 (2024).
import { longOnly, note, option, shortAndLong, type ClassOverlay } from './common.ts'

type Land = [id: string, name: string, spells: [string, number][]]
const at = (level: number, ...ids: string[]) => ids.map((id) => [id, level] as [string, number])
const lands2014: Land[] = [
  ['arctic', 'Arctic', [...at(3, 'hold-person', 'spike-growth'), ...at(5, 'sleet-storm', 'slow'), ...at(7, 'freedom-of-movement', 'ice-storm'), ...at(9, 'commune-with-nature', 'cone-of-cold')]],
  ['coast', 'Coast', [...at(3, 'mirror-image', 'misty-step'), ...at(5, 'water-breathing', 'water-walk'), ...at(7, 'control-water', 'freedom-of-movement'), ...at(9, 'conjure-elemental', 'scrying')]],
  ['desert', 'Desert', [...at(3, 'blur', 'silence'), ...at(5, 'create-food-and-water', 'protection-from-energy'), ...at(7, 'blight', 'hallucinatory-terrain'), ...at(9, 'insect-plague', 'wall-of-stone')]],
  ['forest', 'Forest', [...at(3, 'barkskin', 'spider-climb'), ...at(5, 'call-lightning', 'plant-growth'), ...at(7, 'divination', 'freedom-of-movement'), ...at(9, 'commune-with-nature', 'tree-stride')]],
  ['grassland', 'Grassland', [...at(3, 'invisibility', 'pass-without-trace'), ...at(5, 'daylight', 'haste'), ...at(7, 'divination', 'freedom-of-movement'), ...at(9, 'dream', 'insect-plague')]],
  ['mountain', 'Mountain', [...at(3, 'spider-climb', 'spike-growth'), ...at(5, 'lightning-bolt', 'meld-into-stone'), ...at(7, 'stone-shape', 'stoneskin'), ...at(9, 'passwall', 'wall-of-stone')]],
  ['swamp', 'Swamp', [...at(3, 'acid-arrow', 'darkness'), ...at(5, 'water-walk', 'stinking-cloud'), ...at(7, 'freedom-of-movement', 'locate-creature'), ...at(9, 'insect-plague', 'scrying')]],
]
const lands2024: (Land & { 3: string })[] = [
  Object.assign(['arid', 'Arid Land', [...at(3, 'blur', 'burning-hands', 'fire-bolt'), ...at(5, 'fireball'), ...at(7, 'blight'), ...at(9, 'wall-of-stone')]] as Land, { 3: 'Fire' }),
  Object.assign(['polar', 'Polar Land', [...at(3, 'fog-cloud', 'hold-person', 'ray-of-frost'), ...at(5, 'sleet-storm'), ...at(7, 'ice-storm'), ...at(9, 'cone-of-cold')]] as Land, { 3: 'Cold' }),
  Object.assign(['temperate', 'Temperate Land', [...at(3, 'misty-step', 'shocking-grasp', 'sleep'), ...at(5, 'lightning-bolt'), ...at(7, 'freedom-of-movement'), ...at(9, 'tree-stride')]] as Land, { 3: 'Lightning' }),
  Object.assign(['tropical', 'Tropical Land', [...at(3, 'acid-splash', 'ray-of-sickness', 'web'), ...at(5, 'stinking-cloud'), ...at(7, 'polymorph'), ...at(9, 'insect-plague')]] as Land, { 3: 'Poison' }),
]
const granted = (spells: [string, number][]) => spells.map(([id, minLevel]) => ({ id, minLevel }))

export const druid: ClassOverlay = {
  entities: {
    '2024': [
      option('2024', 'druid-magician', 'Magician', 'druid', 'druid-primal-order', 'One extra Druid cantrip; add your Wisdom modifier (min +1) to Intelligence (Arcana or Nature) checks.', {
        effects: [{ target: 'skill:arcana', value: 'max(1, wis)' }, { target: 'skill:nature', value: 'max(1, wis)' }],
        choices: [{ id: 'cantrip', label: 'Druid cantrip', kind: 'spell', spellLevel: 0, spellClasses: ['druid'] }],
        spells: [{ fromChoice: 'cantrip' }],
      }),
      option('2024', 'druid-warden', 'Warden', 'druid', 'druid-primal-order', 'Proficiency with Martial weapons and training with Medium armor.', {
        effects: [{ target: 'proficiency:weapon:martial', value: 1 }, { target: 'proficiency:armor:medium', value: 1 }],
      }),
      option('2024', 'druid-potent-spellcasting', 'Potent Spellcasting', 'druid', 'druid-elemental-fury', 'Add your Wisdom modifier to the damage of Druid cantrips. Level 15: Druid cantrips with a range of 10+ ft reach 300 ft farther.'),
      option('2024', 'druid-primal-strike', 'Primal Strike', 'druid', 'druid-elemental-fury', 'Once per turn, a weapon or Beast-form attack hit deals an extra 1d8 Cold, Fire, Lightning or Thunder (2d8 from level 15).', {
        activities: [{ id: 'use', name: 'Primal Strike', actionType: 'other', attack: true, perTurn: 1, roll: { dice: { count: { byLevel: { 7: 1, 15: 2 } }, die: 8 }, kind: 'damage' }, summary: 'Once per turn on a weapon or Beast-form hit: Cold, Fire, Lightning or Thunder.' }],
      }),
      ...lands2024.map(([id, name, spells, ]) =>
        option('2024', `land-${id}`, name, 'circle-of-the-land', 'land-circle-of-the-land-spells', `Circle spells of the ${name.toLowerCase()}; Nature's Ward (level 10) gives Resistance to ${lands2024.find((l) => l[0] === id)![3]}.`, { spells: granted(spells) }),
      ),
    ],
  },

  '2014': {
    'wild-shape-cr-1-4-or-below-no-flying-or-swim-speed': {
      name: 'Wild Shape',
      resources: [{ id: 'wild-shape', name: 'Wild Shape', max: { byLevel: { 2: 2, 20: 99 } }, recharge: shortAndLong() }],
      activities: [
        {
          id: 'use', name: 'Wild Shape', actionType: 'action', cost: [{ resource: 'wild-shape' }], toggle: 'Wild Shape', fx: 'magic',
          summary: 'Beast you have seen: CR 1/4, no fly or swim speed (4th: CR 1/2, no fly; 8th: CR 1). Lasts half your druid level in hours. Unlimited at 20th.',
        },
      ],
      effects: [note('Wild Shape: the beast’s statistics replace yours (keep Int, Wis, Cha, skills); you can’t cast spells; HP of the beast first.', 'Wild Shape')],
    },
    'wild-shape-cr-1-2-or-below-no-flying-speed': { upgradeOf: 'wild-shape-cr-1-4-or-below-no-flying-or-swim-speed' },
    'wild-shape-cr-1-or-below': { upgradeOf: 'wild-shape-cr-1-4-or-below-no-flying-or-swim-speed' },
    'druid-circle-improvement-1': { upgradeOf: 'druid-circle' },
    'druid-circle-improvement-2': { upgradeOf: 'druid-circle' },
    'druid-circle-improvement-3': { upgradeOf: 'druid-circle' },
    // Circle of the Land
    ...Object.fromEntries(lands2014.map(([id, , spells]) => [`circle-of-the-land-${id}`, { spells: granted(spells) }])),
    'bonus-cantrip': { choices: [{ id: 'cantrip', label: 'Druid cantrip', kind: 'spell', spellLevel: 0, spellClasses: ['druid'] }], spells: [{ fromChoice: 'cantrip' }] },
    'natural-recovery': {
      resources: [{ id: 'natural-recovery', name: 'Natural Recovery', max: 1, recharge: longOnly }],
      activities: [{ id: 'use', name: 'Natural Recovery', actionType: 'other', cost: [{ resource: 'natural-recovery' }], recoverSlots: 'ceil(level / 2)', fx: 'magic', summary: 'During a short rest: recover expended spell slots with a combined level up to half your druid level (none 6th+).' }],
    },
  },

  '2024': {
    'druid-primal-order': { choices: [{ id: 'order', label: 'Primal Order', kind: 'entity', from: { ids: ['druid-magician', 'druid-warden'] } }] },
    'druid-wild-shape': {
      resources: [{ id: 'wild-shape', name: 'Wild Shape', max: { byLevel: { 2: 2, 6: 3, 17: 4 } }, recharge: shortAndLong(1) }],
      activities: [
        {
          id: 'use', name: 'Wild Shape', actionType: 'bonusAction', cost: [{ resource: 'wild-shape' }], toggle: 'Wild Shape', roll: { bonus: 'level', kind: 'temp' }, fx: 'magic',
          summary: 'Known Beast form (level 2: CR 1/4, no Fly; 4: CR 1/2; 8: CR 1, Fly). Temp HP = Druid level. Lasts half your Druid level in hours; leave as a Bonus Action.',
        },
      ],
      effects: [note('Wild Shape: the Beast’s stat block replaces yours (keep HP, Hit Dice, Int, Wis, Cha, class features); no spellcasting.', 'Wild Shape')],
    },
    'druid-wild-companion': {
      activities: [
        { id: 'use', name: 'Wild Companion', actionType: 'action', cost: [{ resource: 'wild-shape' }], fx: 'magic', summary: 'Cast Find Familiar without Material components. The Fey familiar leaves on a Long Rest.' },
        { id: 'slot', name: 'Wild Companion (spell slot)', actionType: 'action', slotCost: true, fx: 'magic', summary: 'The same, spending a spell slot instead of Wild Shape.' },
      ],
    },
    'druid-wild-resurgence': {
      resources: [{ id: 'wild-resurgence', name: 'Wild Resurgence (slot)', max: 1, recharge: longOnly }],
      activities: [
        { id: 'slot-to-shape', name: 'Wild Resurgence: slot → Wild Shape', actionType: 'other', perTurn: 1, slotCost: true, restore: [{ resource: 'wild-shape', amount: 1 }], fx: 'magic', summary: 'No Wild Shape left: expend a spell slot to regain one (once per turn).' },
        { id: 'shape-to-slot', name: 'Wild Resurgence: Wild Shape → level 1 slot', actionType: 'other', cost: [{ resource: 'wild-shape' }, { resource: 'wild-resurgence' }], restore: [{ resource: 'slot:1', amount: 1 }], fx: 'magic', summary: 'Expend a Wild Shape for a level 1 spell slot (once per Long Rest).' },
      ],
    },
    'druid-archdruid': {
      activities: [{ id: 'evergreen', name: 'Evergreen Wild Shape', actionType: 'other', restore: [{ resource: 'wild-shape', amount: 1, upTo: true }], summary: 'Roll Initiative with no Wild Shape left: regain one.' }],
    },
    'druid-elemental-fury': {
      choices: [{ id: 'option', label: 'Elemental Fury', kind: 'entity', from: { ids: ['druid-potent-spellcasting', 'druid-primal-strike'] } }],
    },
    // Circle of the Land
    'land-circle-of-the-land-spells': {
      choices: [{ id: 'land', label: 'Land', kind: 'entity', from: { ids: lands2024.map(([id]) => `land-${id}`) }, changeable: 'longRest' }],
    },
    'land-lands-aid': {
      activities: [
        {
          id: 'use', name: "Land's Aid", actionType: 'action', cost: [{ resource: 'wild-shape' }], saveDc: '8 + wis + pb', saveAbility: 'con', fx: 'magic',
          roll: { dice: { count: { byLevel: { 3: 2, 10: 3, 14: 4 } }, die: 6 }, kind: 'damage' },
          summary: '10-ft sphere within 60 ft: Necrotic to chosen creatures (half on a save), and one creature heals the same dice.',
        },
      ],
    },
    'land-natural-recovery': {
      resources: [{ id: 'natural-recovery', name: 'Natural Recovery', max: 1, recharge: longOnly }],
      activities: [{ id: 'use', name: 'Natural Recovery', actionType: 'other', cost: [{ resource: 'natural-recovery' }], recoverSlots: 'ceil(level / 2)', fx: 'magic', summary: 'After a Short Rest: recover expended slots with a combined level up to half your Druid level (none 6+).' }],
    },
    'land-natures-sanctuary': {
      activities: [{ id: 'use', name: "Nature's Sanctuary", actionType: 'action', cost: [{ resource: 'wild-shape' }], fx: 'magic', summary: '15-ft cube within 120 ft for 1 minute: you and allies have Half Cover there; allies get your Nature’s Ward Resistance. Move it 60 ft as a Bonus Action.' }],
    },
  },

  checks: {
    '2024': [['druid', 'wild_shape_uses', { 2: 2, 6: 3, 17: 4 }]],
  },
}
