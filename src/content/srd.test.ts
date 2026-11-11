// Integrity checks over the built-in SRD data: every reference resolves.
import { describe, expect, it } from 'vitest'
import { srd } from '../engine/fixtures'
import { evalFormula } from '../engine/formula'
import { editions, type Entity, type Scaled } from './schema'

const formulaVars = {
  athletics: 0,
  pb: 2, level: 1, classLevel: 1, characterLevel: 1,
  str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0,
  strScore: 10, dexScore: 10, conScore: 10, intScore: 10, wisScore: 10, chaScore: 10,
}

function formulas(value: Scaled | undefined): string[] {
  if (value === undefined || typeof value === 'number') return []
  if (typeof value === 'string') return [value]
  return Object.values(value.byLevel).filter((v): v is string => typeof v === 'string')
}

describe.each(editions)('SRD %s', (edition) => {
  const content = srd(edition)
  const entities: Entity[] = [
    ...content.all('class'), ...content.all('subclass'), ...content.all('feature'), ...content.all('feat'),
    ...content.all('species'), ...content.all('subspecies'), ...content.all('background'), ...content.all('trait'),
    ...content.all('item'), ...content.all('spell'), ...content.all('condition'),
  ]

  it('has all 12 classes with 20 levels and a subclass each', () => {
    const classes = content.all('class')
    expect(classes).toHaveLength(12)
    for (const c of classes) {
      expect(c.levels.map((l) => l.level)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
      expect(content.all('subclass').some((s) => s.class === c.id)).toBe(true)
    }
  })

  it('resolves every referenced id', () => {
    const missing: string[] = []
    const check = (id: string | undefined, from: string) => {
      if (id && !content.get(id)) missing.push(`${from} → ${id}`)
    }
    for (const c of content.all('class')) c.levels.forEach((l) => l.features.forEach((f) => check(f, c.id)))
    for (const s of content.all('subclass')) {
      check(s.class, s.id)
      s.levels.forEach((l) => l.features.forEach((f) => check(f, s.id)))
    }
    for (const s of content.all('species')) [...s.traits, ...s.subspecies].forEach((t) => check(t, s.id))
    for (const s of content.all('subspecies')) s.traits.forEach((t) => check(t, s.id))
    for (const b of content.all('background')) [b.feat, ...b.features].forEach((f) => check(f, b.id))
    for (const f of content.all('feature')) check(f.upgradeOf, f.id)
    for (const e of entities) for (const ch of e.choices) ch.from?.ids?.forEach((id) => check(id, `${e.id}/${ch.id}`))
    for (const w of content.all('item')) if (w.kind === 'weapon') check(w.ammunition, w.id)
    expect(missing).toEqual([])
  })

  it('has a resource for every activity cost', () => {
    const resourceIds = new Set(entities.flatMap((e) => e.resources.map((r) => r.id)))
    const missing = entities.flatMap((e) =>
      e.activities.flatMap((a) => a.cost.filter((c) => c.resource !== '@quantity' && !resourceIds.has(c.resource)).map((c) => `${e.id}: ${c.resource}`)),
    )
    expect(missing).toEqual([])
  })

  it('has only valid formulas', () => {
    const bad: string[] = []
    for (const e of entities) {
      const all = [
        ...e.effects.flatMap((x) => formulas(x.value)),
        ...e.resources.flatMap((r) => [...formulas(r.max), ...formulas(r.die)]),
        ...e.activities.flatMap((a) => [...formulas(a.roll?.bonus), ...formulas(a.saveDc)]),
        ...e.choices.flatMap((c) => formulas(c.count)),
      ]
      for (const f of all) {
        try {
          evalFormula(f, formulaVars)
        } catch (err) {
          bad.push(`${e.id}: ${(err as Error).message}`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})
