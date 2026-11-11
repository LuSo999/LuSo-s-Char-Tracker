// Test characters built only from SRD content.
import { readFileSync } from 'node:fs'
import { ContentIndex } from '../content'
import { Pack, type Edition } from '../content/schema'
import { sampleChampion } from '../data/samples'
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

/** The public sample character (SRD stand-in for Valdric). */
export function valdric(overrides: Partial<CharacterInput> = {}): Character {
  return makeCharacter({ ...sampleChampion, name: 'Valdric Greywing', ...overrides })
}
