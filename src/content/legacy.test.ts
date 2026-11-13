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

describe('Legacy species and feats', () => {
  const content = srdBoth('2024')
  it('2014 species, subspecies and feats appear, without ability increases, feats as general', () => {
    const view = content.withLegacySubclasses(false, true)
    expect(view.all('subclass').some((s) => s.id.startsWith('2014:'))).toBe(false)
    const dwarf = view.getTyped('2014:dwarf', 'species')!
    expect(dwarf.name).toBe('Dwarf (2014)')
    expect(dwarf.abilityBonuses).toEqual([])
    expect(dwarf.tags).toContain('legacy-2014')
    const hill = view.getTyped('2014:hill-dwarf', 'subspecies')!
    expect(hill.species).toBe('2014:dwarf')
    const grappler = view.getTyped('2014:grappler', 'feat')!
    expect(grappler.tags).toContain('general')
    expect(grappler.prerequisite?.level).toBe(4)
  })

  it('a 2024 character can be a 2014 Hill Dwarf (traits work, no racial ability bonus)', () => {
    const view = content.withLegacySubclasses(false, true)
    const c = makeCharacter({ edition: '2024', classes: [{ classId: 'fighter', level: 1 }], speciesId: '2014:dwarf', subspeciesId: '2014:hill-dwarf', backgroundId: 'soldier', baseScores: { str: 15, dex: 14, con: 13, int: 10, wis: 10, cha: 8 }, hp: { current: 10 } })
    const s = computeSheet(c, view)
    expect(s.scores.con.value).toBe(13)
    expect(s.resistances).toContain('poison')
    expect(s.hpMax.value).toBe(10 + 1 + 1) // d10 + Con +1 + Dwarven Toughness
  })
})
