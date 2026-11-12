import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Character } from '../../engine/character'
import { computeSheet } from '../../engine/derive'
import { srdBoth } from '../../engine/fixtures'
import { defaultSpellFilters, filterSpells, type SpellFilters } from './spellFilters'

const content = srdBoth('2024')
const c = Character.parse({ id: 'w', ...JSON.parse(readFileSync(new URL('../../../docs/samples/wizard-level-4-2024.json', import.meta.url), 'utf8')) })
const sheet = computeSheet(c, content)
const run = (f: Partial<SpellFilters>, char = c) => filterSpells(sheet.spellcasting.rows, { ...defaultSpellFilters, ...f }, sheet, char.favoriteSpells).map((r) => r.spell.id)

describe('spell filters', () => {
  it('level, action type and kind', () => {
    expect(run({ levels: [0] })).toEqual(expect.arrayContaining(['fire-bolt', 'mage-hand', 'light']))
    expect(run({ actionType: 'reaction' })).toEqual(['spell-shield'])
    expect(run({ actionType: 'bonusAction' })).toEqual(['misty-step'])
    expect(run({ kind: 'attack' })).toEqual(expect.arrayContaining(['fire-bolt', 'ray-of-frost', 'scorching-ray']))
  })

  it('starred, concentration, ritual and source', () => {
    expect(run({ favorites: true }).sort()).toEqual([...c.favoriteSpells].sort())
    expect(run({ concentration: 'yes' })).toEqual(['detect-magic', 'sleep', 'hold-person'])
    expect(run({ ritual: true })).toEqual(expect.arrayContaining(['detect-magic', 'identify', 'find-familiar']))
    expect(run({ source: 'granted' }).sort()).toEqual(['find-familiar', 'light', 'minor-illusion'])
  })

  it('castable now: no level 2 slots left hides level 2 spells (rituals stay)', () => {
    const empty = { ...c, resourcesUsed: { 'slot:2': 3 } }
    const s2 = computeSheet(empty, content)
    const ids = filterSpells(s2.spellcasting.rows, { ...defaultSpellFilters, castable: true, levels: [2] }, s2, []).map((r) => r.spell.id)
    expect(ids).toEqual([])
  })
})
