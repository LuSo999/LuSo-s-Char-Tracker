// Rules glossary for Ctrl+hover / Ctrl+click on terms of the sheet (Ritual,
// Concentration, Bonus Action, AC…). Short explanations written for this app
// from the SRD 5.2.1 / 5.1 rules (CC-BY-4.0). Links go to the free rules on
// D&D Beyond (2024: Rules Glossary, 2014: Basic Rules), checked to exist.

const G24 = 'https://www.dndbeyond.com/sources/dnd/free-rules/rules-glossary#'
const B14 = 'https://www.dndbeyond.com/sources/dnd/basic-rules-2014/'

type Term = {
  id: string
  name: string
  /** Same text for both editions, or one per edition. */
  text: string | { '2014': string; '2024': string }
  url: { '2014'?: string; '2024'?: string }
  /** Name in 2014 if it differs. */
  name2014?: string
}

export const glossary: Term[] = [
  {
    id: 'ritual',
    name: 'Ritual',
    text: {
      '2024': 'A spell with the Ritual tag can be cast as a ritual: it takes 10 minutes longer than normal and uses no spell slot. You must have the spell prepared (a Wizard can cast rituals straight from the spellbook). It can’t be cast at a higher level this way.',
      '2014': 'A spell with the ritual tag can be cast as a ritual: it takes 10 minutes longer and uses no spell slot, so it can’t be cast at a higher level. You need a feature that allows rituals (Cleric, Druid, Bard: prepared/known spells; Wizard: any ritual in the spellbook).',
    },
    url: { '2024': `${G24}Ritual`, '2014': `${B14}spellcasting#Rituals` },
  },
  {
    id: 'concentration',
    name: 'Concentration',
    text: {
      '2024': 'Some spells last only while you concentrate. It ends if you cast another Concentration spell, have the Incapacitated condition or die. When you take damage, make a Constitution save, DC 10 or half the damage (round down), whichever is higher, max DC 30 — on a failure the spell ends.',
      '2014': 'Some spells last only while you concentrate. It ends if you cast another concentration spell, are incapacitated or killed. When you take damage, make a Constitution save, DC 10 or half the damage, whichever is higher — on a failure the spell ends.',
    },
    url: { '2024': `${G24}Concentration`, '2014': `${B14}spellcasting#Concentration` },
  },
  {
    id: 'cantrip',
    name: 'Cantrip',
    text: 'A level 0 spell: cast at will, without a spell slot. Damage cantrips get stronger at character levels 5, 11 and 17.',
    url: { '2024': `${G24}Cantrip`, '2014': `${B14}spellcasting#Cantrips` },
  },
  {
    id: 'spell-slots',
    name: 'Spell Slots',
    text: 'Casting a spell of level 1 or higher expends a slot of that level or higher. A higher slot casts the spell at that level, often with a bigger effect (“Using a Higher-Level Spell Slot”). Slots come back on a Long Rest (Warlock Pact slots also on a Short Rest).',
    url: { '2024': `${G24}Spell`, '2014': `${B14}spellcasting#SpellSlots` },
  },
  {
    id: 'spell-attack',
    name: 'Spell Attack',
    text: 'An attack roll made with a spell: d20 + your spellcasting ability modifier + Proficiency Bonus. A ranged spell attack has Disadvantage while an enemy is within 5 feet of you.',
    url: { '2024': `${G24}SpellAttack`, '2014': `${B14}spellcasting#AttackRolls` },
  },
  {
    id: 'saving-throw',
    name: 'Saving Throw',
    text: 'A d20 roll to resist a spell, trap or other effect: d20 + the ability modifier (+ Proficiency Bonus if proficient) against a DC. Spell save DC = 8 + spellcasting ability modifier + Proficiency Bonus.',
    url: { '2024': `${G24}SavingThrow`, '2014': `${B14}using-ability-scores#SavingThrows` },
  },
  {
    id: 'action',
    name: 'Action',
    text: {
      '2024': 'On your turn you can take one action: Attack, Dash, Disengage, Dodge, Help, Hide, Influence, Magic, Ready, Search, Study or Utilize.',
      '2014': 'On your turn you can take one action: Attack, Cast a Spell, Dash, Disengage, Dodge, Help, Hide, Ready, Search or Use an Object.',
    },
    url: { '2024': `${G24}Action`, '2014': `${B14}combat#ActionsinCombat` },
  },
  {
    id: 'bonus-action',
    name: 'Bonus Action',
    text: 'An extra action you get only from a feature or spell that says so (Healing Word, Second Wind, off-hand attack…). One per turn, and you choose when to take it during your turn.',
    url: { '2024': `${G24}BonusAction`, '2014': `${B14}combat#BonusActions` },
  },
  {
    id: 'reaction',
    name: 'Reaction',
    text: 'An instant response to a trigger, on your turn or someone else’s — an Opportunity Attack, Shield, Counterspell. One per round: you get it back at the start of your turn.',
    url: { '2024': `${G24}Reaction`, '2014': `${B14}combat#Reactions` },
  },
  {
    id: 'magic-action',
    name: 'Magic Action',
    text: {
      '2024': 'The action used to cast a spell with a casting time of an action, use a magic item or a magical feature.',
      '2014': 'In 2014 rules this is the Cast a Spell or Use an Object action (magic items).',
    },
    url: { '2024': `${G24}MagicAction`, '2014': `${B14}combat#CastaSpell` },
  },
  {
    id: 'attack-action',
    name: 'Attack Action',
    text: 'One attack with a weapon or an Unarmed Strike (more with Extra Attack). You can move between the attacks.',
    url: { '2024': `${G24}AttackAction`, '2014': `${B14}combat#Attack` },
  },
  {
    id: 'opportunity-attack',
    name: 'Opportunity Attack',
    text: 'When a creature you can see leaves your reach, you can use your Reaction to make one melee attack against it. Disengage and teleporting avoid it.',
    url: { '2024': `${G24}OpportunityAttacks`, '2014': `${B14}combat#OpportunityAttacks` },
  },
  {
    id: 'advantage',
    name: 'Advantage',
    text: 'Roll two d20s and use the higher. Advantage and Disadvantage cancel out, however many of each you have.',
    url: { '2024': `${G24}Advantage`, '2014': `${B14}using-ability-scores#AdvantageandDisadvantage` },
  },
  {
    id: 'disadvantage',
    name: 'Disadvantage',
    text: 'Roll two d20s and use the lower. Advantage and Disadvantage cancel out, however many of each you have.',
    url: { '2024': `${G24}Disadvantage`, '2014': `${B14}using-ability-scores#AdvantageandDisadvantage` },
  },
  {
    id: 'critical-hit',
    name: 'Critical Hit',
    text: {
      '2024': 'A 20 on the d20 of an attack roll hits regardless of AC, and the attack’s damage dice are rolled twice (modifiers once).',
      '2014': 'A 20 on the d20 of an attack roll hits regardless of AC, and all the attack’s damage dice are rolled twice (modifiers once).',
    },
    url: { '2024': `${G24}CriticalHit`, '2014': `${B14}combat#CriticalHits` },
  },
  {
    id: 'armor-class',
    name: 'Armor Class',
    text: 'How hard you are to hit: an attack roll hits if it equals or beats your AC. Unarmored: 10 + Dex modifier; armor, a Shield and features change it.',
    url: { '2024': `${G24}ArmorClass`, '2014': `${B14}using-ability-scores#ArmorClass` },
  },
  {
    id: 'initiative',
    name: 'Initiative',
    text: 'At the start of combat everyone rolls a Dexterity check (d20 + Dex modifier + bonuses); turns go from highest to lowest.',
    url: { '2024': `${G24}Initiative`, '2014': `${B14}combat#Initiative` },
  },
  {
    id: 'speed',
    name: 'Speed',
    text: 'How far you can move on your turn, in feet. Difficult Terrain costs 1 extra foot per foot; the Dash action adds your Speed again.',
    url: { '2024': `${G24}Speed`, '2014': `${B14}adventuring#Speed` },
  },
  {
    id: 'hit-points',
    name: 'Hit Points',
    text: 'Damage lowers your HP; at 0 HP you fall Unconscious and make Death Saving Throws (damage of your HP maximum or more left over kills outright). Healing can’t exceed the maximum.',
    url: { '2024': `${G24}HitPoints`, '2014': `${B14}combat#HitPoints` },
  },
  {
    id: 'temporary-hit-points',
    name: 'Temporary Hit Points',
    text: 'A buffer lost before your real HP. They don’t stack — take the higher amount — and healing doesn’t restore them. They last until used up or you finish a Long Rest.',
    url: { '2024': `${G24}TemporaryHitPoints`, '2014': `${B14}combat#TemporaryHitPoints` },
  },
  {
    id: 'death-saving-throw',
    name: 'Death Saving Throw',
    text: {
      '2024': 'At 0 HP, roll a d20 at the start of each turn: 10+ is a success, lower a failure. 3 successes: Stable; 3 failures: dead. A 20 brings you back with 1 HP, a 1 counts as two failures; damage at 0 HP is a failure (a Critical Hit two).',
      '2014': 'At 0 HP, roll a d20 at the start of each turn: 10+ is a success, lower a failure. 3 successes: stable; 3 failures: dead. A 20 brings you back with 1 HP, a 1 counts as two failures; damage at 0 HP is a failure (a critical hit two).',
    },
    url: { '2024': `${G24}DeathSavingThrow`, '2014': `${B14}combat#DeathSavingThrows` },
  },
  {
    id: 'hit-point-dice',
    name: 'Hit Point Dice',
    name2014: 'Hit Dice',
    text: {
      '2024': 'One die per level, by class. On a Short Rest, spend any number: roll each + Con modifier and regain that many HP. A Long Rest restores all of them.',
      '2014': 'One die per level, by class. On a short rest, spend any number: roll each + Con modifier and regain that many HP. A long rest restores half your total (at least one).',
    },
    url: { '2024': `${G24}HitPointDice`, '2014': `${B14}adventuring#ShortRest` },
  },
  {
    id: 'short-rest',
    name: 'Short Rest',
    text: 'At least 1 hour of light activity. You can spend Hit Point Dice to heal, and some features and Warlock Pact slots come back.',
    url: { '2024': `${G24}ShortRest`, '2014': `${B14}adventuring#ShortRest` },
  },
  {
    id: 'long-rest',
    name: 'Long Rest',
    text: {
      '2024': 'At least 8 hours (sleep + light activity), once per 24 hours. You regain all HP and all Hit Point Dice, spell slots and features come back, and Exhaustion drops by 1.',
      '2014': 'At least 8 hours (sleep + light activity), once per 24 hours. You regain all HP and half your Hit Dice, spell slots and features come back, and exhaustion drops by 1 (with food and drink).',
    },
    url: { '2024': `${G24}LongRest`, '2014': `${B14}adventuring#LongRest` },
  },
  {
    id: 'proficiency-bonus',
    name: 'Proficiency Bonus',
    text: 'Added to attack rolls, checks and saves you are proficient in, and to your spell save DC: +2 at levels 1–4, +3 at 5–8, +4 at 9–12, +5 at 13–16, +6 at 17–20.',
    url: { '2024': `${G24}Proficiency`, '2014': `${B14}using-ability-scores#ProficiencyBonus` },
  },
  {
    id: 'passive-perception',
    name: 'Passive Perception',
    text: '10 + your Wisdom (Perception) modifier (+5 with Advantage, −5 with Disadvantage). The GM uses it to see whether you notice something without looking.',
    url: { '2024': `${G24}PassivePerception`, '2014': `${B14}using-ability-scores#PassiveChecks` },
  },
  {
    id: 'difficult-terrain',
    name: 'Difficult Terrain',
    text: 'Every foot of movement in it costs 1 extra foot.',
    url: { '2024': `${G24}DifficultTerrain`, '2014': `${B14}combat#DifficultTerrain` },
  },
  {
    id: 'attunement',
    name: 'Attunement',
    text: 'Some magic items work only after you spend a Short Rest focused on them. You can be attuned to at most 3 items at once.',
    url: { '2024': `${G24}Attunement` },
  },
  {
    id: 'heroic-inspiration',
    name: 'Heroic Inspiration',
    name2014: 'Inspiration',
    text: {
      '2024': 'If you have it, you can expend it to reroll any one die and use the new roll. You can have only one at a time.',
      '2014': 'Given by the GM; spend it to gain Advantage on one attack roll, saving throw or ability check.',
    },
    url: { '2024': `${G24}HeroicInspiration` },
  },
]
