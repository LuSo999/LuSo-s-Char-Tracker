// Files exchanged with the desktop app: character export and sheet import.
import { describe, expect, it } from 'vitest'
import { Character } from './character'
import { computeSheet } from './derive'
import { CharacterExport, makeCharacterExport, resolveSheetImport, SheetImport } from './exchange'
import { makeCharacter, srd } from './fixtures'

const c24 = srd('2024')

describe('Character export', () => {
  it('carries the character, its values and the catalogue', () => {
    const c = makeCharacter({ name: 'Brom', edition: '2024', classes: [{ classId: 'fighter', level: 3 }], speciesId: 'dwarf', backgroundId: 'soldier', baseScores: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 10 }, hp: { current: 30 } })
    const out = CharacterExport.parse(JSON.parse(JSON.stringify(makeCharacterExport(c, computeSheet(c, c24), c24))))
    expect(out.values['str.score']).toBe('16')
    expect(out.fields.some((f) => f.key === 'skill.athletics.prof')).toBe(true)
    expect(Character.safeParse({ id: 'x', ...out.character }).success).toBe(true)
  })
})

describe('Sheet import', () => {
  it('matches names to content (accents, plurals, case) and reports the rest', () => {
    const data = SheetImport.parse({
      format: 'luso-sheet-import', version: 1, edition: '2024', name: 'Žofie',
      classes: [{ name: 'wizard', level: 5, subclass: 'Evoker' }], species: 'Human', background: 'Sage',
      abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 }, hpMax: 32,
      skills: ['Arcana', 'History', 'Underwater Basket Weaving'], expertise: ['Arcana'],
      cantrips: ['Fire Bolt'], spells: ['Magic Missile', 'Fireball', 'Made-up Spell'],
      items: [{ name: 'Daggers', quantity: 2, equipped: true }, { name: 'Lucky Rock' }], currency: { gp: 42 },
    })
    const { character, report } = resolveSheetImport(data, c24)
    const c = Character.parse({ id: 'x', ...character })
    expect(c.classes[0]).toMatchObject({ classId: 'wizard', level: 5, subclassId: 'evoker' })
    expect(c.spells.wizard.known).toEqual(expect.arrayContaining(['fire-bolt', 'magic-missile', 'fireball']))
    expect(c.inventory[0]).toMatchObject({ itemId: 'dagger', quantity: 2, equipped: true })
    expect(report.unmatched.map((u) => u.name)).toEqual(expect.arrayContaining(['Underwater Basket Weaving', 'Made-up Spell', 'Lucky Rock']))
    expect(c.notes).toContain('Lucky Rock')
    const s = computeSheet(c, c24)
    expect(s.scores.int.value).toBe(18)
    expect(s.skills.arcana.proficiency).toBe(2)
    expect(s.hpMax.value).toBeGreaterThan(0)
  })
})
