// The way back: export values (as read off a filled sheet) → sheet import → character.
import { describe, expect, it } from 'vitest'
import { computeSheet } from '../derive'
import { resolveSheetImport, SheetImport } from '../exchange'
import { makeCharacter, srd } from '../fixtures'
import { importFromValues, parseClasses, parseItem } from './readBack'
import { exportValues } from './values'

const c24 = srd('2024')

describe('Reading a filled sheet back', () => {
  it('parses classes and items as sheets print them', () => {
    expect(parseClasses('Fighter 5 / Wizard 2', 'Champion')).toEqual([{ name: 'Fighter', level: 5, subclass: 'Champion' }, { name: 'Wizard', level: 2 }])
    expect(parseClasses('Cleric (Life) 4')).toEqual([{ name: 'Cleric', level: 4, subclass: 'Life' }])
    expect(parseItem('2× Dagger (equipped)')).toEqual({ name: 'Dagger', quantity: 2, equipped: true })
    expect(parseItem('Arrows (20)')).toEqual({ name: 'Arrows', quantity: 20 })
    expect(parseItem('Rope x2')).toEqual({ name: 'Rope', quantity: 2 })
  })

  it('round-trips a character through its export values', () => {
    const wizard = makeCharacter({
      name: 'Žofie', edition: '2024', classes: [{ classId: 'wizard', level: 5, subclassId: 'evoker' }], speciesId: 'human', backgroundId: 'sage',
      baseScores: { str: 8, dex: 14, con: 14, int: 17, wis: 12, cha: 10 }, hp: { current: 20 },
      inventory: [{ uid: 'a', itemId: 'dagger', quantity: 2, equipped: true }],
      spells: { wizard: { known: ['fire-bolt', 'magic-missile', 'fireball'], prepared: ['magic-missile', 'fireball'] } },
      currency: { cp: 0, sp: 0, ep: 0, gp: 42, pp: 0 },
    })
    const data = SheetImport.parse(importFromValues(exportValues(wizard, computeSheet(wizard, c24), c24), '2024'))
    expect(data.classes).toEqual([{ name: 'Wizard', level: 5, subclass: 'Evoker' }])
    expect(data.abilities.int).toBe(17)
    expect(data.skills).toContain('arcana')
    expect(data.cantrips).toEqual(['Fire Bolt'])
    expect(data.spells.sort()).toEqual(['Fireball', 'Magic Missile'])
    expect(data.items).toEqual([{ name: 'Dagger', quantity: 2, equipped: true }])
    const { character, report } = resolveSheetImport(data, c24)
    expect(character.classes[0]).toMatchObject({ classId: 'wizard', level: 5, subclassId: 'evoker' })
    expect(character.inventory?.[0]).toMatchObject({ itemId: 'dagger', quantity: 2 })
    expect(report.unmatched).toEqual([])
  })
})
