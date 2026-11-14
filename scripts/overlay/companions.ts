// Familiars, steeds and summons the SRD spells and pacts give, and the three scaled stat
// blocks of SRD 5.2 spells (Otherworldly Steed, Giant Insect, Draconic Spirit).
// Numbers in scaled stat blocks are formulas: slot = spell level, spellAttack / spellDc = yours.
import type { ClassOverlay } from './common.ts'

const familiars2014 = ['bat', 'cat', 'crab', 'frog', 'hawk', 'lizard', 'octopus', 'owl', 'poisonous-snake', 'quipper', 'rat', 'raven', 'sea-horse', 'spider', 'weasel'].map((x) => `creature-${x}`)
const steeds2014 = ['warhorse', 'pony', 'camel', 'elk', 'mastiff'].map((x) => `creature-${x}`)

export const chainFamiliar2014 = {
  id: 'chain-familiar', kind: 'familiar', creatures: [...familiars2014, ...['imp', 'pseudodragon', 'quasit', 'sprite'].map((x) => `creature-${x}`)],
  note: 'Pact of the Chain: it can attack with its Reaction when you forgo one of your attacks.',
}
export const chainFamiliar2024 = {
  id: 'chain-familiar', kind: 'familiar', filter: { creatureType: 'beast', maxCr: 0 },
  creatures: ['imp', 'pseudodragon', 'quasit', 'skeleton', 'sphinx-of-wonder', 'sprite', 'venomous-snake'].map((x) => `creature-${x}`),
  note: 'Pact of the Chain: when you take the Attack action, forgo one attack so the familiar attacks once with its Reaction.',
}

const scaled = (id: string, name: string, description: string, x: Record<string, unknown>) => ({
  id, edition: '2024', name, description, source: { book: 'srd-5.2' }, type: 'creature', tags: ['summon'], ...x,
})

const steedSlam = (type: string, kind: string) => ({
  name: `Otherworldly Slam (${kind})`, actionType: 'action', description: `Melee spell attack, reach 5 ft. ${type} damage.`,
  attack: { bonus: 'spellAttack', range: 'reach 5 ft.' }, damage: [{ dice: '1d8', bonus: 'slot', type }],
})

const insect = (form: string, extra: Record<string, unknown>[], fly: boolean) =>
  scaled(`creature-giant-insect-${form}`, `Giant Insect (${form[0].toUpperCase()}${form.slice(1)})`, 'Large Beast summoned by Giant Insect; scales with the spell level.', {
    size: 'Large', creatureType: 'beast', cr: 0, ac: '11 + slot', hp: '30 + 10 * (slot - 4)',
    speed: { walk: 40, climb: 40, ...(fly ? { fly: 40 } : {}) },
    scores: { str: 17, dex: 13, con: 15, int: 4, wis: 14, cha: 3 },
    senses: { darkvision: 60 }, passivePerception: 12, languages: 'Understands the languages you know',
    traits: [{ name: 'Spider Climb', description: 'The insect can climb difficult surfaces, including along ceilings, without an ability check.' }],
    actions: [
      { name: 'Multiattack', actionType: 'action', description: 'The insect makes a number of attacks equal to half the spell’s level (round down).' },
      { name: 'Poison Jab', actionType: 'action', description: 'Melee spell attack, reach 10 ft.', attack: { bonus: 'spellAttack', range: 'reach 10 ft.' }, damage: [{ dice: '1d6', bonus: '3 + slot', type: 'piercing' }, { dice: '1d4', bonus: 0, type: 'poison' }] },
      ...extra,
    ],
  })

const creatures2024 = [
  scaled('creature-otherworldly-steed', 'Otherworldly Steed', 'Large Celestial, Fey or Fiend from Find Steed; scales with the spell level.', {
    size: 'Large', creatureType: 'celestial, fey or fiend', cr: 0, ac: '10 + slot', hp: '5 + 10 * slot', hitDice: 'slot',
    speed: { walk: 60, fly: '60 * min(1, floor(slot / 4))' },
    scores: { str: 18, dex: 12, con: 14, int: 6, wis: 12, cha: 8 }, passivePerception: 11, languages: 'Telepathy 1 mile (works only with you)',
    traits: [{ name: 'Life Bond', description: 'When you regain Hit Points from a level 1+ spell, the steed regains the same number if you’re within 5 feet of it.' }],
    actions: [
      steedSlam('radiant', 'Celestial'), steedSlam('psychic', 'Fey'), steedSlam('necrotic', 'Fiend'),
      { name: 'Fell Glare (Fiend; 1/Long Rest)', uses: { max: 1, recharge: 'longRest' }, actionType: 'bonusAction', description: 'One creature you can see within 60 ft.: Wisdom save or Frightened until the end of your next turn.', save: { ability: 'wis', dc: 'spellDc' } },
      { name: 'Fey Step (Fey; 1/Long Rest)', uses: { max: 1, recharge: 'longRest' }, actionType: 'bonusAction', description: 'The steed teleports, with its rider, up to 60 ft. to an unoccupied space it can see.' },
      { name: 'Healing Touch (Celestial; 1/Long Rest)', uses: { max: 1, recharge: 'longRest' }, actionType: 'bonusAction', description: 'One creature within 5 ft. regains 2d8 + spell level Hit Points.', damage: [{ dice: '2d8', bonus: 'slot', type: 'healing' }] },
    ],
  }),
  insect('centipede', [{ name: 'Venomous Spew', actionType: 'bonusAction', description: 'One creature within 10 ft.: Constitution save or Poisoned until the start of the insect’s next turn.', save: { ability: 'con', dc: 'spellDc' } }], false),
  insect('spider', [{ name: 'Web Bolt', actionType: 'action', description: 'Ranged spell attack, range 60 ft. On a hit the target’s Speed is 0 until the start of the insect’s next turn.', attack: { bonus: 'spellAttack', range: 'range 60 ft.' }, damage: [{ dice: '1d10', bonus: '3 + slot', type: 'bludgeoning' }] }], false),
  insect('wasp', [], true),
  scaled('creature-draconic-spirit', 'Draconic Spirit', 'Large Dragon from Summon Dragon; scales with the spell level.', {
    size: 'Large', creatureType: 'dragon', cr: 0, ac: '14 + slot', hp: '50 + 10 * (slot - 5)',
    speed: { walk: 30, fly: 60, swim: 30 },
    scores: { str: 19, dex: 14, con: 17, int: 10, wis: 14, cha: 14 },
    resistances: ['acid', 'cold', 'fire', 'lightning', 'poison'], conditionImmunities: ['charmed', 'frightened', 'poisoned'],
    senses: { blindsight: 30, darkvision: 60 }, passivePerception: 12, languages: 'Draconic and the languages you know',
    traits: [{ name: 'Shared Resistances', description: 'You share its @choice Resistance until the spell ends.' }],
    actions: [
      { name: 'Multiattack', actionType: 'action', description: 'Rend attacks equal to half the spell’s level (round down), and it uses Breath Weapon.' },
      { name: 'Rend', actionType: 'action', description: 'Melee spell attack, reach 10 ft.', attack: { bonus: 'spellAttack', range: 'reach 10 ft.' }, damage: [{ dice: '1d6', bonus: '4 + slot', type: 'piercing' }] },
      { name: 'Breath Weapon', actionType: 'action', description: '30-ft Cone, Dexterity save: 2d6 @choice damage, half on a success.', save: { ability: 'dex', dc: 'spellDc' }, damage: [{ dice: '2d6', bonus: 0, type: '@choice' }] },
    ],
  }),
]

export const companions: ClassOverlay = {
  entities: { '2024': creatures2024 },
  '2014': {
    'find-familiar': { companions: [{ id: 'familiar', kind: 'familiar', creatures: familiars2014, note: 'Celestial, fey or fiend in the chosen form. It can’t attack.' }] },
    'find-steed': { companions: [{ id: 'steed', kind: 'steed', creatures: steeds2014, note: 'Celestial, fey or fiend; Intelligence at least 6.' }] },
    'conjure-animals': { companions: [{ id: 'beasts', kind: 'summon', filter: { creatureType: 'beast', maxCr: 2 }, note: 'One CR 2, two CR 1, four CR 1/2 or eight CR 1/4 beasts (more with higher slots).' }] },
    'animate-dead': { companions: [{ id: 'undead', kind: 'summon', creatures: ['creature-skeleton', 'creature-zombie'], note: 'Command them with a Bonus Action; control lasts 24 hours.' }] },
  },
  '2024': {
    'find-familiar': { companions: [{ id: 'familiar', kind: 'familiar', filter: { creatureType: 'beast', maxCr: 0 }, note: 'Celestial, Fey or Fiend in the chosen form. It can’t attack.' }] },
    'find-steed': { companions: [{ id: 'steed', kind: 'steed', creatures: ['creature-otherworldly-steed'], slot: true, note: 'Shares your Initiative; a controlled mount while you ride it.' }] },
    'giant-insect': { companions: [{ id: 'insect', kind: 'summon', creatures: ['centipede', 'spider', 'wasp'].map((f) => `creature-giant-insect-${f}`), slot: true }] },
    'summon-dragon': { companions: [{ id: 'dragon', kind: 'summon', creatures: ['creature-draconic-spirit'], slot: true, choose: { label: 'Shared resistance (breath damage type)', options: ['acid', 'cold', 'fire', 'lightning', 'poison'], shareResistance: true } }] },
    'animate-dead': { companions: [{ id: 'undead', kind: 'summon', creatures: ['creature-skeleton', 'creature-zombie'], note: 'Command them with a Bonus Action; control lasts 24 hours.' }] },
  },
}
