// Test characters built only from SRD content.
import { readFileSync } from 'node:fs'
import { ContentIndex } from '../content'
import { Pack, type Edition } from '../content/schema'
import { Character, type CharacterInput } from './character'

const packs = new Map<Edition, Pack>()

export function srd(edition: Edition): ContentIndex {
  if (!packs.has(edition)) {
    const raw = JSON.parse(readFileSync(new URL(`../data/srd/${edition}.json`, import.meta.url), 'utf8'))
    packs.set(edition, Pack.parse(raw))
  }
  return new ContentIndex(edition, [packs.get(edition)!])
}

export function makeCharacter(input: Partial<CharacterInput> & Pick<CharacterInput, 'edition'>): Character {
  return Character.parse({
    id: 'test',
    name: 'Test',
    classes: [{ classId: 'fighter', level: 1 }],
    speciesId: 'human',
    backgroundId: 'acolyte',
    baseScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    hp: { current: 10 },
    ...input,
  })
}

/**
 * Valdric Greywing with SRD-only stand-ins: the real character is a Battle
 * Master with Heavy Armor Master (not in the SRD), so here he is a Champion
 * who took the Ability Score Improvement feat (+1 Str, +1 Dex) at level 4.
 */
export function valdric(overrides: Partial<CharacterInput> = {}): Character {
  return makeCharacter({
    edition: '2024',
    name: 'Valdric Greywing',
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
      { uid: 'javelins', itemId: 'javelin', quantity: 8, equipped: true },
      { uid: 'potion', itemId: 'potion-of-healing', quantity: 2 },
    ],
    ...overrides,
  })
}
