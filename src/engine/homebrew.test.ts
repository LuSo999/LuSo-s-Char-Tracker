// Homebrew pack import: readable errors.
import { describe, expect, it } from 'vitest'
import { newPack, parsePackFile, stampChanges } from './homebrew'

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
