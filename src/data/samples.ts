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
