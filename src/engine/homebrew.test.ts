// Homebrew pack import: readable errors.
import { describe, expect, it } from 'vitest'
import { ContentIndex } from '../content'
import { computeSheet } from './derive'
import { makeCharacter, packOf, srd } from './fixtures'
import { checkEntity, HOMEBREW_TYPES, homebrewKind, newEntity, newPack, parsePackFile, stampChanges } from './homebrew'

describe('Import errors', () => {
  it('name the entity and the field, using its own type’s rules', () => {
    const r = parsePackFile(JSON.stringify({ id: 'p', name: 'P', edition: '2024', book: 'homebrew:p', entities: [
      { id: 'x', edition: '2024', name: 'Bad Bolt', type: 'spell', source: { book: 'homebrew:p' }, level: 'three', school: 'evocation', castingTime: '1 action', actionType: 'action', range: '60 ft', components: ['V'], duration: 'Instant', concentration: false, ritual: false },
    ] }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors[0]).toMatch(/^#1 Bad Bolt \(spell\): level:/)
    expect(r.errors.some((e) => /^#1 .*: (kind|class|subclass)/.test(e))).toBe(false)
  })

  it('says when the file isn’t JSON', () => {
    const r = parsePackFile('{ nope')
    expect(!r.ok && r.notJson).toBe(true)
  })
})

describe('Homebrew change stamps', () => {
  it('only changed entities get a new updatedAt', () => {
    const p = newPack('2024', 'P')
    const a = { id: 'a', edition: '2024', name: 'A', type: 'feature', source: { book: p.book } } as never
    const b = { id: 'b', edition: '2024', name: 'B', type: 'feature', source: { book: p.book }, updatedAt: 5 } as never
    const prev = { ...p, entities: [a, b] }
    const next = stampChanges({ ...p, entities: [{ ...(a as object), name: 'A2' } as never, b] }, prev, 100)
    expect(next.entities.map((e) => e.updatedAt)).toEqual([100, 5])
  })
})

describe('New homebrew entities', () => {
  it.each(HOMEBREW_TYPES)('a new %s is valid', (type) => {
    const p = newPack('2024', 'P')
    const e = newEntity(p, type, 'Thing')
    expect(checkEntity(e).ok).toBe(true)
    expect(homebrewKind(e)).toBe(type)
  })

  it('a homebrew class with a copied spell table gives slots on the sheet', () => {
    const p = newPack('2024', 'P')
    const content0 = srd('2024')
    const wizard = content0.require('wizard', 'class')
    const cls = newEntity(p, 'class', 'Rune Scribe', { spellcasting: 'full', caster: wizard.caster, spellTable: wizard.spellTable, hitDie: 6 })
    const content = new ContentIndex('2024', [packOf('2024'), { ...p, entities: [cls] }])
    const c = makeCharacter({ edition: '2024', classes: [{ classId: cls.id, level: 3 }], speciesId: 'human', backgroundId: 'soldier' })
    const s = computeSheet(c, content)
    expect(s.spellcasting.slots.map((x) => x.max)).toEqual([4, 2])
  })
})
