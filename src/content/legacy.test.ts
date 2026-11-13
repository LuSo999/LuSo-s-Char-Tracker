// 2014 subclasses for 2024 characters.
import { describe, expect, it } from 'vitest'
import { computeSheet } from '../engine/derive'
import { makeCharacter, srdBoth } from '../engine/fixtures'

describe('Legacy subclasses', () => {
  const content = srdBoth('2024')
  it('2014 subclasses appear only in the legacy view, renamed and at level 3+', () => {
    expect(content.all('subclass').some((s) => s.id.startsWith('2014:'))).toBe(false)
    const view = content.withLegacySubclasses(true)
    const life = view.getTyped('2014:life', 'subclass')!
    expect(life.name).toBe('Life (2014)')
    expect(Math.min(...life.levels.map((l) => l.level))).toBe(3)
    expect(view.all('subclass').filter((s) => s.id.startsWith('2014:')).length).toBe(12)
  })

  it('a 2024 Monk with Way of the Open Hand (2014) spends Focus Points', () => {
    const view = content.withLegacySubclasses(true)
    const c = makeCharacter({ edition: '2024', classes: [{ classId: 'monk', level: 6, subclassId: '2014:open-hand' }], speciesId: 'human', backgroundId: 'soldier', baseScores: { str: 10, dex: 16, con: 14, int: 10, wis: 16, cha: 8 }, hp: { current: 40 } })
    const s = computeSheet(c, view)
    expect(s.active.some((a) => a.entity.id.startsWith('2014:'))).toBe(true)
    for (const a of s.activities.filter((x) => x.source.entity.id.startsWith('2014:'))) for (const cost of a.costs) expect(cost.resourceKey).not.toBe('ki')
  })
})
