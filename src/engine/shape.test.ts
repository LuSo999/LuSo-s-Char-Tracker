// Wild Shape forms and companions (familiars, steeds, summons) from SRD data.
import { describe, expect, it } from 'vitest'
import type { ActionResult } from './actions'
import { takeDamage } from './actions'
import type { CharacterInput } from './character'
import { eligibleShapes, grantCreatures, viewCreature } from './creatures'
import { computeSheet } from './derive'
import { makeCharacter, srd } from './fixtures'
import { longRest } from './rest'
import { addCompanion, adjustCompanionHp, endShape, startShape } from './shape'

const c24 = srd('2024')
const c14 = srd('2014')
const okR = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error)
  return r.character
}
const hero = (edition: '2014' | '2024', classId: string, level: number, extra: Partial<CharacterInput> = {}) =>
  makeCharacter({
    edition,
    classes: [{ classId, level }],
    speciesId: 'human',
    backgroundId: edition === '2024' ? 'soldier' : 'acolyte',
    baseScores: { str: 10, dex: 14, con: 14, int: 8, wis: 16, cha: 10 },
    hp: { current: 20 },
    ...extra,
  })

describe('Wild Shape', () => {
  it('2024: limits by Druid level (CR, Fly, known forms)', () => {
    expect(computeSheet(hero('2024', 'druid', 2), c24).shapeRules).toEqual({ maxCr: 0.25, fly: false, swim: true, forms: 4 })
    expect(computeSheet(hero('2024', 'druid', 8), c24).shapeRules).toEqual({ maxCr: 1, fly: true, swim: true, forms: 8 })
    const forms = eligibleShapes(c24, computeSheet(hero('2024', 'druid', 2), c24).shapeRules!)
    expect(forms.some((c) => c.name === 'Wolf')).toBe(true)
    expect(forms.some((c) => 'fly' in c.speed)).toBe(false)
  })

  it('2014: no swimming forms below level 4', () => {
    expect(computeSheet(hero('2014', 'druid', 2), c14).shapeRules).toEqual({ maxCr: 0.25, fly: false, swim: false, forms: undefined })
    expect(computeSheet(hero('2014', 'druid', 4), c14).shapeRules?.swim).toBe(true)
    expect(computeSheet(hero('2014', 'wizard', 4), c14).shapeRules).toBeUndefined()
  })

  it('2024: the beast replaces Str/Dex/Con, AC, Speed and attacks; Wis stays', () => {
    const c = okR(startShape(hero('2024', 'druid', 4), c24, 'creature-wolf'))
    const s = computeSheet(c, c24)
    // Your own HP maximum stays (the wolf's Constitution doesn't change it).
    expect(s.hpMax.value).toBe(computeSheet(hero('2024', 'druid', 4), c24).hpMax.value)
    expect(s.scores.str.value).toBe(14)
    expect(s.scores.wis.value).toBe(16)
    expect(s.ac.value).toBe(12)
    expect(s.speed.value).toBe(40)
    expect(s.attacks).toHaveLength(0)
    expect(s.shape?.actions.find((a) => a.name === 'Bite')?.attack?.bonus).toBe(4)
    expect(s.shape?.hp).toBeUndefined()
    // Perception: the wolf's +5 beats the druid's own bonus.
    expect(s.skills.perception.value).toBe(5)
    const back = computeSheet(okR(endShape(c, c24)), c24)
    expect(back.speed.value).toBe(30)
  })

  it('2014: damage hits the beast first; at 0 the druid reverts and the rest carries over', () => {
    const c = okR(startShape(hero('2014', 'druid', 2), c14, 'creature-wolf'))
    let s = computeSheet(c, c14)
    expect(s.shape?.hp).toEqual({ current: 11, max: 11 })
    const hit = okR(takeDamage(c, s, 5))
    expect(computeSheet(hit, c14).shape?.hp?.current).toBe(6)
    expect(hit.hp.current).toBe(20)
    s = computeSheet(hit, c14)
    const big = okR(takeDamage(hit, s, 10))
    expect(big.shape).toBeUndefined()
    expect(big.hp.current).toBe(16)
  })

  it('rests end the form', () => {
    const c = okR(startShape(hero('2024', 'druid', 2), c24, 'creature-wolf'))
    expect(longRest(c, c24).character.shape).toBeUndefined()
  })
})

describe('Companions', () => {
  it('every companion grant points at existing creatures', () => {
    for (const content of [c14, c24]) {
      for (const type of ['feature', 'spell'] as const) {
        for (const e of content.all(type)) for (const g of e.companions) expect(grantCreatures(g, content).length, `${e.id}/${g.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('2014 Find Familiar: the known spell offers the familiar forms; an owl at full HP', () => {
    const c = hero('2014', 'wizard', 1, { spells: { wizard: { known: ['find-familiar'], prepared: ['find-familiar'] } } })
    const s = computeSheet(c, c14)
    const source = s.companionSources.find((x) => x.grant.id === 'familiar')!
    expect(grantCreatures(source.grant, c14).map((x) => x.name)).toContain('Owl')
    const withOwl = okR(addCompanion(c, s, c14, source, 'creature-owl'))
    const owl = computeSheet(withOwl, c14).companions[0]
    expect(owl.hpMax).toBe(1)
    expect(owl.entry.hp).toBe(1)
    // A second familiar replaces the first.
    const withCat = okR(addCompanion(withOwl, computeSheet(withOwl, c14), c14, source, 'creature-cat'))
    expect(withCat.companions.map((x) => x.creatureId)).toEqual(['creature-cat'])
  })

  it('2024 Find Steed scales with the spell slot and uses your spell attack', () => {
    const c = hero('2024', 'paladin', 5)
    const s = computeSheet(c, c24)
    const source = s.companionSources.find((x) => x.grant.id === 'steed')!
    const steed2 = computeSheet(okR(addCompanion(c, s, c24, source, 'creature-otherworldly-steed', 2)), c24).companions[0]
    expect(steed2.ac).toBe(12)
    expect(steed2.hpMax).toBe(25)
    expect(steed2.speeds.fly).toBeUndefined()
    expect(steed2.actions[0].attack?.bonus).toBe(source.spellAttack)
    expect(steed2.actions[0].damage).toBe('1d8+2 radiant')
    const steed4 = computeSheet(okR(addCompanion(c, s, c24, source, 'creature-otherworldly-steed', 4)), c24).companions[0]
    expect(steed4.speeds.fly).toBe(60)
  })

  it('companion damage eats temporary HP first', () => {
    const c = hero('2014', 'wizard', 1, { companions: [{ uid: 'x', creatureId: 'creature-cat', sourceId: 'find-familiar', grantId: 'familiar', hp: 2, tempHp: 1 }] })
    const after = okR(adjustCompanionHp(c, 'x', 2, -2, 'Cat'))
    expect(after.companions[0]).toMatchObject({ hp: 1, tempHp: 0 })
  })
})

describe('Stat block adjustments and extra forms', () => {
  it('a grant can add pb to AC, attacks and damage and set an HP minimum (2014 Ranger’s Companion)', () => {
    const wolf = c14.getTyped('creature-wolf', 'creature')!
    const v = viewCreature(wolf, { pb: 3, level: 5 }, { ac: 'pb', attack: 'pb', damage: 'pb', hpMin: '4 * level' })
    expect(v.ac).toBe(13 + 3)
    expect(v.hpMax).toBe(20)
    expect(v.actions[0].attack?.bonus).toBe(4 + 3)
    expect(v.actions[0].damage).toBe('2d4+5 piercing')
  })

  it('shape:creature:<id> adds a form outside the CR and beast limits (Elemental Wild Shape)', () => {
    const shapes = eligibleShapes(c14, { maxCr: 0.25, fly: false, swim: false, extra: ['creature-air-elemental'] })
    expect(shapes.some((c) => c.id === 'creature-air-elemental')).toBe(true)
  })
})

describe('Formula stat blocks', () => {
  it('scaling damage dice, formula saves, per-die HP and arrival temp HP', () => {
    const wolf = c14.getTyped('creature-wolf', 'creature')!
    const drake = { ...wolf, saves: { dex: '1 + pb' }, actions: [{ ...wolf.actions[0], damage: [{ dice: { count: { byLevel: { 3: 1, 7: 2 } }, die: 6 }, bonus: 'pb', type: 'acid' }] }] }
    const v = viewCreature(drake, { pb: 3, classLevel: 7, level: 7 }, { hpPerDie: 2, tempHp: 'floor(level / 2)' })
    expect(v.saves.dex).toBe(4)
    expect(v.actions[0].damage).toBe('2d6+3 acid')
    expect(v.hpMax).toBe(11 + 2 * 2)
    expect(v.tempHp).toBe(3)
  })
})
