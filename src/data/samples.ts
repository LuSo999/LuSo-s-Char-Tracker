// Sample characters built only from SRD content (safe for the public repo).
import type { CharacterInput } from '../engine/character'

/** A 2024 Goliath Champion, level 4 — Valdric's build with SRD-only choices. */
export const sampleChampion: Omit<CharacterInput, 'id'> = {
  name: 'Sample: Goliath Champion',
  edition: '2024',
  classes: [{ classId: 'fighter', level: 4, subclassId: 'champion' }],
  speciesId: 'goliath',
  subspeciesId: 'giant-ancestry-stones-endurance',
  backgroundId: 'sage',
  baseScores: { str: 15, dex: 14, con: 16, int: 13, wis: 16, cha: 9 },
  backgroundBonuses: { con: 2, wis: 1 },
  choices: {
    'fighter/skills': ['athletics', 'perception'],
    'fighter-fighting-style/feat': ['defense'],
    'fighter-weapon-mastery/weapons': ['flail', 'greatsword', 'javelin', 'quarterstaff'],
    'fighter-ability-score-improvement@fighter:4/feat': ['ability-score-improvement'],
    'fighter-ability-score-improvement@fighter:4/feat=ability-score-improvement/asi': ['str+1', 'dex+1'],
    'sage/feat/cantrips': ['mage-hand', 'prestidigitation'],
    'sage/feat/spell': ['find-familiar'],
    'sage/feat/ability': ['int'],
  },
  hp: { current: 44 },
  inventory: [
    { uid: 'armor', itemId: 'chain-mail', equipped: true },
    { uid: 'shield', itemId: 'shield', equipped: true },
    { uid: 'flail', itemId: 'flail', equipped: true },
    { uid: 'greatsword', itemId: 'greatsword', equipped: true },
    { uid: 'javelins', itemId: 'javelin', quantity: 8, equipped: true },
    { uid: 'quarterstaff', itemId: 'quarterstaff', equipped: true },
    { uid: 'potion', itemId: 'potion-of-healing', quantity: 2 },
    { uid: 'pack', itemId: 'dungeoneer-pack' },
  ],
  currency: { cp: 0, sp: 0, ep: 0, gp: 2, pp: 0 },
}

/** A 2024 Elf Wizard (Evoker), level 5 — the spellcasting reference character. */
export const sampleWizard: Omit<CharacterInput, 'id'> = {
  name: 'Sample: Elf Wizard',
  edition: '2024',
  classes: [{ classId: 'wizard', level: 5, subclassId: 'evoker' }],
  speciesId: 'elf',
  subspeciesId: 'elven-lineage-high-elf',
  backgroundId: 'sage',
  baseScores: { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 },
  backgroundBonuses: { int: 2, con: 1 },
  choices: {
    'wizard/skills': ['arcana', 'investigation'],
    'wizard-scholar/skill': ['arcana'],
    'wizard-ability-score-improvement@wizard:4/feat': ['ability-score-improvement'],
    'wizard-ability-score-improvement@wizard:4/feat=ability-score-improvement/asi': ['int+1', 'dex+1'],
    'sage/feat/cantrips': ['light', 'minor-illusion'],
    'sage/feat/spell': ['find-familiar'],
    'sage/feat/ability': ['int'],
  },
  hp: { current: 32 },
  favoriteSpells: ['fire-bolt', 'magic-missile', 'spell-shield', 'misty-step', 'fireball', 'counterspell'],
  spells: {
    wizard: {
      known: ['fire-bolt', 'mage-hand', 'ray-of-frost', 'prestidigitation', 'magic-missile', 'spell-shield', 'detect-magic', 'sleep', 'misty-step', 'hold-person', 'fireball', 'counterspell', 'identify'],
      prepared: ['magic-missile', 'spell-shield', 'sleep', 'misty-step', 'hold-person', 'fireball', 'counterspell'],
    },
  },
  inventory: [
    { uid: 'staff', itemId: 'quarterstaff', equipped: true },
    { uid: 'dagger', itemId: 'dagger', quantity: 2, equipped: true },
  ],
  currency: { cp: 0, sp: 0, ep: 0, gp: 15, pp: 0 },
}
